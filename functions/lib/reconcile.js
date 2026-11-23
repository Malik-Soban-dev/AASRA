/**
 * Safety net for missed payment webhooks.
 *
 * If a customer pays but our webhook never arrives, the order would stay
 * pending forever. These helpers ask Safepay for the payment's state and, only
 * when Safepay says the payment ended and the amount matches our record, settle
 * it through the same processPayment path the webhook uses. processPayment is
 * idempotent and checks the order state, so a payment can't be settled twice.
 */

import { fetchTrackerState } from './gateway.js';
import { processPayment } from '../api/webhook.js';

// Safepay state for a captured payment (same test the Safepay SDK's is_paid uses).
const SETTLED_STATE = 'TRACKER_ENDED';

function minutesAgoIso(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/** Check one pending payment with Safepay and settle it if it has ended. */
export async function reconcilePayment(env, db, payment) {
  let remote;
  try {
    remote = await fetchTrackerState(env, payment.tracker_token);
  } catch (e) {
    return { status: 'gateway_error', order_id: payment.order_id, error: e.message };
  }
  // Logged so the Workers logs show what Safepay returned (state, and whether an amount came back).
  console.log('[RECONCILE]', payment.order_id, 'state=' + remote.state, 'amount=' + (remote.amount == null ? 'none' : 'present'));
  if (remote.state !== SETTLED_STATE) {
    return { status: 'not_settled', order_id: payment.order_id, state: remote.state };
  }
  // Fail closed: never settle without an amount to check against our record.
  if (remote.amount == null) {
    return { status: 'amount_unverified', order_id: payment.order_id };
  }

  const result = await processPayment(env, db, {
    eventId: `reconcile-${payment.tracker_token}`,
    trackerToken: payment.tracker_token,
    orderId: payment.order_id,
    amount: remote.amount,
    kind: payment.kind,
  });
  const body = result.body || {};
  if (body.ok && body.duplicate) return { status: 'already_settled', order_id: payment.order_id };
  if (body.duplicate_payment) return { status: 'duplicate_payment', order_id: payment.order_id };
  if (body.ok) return { status: 'settled', order_id: payment.order_id };
  return { status: 'rejected', order_id: payment.order_id, error: body.error || 'unknown' };
}

async function reconcileRows(env, db, rows) {
  const outcomes = [];
  for (const payment of rows) {
    try {
      outcomes.push(await reconcilePayment(env, db, payment));
    } catch (e) {
      outcomes.push({ status: 'error', order_id: payment.order_id, error: e.message });
    }
  }
  return outcomes;
}

/** Pending payments for one order that are old enough to have finished at Safepay. */
export async function reconcileOrderPayments(env, db, orderId) {
  const rows = await db
    .prepare("SELECT * FROM payments WHERE order_id = ? AND status = 'pending' AND created_at < ?")
    .bind(orderId, minutesAgoIso(2))
    .all();
  return reconcileRows(env, db, rows.results || []);
}

/** Recent pending payments across all orders (scheduled sweep). */
export async function reconcilePendingPayments(env, db, { maxAgeHours = 6, limit = 50 } = {}) {
  const rows = await db
    .prepare(
      "SELECT * FROM payments WHERE status = 'pending' AND created_at < ? AND created_at > ? ORDER BY created_at LIMIT ?"
    )
    .bind(minutesAgoIso(10), hoursAgoIso(maxAgeHours), limit)
    .all();
  return reconcileRows(env, db, rows.results || []);
}
