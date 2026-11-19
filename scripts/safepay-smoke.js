#!/usr/bin/env node
/**
 * safepay-smoke.js — run Safepay's real Express Checkout flow in the sandbox
 * and print the hosted checkout URL. Proves the integration end-to-end
 * before any customer sees it.
 *
 * Mirrors Safepay's official SDK (getsafepay/safepay-python client.py):
 *   1. POST /order/payments/v3/        -> tracker token
 *   2. POST /client/passport/v1/token  -> auth token (TBT)
 *   3. Build {checkout}/embedded/?tbt=...&tracker=...&environment=...
 *
 * Usage:  node scripts/safepay-smoke.js [amountPkr]
 * Keys:   from env, or from .dev.vars (gitignored) in the repo root.
 *         Needs SAFEPAY_API_KEY (sec_...) + SAFEPAY_SECRET_KEY.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Load .dev.vars if present (KEY="value" lines).
const env = { ...process.env };
const devVars = join(root, '.dev.vars');
if (existsSync(devVars)) {
  for (const line of readFileSync(devVars, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
}

const baseUrl = env.SAFEPAY_BASE_URL || 'https://sandbox.api.getsafepay.com';
const checkoutBase = env.SAFEPAY_CHECKOUT_URL || baseUrl;
const environment = env.SAFEPAY_ENVIRONMENT || (baseUrl.includes('sandbox') ? 'sandbox' : 'production');
const apiKey = env.SAFEPAY_API_KEY;
const secret = env.SAFEPAY_SECRET_KEY;
const amountPkr = Number(process.argv[2] || 100);

if (!secret || secret.includes('REPLACE_ME') || !apiKey || apiKey.includes('REPLACE_ME')) {
  console.error('SAFEPAY_API_KEY / SAFEPAY_SECRET_KEY missing — copy .dev.vars.example to .dev.vars and fill in your sandbox keys.');
  process.exit(1);
}

async function safepayPost(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'X-SFPY-MERCHANT-SECRET': secret,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`POST ${path} -> HTTP ${res.status}`);
  if (!res.ok) {
    console.log(text);
    process.exit(1);
  }
  return JSON.parse(text).data;
}

const orderId = `SMOKE-${Date.now().toString(36).toUpperCase()}`;
const amountPaisa = Math.round(amountPkr * 100);

console.log(`1) Creating payment session: ${amountPkr} PKR (${amountPaisa} paisa), order ${orderId}`);
const session = await safepayPost('/order/payments/v3/', {
  merchant_api_key: apiKey,
  intent: 'CYBERSOURCE',
  mode: 'payment',
  currency: 'PKR',
  amount: amountPaisa,
  include_fees: false,
  metadata: { order_id: orderId },
});
const tracker = session.tracker.token;
console.log(`   tracker: ${tracker} (state: ${session.tracker.state})`);

console.log('2) Creating auth token (TBT)...');
const tbt = await safepayPost('/client/passport/v1/token');
console.log(`   tbt: ${String(tbt).slice(0, 24)}...`);

const url = new URL('/embedded/', checkoutBase);
url.searchParams.set('tbt', tbt);
url.searchParams.set('tracker', tracker);
url.searchParams.set('environment', environment);
url.searchParams.set('source', 'hosted');
url.searchParams.set('redirect_url', 'https://aasra.shop/api/safepay-return');
url.searchParams.set('cancel_url', 'https://aasra.shop/payment-cancelled');
url.searchParams.set('order_id', orderId);

console.log(`\nHosted checkout URL:\n${url.toString()}`);
console.log('\nOpen it in a browser — the sandbox checkout should render with test payment methods.');
