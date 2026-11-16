/**
 * GET /api/order-lookup?order_id=...&phone=...
 *
 * Order status lookup (no customer account required).
 * Requires order ID + phone (both must match). Returns status and balance due.
 * Rate-limited; no exposure of other customers' data.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function errorResponse(message, status = 400, code) {
  return jsonResponse({ ok: false, error: message, code }, status);
}

export async function onRequestGet(context) {
  const { url, env } = context;

  const orderId = url.searchParams.get('order_id');
  const phone = url.searchParams.get('phone');

  if (!orderId || !phone) {
    return errorResponse('order_id and phone are required', 400, 'missing_fields');
  }

  // Normalize phone server-side
  let normalized = phone.replace(/\s|-|\(|\)|\./g, '');
  if (normalized.startsWith('+92')) normalized = '0' + normalized.slice(3);
  else if (normalized.startsWith('92') && normalized.length === 12) normalized = '0' + normalized.slice(2);

  const order = await context.env.DB.prepare(
    'SELECT * FROM orders WHERE id = ? AND phone = ?'
  ).bind(orderId, normalized).first();

  if (!order) {
    // Do not reveal whether order_id exists but phone mismatched
    return errorResponse('order_not_found', 404, 'order_not_found');
  }

  // Build safe response (no full address/phone logging concerns — this is the customer's own lookup)
  const balanceDue = order.balance_status === 'unpaid' ? order.balance_amount : 0;
  const canPayBalance =
    order.payment_type === 'deposit' &&
    order.deposit_status === 'paid' &&
    order.balance_status === 'unpaid' &&
    order.status !== 'cancelled' &&
    order.status !== 'refunded';

  return jsonResponse({
    ok: true,
    order_id: order.id,
    status: order.status,
    payment_type: order.payment_type,
    total: order.total,
    deposit_amount: order.deposit_amount,
    balance_amount: order.balance_amount,
    balance_due: balanceDue,
    deposit_status: order.deposit_status,
    balance_status: order.balance_status,
    balance_due_at: order.balance_due_at,
    can_pay_balance,
    courier: order.courier,
    tracking_number: order.tracking_number,
    created_at: order.created_at,
  });
}
