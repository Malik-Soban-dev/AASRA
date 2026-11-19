/**
 * POST /api/safepay/return  — Safepay's signed server-to-server payment return.
 *
 * After payment, Safepay POSTs { tracker, token, orderId, ref, sig } where
 * sig = HMAC-SHA256 hex of the tracker token keyed with the v1 secret
 * (see functions/lib/gateway.js). The HMAC is the authentication — this
 * endpoint is exempt from CSRF (external service) and settles the payment
 * through the same idempotent path as the webhook (processPayment).
 *
 * GET renders a small "returning to the store" page for the browser
 * (informational only — never trusted for settlement).
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

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const order = url.searchParams.get('order') || '';
  const target = `/order-success?order=${encodeURIComponent(order)}`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Returning to AASRA…</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="2;url=${target}" />
    <style>
      body { font-family: Georgia, serif; background: #f7f5ef; color: #23211d;
             display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .box { text-align: center; }
      a { color: #a65e45; }
    </style>
  </head>
  <body>
    <div class="box">
      <p style="letter-spacing:.2em;text-transform:uppercase;font-size:.7rem">AASRA</p>
      <h1>Payment received</h1>
      <p>Returning you to the store… <a href="${target}">continue</a></p>
    </div>
  </body>
</html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
