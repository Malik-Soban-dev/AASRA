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
 *
 * Event names accepted (Safepay endpoint configurations differ):
 *  payment.succeeded | payment.paid | payment:created
 * Amounts may be reported in rupees or paisa; both are accepted and must match
 * exactly one interpretation of the pending payment amount.
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

function amountMatches(paymentAmount, reported) {
  const pending = Number(paymentAmount);
  const seen = Number(reported);
  return seen === pending || seen === pending * 100; // rupees or paisa
}

/**
 * Transition order state based on payment kind and current status.
 * Returns { newStatus, eventType, depositStatus, balanceStatus }.
 */
function transitionOrder(order, kind) {
  const depositStatus = order.deposit_status;
  const balanceStatus = order.balance_status;

  if (kind === 'full') {
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

/**
 * Shared, idempotent payment settlement — used by the webhook AND by the
 * HMAC-signed server-to-server payment return (/api/safepay/return).
 * Every caller must have authenticated the payload before invoking this.
 *
 * @returns {{status: number, body: object}}
 */
export async function processPayment(env, db, { eventId, trackerToken, orderId, amount, kind }) {
  const idempotencyId = eventId || `sf-return-${trackerToken}`;

  // Idempotency: already processed?
  const existing = await db
    .prepare('SELECT id FROM payments WHERE raw_event_id = ?')
    .bind(idempotencyId)
    .first();
  if (existing) return { status: 200, body: { ok: true, duplicate: true } };

  // Match to pending payment by tracker token (the trusted mapping).
  const payment = await db
    .prepare('SELECT * FROM payments WHERE tracker_token = ? AND status = ?')
    .bind(trackerToken, 'pending')
    .first();

  if (!payment) {
    const alreadyPaid = await db
      .prepare('SELECT id FROM payments WHERE tracker_token = ? AND status = ?')
      .bind(trackerToken, 'paid')
      .first();
    if (alreadyPaid) return { status: 200, body: { ok: true, duplicate: true } };
    return { status: 404, body: { ok: false, error: 'no_pending_payment' } };
  }

  // Match every settlement field against our pending payment record.
  if (orderId && payment.order_id !== orderId) return { status: 400, body: { ok: false, error: 'order_mismatch' } };
  if (amount != null && !amountMatches(payment.amount, amount)) {
    return { status: 400, body: { ok: false, error: 'amount_mismatch' } };
  }
  if (kind && kind !== payment.kind) return { status: 400, body: { ok: false, error: 'payment_kind_mismatch' } };

  // Fetch the order using the trusted payment record, not gateway text.
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(payment.order_id).first();
  if (!order) return { status: 404, body: { ok: false, error: 'order_not_found' } };

  let transition;
  try {
    transition = transitionOrder(order, payment.kind);
  } catch (e) {
    return { status: 400, body: { ok: false, error: e.message } };
  }

  const now = nowIso();

  // Update payment record (mark paid, record idempotency id)
  await db
    .prepare('UPDATE payments SET status = ?, raw_event_id = ?, updated_at = ? WHERE id = ?')
    .bind('paid', idempotencyId, now, payment.id);

  // Update order state
  await db
    .prepare(
      `UPDATE orders SET
         status = ?, deposit_status = ?, balance_status = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(transition.newStatus, transition.depositStatus, transition.balanceStatus, now, payment.order_id);

  // Confirm stock reservations (active → confirmed)
  await db
    .prepare("UPDATE reservations SET status = 'confirmed' WHERE order_id = ? AND status = 'active'")
    .bind(payment.order_id);

  // Log events
  await createOrderEvent(db, payment.order_id, transition.eventType, {
    kind: payment.kind,
    amount: payment.amount,
    tracker: trackerToken,
    new_status: transition.newStatus,
  });

  // Email customer
  try {
    await sendEmail(env, {
      to: order.email,
      ...paymentPaidEmail({ order, kind: payment.kind, amount: payment.amount, env }),
    });
  } catch (e) {
    // Email failure must not fail settlement; log and continue.
    console.warn('[WEBHOOK] email failed', payment.order_id, e.message);
    await createOrderEvent(db, payment.order_id, 'email_failed', { kind: payment.kind, error: e.message });
  }

  // If paid in full, could trigger packing workflow here (out of scope v1)
  if (transition.newStatus === 'paid') {
    await createOrderEvent(db, payment.order_id, 'order_paid_in_full', {});
  }

  return { status: 200, body: { ok: true, order_id: payment.order_id, status: transition.newStatus } };
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

  // 4. Extract webhook fields (names vary by Safepay endpoint configuration)
  const data = payload.data || payload.object || payload;
  const eventId = payload.event_id || payload.id || data.event_id || null;
  const eventType = payload.event || payload.type || data.event || data.event_type || null;
  const trackerToken = data.tracker_token || data.tracker || data.reference || data.token || null;
  const amount = data.amount == null ? null : Number(data.amount);
  const currency = data.currency || null;
  const status = data.status || data.payment_status || null;
  const orderId = data.order_id || data.merchant_reference || data.order || null;
  const kind = data.payment_type || data.kind || null;

  if (!eventId || !trackerToken || !orderId || !eventType || !status || amount === null || !Number.isFinite(amount) || !currency) {
    return jsonResponse({ ok: false, error: 'unverified_webhook_contract' }, 400);
  }
  const okEvents = ['payment.succeeded', 'payment.paid', 'payment:created'];
  const okStatuses = ['succeeded', 'paid', 'created', 'completed'];
  if (!okEvents.includes(String(eventType)) || !okStatuses.includes(String(status).toLowerCase())) {
    return jsonResponse({ ok: true, ignored: true, reason: 'payment_not_successful' });
  }
  if (currency !== 'PKR') return jsonResponse({ ok: false, error: 'currency_mismatch' }, 400);

  const result = await processPayment(env, context.env.DB, {
    eventId,
    trackerToken: String(trackerToken),
    orderId: String(orderId),
    amount,
    kind,
  });
  return jsonResponse(result.body, result.status);
}

async function createOrderEvent(db, orderId, type, details = null) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await db
      .prepare('INSERT INTO order_events (id, order_id, type, details, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, orderId, type, details ? JSON.stringify(details) : null, new Date().toISOString());
  } catch (e) {
    console.warn('[ORDER_EVENT] failed', type, e.message);
  }
}
