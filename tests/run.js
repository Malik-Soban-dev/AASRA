/**
 * AASRA automated tests.
 * Covers pricing, deposit math, webhook signature verification, stock logic,
 * order state transitions, invoices, CSRF, and email templates.
 * Run with: node tests/run.js
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  computeOrder,
  applyCoupon,
  setProducts,
} from '../functions/lib/pricing.js';
import {
  normalizePhone,
  isValidEmail,
  validateCart,
  sanitizeString,
} from '../functions/lib/validation.js';
import { verifyWebhookSignature, verifyRedirectSignature, createCheckoutSession } from '../functions/lib/gateway.js';
import { buildInvoiceHtml } from '../functions/lib/invoice.js';
import {
  orderReceivedEmail,
  depositPaidEmail,
  balancePaidEmail,
  paymentPaidEmail,
  balanceReminderEmail,
  shippedEmail,
  deliveredEmail,
  cancelledEmail,
  refundedEmail,
  wrapEmail,
  sendEmail,
} from '../functions/lib/email.js';
import { onRequestPost as newsletterPost } from '../functions/api/newsletter.js';
import { onRequestGet as invoiceGet } from '../functions/api/invoice.js';

// ---- Load sample products ----
const productsData = JSON.parse(
  readFileSync(new URL('../data/products.json', import.meta.url), 'utf8')
);
setProducts(productsData);

let passed = 0;
let failed = 0;

const tests = [];

function t(name, fn) {
  tests.push(async () => {
    try {
      if (fn.constructor.name === 'AsyncFunction') await fn();
      else fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (e) {
      failed++;
      console.error(`FAIL: ${name} — ${e.message}`);
    }
  });
}

function assertEq(a, b, msg) {
  assert.deepStrictEqual(a, b, msg);
}

// ============================================================
// Validation
// ============================================================
t('normalizePhone converts +92 to 03', () => {
  assertEq(normalizePhone('+923001234567'), '03001234567');
  assertEq(normalizePhone('03001234567'), '03001234567');
  assertEq(normalizePhone('0300-1234567'), '03001234567');
  assertEq(normalizePhone('923001234567'), '03001234567');
  assertEq(normalizePhone('invalid'), null);
  assertEq(normalizePhone('0300123456'), null);
});

t('isValidEmail', () => {
  assert.ok(isValidEmail('you@example.com'));
  assert.ok(!isValidEmail('not-an-email'));
  assert.ok(!isValidEmail(''));
});

t('validateCart rejects empty / duplicates / bad SKU', () => {
  assertEq(validateCart([]).ok, false);
  assertEq(validateCart([{ sku: 'LIN-IV-135X240', qty: 1 }]).ok, true);
  assertEq(
    validateCart([
      { sku: 'LIN-IV-135X240', qty: 1 },
      { sku: 'LIN-IV-135X240', qty: 1 },
    ]).ok,
    false
  );
  assertEq(validateCart([{ sku: 'bad!sku', qty: 1 }]).ok, false);
  const r = validateCart([{ sku: 'LIN-IV-135X240', qty: 100 }]);
  assert.ok(r.ok);
  assertEq(r.items[0].qty, 10);
});

t('sanitizeString trims and caps', () => {
  assertEq(sanitizeString('  hello   world  '), 'hello world');
  assertEq(sanitizeString('a'.repeat(1000), 10).length, 10);
  assertEq(sanitizeString(123), null);
});

// ============================================================
// Pricing / money
// ============================================================
t('computeOrder full payment: deposit=balance=0', () => {
  const c = computeOrder({
    items: [{ sku: 'AS-W001-IVO-XS', qty: 2, _city: 'Karachi' }],
    products: productsData,
    shippingConfig: { free_shipping_threshold_pkr: 20000, rates: [] },
    paymentType: 'full',
    couponResult: null,
    nowIso: new Date().toISOString(),
  });
  assertEq(c.deposit_amount, 0);
  assertEq(c.balance_amount, 0);
  assertEq(c.total, c.subtotal + c.shipping_fee);
  assertEq(c.total, 37800);
});

t('computeOrder deposit: deposit + balance == total', () => {
  const c = computeOrder({
    items: [{ sku: 'AS-W003-OLI-XS', qty: 1, _city: 'Lahore' }],
    products: productsData,
    shippingConfig: { free_shipping_threshold_pkr: 20000, rates: [] },
    paymentType: 'deposit',
    depositPercent: 30,
    couponResult: null,
    nowIso: new Date().toISOString(),
  });
  assertEq(c.deposit_amount + c.balance_amount, c.total);
  assertEq(c.deposit_amount, Math.floor((c.total * 30) / 100));
  assertEq(c.balance_amount, c.total - c.deposit_amount);
});

t('computeOrder deposit ineligible cart throws', () => {
  assert.throws(() =>
    computeOrder({
      items: [{ sku: 'AS-M001-SLA-S', qty: 1, _city: 'Karachi' }],
      products: productsData,
      shippingConfig: { free_shipping_threshold_pkr: 20000, rates: [] },
      paymentType: 'deposit',
      depositPercent: 30,
      couponResult: null,
      nowIso: new Date().toISOString(),
    })
  );
});

t('computeOrder odd amounts keep invariant', () => {
  const c = computeOrder({
    items: [{ sku: 'AS-W001-IVO-XS', qty: 1, _city: 'Karachi' }],
    products: productsData,
    shippingConfig: { free_shipping_threshold_pkr: 20000, rates: [] },
    paymentType: 'deposit',
    depositPercent: 30,
    couponResult: null,
    nowIso: new Date().toISOString(),
  });
  assertEq(c.deposit_amount + c.balance_amount, c.total);
  assertEq(c.deposit_amount, 5670);
  assertEq(c.balance_amount, 13230);
});

t('applyCoupon percentage caps at subtotal', async () => {
  const r = applyCoupon(
    {
      code: 'BIG50',
      type: 'percentage',
      value: 50,
      min_order: 0,
      expires_at: null,
      usage_limit: null,
      used_count: 0,
    },
    1000,
    new Date().toISOString()
  );
  assertEq(r.applied, true);
  assertEq(r.discount, 500);
});

t('applyCoupon expired is rejected', () => {
  const r = applyCoupon(
    {
      code: 'OLD',
      type: 'percentage',
      value: 10,
      min_order: 0,
      expires_at: '2020-01-01T00:00:00Z',
      usage_limit: null,
      used_count: 0,
    },
    1000,
    '2026-01-01T00:00:00Z'
  );
  assertEq(r.applied, false);
  assertEq(r.reason, 'coupon_expired');
});

t('applyCoupon fixed exceeds subtotal caps', () => {
  const r = applyCoupon(
    {
      code: 'FIX',
      type: 'fixed',
      value: 5000,
      min_order: 0,
      expires_at: null,
      usage_limit: null,
      used_count: 0,
    },
    1000,
    new Date().toISOString()
  );
  assertEq(r.applied, true);
  assertEq(r.discount, 1000);
});

// ============================================================
// Webhook signature verification
// ============================================================
t('verifyWebhookSignature accepts valid HMAC', async () => {
  const secret = 'test-secret';
  const body = JSON.stringify({ order_id: 'AAS-1', amount: 1000 });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const env = {
    SAFEPAY_WEBHOOK_SECRET: secret,
    SAFEPAY_BASE_URL: '',
    SAFEPAY_ENABLED: 'true',
    SAFEPAY_PROTOCOL_VERIFIED: 'true',
  };
  assert.ok(await verifyWebhookSignature(env, body, hex));
});

t('checkout session refuses to simulate a gateway when configuration is absent', async () => {
  await assert.rejects(
    createCheckoutSession({ SAFEPAY_ENABLED: 'false' }, { orderId: 'test', amountPkr: 1000 }),
    /safepay_not_configured/
  );
});

t('email provider reports unconfigured instead of a successful stub', async () => {
  const result = await sendEmail({}, { to: 'person@example.com', subject: 'test', html: '', text: '' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'email_provider_not_configured');
});

t('verifyWebhookSignature rejects wrong signature', async () => {
  const env = {
    SAFEPAY_WEBHOOK_SECRET: 'right',
    SAFEPAY_BASE_URL: '',
    SAFEPAY_ENABLED: 'true',
  };
  assert.ok(!(await verifyWebhookSignature(env, 'body', 'deadbeef')));
});

t('verifyWebhookSignature rejects missing secret', async () => {
  const env = { SAFEPAY_BASE_URL: '', SAFEPAY_ENABLED: 'true' };
  assert.ok(!(await verifyWebhookSignature(env, 'body', 'sig')));
});

// ============================================================
// Order state transitions
// ============================================================
function transitionOrder(order, kind) {
  if (kind === 'full') {
    return { newStatus: 'paid', depositStatus: 'paid', balanceStatus: 'paid' };
  }
  if (kind === 'deposit') {
    return { newStatus: 'deposit-paid', depositStatus: 'paid', balanceStatus: 'unpaid' };
  }
  if (kind === 'balance') {
    return { newStatus: 'paid', depositStatus: 'paid', balanceStatus: 'paid' };
  }
  throw new Error('unknown kind');
}

t('order state transitions', () => {
  const dep = { payment_type: 'deposit', deposit_status: 'unpaid', balance_status: 'unpaid' };
  assertEq(transitionOrder(dep, 'deposit').newStatus, 'deposit-paid');
  assertEq(transitionOrder(dep, 'balance').newStatus, 'paid');
  const full = { payment_type: 'full', deposit_status: 'unpaid', balance_status: 'unpaid' };
  assertEq(transitionOrder(full, 'full').newStatus, 'paid');
});

// ============================================================
// Invoice generation
// ============================================================
const sampleOrder = {
  id: 'AAS-20261116-TEST1',
  status: 'paid',
  customer_name: 'Fatima Ali',
  phone: '03001234567',
  email: 'fatima@example.com',
  city: 'Lahore',
  address: 'House 12, Street 4, Model Town',
  notes: '',
  items: JSON.stringify([
    { name: 'Linen Curtain Panel — Ivory', sku: 'LIN-IV-135X240', qty: 2, unit_price_pkr: 6500, line_total_pkr: 13000 },
  ]),
  subtotal: 13000,
  shipping_fee: 250,
  discount: 0,
  total: 13250,
  payment_type: 'deposit',
  deposit_amount: 3975,
  balance_amount: 9275,
  deposit_status: 'paid',
  balance_status: 'paid',
  balance_due_at: null,
  balance_token: 'bal_abc123',
  coupon_code: null,
  courier: 'TCS',
  tracking_number: 'TCS123456789',
  created_at: '2026-11-16T10:00:00Z',
  updated_at: '2026-11-16T14:30:00Z',
};

const sampleItems = [
  { name: 'Linen Curtain Panel — Ivory', sku: 'LIN-IV-135X240', qty: 2, unit_price_pkr: 6500, line_total_pkr: 13000 },
];

t('invoice HTML contains order id and totals', () => {
  const html = buildInvoiceHtml({
    order: sampleOrder,
    items: sampleItems,
    type: 'final',
    payment: { updated_at: sampleOrder.updated_at, tracker_token: 'sp_track_123' },
    baseUrl: 'https://shop.example.com',
    generatedAt: '2026-11-16T15:00:00Z',
  });
  assert.ok(html.includes('AAS-20261116-TEST1'), 'order id present');
  assert.ok(html.includes('13,250'), 'total present');
  assert.ok(html.includes('Total paid'), 'total paid label');
  assert.ok(html.includes('Amount due'), 'amount due label');
  assert.ok(html.includes('Fatima Ali'), 'customer name present');
  assert.ok(html.includes('Tax Invoice'), 'doc title present');
  assert.ok(!html.includes('03001234567'), 'full phone masked in invoice');
  assert.ok(html.includes('••••••67'), 'masked phone shown');
});

t('invoice deposit receipt type', () => {
  const html = buildInvoiceHtml({
    order: { ...sampleOrder, payment_type: 'deposit', deposit_status: 'paid', balance_status: 'unpaid' },
    items: sampleItems,
    type: 'deposit',
    payment: null,
    baseUrl: 'https://shop.example.com',
    generatedAt: new Date().toISOString(),
  });
  assert.ok(html.includes('Deposit Receipt'), 'deposit receipt title');
  assert.ok(html.includes('Balance due'), 'balance due label');
});

t('invoice balance receipt type', () => {
  const html = buildInvoiceHtml({
    order: { ...sampleOrder, payment_type: 'deposit', deposit_status: 'paid', balance_status: 'paid' },
    items: sampleItems,
    type: 'balance',
    payment: { updated_at: sampleOrder.updated_at, tracker_token: 'sp_track_456' },
    baseUrl: 'https://shop.example.com',
    generatedAt: new Date().toISOString(),
  });
  assert.ok(html.includes('Balance Receipt'), 'balance receipt title');
  assert.ok(html.includes('Balance paid'), 'balance paid label');
});

// ============================================================
// Email templates
// ============================================================
const testEnv = {
  PUBLIC_BASE_URL: 'https://shop.example.com',
  EMAIL_FROM: 'orders@example.com',
  EMAIL_FROM_NAME: 'AASRA',
};

t('orderReceivedEmail has subject and html', () => {
  const e = orderReceivedEmail({ order: sampleOrder, env: testEnv });
  assert.ok(e.subject, 'has subject');
  assert.ok(e.html, 'has html');
  assert.ok(e.html.includes('AAS-20261116-TEST1'), 'contains order id');
  assert.ok(e.html.includes('13,250'), 'contains total');
});

t('depositPaidEmail has subject and html', () => {
  const e = depositPaidEmail({ order: sampleOrder, amount: 3975, env: testEnv });
  assert.ok(e.subject, 'has subject');
  assert.ok(e.html, 'has html');
  assert.ok(e.html.includes('3,975'), 'contains deposit amount');
});

t('balancePaidEmail has subject and html', () => {
  const e = balancePaidEmail({ order: sampleOrder, amount: 9275, env: testEnv });
  assert.ok(e.subject, 'has subject');
  assert.ok(e.html, 'has html');
  assert.ok(e.html.includes('paid in full'), 'mentions paid in full');
});

t('full payment sends a receipt with items, totals and paid status', () => {
  const order = {
    ...sampleOrder,
    items: JSON.stringify([
      { name: 'Linen Wrap Dress — Clay', sku: 'AS-W002-CLA-S', qty: 2, unit_price_pkr: 22500, line_total_pkr: 45000 },
    ]),
    subtotal: 45000, discount: 0, shipping_fee: 0, total: 45000,
    deposit_amount: 0, balance_amount: 0, balance_token: 'bal_test123',
  };
  const e = paymentPaidEmail({ order, kind: 'full', amount: 45000, env: testEnv, trackerToken: 'track_abc', paidAt: '2026-11-22T02:00:00Z' });
  assert.ok(e.subject.startsWith('Order paid in full'), 'subject');
  assert.ok(!e.subject.includes('Deposit'), 'subject must not say Deposit');
  assert.ok(!e.html.includes('Remaining balance'), 'must not mention remaining balance');
  assert.ok(e.html.includes('AS-W002-CLA-S'), 'lists item SKU');
  assert.ok(e.html.includes('Linen Wrap Dress'), 'lists item name');
  assert.ok(e.html.includes('PAID'), 'shows PAID status');
  assert.ok(e.html.includes('track_abc'), 'shows payment reference');
  assert.ok(e.html.includes('Amount paid'), 'shows amount paid');
  assert.ok(e.html.includes('Shipping to'), 'shows shipping address block');
  assert.ok(e.html.includes('House 12'), 'shows address');
  assert.ok(e.btnUrl && e.btnUrl.includes('type=final'), 'links to final invoice');
  const copy = (e.subject + e.html + e.intro + e.outro).toLowerCase();
  assert.ok(!copy.includes('received'), 'paid email must not say "received"');
  assert.ok(!copy.includes('deposit'), 'paid email must not say "deposit"');
});

t('full payment with a discount shows the discount line', () => {
  const order = { ...sampleOrder, items: JSON.stringify([{ name: 'A', sku: 'X', qty: 1, unit_price_pkr: 10000, line_total_pkr: 10000 }]), subtotal: 10000, discount: 1000, shipping_fee: 0, total: 9000, coupon_code: 'WELCOME10' };
  const e = paymentPaidEmail({ order, kind: 'full', amount: 9000, env: testEnv });
  assert.ok(e.html.includes('WELCOME10'), 'shows coupon');
  assert.ok(e.html.includes('-'), 'shows discount sign');
});

t('deposit and balance payments keep their own emails', () => {
  assert.ok(paymentPaidEmail({ order: sampleOrder, kind: 'deposit', amount: 3975, env: testEnv }).subject.startsWith('Deposit received'));
  assert.ok(paymentPaidEmail({ order: sampleOrder, kind: 'balance', amount: 9275, env: testEnv }).subject.startsWith('Order paid in full'));
});

t('balanceReminderEmail has subject and html', () => {
  const e = balanceReminderEmail({ order: sampleOrder, env: testEnv });
  assert.ok(e.subject, 'has subject');
  assert.ok(e.html, 'has html');
  assert.ok(e.html.includes('remaining balance'), 'mentions remaining balance');
});

t('shippedEmail has tracking when provided', () => {
  const e = shippedEmail({ order: sampleOrder, tracking: 'TCS123456789', env: testEnv });
  assert.ok(e.html.includes('TCS123456789'), 'contains tracking number');
  assert.ok(e.html.includes('TCS'), 'contains courier');
});

t('deliveredEmail has subject and html', () => {
  const e = deliveredEmail({ order: sampleOrder, env: testEnv });
  assert.ok(e.subject, 'has subject');
  assert.ok(e.html, 'has html');
  assert.ok(e.html.includes('delivered'), 'mentions delivered');
});

t('cancelledEmail has subject and html', () => {
  const e = cancelledEmail({ order: sampleOrder, reason: 'Stock unavailable', env: testEnv });
  assert.ok(e.subject, 'has subject');
  assert.ok(e.html, 'has html');
  assert.ok(e.html.includes('cancelled'), 'mentions cancelled');
  assert.ok(e.html.includes('Stock unavailable'), 'contains reason');
});

t('refundedEmail has subject and html', () => {
  const e = refundedEmail({ order: sampleOrder, amount: 3975, reason: 'Customer request', env: testEnv });
  assert.ok(e.subject, 'has subject');
  assert.ok(e.html, 'has html');
  assert.ok(e.html.includes('3,975'), 'contains refund amount');
  assert.ok(e.html.includes('Customer request'), 'contains reason');
});

t('wrapEmail produces full HTML layout', () => {
  const e = wrapEmail(testEnv, {
    subject: 'Test Subject',
    title: 'Test Title',
    body: '<p>Test body</p>',
    intro: 'Test intro',
    outro: 'Test outro',
  });
  assert.ok(e.html.includes('<!DOCTYPE html>'), 'is full HTML');
  assert.ok(e.html.includes('Test Subject'), 'contains subject');
  assert.ok(e.html.includes('Test body'), 'contains body');
  assert.ok(e.html.includes('orders@example.com'), 'contains from email');
  assert.ok(e.html.includes('mailto:'), 'contains an email contact link');
});

// ============================================================
// Safepay signature verification (contract lock, 2026-11)
// ============================================================
import { createHmac } from 'node:crypto';
import { processPayment } from '../functions/api/webhook.js';
import { fetchTrackerState } from '../functions/lib/gateway.js';
import { reconcilePayment } from '../functions/lib/reconcile.js';
import { onRequestPost as payOrderPost } from '../functions/api/pay-order.js';

t('webhook signature: HMAC-SHA512 over raw body verifies', async () => {
  const env = { SAFEPAY_WEBHOOK_SECRET: 'whsec_test_123' };
  const body = JSON.stringify({ event: 'payment:created', data: { tracker: 't1' } });
  const sig = createHmac('sha512', 'whsec_test_123').update(body).digest('hex');
  assert.strictEqual(await verifyWebhookSignature(env, body, sig), true, 'valid sha512 sig accepted');
  assert.strictEqual(await verifyWebhookSignature(env, body, 'deadbeef'), false, 'wrong sig rejected');
  assert.strictEqual(await verifyWebhookSignature(env, body, null), false, 'missing sig rejected');
  // raw-body rule: same JSON with different whitespace must NOT verify
  assert.strictEqual(await verifyWebhookSignature(env, body + ' ', sig), false, 'raw body is exact');
});

t('webhook signature: SHA-256 variant accepted (endpoint configs vary)', async () => {
  const env = { SAFEPAY_WEBHOOK_SECRET: 'whsec_test_123' };
  const body = '{"a":1}';
  const sig = createHmac('sha256', 'whsec_test_123').update(body).digest('hex');
  assert.strictEqual(await verifyWebhookSignature(env, body, sig), true);
});

t('webhook signature: fails closed without a configured secret', async () => {
  const sig = createHmac('sha512', 'x').update('body').digest('hex');
  assert.strictEqual(await verifyWebhookSignature({}, 'body', sig), false, 'no secret -> reject');
  assert.strictEqual(await verifyWebhookSignature({ SAFEPAY_WEBHOOK_SECRET: '' }, 'body', sig), false);
});

t('redirect signature: HMAC-SHA256 hex of tracker with v1 secret verifies', async () => {
  const env = { SAFEPAY_V1_SECRET: 'v1_secret', SAFEPAY_SECRET_KEY: 'sk_test' };
  const tracker = '123456789abcdef';
  const sig = createHmac('sha256', 'v1_secret').update(tracker).digest('hex');
  assert.strictEqual(await verifyRedirectSignature(env, tracker, sig), true, 'valid sig accepted');
  assert.strictEqual(await verifyRedirectSignature(env, tracker, 'ff'.repeat(32)), false, 'wrong sig rejected');
  assert.strictEqual(await verifyRedirectSignature(env, tracker, 'not-hex-at-all'), false, 'malformed sig rejected');
  // falls back to the secret key when no separate v1 secret is configured
  const sig2 = createHmac('sha256', 'sk_test').update(tracker).digest('hex');
  assert.strictEqual(
    await verifyRedirectSignature({ SAFEPAY_SECRET_KEY: 'sk_test' }, tracker, sig2),
    true,
    'secret-key fallback verifies'
  );
});

// ============================================================
// Payment safety: duplicate settlement and pay-now guards
// (small fake D1: routes by SQL text; records every write)
// ============================================================
function fakeDb(routes) {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      return {
        bind(...args) {
          const lookup = () => {
            for (const [needle, value] of routes) {
              if (sql.includes(needle)) return typeof value === 'function' ? value(args) : value;
            }
            return null;
          };
          return {
            first: async () => lookup(),
            all: async () => ({ results: lookup() ? [lookup()].flat() : [] }),
            run: async () => {
              writes.push({ sql, args });
              return { success: true, results: [] };
            },
          };
        },
      };
    },
    async batch(stmts) {
      return stmts.map(() => ({ success: true, results: [] }));
    },
  };
}

t('duplicate full payment on a paid order is not settled again', async () => {
  const payment = { id: 'pay-2', order_id: 'AAS-DUP-1', kind: 'full', status: 'pending', amount: 37800, tracker_token: 'trk_2' };
  const order = { id: 'AAS-DUP-1', status: 'paid', payment_type: 'full', total: 37800, deposit_status: 'paid', balance_status: 'paid' };
  const db = fakeDb([
    ['FROM payments WHERE raw_event_id', null],
    ['FROM payments WHERE tracker_token = ? AND status = ?', payment],
    ['FROM orders WHERE id = ?', order],
  ]);
  const res = await processPayment({}, db, { eventId: 'evt_dup_1', trackerToken: 'trk_2', orderId: 'AAS-DUP-1', amount: 37800, kind: 'full' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.duplicate_payment, true);
  assert.ok(!db.writes.some((w) => w.sql.startsWith('UPDATE orders')), 'order must not be re-settled');
  assert.ok(db.writes.some((w) => w.sql.startsWith('UPDATE payments') && w.args.includes('duplicate')), 'payment marked duplicate');
  assert.ok(db.writes.some((w) => w.args.includes('duplicate_payment')), 'duplicate logged for refund');
});

t('pay-now refuses an order whose phone does not match (no hint about the order)', async () => {
  const db = fakeDb([['FROM orders WHERE id = ? AND phone = ?', null]]);
  const req = new Request('https://aasra.shop/api/pay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: 'AAS-X', phone: '03000000000' }),
  });
  const res = await payOrderPost({ request: req, env: { DB: db } });
  const body = await res.json();
  assert.strictEqual(res.status, 404);
  assert.strictEqual(body.code, 'order_not_found');
});

t('pay-now blocks a second payment while one is in progress', async () => {
  const order = { id: 'AAS-P-1', phone: '03001234567', email: 'a@example.com', status: 'pending-payment', payment_type: 'full', total: 37800, items: '[]' };
  const db = fakeDb([
    ['FROM orders WHERE id = ? AND phone = ?', order],
    ["AND status = 'pending' AND created_at > ?", { id: 'pay-old' }],
  ]);
  const req = new Request('https://aasra.shop/api/pay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: 'AAS-P-1', phone: '03001234567' }),
  });
  const res = await payOrderPost({ request: req, env: { DB: db } });
  const body = await res.json();
  assert.strictEqual(res.status, 409);
  assert.strictEqual(body.code, 'payment_in_progress');
  assert.ok(!db.writes.some((w) => w.sql.startsWith('INSERT INTO payments')), 'no second session recorded');
});

t('pay-now refuses an order that has nothing left to pay', async () => {
  const order = { id: 'AAS-P-2', phone: '03001234567', status: 'paid', payment_type: 'full', total: 37800, items: '[]' };
  const db = fakeDb([['FROM orders WHERE id = ? AND phone = ?', order]]);
  const req = new Request('https://aasra.shop/api/pay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: 'AAS-P-2', phone: '03001234567' }),
  });
  const res = await payOrderPost({ request: req, env: { DB: db } });
  const body = await res.json();
  assert.strictEqual(res.status, 409);
  assert.strictEqual(body.code, 'nothing_to_pay');
});

t('checkout only accepts full payment (deposit disabled)', () => {
  // checkout.js imports JSON without an import attribute, so it cannot be
  // loaded by plain Node here. Check the guard in the source instead.
  const src = readFileSync(new URL('../functions/api/checkout.js', import.meta.url), 'utf8');
  assert.ok(
    /if \(payment_type !== 'full'\)[\s\S]{0,200}deposit_disabled/.test(src),
    'checkout must reject any payment_type other than full'
  );
  const checkoutPage = readFileSync(new URL('../src/pages/checkout.astro', import.meta.url), 'utf8');
  assert.ok(!/value="deposit"/.test(checkoutPage), 'checkout page must not offer deposit');
});

t('order lookup takes phone in POST body, not the URL', () => {
  const api = readFileSync(new URL('../functions/api/order-lookup.js', import.meta.url), 'utf8');
  assert.ok(/export async function onRequestPost\(/.test(api), 'lookup must be a POST handler');
  assert.ok(!/onRequestGet/.test(api), 'lookup must not accept GET (phone would appear in URL logs)');
  const page = readFileSync(new URL('../src/pages/order-lookup.astro', import.meta.url), 'utf8');
  assert.ok(!/order-lookup\?order_id=/.test(page), 'lookup page must not put the phone in the URL');
  assert.ok(/method: 'POST'[\s\S]{0,300}\/api\/order-lookup/.test(page) || /\/api\/order-lookup'[\s\S]{0,200}method: 'POST'/.test(page), 'lookup page must POST to /api/order-lookup');
});

const SAFEPAY_TEST_ENV = {
  SAFEPAY_ENABLED: 'true',
  SAFEPAY_SECRET_KEY: 'sec_test',
  SAFEPAY_BASE_URL: 'https://sandbox.api.getsafepay.com',
};

function mockSafepayTracker(tracker) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ tracker }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return calls;
}

t('fetchTrackerState reads state and amount using the merchant secret', async () => {
  const realFetch = globalThis.fetch;
  try {
    const calls = mockSafepayTracker({ state: 'TRACKER_ENDED', amount: 37800 });
    const out = await fetchTrackerState(SAFEPAY_TEST_ENV, 'track_abc');
    assert.deepStrictEqual(out, { state: 'TRACKER_ENDED', amount: 37800 });
    assert.strictEqual(calls[0].url, 'https://sandbox.api.getsafepay.com/reporter/api/v1/payments/track_abc');
    assert.strictEqual(calls[0].init.method, 'GET');
    assert.strictEqual(calls[0].init.headers['X-SFPY-MERCHANT-SECRET'], 'sec_test');
  } finally {
    globalThis.fetch = realFetch;
  }
});

t('reconcile settles a pending full payment that Safepay reports as ended', async () => {
  const realFetch = globalThis.fetch;
  try {
    mockSafepayTracker({ state: 'TRACKER_ENDED', amount: 37800 });
    const payment = { id: 'pay-rec-1', order_id: 'AAS-REC-1', kind: 'full', status: 'pending', amount: 37800, tracker_token: 'track_rec1' };
    const order = { id: 'AAS-REC-1', status: 'pending-payment', payment_type: 'full', total: 37800, email: 'c@example.com', customer_name: 'Test' };
    const db = fakeDb([
      ['FROM payments WHERE raw_event_id', null],
      ['FROM payments WHERE tracker_token = ? AND status = ?', payment],
      ['FROM orders WHERE id = ?', order],
    ]);
    const out = await reconcilePayment(SAFEPAY_TEST_ENV, db, payment);
    assert.strictEqual(out.status, 'settled');
    assert.ok(db.writes.some((w) => w.sql.startsWith('UPDATE orders') && w.args.includes('paid')), 'order marked paid');
    assert.ok(db.writes.some((w) => w.sql.startsWith('UPDATE payments') && w.args.includes('paid')), 'payment marked paid');
  } finally {
    globalThis.fetch = realFetch;
  }
});

t('reconcile does nothing while Safepay says the payment has not ended', async () => {
  const realFetch = globalThis.fetch;
  try {
    mockSafepayTracker({ state: 'TRACKER_AUTHORIZED', amount: 37800 });
    const payment = { id: 'pay-rec-2', order_id: 'AAS-REC-2', kind: 'full', status: 'pending', amount: 37800, tracker_token: 'track_rec2' };
    const db = fakeDb([]);
    const out = await reconcilePayment(SAFEPAY_TEST_ENV, db, payment);
    assert.strictEqual(out.status, 'not_settled');
    assert.strictEqual(db.writes.length, 0, 'nothing written');
  } finally {
    globalThis.fetch = realFetch;
  }
});

t('reconcile refuses to settle when the amount does not match our record', async () => {
  const realFetch = globalThis.fetch;
  try {
    mockSafepayTracker({ state: 'TRACKER_ENDED', amount: 1000 });
    const payment = { id: 'pay-rec-3', order_id: 'AAS-REC-3', kind: 'full', status: 'pending', amount: 37800, tracker_token: 'track_rec3' };
    const order = { id: 'AAS-REC-3', status: 'pending-payment', payment_type: 'full', total: 37800 };
    const db = fakeDb([
      ['FROM payments WHERE raw_event_id', null],
      ['FROM payments WHERE tracker_token = ? AND status = ?', payment],
      ['FROM orders WHERE id = ?', order],
    ]);
    const out = await reconcilePayment(SAFEPAY_TEST_ENV, db, payment);
    assert.strictEqual(out.status, 'rejected');
    assert.strictEqual(out.error, 'amount_mismatch');
    assert.ok(!db.writes.some((w) => w.sql.startsWith('UPDATE orders')), 'order must not be settled');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ============================================================
// Audit fixes (KNOWN_ISSUES #1, #6, #7, #8, #11, #12, #30)
// ============================================================
function fakeD1(error) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() { calls.push({ sql, args }); if (error) throw error; return { success: true }; },
            async first() { calls.push({ sql, args }); if (error) throw error; return null; },
          };
        },
      };
    },
  };
}
function src(path) { return readFileSync(new URL('../' + path, import.meta.url), 'utf8'); }

t('newsletter: signup executes the insert and says subscribed (KNOWN #1)', async () => {
  const db = fakeD1();
  const res = await newsletterPost({ request: new Request('https://x.test/api/newsletter', { method: 'POST', body: JSON.stringify({ email: 'Ana@Example.com', consent: true }) }), env: { DB: db } });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.message, 'subscribed');
  assert.strictEqual(db.calls.length, 1, 'insert must run');
  assert.ok(db.calls[0].sql.startsWith('INSERT INTO newsletter'));
  assert.ok(db.calls[0].args.includes('ana@example.com'), 'email is normalised');
});

t('newsletter: duplicate signup is idempotent (KNOWN #1)', async () => {
  const res = await newsletterPost({ request: new Request('https://x.test/api/newsletter', { method: 'POST', body: JSON.stringify({ email: 'a@b.com', consent: true }) }), env: { DB: fakeD1(new Error('UNIQUE constraint failed: newsletter.email')) } });
  assert.strictEqual((await res.json()).message, 'already_subscribed');
});

t('newsletter: a database failure is reported, not hidden (KNOWN #1)', async () => {
  const res = await newsletterPost({ request: new Request('https://x.test/api/newsletter', { method: 'POST', body: JSON.stringify({ email: 'a@b.com', consent: true }) }), env: { DB: fakeD1(new Error('disk on fire')) } });
  assert.strictEqual(res.status, 500);
});

t('contact: fails closed without Turnstile and escapes every field (KNOWN #7, #8)', () => {
  const c = src('functions/api/contact.js');
  assert.ok(c.includes("turnstile_not_configured"), 'guard present');
  assert.ok(c.includes('escapeHtml(customerName)') && c.includes('escapeHtml(customerMessage)') && c.includes('escapeHtml(customerSubject)'), 'fields escaped');
  assert.ok(!c.includes("orders@example.com"), 'no placeholder recipient');
});

t('pay-balance: fails closed without Turnstile (KNOWN #8)', () => {
  assert.ok(src('functions/api/pay-balance.js').includes("if (!env.TURNSTILE_SECRET_KEY)"));
});

t('email: no placeholder sender; mail is not sent without a configured sender (KNOWN #11)', async () => {
  const { emailConfig, sendEmail } = await import('../functions/lib/email.js');
  assert.strictEqual(emailConfig({}).from, '');
  const realFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response('{}'); };
  try {
    const r = await sendEmail({ EMAIL_PROVIDER: 'resend', EMAIL_PROVIDER_API_KEY: 'k' }, { to: 'a@b.com', subject: 's', html: 'h' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'email_provider_not_configured');
    assert.strictEqual(fetched, false, 'no provider call without a sender');
  } finally { globalThis.fetch = realFetch; }
});

t('shipping email: shows tracking number, no placeholder link (KNOWN #30)', () => {
  const m = shippedEmail({ order: { id: 'AAS-1', customer_name: 'Ana', courier: 'TCS' }, tracking: '123456', env: {} });
  assert.ok(m.html.includes('Tracking number'));
  assert.ok(!m.html.includes('example.com'));
});

t('invoice: unpaid orders get no receipt; token is still checked first (KNOWN #6)', async () => {
  const order = { id: 'AAS-1', status: 'pending-payment', balance_token: 'tok', items: '[]' };
  const db = { prepare: () => ({ bind: () => ({ first: async () => order, all: async () => ({ results: [] }) }) }) };
  const call = (token) => invoiceGet({ env: { DB: db }, request: new Request('https://x.test/api/invoice?order_id=AAS-1&token=' + token) });
  assert.strictEqual((await call('tok')).status, 404);
  assert.strictEqual((await call('bad')).status, 403);
});

t('scheduled: reminder failure logs the right order id (KNOWN #12)', () => {
  assert.ok(src('functions/scheduled.js').includes('dueOrders.results[i].id'));
});

// ============================================================
// Run all tests
// ============================================================
(async () => {
  for (const run of tests) await run();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
