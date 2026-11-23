/**
 * POST /api/pay-order  { order_id, phone }
 *
 * Lets a customer pay what is still due on their own order, from the lookup page:
 *   - full-payment order that is still pending  -> full order total
 *   - deposit order, deposit paid, balance due   -> balance
 *
 * Auth is the same as order-lookup: order ID + the phone used at checkout.
 * The payment is settled only by the signed webhook (never by this response).
 */

import { createCheckoutSession } from '../lib/gateway.js';
import {
  reserveStock,
  releaseReservations,
  linkReservationsToOrder,
  createOrderEvent,
} from '../lib/stock.js';

// A pending payment younger than this blocks a second session, so one order
// cannot be paid twice by accident (two open checkouts).
const IN_PROGRESS_MINUTES = 30;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function errorResponse(message, status = 400, code) {
  return jsonResponse({ ok: false, error: message, code }, status);
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Same normalisation as order-lookup.js
function normalizePhone(raw) {
  let normalized = String(raw || '').replace(/\s|-|\(|\)|\./g, '');
  if (normalized.startsWith('+92')) normalized = '0' + normalized.slice(3);
  else if (normalized.startsWith('92') && normalized.length === 12) normalized = '0' + normalized.slice(2);
  return normalized;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('invalid_json', 400, 'invalid_json');
  }

  const orderId = String(body.order_id || '').trim();
  const phone = normalizePhone(body.phone);
  if (!orderId || !phone) {
    return errorResponse('order_id and phone are required', 400, 'missing_fields');
  }

  // Do not reveal whether the order exists when the phone does not match.
  const order = await db
    .prepare('SELECT * FROM orders WHERE id = ? AND phone = ?')
    .bind(orderId, phone)
    .first();
  if (!order) return errorResponse('order_not_found', 404, 'order_not_found');

  if (order.status === 'cancelled' || order.status === 'refunded') {
    return errorResponse('order_not_payable', 409, 'order_not_payable');
  }

  let kind;
  let amount;
  if (order.payment_type === 'full' && order.status === 'pending-payment') {
    kind = 'full';
    amount = Number(order.total);
  } else if (
    order.payment_type === 'deposit' &&
    order.deposit_status === 'paid' &&
    order.balance_status === 'unpaid' &&
    Number(order.balance_amount) > 0
  ) {
    kind = 'balance';
    amount = Number(order.balance_amount);
  } else {
    return errorResponse('nothing_to_pay', 409, 'nothing_to_pay');
  }

  // One open payment at a time.
  const since = new Date(Date.now() - IN_PROGRESS_MINUTES * 60 * 1000).toISOString();
  const inProgress = await db
    .prepare("SELECT id FROM payments WHERE order_id = ? AND status = 'pending' AND created_at > ?")
    .bind(orderId, since)
    .first();
  if (inProgress) {
    return errorResponse(
      'A payment for this order was started recently. Please wait 30 minutes and try again.',
      409,
      'payment_in_progress'
    );
  }

  // A full order's earlier stock hold has usually expired by now. Release any
  // hold still marked active, then hold the stock again before taking money.
  let reservations = [];
  if (kind === 'full') {
    const old = await db
      .prepare("SELECT id FROM reservations WHERE order_id = ? AND status = 'active'")
      .bind(orderId)
      .all();
    await releaseReservations(db, (old.results || []).map((r) => r.id));

    let items;
    try {
      items = JSON.parse(order.items || '[]').map((i) => ({ sku: i.sku, qty: i.qty }));
      const result = await reserveStock(db, items, 15);
      reservations = result.reservations;
    } catch (e) {
      return errorResponse('Some items are no longer in stock. Please contact us.', 409, 'out_of_stock');
    }
    await linkReservationsToOrder(db, reservations.map((r) => r.id), orderId);
  }

  let session;
  try {
    session = await createCheckoutSession(env, {
      orderId,
      amountPkr: amount,
      currency: 'PKR',
      customerEmail: order.email,
      customerPhone: order.phone,
      reference: orderId,
      description: `AASRA order ${orderId} — ${kind === 'full' ? 'payment' : 'balance payment'}`,
      kind,
    });
  } catch (e) {
    if (kind === 'full') await releaseReservations(db, reservations.map((r) => r.id));
    await createOrderEvent(db, orderId, 'payment_retry_failed', { kind, error: e.message });
    return errorResponse('payment_session_failed', 502, 'gateway_error');
  }

  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO payments (id, order_id, kind, gateway, tracker_token, amount, currency, status, raw_event_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(makeId('pay'), orderId, kind, session.provider, session.trackerToken, amount, 'PKR', 'pending', null, now, now)
    .run();
  await createOrderEvent(db, orderId, 'payment_retry_pending', {
    kind,
    amount,
    tracker: session.trackerToken,
  });

  return jsonResponse({
    ok: true,
    order_id: orderId,
    kind,
    amount_due: amount,
    checkout_url: session.checkoutUrl,
  });
}
