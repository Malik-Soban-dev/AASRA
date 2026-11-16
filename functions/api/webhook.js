/**
 * POST /api/webhook
 *
 * Payment webhook from the gateway (Safepay primary).
 *
 * Rules (per brief section 5):
 *  - Verify signature on the RAW request body (X-SFPY-SIGNATURE).
 *  - Match tracker_token + amount to a pending payment.
 *  - Idempotent: ignore duplicate webhooks (raw_event_id).
 *  - The browser redirect is informational only; the webhook is the source of truth.
 *  - Mark payment paid, update order state, confirm stock reservation, email customer.
 *  - Ignore unknown events, log failures.
 */

import { verifyWebhookSignature } from '../lib/gateway.js';
import { sendEmail, paymentPaidEmail } from '../lib/email.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Transition order state based on payment kind and current status.
 * Returns { newStatus, eventType, depositStatus, balanceStatus }.
 */
function transitionOrder(order, kind) {
  const depositStatus = order.deposit_status;
  const balanceStatus = order.balance_status;

  if (kind === 'full') {
    // Single payment covers everything
    return {
      newStatus: 'paid',
      eventType: 'payment_paid_full',
      depositStatus: 'paid',
      balanceStatus: 'paid',
    };
  }

  if (kind === 'deposit') {
    if (order.payment_type !== 'deposit') {
      throw new Error('deposit payment on non-deposit order');
    }
    if (depositStatus === 'paid') {
      throw new Error('deposit already paid');
    }
    return {
      newStatus: 'deposit-paid',
      eventType: 'payment_paid_deposit',
      depositStatus: 'paid',
      balanceStatus: 'unpaid', // balance still pending
    };
  }

  if (kind === 'balance') {
    if (order.payment_type !== 'deposit') {
      throw new Error('balance payment on non-deposit order');
    }
    if (depositStatus !== 'paid') {
      throw new Error('balance paid before deposit');
    }
    if (balanceStatus === 'paid') {
      throw new Error('balance already paid');
    }
    return {
      newStatus: 'paid',
      eventType: 'payment_paid_balance',
      depositStatus: 'paid',
      balanceStatus: 'paid',
    };
  }

  throw new Error(`unknown payment kind: ${kind}`);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Read RAW body (signature is over the raw body, not parsed JSON)
  let rawBody;
  try {
    rawBody = await request.text();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'unreadable_body' }, 400);
  }

  // 2. Verify signature
  const signature = request.headers.get('X-SFPY-SIGNATURE') || request.headers.get('x-sfpy-signature');
  if (!(await verifyWebhookSignature(env, rawBody, signature))) {
    return jsonResponse({ ok: false, error: 'invalid_signature' }, 401);
  }

  // 3. Parse payload
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  // 4. Extract webhook fields (VERIFY exact field names with Safepay)
  const eventId = payload.event_id || payload.id || null; // idempotency key
  const eventType = payload.event || payload.type || 'payment.succeeded';
  const data = payload.data || payload.object || payload;

  const trackerToken = data.tracker_token || data.reference || data.checkout_reference || null;
  const amount = data.amount ? Number(data.amount) : null;
  const currency = data.currency || 'PKR';
  const status = data.status || data.payment_status || 'succeeded';
  const orderId = data.order_id || data.merchant_reference || data.reference || null;
  const kind = data.payment_type || data.kind || null; // 'full' | 'deposit' | 'balance'

  // 5. Ignore unknown events
  if (!eventId || !trackerToken || !orderId) {
    return jsonResponse({ ok: true, ignored: true, reason: 'missing_fields' });
  }

  // 6. Idempotency: check if this raw_event_id was already processed
  const existing = await context.env.DB.prepare(
    'SELECT id FROM payments WHERE raw_event_id = ?'
  ).bind(eventId).first();

  if (existing) {
    // Duplicate webhook — acknowledge and ignore
    return jsonResponse({ ok: true, duplicate: true });
  }

  // 7. Match to pending payment
  const payment = await context.env.DB.prepare(
    'SELECT * FROM payments WHERE tracker_token = ? AND status = ?'
  ).bind(trackerToken, 'pending').first();

  if (!payment) {
    // Could be an already-paid payment (duplicate) or unknown tracker
    const alreadyPaid = await context.env.DB.prepare(
      'SELECT id FROM payments WHERE tracker_token = ? AND status = ?'
    ).bind(trackerToken, 'paid').first();
    if (alreadyPaid) {
      return jsonResponse({ ok: true, duplicate: true });
    }
    return jsonResponse({ ok: false, error: 'no_pending_payment' }, 404);
  }

  // 8. Verify amount matches (never trust browser for amount)
  if (amount !== null && Number(payment.amount) !== amount) {
    return jsonResponse({ ok: false, error: 'amount_mismatch' }, 400);
  }

  // 9. Verify currency
  if (currency !== 'PKR') {
    return jsonResponse({ ok: false, error: 'currency_mismatch' }, 400);
  }

  // 10. Only process successful payments
  if (status !== 'succeeded' && status !== 'paid' && status !== 'completed') {
    // Mark payment failed
    await context.env.DB.prepare(
      "UPDATE payments SET status = 'failed', updated_at = ? WHERE id = ?"
    ).bind(nowIso(), payment.id);
    await createOrderEvent(context.env.DB, payment.order_id, 'payment_failed', {
      kind: payment.kind,
      amount: payment.amount,
      gateway_status: status,
    });
    return jsonResponse({ ok: true, ignored: true, reason: 'payment_not_successful' });
  }

  // 11. Fetch order
  const order = await context.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) {
    return jsonResponse({ ok: false, error: 'order_not_found' }, 404);
  }

  // 12. Transition order state
  let transition;
  try {
    transition = transitionOrder(order, kind);
  } catch (e) {
    return jsonResponse({ ok: false, error: e.message }, 400);
  }

  const now = nowIso();

  // 13. Update payment record (mark paid, record idempotency id)
  await context.env.DB.prepare(
    `UPDATE payments SET status = 'paid', raw_event_id = ?, updated_at = ? WHERE id = ?`
  ).bind(eventId, now, payment.id);

  // 14. Update order state
  await context.env.DB.prepare(
    `UPDATE orders SET
       status = ?, deposit_status = ?, balance_status = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    transition.newStatus,
    transition.depositStatus,
    transition.balanceStatus,
    now,
    orderId
  );

  // 15. Confirm stock reservations (active → confirmed)
  await context.env.DB.prepare(
    "UPDATE reservations SET status = 'confirmed' WHERE order_id = ? AND status = 'active'"
  ).bind(orderId);

  // 16. Log events
  await createOrderEvent(context.env.DB, orderId, transition.eventType, {
    kind: payment.kind,
    amount: payment.amount,
    tracker: trackerToken,
    new_status: transition.newStatus,
  });

  // 17. Email customer
  try {
    const baseUrl = env.PUBLIC_BASE_URL || 'https://aasra.shop';
    await sendEmail(env, {
      to: order.email,
      ...paymentPaidEmail({ order, kind: payment.kind, amount: payment.amount, env }),
    });
  } catch (e) {
    // Email failure must not fail the webhook; log and continue.
    console.warn('[WEBHOOK] email failed', orderId, e.message);
    await createOrderEvent(context.env.DB, orderId, 'email_failed', { kind: payment.kind, error: e.message });
  }

  // 18. If paid in full, could trigger packing workflow here (out of scope v1)
  if (transition.newStatus === 'paid') {
    await createOrderEvent(context.env.DB, orderId, 'order_paid_in_full', {});
  }

  return jsonResponse({ ok: true, order_id: orderId, status: transition.newStatus });
}

async function createOrderEvent(db, orderId, type, details = null) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await db.prepare(
      'INSERT INTO order_events (id, order_id, type, details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, orderId, type, details ? JSON.stringify(details) : null, new Date().toISOString());
  } catch (e) {
    console.warn('[ORDER_EVENT] failed', type, e.message);
  }
}
