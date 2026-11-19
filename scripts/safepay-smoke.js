#!/usr/bin/env node
/**
 * safepay-smoke.js — create a real sandbox tracker and print the hosted
 * checkout URL. Proves the integration end-to-end before any customer sees it.
 *
 * Usage:  node scripts/safepay-smoke.js [amountPkr]
 * Keys:   from env, or from .dev.vars (gitignored) in the repo root.
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
const checkoutHost = env.SAFEPAY_CHECKOUT_URL || 'https://sandbox.getsafepay.com';
const secret = env.SAFEPAY_SECRET_KEY;
const amountPkr = Number(process.argv[2] || 100);

if (!secret || secret.includes('REPLACE_ME')) {
  console.error('SAFEPAY_SECRET_KEY missing — copy .dev.vars.example to .dev.vars and fill in your sandbox keys.');
  process.exit(1);
}

const reference = `SMOKE-${Date.now().toString(36).toUpperCase()}`;
const payload = {
  order: { reference },
  invoice: { amount: Math.round(amountPkr * 100), currency: 'PKR' },
  redirect_url: 'https://aasra.shop/api/safepay-return',
  cancel_url: 'https://aasra.shop/payment-cancelled',
  webhook: true,
};

console.log(`POST ${baseUrl}/tracker/v1/  reference=${reference} amount=${amountPkr} PKR (${payload.invoice.amount} paisa)`);
const res = await fetch(`${baseUrl}/tracker/v1/`, {
  method: 'POST',
  headers: {
    'X-SFPY-MERCHANT-SECRET': secret,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log(`HTTP ${res.status}`);
try {
  const data = JSON.parse(text);
  console.log(JSON.stringify(data, null, 2));
  const token = (data.data && (data.data.token || data.data.tracker)) || data.token || data.tracker;
  if (token) {
    console.log(`\nHosted checkout URL:\n${checkoutHost}/checkout?token=${token}`);
    console.log('\nOpen it in a browser — the sandbox checkout should render with test payment methods.');
  }
} catch {
  console.log(text);
}
process.exit(res.ok ? 0 : 1);
