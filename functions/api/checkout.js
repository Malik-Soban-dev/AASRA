/**
 * POST /api/checkout
 *
 * Checkout endpoint for AASRA headless store.
 *
 * Flow (per brief section 5):
 *   A. Browser sends cart (sku + qty only), payment type, customer details,
 *      coupon code, Turnstile token.
 *   B. Worker validates input + Turnstile; loads server-side prices; checks and
 *      reserves stock (15-min hold); applies coupon; adds shipping; computes
 *      total / deposit / balance; creates order (pending-payment or
 *      pending-deposit); creates gateway payment session; returns hosted
 *      checkout URL.
 *   C. Browser redirects to hosted checkout. Webhook (not the redirect) is the
 *      source of truth for payment status.
 *
 * Money rules: all amounts integer PKR. deposit + balance === total exactly.
 * Prices snapshot into the order so later products.json edits don't change old orders.
 */

import { validateCart, isValidPhone, isValidEmail, sanitizeString, requireFields, normalizePhone } from '../lib/validation.js';
import {
  setProducts,
  getProducts,
  findProductBySku,
  computeOrder,
  applyCoupon,
  assertMoneyInvariant,
} from '../lib/pricing.js';
import { createCheckoutSession } from '../lib/gateway.js';
import { reserveStock, releaseReservations, linkReservationsToOrder, createOrderEvent } from '../lib/stock.js';
import { sendEmail, orderReceivedEmail, wrapEmail } from '../lib/email.js';
import productsData from '../../data/products.json';
import shippingConfigData from '../../data/shipping-rates.json';

// Load product catalog once per isolate.
setProducts(productsData.default || productsData);

// Load shipping config once.
const SHIPPING_CONFIG = shippingConfigData.default || shippingConfigData;

// ---- Helpers ----

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

function publicOrderNumber() {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
  // Use a short random suffix; uniqueness also enforced by DB.
  return `AAS-${yyyymmdd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function verifyTurnstile(env, token) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, error: 'turnstile_not_configured' };
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const result = await resp.json();
    return { ok: !!result.success, challenge: result };
  } catch (e) {
    return { ok: false, error: 'turnstile_request_failed' };
  }
}

/**
 * Reserve stock for 15 minutes. Returns { ok, reservations: [...] } or throws.
 * Uses a transaction: check available qty, insert reservations, decrement stock.
 */

// Unexpected errors: clean up held stock and any half-made order, then return a generic error.
export async function onRequestPost(context) {
  const state = {};
  try {
    return await handleCheckoutPost({ ...context, state });
  } catch (e) {
    // Clean up so a crash never leaves stock held or a half-made order behind.
    try {
      const db = context.env.DB;
      if (state.orderId) {
        await db
          .prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status IN ('pending-payment', 'pending-deposit')")
          .bind(nowIso(), state.orderId)
          .run();
        await createOrderEvent(db, state.orderId, 'checkout_failed', { error: String(e && e.message ? e.message : 'unknown') });
      }
      if (state.reservationIds) await releaseReservations(db, state.reservationIds);
    } catch (cleanupError) {
      console.warn('[CHECKOUT] cleanup failed', cleanupError && cleanupError.message);
    }
    return errorResponse('checkout_failed', 500, 'server_error');
  }
}

async function handleCheckoutPost(context) {
  const { request, env } = context;

  // 1. Parse body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse('invalid_json', 400, 'invalid_json');
  }

  // 2. Required fields
  const missing = requireFields(body, ['cart', 'payment_type', 'customer', 'turnstile_token']);
  if (missing.length) {
    return errorResponse(`missing_fields: ${missing.join(', ')}`, 400, 'missing_fields');
  }

  const { cart, payment_type, customer, coupon_code, turnstile_token } = body;

  // Never create an order or reserve inventory when a production dependency is
  // absent. Configuration blockers are explicit so checkout cannot appear live
  // while using a fake gateway or bypassing bot protection.
  if (!env.DB) return errorResponse('checkout_unavailable:database_not_configured', 503, 'configuration_missing');
  if (env.TURNSTILE_SECRET_KEY == null || !env.TURNSTILE_SECRET_KEY.trim()) {
    return errorResponse('checkout_unavailable:turnstile_not_configured', 503, 'configuration_missing');
  }
  // Safepay: hosted checkout needs the secret key + verified protocol. The
  // webhook secret is optional here — the signed server-to-server return
  // (/api/safepay-return) settles payments, and webhooks fail closed without
  // their shared secret.
  if (env.SAFEPAY_ENABLED !== 'true' || !env.SAFEPAY_SECRET_KEY || !env.SAFEPAY_API_KEY || env.SAFEPAY_PROTOCOL_VERIFIED !== 'true') {
    return errorResponse('checkout_unavailable:safepay_not_fully_configured', 503, 'payment_not_configured');
  }

  // Validate payment_type
  if (payment_type !== 'full' && payment_type !== 'deposit') {
    return errorResponse('invalid payment_type', 400, 'invalid_payment_type');
  }

  // 3. Turnstile verification (bot protection)
  const turnstile = await verifyTurnstile(env, turnstile_token);
  if (!turnstile.ok) {
    return errorResponse('turnstile verification failed', 403, 'turnstile_failed');
  }

  // 4. Validate cart
  const cartValidation = validateCart(cart);
  if (!cartValidation.ok) {
    return errorResponse(cartValidation.error, 400, 'invalid_cart');
  }
  const items = cartValidation.items;

  // 5. Validate customer details
  const custMissing = requireFields(customer, ['name', 'phone', 'email', 'city', 'address']);
  if (custMissing.length) {
    return errorResponse(`missing_customer_fields: ${custMissing.join(', ')}`, 400, 'missing_customer_fields');
  }
  const name = sanitizeString(customer.name, 100);
  const phone = normalizePhone(customer.phone);
  if (!phone) {
    return errorResponse('invalid Pakistani phone number', 400, 'invalid_phone');
  }
  const email = sanitizeString(customer.email, 254);
  if (!isValidEmail(email)) {
    return errorResponse('invalid email address', 400, 'invalid_email');
  }
  const city = sanitizeString(customer.city, 100);
  const address = sanitizeString(customer.address, 500);
  const notes = sanitizeString(customer.notes, 1000) || null;

  // 6. Deposit percentage (from env, default 30). VERIFY: decide actual %.
  const depositPercent = Number(env.DEFAULT_DEPOSIT_PERCENT || 30);

  // 7. Attach city to items for shipping computation (server-side)
  const itemsWithCity = items.map((it) => ({ ...it, _city: city }));

  // 8. Compute order money server-side (prices from products.json, never client)
  let computed;
  try {
    computed = computeOrder({
      items: itemsWithCity,
      products: getProducts(),
      shippingConfig: SHIPPING_CONFIG,
      paymentType: payment_type,
      depositPercent,
      couponResult: null, // coupon validated below
      nowIso: nowIso(),
    });
  } catch (e) {
    return errorResponse(e.message || 'pricing_error', 400, 'pricing_error');
  }

  // 9. Validate coupon server-side (if provided)
  let couponResult = { discount: 0, code: null, applied: false, reason: null };
  if (coupon_code) {
    const code = String(coupon_code).trim().toUpperCase();
    const row = await context.env.DB.prepare('SELECT * FROM coupons WHERE code = ?').bind(code).first();
    if (row) {
      couponResult = applyCoupon(
        {
          code: row.code,
          type: row.type,
          value: row.value,
          min_order: row.min_order || 0,
          expires_at: row.expires_at,
          usage_limit: row.usage_limit,
          used_count: row.used_count || 0,
        },
        computed.subtotal,
        nowIso()
      );
    }
    // If coupon invalid, we do NOT fail checkout — we just ignore it.
    // (Could be configured to fail instead.)
  }

  // Recompute with coupon applied
  if (couponResult.applied) {
    try {
      computed = computeOrder({
        items: itemsWithCity,
        products: getProducts(),
        shippingConfig: SHIPPING_CONFIG,
        paymentType: payment_type,
        depositPercent,
        couponResult,
        nowIso: nowIso(),
      });
    } catch (e) {
      return errorResponse(e.message || 'pricing_error', 400, 'pricing_error');
    }
  }

  // Deposit orders split the total into deposit + balance. Full payments take
  // the whole total now, so deposit/balance stay 0 by design (the webhook marks
  // both as paid on a full payment) and the split invariant does not apply.
  if (payment_type === 'deposit') {
    assertMoneyInvariant({
      total: computed.total,
      deposit_amount: computed.deposit_amount,
      balance_amount: computed.balance_amount,
    });
  }

  // 10. Reserve stock (15-minute hold)
  let reservationResult;
  try {
    reservationResult = await reserveStock(context.env.DB, items, 15);
    if (context.state) context.state.reservationIds = reservationResult.reservations.map((r) => r.id);
  } catch (e) {
    if (e.message && e.message.startsWith('insufficient_stock:')) {
      const sku = e.message.split(':')[1];
      return errorResponse(`out_of_stock:${sku}`, 409, 'insufficient_stock');
    }
    return errorResponse('stock_reservation_failed', 500, 'stock_error');
  }

  // 11. Create order record
  const orderId = publicOrderNumber();
  if (context.state) context.state.orderId = orderId;
  // Unguessable token for balance payment + invoice access (not the order id).
  const balanceToken = makeId('bal');
  const now = nowIso();
  const amountDueNow = payment_type === 'deposit' ? computed.deposit_amount : computed.total;
  const initialStatus = payment_type === 'deposit' ? 'pending-deposit' : 'pending-payment';
  const balanceDueAt =
    payment_type === 'deposit'
      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // VERIFY: balance deadline days
      : null;

  try {
    await context.env.DB.prepare(
      `INSERT INTO orders (
        id, status, customer_name, phone, email, city, address, notes,
        items, subtotal, shipping_fee, discount, total,
        payment_type, deposit_amount, balance_amount,
        deposit_status, balance_status, balance_due_at,
        balance_token,
        coupon_code, courier, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId,
      initialStatus,
      name,
      phone,
      email,
      city,
      address,
      notes,
      JSON.stringify(computed.per_item),
      computed.subtotal,
      computed.shipping_fee,
      computed.discount,
      computed.total,
      payment_type,
      computed.deposit_amount,
      computed.balance_amount,
      'unpaid',
      'unpaid',
      balanceDueAt,
      balanceToken,
      couponResult.code || null,
      computed.courier || null,
      now,
      now
    ).run();
  } catch (e) {
    // Order insert failed — release reservations
    await releaseReservations(context.env.DB, reservationResult.reservations.map((r) => r.id));
    return errorResponse('order_creation_failed', 500, 'db_error');
  }

  // Link reservations to the order
  await linkReservationsToOrder(
    context.env.DB,
    reservationResult.reservations.map((r) => r.id),
    orderId
  );

  // Log events
  await createOrderEvent(context.env.DB, orderId, 'order_created', {
    payment_type,
    total: computed.total,
    deposit: computed.deposit_amount,
    balance: computed.balance_amount,
  });
  await createOrderEvent(context.env.DB, orderId, 'stock_reserved', {
    skus: items.map((i) => i.sku),
    hold_minutes: 15,
  });

  // 12. Create gateway payment session (hosted checkout)
  let session;
  try {
    session = await createCheckoutSession(env, {
      orderId,
      amountPkr: amountDueNow,
      currency: 'PKR',
      customerEmail: email,
      customerPhone: phone,
      reference: orderId,
      description: `AASRA order ${orderId} — ${payment_type} payment`,
      kind: payment_type === 'deposit' ? 'deposit' : 'full',
    });
  } catch (e) {
    // Gateway session failed — release reservations, mark order cancelled
    await releaseReservations(context.env.DB, reservationResult.reservations.map((r) => r.id));
    await context.env.DB.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, orderId).run();
    await createOrderEvent(context.env.DB, orderId, 'gateway_session_failed', { error: e.message });
    return errorResponse('payment_session_failed', 502, 'gateway_error');
  }

  // Store payment record (pending)
  await context.env.DB.prepare(
    `INSERT INTO payments (id, order_id, kind, gateway, tracker_token, amount, currency, status, raw_event_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    makeId('pay'),
    orderId,
    payment_type === 'deposit' ? 'deposit' : 'full',
    session.provider,
    session.trackerToken,
    amountDueNow,
    'PKR',
    'pending',
    null,
    now,
    now
  ).run();

  await createOrderEvent(context.env.DB, orderId, 'payment_pending', {
    kind: payment_type === 'deposit' ? 'deposit' : 'full',
    amount: amountDueNow,
    tracker: session.trackerToken,
  });

  // 12b. Order confirmation email to the customer. A send failure must not
  // block checkout: log an order event and continue to the payment page.
  try {
    const tpl = orderReceivedEmail({
      order: {
        id: orderId,
        customer_name: name,
        total: computed.total,
        payment_type,
        deposit_amount: computed.deposit_amount,
        balance_amount: computed.balance_amount,
        balance_token: balanceToken,
        deposit_status: 'unpaid',
      },
      env,
    });
    const mail = wrapEmail(env, {
      subject: tpl.subject,
      title: 'Order confirmation',
      body: tpl.html,
      intro: tpl.intro,
      outro: tpl.outro,
      btnText: 'Track your order',
      btnUrl: `${env.PUBLIC_BASE_URL || 'https://aasra.shop'}/order-lookup`,
    });
    const sent = await sendEmail(env, { to: email, subject: mail.subject, html: mail.html, text: mail.text });
    if (!sent.ok) {
      await createOrderEvent(context.env.DB, orderId, 'email_failed', { kind: 'order_received', error: sent.error });
    }
  } catch (e) {
    console.warn('[CHECKOUT] order email failed', orderId, e.message);
    await createOrderEvent(context.env.DB, orderId, 'email_failed', { kind: 'order_received', error: e.message });
  }

  // 13. Return hosted checkout URL (browser redirects here; webhook is source of truth)
  return jsonResponse({
    ok: true,
    order_id: orderId,
    checkout_url: session.checkoutUrl,
    tracker_token: session.trackerToken,
    amount_due_now: amountDueNow,
    total: computed.total,
    deposit_amount: computed.deposit_amount,
    balance_amount: computed.balance_amount,
    expires_at: session.expiresAt,
  });
}
