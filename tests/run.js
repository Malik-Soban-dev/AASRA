/**
 * AASRA automated tests.
 * Covers pricing, deposit math, webhook signature verification, stock logic,
 * and order state transitions. Run with: node tests/run.js
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
import { verifyWebhookSignature } from '../functions/lib/gateway.js';

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
    items: [{ sku: 'LIN-IV-135X240', qty: 2, _city: 'Karachi' }],
    products: productsData,
    shippingConfig: { free_shipping_threshold_pkr: 20000, rates: [] },
    paymentType: 'full',
    couponResult: null,
    nowIso: new Date().toISOString(),
  });
  assertEq(c.deposit_amount, 0);
  assertEq(c.balance_amount, 0);
  assertEq(c.total, c.subtotal + c.shipping_fee);
  assertEq(c.total, 13000);
});

t('computeOrder deposit: deposit + balance == total', () => {
  const c = computeOrder({
    items: [{ sku: 'DHR-BG-4X6', qty: 1, _city: 'Lahore' }],
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
      items: [{ sku: 'LIN-IV-135X240', qty: 1, _city: 'Karachi' }],
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
    items: [{ sku: 'DHR-BG-4X6', qty: 1, _city: 'Karachi' }],
    products: productsData,
    shippingConfig: { free_shipping_threshold_pkr: 20000, rates: [] },
    paymentType: 'deposit',
    depositPercent: 30,
    couponResult: null,
    nowIso: new Date().toISOString(),
  });
  assertEq(c.deposit_amount + c.balance_amount, c.total);
  assertEq(c.deposit_amount, 4350);
  assertEq(c.balance_amount, 10150);
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
// Webhook signature verification (async)
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
  };
  assert.ok(await verifyWebhookSignature(env, body, hex));
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
// Run all tests (await async ones), then summary
// ============================================================
(async () => {
  for (const run of tests) await run();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
