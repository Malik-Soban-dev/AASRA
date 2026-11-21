/**
 * POST /api/safepay-return  — Safepay's signed server-to-server payment return.
 *
 * After payment, Safepay POSTs { tracker, token, orderId, ref, sig } where
 * sig = HMAC-SHA256 hex of the tracker token keyed with the v1 secret
 * (see functions/lib/gateway.js). The HMAC is the authentication — this
 * endpoint is exempt from CSRF (external service) and settles the payment
 * through the same idempotent path as the webhook (processPayment).
 *
 * GET renders a "returning to the store" page for the browser. It says
 * "Payment received" only when D1 already shows the order as paid; otherwise it
 * says the payment is being confirmed (informational only, never used to settle).
 */

import { verifyRedirectSignature } from '../lib/gateway.js';
import { processPayment } from './webhook.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let raw;
  try {
    raw = await request.text();
  } catch {
    return jsonResponse({ ok: false, error: 'unreadable_body' }, 400);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    // Safepay may post form-encoded depending on configuration.
    body = Object.fromEntries(new URLSearchParams(raw));
  }

  const trackerToken = body.tracker || body.token || body.tracker_token || null;
  const signature = body.sig || body.signature || null;
  const orderId = body.orderId || body.order_id || body.order || body.ref || null;

  if (!trackerToken || !signature) {
    return jsonResponse({ ok: false, error: 'missing_fields' }, 400);
  }

  // The HMAC signature is the authentication — verify before touching state.
  if (!(await verifyRedirectSignature(env, String(trackerToken), String(signature)))) {
    return jsonResponse({ ok: false, error: 'invalid_signature' }, 401);
  }

  // Settlement: same idempotent path as the webhook. Amount/kind are not part
  // of the signed return payload, so the tracker→pending-payment mapping is
  // the trust anchor here (the webhook, when configured, adds amount checks).
  const result = await processPayment(env, context.env.DB, {
    eventId: null,
    trackerToken: String(trackerToken),
    orderId: orderId ? String(orderId) : null,
    amount: null,
    kind: null,
  });
  return jsonResponse(result.body, result.status);
}

/**
 * Whether the order has a settled payment in D1. The browser GET is display
 * only, so it reads state rather than trusting the URL.
 */
async function isOrderPaid(env, orderId) {
  if (!env.DB || !orderId) return false;
  try {
    const row = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(orderId).first();
    return !!row && (row.status === 'paid' || row.status === 'deposit-paid');
  } catch {
    return false;
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  let order = (url.searchParams.get('order') || '').slice(0, 64);
  // Safepay appends ?tracker=... to redirect_url. Use it to find the order when
  // the URL has no order number (read-only lookup; the order page only displays).
  const tracker = (url.searchParams.get('tracker') || '').slice(0, 128);
  if (!order && tracker && context.env.DB) {
    try {
      const row = await context.env.DB.prepare('SELECT order_id FROM payments WHERE tracker_token = ? LIMIT 1')
        .bind(tracker)
        .first();
      if (row && row.order_id) order = String(row.order_id).slice(0, 64);
    } catch (e) {
      // Fall through: the order page still shows without an order number.
    }
  }
  const confirmed = await isOrderPaid(context.env, order);
  const target = `/order-success?order=${encodeURIComponent(order)}`;
  const heading = confirmed ? 'Payment received' : 'Confirming your payment';
  const message = confirmed
    ? 'Returning you to the store…'
    : 'We are confirming your payment with Safepay. Your order page will update once it is confirmed.';
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${heading} — AASRA</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="${confirmed ? 2 : 5};url=${target}" />
    <style>
      body { font-family: Georgia, serif; background: #f7f5ef; color: #23211d;
             display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .box { text-align: center; max-width: 36ch; padding: 0 1rem; }
      a { color: #94503a; }
    </style>
  </head>
  <body>
    <div class="box">
      <p style="letter-spacing:.2em;text-transform:uppercase;font-size:.7rem">AASRA</p>
      <h1>${heading}</h1>
      <p>${message} <a href="${target}">Continue</a></p>
    </div>
  </body>
</html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
