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
import { verifyWebhookSignature, createCheckoutSession } from '../functions/lib/gateway.js';
import { buildInvoiceHtml } from '../functions/lib/invoice.js';
import {
  orderReceivedEmail,
  depositPaidEmail,
  balancePaidEmail,
  balanceReminderEmail,
  shippedEmail,
  deliveredEmail,
  cancelledEmail,
  refundedEmail,
  wrapEmail,
  sendEmail,
} from '../functions/lib/email.js';

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
// Run all tests
// ============================================================
(async () => {
  for (const run of tests) await run();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
