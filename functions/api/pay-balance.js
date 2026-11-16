/**
 * POST /api/pay-balance
 *
 * Create a second payment session for the balance of a deposit order.
 * Unguessable token, bound to that order, expires.
 * Webhook (not redirect) confirms payment.
 */

import { createCheckoutSession } from '../lib/gateway.js';
import { sendEmail, balanceReminderEmail } from '../lib/email.js';
import { sanitizeString } from '../lib/validation.js';

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

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse('invalid_json', 400, 'invalid_json');
  }

  const { order_id, token, turnstile_token } = body;

  if (!order_id || !token) {
    return errorResponse('order_id and token are required', 400, 'missing_fields');
  }

  // Turnstile (optional but recommended on balance pay)
  if (env.TURNSTILE_SECRET_KEY) {
    const secret = env.TURNSTILE_SECRET_KEY;
    try {
      const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(turnstile_token || '')}`,
      });
      const result = await resp.json();
      if (!result.success) {
        return errorResponse('turnstile verification failed', 403, 'turnstile_failed');
      }
    } catch (e) {
      return errorResponse('turnstile_request_failed', 502, 'turnstile_error');
    }
  }

  // Fetch order
  const order = await context.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(order_id).first();
  if (!order) {
    return errorResponse('order_not_found', 404, 'order_not_found');
  }

  // Token bound to order: token must equal the unguessable balance_token stored on the order.
  if (!order.balance_token || token !== order.balance_token) {
    return errorResponse('invalid_token', 403, 'invalid_token');
  }

  // Only deposit orders with unpaid balance can pay balance
  if (order.payment_type !== 'deposit') {
    return errorResponse('not_a_deposit_order', 400, 'not_deposit_order');
  }
  if (order.balance_status === 'paid') {
    return errorResponse('balance_already_paid', 400, 'balance_paid');
  }
  if (order.balance_amount <= 0) {
    return errorResponse('no_balance_due', 400, 'no_balance_due');
  }

  // Check expiry
  if (order.balance_due_at && new Date(order.balance_due_at) < new Date()) {
    return errorResponse('balance_link_expired', 410, 'balance_expired');
  }

  // Create gateway payment session for the balance
  let session;
  try {
    session = await createCheckoutSession(env, {
      order_id: order.id,
      amountPkr: order.balance_amount,
      currency: 'PKR',
      customerEmail: order.email,
      customerPhone: order.phone,
      reference: order.id,
      description: `AASRA order ${order.id} — balance payment`,
      kind: 'balance',
    });
  } catch (e) {
    return errorResponse('payment_session_failed', 502, 'gateway_error');
  }

  // Store balance payment record (pending)
  const now = nowIso();
  await context.env.DB.prepare(
    `INSERT INTO payments (id, order_id, kind, gateway, tracker_token, amount, currency, status, raw_event_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    makeId('pay'),
    order.id,
    'balance',
    session.provider,
    session.tracker_token,
    order.balance_amount,
    'PKR',
    'pending',
    null,
    now,
    now
  );

  return jsonResponse({
    ok: true,
    order_id: order.id,
    checkout_url: session.checkoutUrl,
    tracker_token: session.tracker_token,
    amount_due: order.balance_amount,
    expires_at: session.expiresAt,
  });
}
