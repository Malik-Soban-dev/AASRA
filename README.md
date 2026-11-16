# AASRA — Headless E-Commerce Store for Pakistan on Cloudflare

A code-only (no WordPress) online store for customers in Pakistan, hosted on Cloudflare Pages + Workers + D1.
Design reference: https://shop.brunellocucinelli.com (layout and feel only — no logos, text, or trademarks copied).

**Live domain:** https://aasra.shop

---

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

---

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
/public/data/       public copies of products.json and shipping-rates.json
```

---

## Features

- **Pages**: Home, Shop (filters, search), Product (PDP), Cart drawer, Checkout, Order success, Payment cancelled, Pay balance, Order lookup, Wishlist, Size guide, Shipping info, About, Contact, FAQ, Privacy, Terms, Return/Refund, Deposit/Cancellation policy, Shipping policy, Cookie policy, Accessibility statement, custom 404.
- **Invoices/receipts**: `GET /api/invoice?order_id=&token=&type=deposit|balance|final` — HTML invoice with itemized totals, sales tax fields, deposit/balance breakdown, print-to-PDF.
- **Transactional emails**: order received, deposit paid, balance reminder, balance paid / paid in full, shipped (tracking), delivered, cancelled, refunded — branded HTML layout, WhatsApp + contact footer, sent from your domain via Worker-integrated provider.
- **Support**: WhatsApp click-to-chat button in header/footer; business contact details (phone, email, address) in header and footer.
- **Newsletter**: consent-based signup, stored privately in D1 (never in repo).
- **Security**: secrets in Worker secrets only (`.env`/`.dev.vars` gitignored); CSRF double-submit cookie on state-changing endpoints; CORS restricted to `ALLOWED_ORIGIN`; WAF rate limiting on `/api/*`; Turnstile on checkout/contact/newsletter; webhook signature verified on raw body (idempotent); hosted checkout only (no card data); all prices/stock computed server-side; customer data in D1 only, masked in logs/invoices.
- **Security headers**: HSTS, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; HTTPS + minimum TLS 1.2.
- **Accessibility**: alt text, visible focus, labeled fields, keyboard navigation, reduced motion, skip-to-content links, accessibility statement page.
- **Payments**: full online or deposit + balance; two payments tracked separately; balance paid via unguessable expiring token; order lookup requires order ID + phone.

---

## Business rules (decided defaults)

| Rule | Value |
|------|-------|
| Currency | PKR (whole rupees, no floats) |
| Countries served | Pakistan only |
| Cash on Delivery | Not accepted |
| Payment options | Pay in full online, or deposit + balance online |
| Deposit percentage | 30% of order total (deposit-eligible products only) |
| Balance deadline | 7 days from deposit; auto-cancel if unpaid |
| Stock reservation hold | 15 minutes at checkout |
| Free shipping threshold | 20,000 PKR |
| Courier | TCS (Pakistan) |
| Dispatch | Within 2 business days of payment confirmation |
| Delivery estimate | 2–7 days by city |
| Return window | 7 days of delivery, unused, original packaging |
| Refund method | Original payment method, 7–14 business days |

> These are published defaults. Confirm against your gateway, accountant, and lawyer before public launch.

---

## Quick start

### 1. Install dependencies

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

### 4. Seed stock (optional)

```bash
node scripts/seed-d1.js | npx wrangler d1 execute AASRA_DB
```

### 5. Configure secrets (never commit these)

```bash
npx wrangler pages secret put TURNSTILE_SECRET_KEY
npx wrangler pages secret put SAFEPAY_SECRET_KEY
npx wrangler pages secret put SAFEPAY_WEBHOOK_SECRET
npx wrangler pages secret put EMAIL_PROVIDER_API_KEY
npx wrangler pages secret put ALLOWED_ORIGIN   # https://aasra.shop
```

Non-secret vars:
```bash
npx wrangler pages variable put PUBLIC_BASE_URL      # https://aasra.shop
npx wrangler pages variable put DEFAULT_DEPOSIT_PERCENT  # 30
npx wrangler pages variable put BALANCE_REMINDER_DAYS    # 3,1
npx wrangler pages variable put BALANCE_CANCEL_AFTER_DAYS # 7
npx wrangler pages variable put TAX_RATE_PCT           # 0 (verify with accountant)
npx wrangler pages variable put BUSINESS_NAME          # AASRA
npx wrangler pages variable put BUSINESS_ADDRESS       # Karachi, Pakistan
npx wrangler pages variable put BUSINESS_PHONE         # +92 300 0000000
npx wrangler pages variable put BUSINESS_EMAIL         # orders@aasra.shop
npx wrangler pages variable put TAX_REGISTRATION_NO    # Not registered
```

### 6. Configure Turnstile

Get a sitekey and secret from the Cloudflare dashboard (Turnstile). Add the sitekey to `src/pages/checkout.astro` and `src/pages/contact.astro` (replace the placeholder `0x0...`).

### 7. Configure the payment gateway webhook

In your gateway dashboard, set the webhook URL to:

```
https://aasra.shop/api/webhook
```

Use separate URLs for staging (sandbox keys) and production (live keys). **Never use live keys in preview.**

### 8. Add the custom domain

In the Cloudflare Pages dashboard, add `aasra.shop` as a custom domain. Enable HTTPS, HSTS, and WAF rules.

### 9. Develop locally

```bash
npm run dev
# or
npx wrangler pages dev . --d1 DB --binding DB --persist
```

### 10. Build & deploy

```bash
npm run build
npm run deploy
```

---

## Environment variables

| Variable | Type | Description |
|----------|------|-------------|
| `DB` | D1 binding | The D1 database (set in wrangler.toml) |
| `PUBLIC_BASE_URL` | var | `https://aasra.shop` |
| `DEFAULT_DEPOSIT_PERCENT` | var | Deposit % (default 30) |
| `BALANCE_REMINDER_DAYS` | var | Reminder schedule, e.g. "3,1" |
| `BALANCE_CANCEL_AFTER_DAYS` | var | Auto-cancel after N days (default 7) |
| `TAX_RATE_PCT` | var | Sales tax rate (verify with accountant) |
| `BUSINESS_NAME` | var | Business name for invoices |
| `BUSINESS_ADDRESS` | var | Business address for invoices |
| `BUSINESS_PHONE` | var | Business phone for invoices |
| `BUSINESS_EMAIL` | var | Business email for invoices |
| `TAX_REGISTRATION_NO` | var | Tax/GST registration number |
| `TURNSTILE_SECRET_KEY` | secret | Cloudflare Turnstile secret key |
| `SAFEPAY_SECRET_KEY` | secret | Safepay API secret key |
| `SAFEPAY_WEBHOOK_SECRET` | secret | Safepay webhook signature secret |
| `EMAIL_PROVIDER_API_KEY` | secret | Transactional email API key |
| `ALLOWED_ORIGIN` | secret | CORS allowed origin (`https://aasra.shop`) |

---

## How it works

### Checkout flow
1. Browser POSTs `/api/checkout` with cart (sku + qty only), payment type, customer details, coupon, Turnstile token.
2. Worker validates Turnstile + CSRF, loads **server-side** prices from `products.json`, checks/reserves stock (15-min hold), applies coupon, adds shipping, computes total/deposit/balance.
3. Worker creates the order (pending-payment / pending-deposit), stores an unguessable `balance_token`, creates a gateway hosted-checkout session, returns the checkout URL.
4. Browser redirects to the gateway. The **webhook** (not the redirect) is the source of truth.
5. `POST /api/webhook` verifies the signature on the raw body, matches tracker + amount, is idempotent, marks payment paid, updates order state, confirms stock reservation, emails customer.

### Deposit orders
Two payments per order: deposit then balance. `POST /api/pay-balance` creates the second session using the unguessable `balance_token`. Ship only when paid in full.

### Order lookup
`GET /api/order-lookup?order_id=...&phone=...` — requires both order ID and phone. Returns only that customer's own order; no exposure of other customers' data.

### Invoices
`GET /api/invoice?order_id=...&token=...&type=deposit\|balance\|final` — authorized by the order's unguessable `balance_token`. Includes itemized totals and sales tax fields.

### Money invariant
`deposit_amount + balance_amount === total_amount` exactly, all integers (whole PKR). No floats.

---

## Editing products and stock

### Products
Edit `data/products.json` (id, slug, name, description, category, price_pkr, images[], variants[], deposit_eligible, tags, seo, visible). Rebuild and redeploy to publish changes. Price edits do **not** affect existing orders (prices are snapshotted at checkout).

### Stock
Stock lives in D1 (`stock` table), not in products.json. Seed or update via:

```bash
npx wrangler d1 execute AASRA_DB --command="UPDATE stock SET quantity_available = 10 WHERE sku = 'LIN-IV-135X240'"
```

Seed helper:
```bash
node scripts/seed-d1.js
```

---

## Refunds

Refunds are done through the gateway dashboard/API. After refunding:
1. Update the order status to `refunded` in D1.
2. Restock the items (`UPDATE stock SET quantity_available = quantity_available + <qty> WHERE sku = ...`).
3. Email the customer using the `refundedEmail` template.

---

## Key rotation

If any secret is leaked, rotate immediately:

```bash
npx wrangler pages secret put TURNSTILE_SECRET_KEY   # new value
npx wrangler pages secret put SAFEPAY_SECRET_KEY
npx wrangler pages secret put SAFEPAY_WEBHOOK_SECRET
npx wrangler pages secret put EMAIL_PROVIDER_API_KEY
```

Redeploy after rotating. Old keys are invalidated immediately by Cloudflare.

---

## Backup and restore

### Backup
```bash
npx wrangler d1 export AASRA_DB --output=backup-$(date +%F).sql
```

### Restore
```bash
npx wrangler d1 execute AASRA_DB --file=backup-2026-11-16.sql
```

Schedule daily exports via a cron job or Cloudflare Pages function.

---

## Testing

```bash
npm test
```

Tests cover pricing, deposit math, coupons, webhook signature verification, stock logic, order state transitions, invoice generation, and email templates. All 27 tests pass.

---

## Launch checklist

- [ ] D1 database created and migrations run
- [ ] Secrets configured (Turnstile, Safepay, email, CORS origin)
- [ ] Turnstile sitekey added to checkout and contact pages
- [ ] Gateway webhook URL set to `https://aasra.shop/api/webhook`
- [ ] Custom domain `aasra.shop` added in Cloudflare Pages
- [ ] HTTPS, HSTS, WAF rules enabled
- [ ] Email domain: SPF, DKIM, DMARC records configured; send test emails
- [ ] WhatsApp number updated (replace `923000000000` placeholder)
- [ ] Tax rate and registration number verified with accountant
- [ ] Full test matrix run on staging (sandbox keys)
- [ ] Small real order placed (deposit + balance), settlement verified, refunded
- [ ] Soft launch with friends and family; review first 20 orders

---

## Failure runbook

| Failure | Action |
|---------|--------|
| Webhook missing | Cron reconciliation job checks pending payments against gateway |
| Stuck unpaid balance | Auto-cancel after `BALANCE_CANCEL_AFTER_DAYS`; release reservation |
| Double payment | Idempotency by `raw_event_id`; second webhook ignored |
| Stock oversell | 15-minute reservation + server-side revalidation at checkout |
| Email failure | Webhook continues; error logged to `order_events` |
| Key leak | Rotate immediately via `wrangler pages secret put` |
| Order lookup returns nothing | Customer must provide exact order ID + phone used at checkout |
| Balance link expired | Order auto-cancelled after 7 days; customer must place a new order |

---

## Monitoring and backups

- Worker logs and error alerts (email/WhatsApp) for failed checkouts, failed webhooks, email failures
- Uptime checks on the homepage and API
- Daily export of orders to backup (CSV or Sheet)
- Documented restore steps (see Backup and restore)
- Keys stored in a password manager

### Weekly checks
- Gateway settlements vs. orders
- Unpaid balances, failed payments, stock accuracy, returns, support backlog

---

## Open decisions — user-supplied items still needed

Before public launch, you must supply:

1. **Gateway**: Safepay or PayFast; methods required (cards, JazzCash, Easypaisa, bank transfer); answers to the gateway verification list (two-payment support, minimum amounts, fees, session expiry, refund rules, webhook signature method, onboarding documents).
2. **Email provider** and sending domain (Resend, Mailgun, SendGrid, Postmark, or Amazon SES) + SPF/DKIM/DMARC.
3. **WhatsApp number** — replace `923000000000` placeholder in `src/components/Header.astro`, `src/components/Footer.astro`, and `functions/lib/email.js`.
4. **Couriers** — confirm TCS rates by city; update `data/shipping-rates.json`.
5. **Tax registration and invoice format** — from your accountant (update `TAX_RATE_PCT` and `TAX_REGISTRATION_NO`).
6. **Brand content** — logo, product photography, descriptions, size guides, all policy text, email templates.
7. **Budget and launch date**.

---

## Security notes

- Never put secrets in code. `.env` and `.dev.vars` are in `.gitignore`.
- Never trust the browser for prices, stock, discounts, or payment status.
- All amounts are integers (whole PKR); no floats.
- Webhook: verify signature on raw body, match tracker and amount, idempotent processing.
- Hosted checkout only — no card data on our systems.
- 2FA on Cloudflare, GitHub, gateway account, email provider, and domain registrar. Registrar lock enabled.
