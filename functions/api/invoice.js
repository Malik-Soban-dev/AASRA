/**
 * GET /api/invoice?order_id=...&token=...&type=deposit|balance|final
 *
 * Generates an HTML invoice / receipt for a specific order and payment type.
 * Access is protected by the order's unguessable balance_token (not the order id),
 * so the link cannot be guessed and only exposes that customer's own data.
 *
 * Types:
 *   deposit  - deposit receipt (shown after deposit paid)
 *   balance  - balance receipt (shown after balance paid)
 *   final    - final tax invoice (shown when paid in full)
 *
 * Rate-limited by Cloudflare WAF (see wrangler.toml / README).
 */

import { buildInvoiceHtml } from '../lib/invoice.js';

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

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
  const token = url.searchParams.get('token');
  const type = url.searchParams.get('type') || 'final';

  if (!orderId || !token) {
    return errorResponse('order_id and token are required', 400, 'missing_fields');
  }
  if (!['deposit', 'balance', 'final'].includes(type)) {
    return errorResponse('invalid type', 400, 'invalid_type');
  }

  // Look up order by id; authorize via unguessable balance_token.
  const order = await context.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) {
    // Do not reveal whether the order id exists
    return errorResponse('invoice not found', 404, 'not_found');
  }
  if (!order.balance_token || token !== order.balance_token) {
    return errorResponse('invalid token', 403, 'invalid_token');
  }

  // Parse items snapshot (stored server-side at checkout).
  let items;
  try {
    items = JSON.parse(order.items || '[]');
  } catch (e) {
    return errorResponse('invoice data unavailable', 500, 'invoice_error');
  }

  // Fetch the latest payment record for this order + type (for dates/refs).
  let payment = null;
  try {
    const row = await context.env.DB.prepare(
      'SELECT * FROM payments WHERE order_id = ? AND kind = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(orderId, type === 'final' ? 'full' : type, 'paid').first();
    payment = row || null;
  } catch (e) {
    // Non-fatal: invoice still renders without payment date/ref
    console.warn('[INVOICE] payment lookup failed', orderId, e.message);
  }

  const html = buildInvoiceHtml({
    order,
    items,
    type,
    payment,
    baseUrl: env.PUBLIC_BASE_URL || 'https://aasra.shop',
    generatedAt: new Date().toISOString(),
  });

  return htmlResponse(html);
}
