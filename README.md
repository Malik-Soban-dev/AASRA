# AASRA — Headless E-Commerce Store for Pakistan on Cloudflare

A code-only (no WordPress) online store for customers in Pakistan, hosted on Cloudflare Pages + Workers + D1.
Design reference: https://shop.brunellocucinelli.com (layout and feel only — no logos, text, or trademarks copied).

## Stack

| Layer | Choice |
|-------|--------|
| Hosting | Cloudflare Pages (static) |
| Backend | Cloudflare Pages Functions (Workers) |
| Database | Cloudflare D1 (SQLite) |
| Frontend | Astro (static output) |
| Payments | Safepay (primary) / PayFast (alternative) — hosted checkout only |
| Bot protection | Cloudflare Turnstile |
| Email | Transactional provider called from Worker (stubbed — configure Resend/Mailgun/etc.) |
| Analytics | Cloudflare Web Analytics |
| Images | WebP/AVIF committed to repo or R2 |

## Repo layout

```
/public             static assets, images, robots.txt, _headers, _redirects
/src                Astro pages, components, styles, lib
/data/products.json product catalog (static)
/data/shipping-rates.json city-based shipping rates
/functions/api/*    Pages Functions: checkout, pay-balance, webhook, order-lookup, contact, newsletter, invoice, csrf-token
/functions/scheduled.js cron: balance reminders, auto-cancel, release reservations, reconcile
/migrations/        D1 schema (0001_initial.sql, 0002_balance_token.sql)
/tests              automated tests
/scripts            seed helpers
```

## Features

- **Pages**: Home, Shop (filters, search), Product (PDP), Cart drawer, Checkout, Order success, Payment cancelled, Pay balance, Order lookup, Wishlist, Size guide, Shipping info, About, Contact, FAQ, Privacy, Terms, Return/Refund, Deposit/Cancellation policy, Shipping policy, Cookie policy, Accessibility statement, custom 404.
- **Invoices/receipts**:  — HTML invoice with itemized totals, sales tax fields, deposit/balance breakdown, print-to-PDF.
- **Transactional emails**: order received, deposit paid, balance reminder, balance paid / paid in full, shipped (tracking), delivered, cancelled, refunded — branded HTML layout, WhatsApp + contact footer, sent from your domain via Worker-integrated provider.
- **Support**: WhatsApp click-to-chat button in header/footer; business contact details (phone, email, address) in header and footer.
- **Newsletter**: consent-based signup, stored privately in D1 (never in repo).
- **Security**: secrets in Worker secrets only (/ gitignored); CSRF double-submit cookie on state-changing endpoints; CORS restricted to ; WAF rate limiting on ; Turnstile on checkout/contact/newsletter; webhook signature verified on raw body (idempotent); hosted checkout only (no card data); all prices/stock computed server-side; customer data in D1 only, masked in logs/invoices.
- **Security headers**: HSTS, CSP, , , , ; HTTPS + minimum TLS 1.2.
- **Accessibility**: alt text, visible focus, labeled fields, keyboard navigation, reduced motion, skip-to-content links, accessibility statement page.
- **Payments**: full online or deposit + balance; two payments tracked separately; balance paid via unguessable expiring token; order lookup requires order ID + phone.

## Custom domain

Your store domain is **https://aasra.shop**. Set it in Cloudflare Pages (Custom domains) and configure:

-  (Pages variable)
-  (Pages secret)
- Safepay webhook URL: 
- Turnstile domain added in Cloudflare dashboard

## WhatsApp number (placeholder)

The WhatsApp click-to-chat links use  as a placeholder. Replace with your real WhatsApp number (e.g. ) in , , and  before launch.

## Quick start

### 1. Install deps

```bash
npm install
```

### 2. Create the D1 database

```bash
npx wrangler d1 create AASRA_DB
```

Copy the printed `database_id` into `wrangler.toml` (`[[d1_databases]] database_id`).

### 3. Run migrations

```bash
npm run d1:execute
```

### 4. Configure secrets (never commit these)

```bash
npx wrangler pages secret put TURNSTILE_SECRET_KEY
npx wrangler pages secret put SAFEPAY_SECRET_KEY
npx wrangler pages secret put SAFEPAY_WEBHOOK_SECRET
npx wrangler pages secret put EMAIL_PROVIDER_API_KEY
npx wrangler pages secret put ALLOWED_ORIGIN   # e.g. https://shop.yourdomain.com
```

Non-secret vars:
```bash
npx wrangler pages variable put PUBLIC_BASE_URL      # https://shop.yourdomain.com
npx wrangler pages variable put DEFAULT_DEPOSIT_PERCENT  # 30
npx wrangler pages variable put BALANCE_REMINDER_DAYS    # 3,1
npx wrangler pages variable put BALANCE_CANCEL_AFTER_DAYS # 7
```

### 5. Configure Turnstile

Get a sitekey and secret from the Cloudflare dashboard (Turnstile). Add the sitekey to `src/pages/checkout.astro` and `src/pages/contact.astro` (replace the placeholder `0x0...`).

### 6. Configure the payment gateway webhook

In your gateway dashboard, set the webhook URL to:

```
https://shop.yourdomain.com/api/webhook
```

Use separate URLs for staging (sandbox keys) and production (live keys). **Never use live keys in preview.**

### 7. Develop locally

```bash
npm run dev
# or
npx wrangler pages dev . --d1 DB --binding DB --persist
```

### 8. Build & deploy

```bash
npm run build
npm run deploy
```

Attach your custom domain in the Cloudflare Pages dashboard, enable HTTPS + HSTS.

## Environment variables

| Variable | Type | Description |
|----------|------|-------------|
| `DB` | D1 binding | The D1 database (set in wrangler.toml) |
| `TURNSTILE_SECRET_KEY` | secret | Cloudflare Turnstile secret key |
| `SAFEPAY_SECRET_KEY` | secret | Safepay API secret key |
| `SAFEPAY_WEBHOOK_SECRET` | secret | Safepay webhook signature secret |
| `EMAIL_PROVIDER_API_KEY` | secret | Transactional email API key |
| `PUBLIC_BASE_URL` | var | Your store's public URL |
| `DEFAULT_DEPOSIT_PERCENT` | var | Deposit % (default 30) |
| `BALANCE_REMINDER_DAYS` | var | Reminder schedule, e.g. "3,1" |
| `BALANCE_CANCEL_AFTER_DAYS` | var | Auto-cancel after N days (default 7) |
| `ALLOWED_ORIGIN` | secret | CORS allowed origin |

## How it works

### Checkout flow
1. Browser POSTs `/api/checkout` with cart (sku + qty only), payment type, customer details, coupon, Turnstile token.
2. Worker validates Turnstile, loads **server-side** prices from `products.json`, checks/reserves stock (15-min hold), applies coupon, adds shipping, computes total/deposit/balance.
3. Worker creates the order (pending-payment / pending-deposit), creates a gateway hosted-checkout session, returns the checkout URL.
4. Browser redirects to the gateway. The **webhook** (not the redirect) is the source of truth.
5. `POST /api/webhook` verifies the signature on the raw body, matches tracker + amount, is idempotent, marks payment paid, updates order state, confirms stock reservation, emails customer.

### Deposit orders
Two payments per order: deposit then balance. `POST /api/pay-balance` creates the second session. Pay only when paid in full.

### Money invariant
`deposit_amount + balance_amount === total_amount` exactly, all integers (whole PKR). No floats.

## Tests

```bash
npm test
```

Tests cover pricing, deposit math, webhook signature verification, stock logic, and order state transitions.

## Open decisions — you must supply (do not guess)

These are marked throughout the code with `VERIFY` / TODO comments. Fill them in before launch:

1. **Brand**: name, domain, categories, product count, photos/copy.
2. **Gateway**: Safepay or PayFast; verify methods (cards/JazzCash/Easypaisa/bank transfer), two-payment support, minimum amounts, fees, session expiry, refund rules, webhook signature method, onboarding documents.
3. **Deposit**: %, eligible products, refundability, balance deadline.
4. **Framework/DB**: Astro + D1 (current defaults) — or plain JS / Airtable/Sheets.
5. **Email provider** and sending domain (SPF/DKIM/DMARC).
6. **Couriers**, delivery cities, shipping prices, free-shipping threshold.
7. **Admin dashboard** (now or later — Cloudflare Access); phone/OTP verification (now or later).
8. **Tax registration & invoice format** (from your accountant).
9. **Budget and launch date**.

## Security

- Secrets in wrangler secrets / encrypted env vars — `.env` and `.dev.vars` are gitignored.
- Webhook signature verified on raw body; idempotent by event ID.
- Hosted checkout only — no card data on our systems.
- All prices/stock/discounts computed server-side.
- CORS restricted to `ALLOWED_ORIGIN`.
- Cloudflare WAF rate limiting on `/api/*`; Turnstile on checkout/contact/newsletter.
- Security headers via `public/_headers` (CSP-ready, `X-Frame-Options: DENY`, HSTS via Pages).

## Runbook (common failures)

| Failure | Action |
|---------|--------|
| Webhook missing | Cron reconciliation job checks pending payments against gateway |
| Stuck unpaid balance | Auto-cancel after `BALANCE_CANCEL_AFTER_DAYS`; release reservation |
| Double payment | Idempotency by `raw_event_id`; second webhook ignored |
| Stock oversell | 15-minute reservation + server-side revalidation at checkout |
| Email failure | Webhook continues; error logged to `order_events` |
| Key leak | Rotate immediately via `wrangler pages secret put` |

## Deliverables

- Full source (frontend + Workers + migrations + tests), commented.
- `products.json` + `shipping-rates.json` with 8 sample entries.
- This README: setup, env vars, deployment, add/edit products, refunds, key rotation, restore from backup.
- Launch checklist and runbook above.
- List of open decisions (section 15 of the brief).
