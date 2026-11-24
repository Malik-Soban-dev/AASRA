# AASRA — Online store for Pakistan on Cloudflare

A code-only online store (no WordPress). Static pages are built with Astro. One Cloudflare Worker serves the pages and the API. One D1 database holds stock and orders. Payment is by Safepay hosted checkout. Email is sent through Resend.

- **Live domain (configured):** https://aasra.shop
- **Design reference:** an established luxury-fashion site, used for layout and feel only. No logos, copy, photos or product names are reused.

## Documentation

| Document | What it is for |
|---|---|
| [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md) | How to build a similar store from zero, and what we learned. Start here. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Short reference: system shape, directories, data model, rules. |
| [`docs/BACKEND.md`](docs/BACKEND.md) | Every API endpoint, money and settlement rules, order states, schema, tests. |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Runbook: fulfilment, refunds, stock, coupons, deploys, secrets, incidents. |
| [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) | Defects and gaps found in the code, with evidence and suggested fixes. Read before taking payments. |
| [`docs/HISTORY.md`](docs/HISTORY.md) | Build record: every pull request, decisions and reasons, owner rules, dead ends. |
| [`docs/CATALOG_INDEX.md`](docs/CATALOG_INDEX.md) | Generated list of categories and products. |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Tokens, components, motion, imagery, copy, accessibility. |
| [`skills/`](skills/) | Rules for anyone (or any agent) editing the project. |

---

## Stack

| Layer | Choice |
|---|---|
| Hosting | Cloudflare Worker with static assets (`dist/`, binding `ASSETS`). `/api/*` always runs the Worker. |
| Backend | Worker entry `src/index.js`. API handlers in `functions/api/*`, compiled by `wrangler pages functions build` during `npm run build`. |
| Database | Cloudflare D1, binding `DB`, database `AASRA_DB`. |
| Front end | Astro, static output. Client-side navigation between browse pages (Astro `ClientRouter`). |
| Payments | Safepay hosted checkout. Sandbox configured. Live is not approved. |
| Email | Resend (`functions/lib/email.js`). Send failures are logged and do not block checkout. |
| Bot protection | Cloudflare Turnstile on checkout. Contact form: see `docs/KNOWN_ISSUES.md` #33. |
| Scheduled jobs | Cron triggers `*/15 * * * *` and `0 9 * * *` (`functions/scheduled.js`). |
| Analytics | None configured. |
| Images | WebP in the repository, under `public/images/`. |

Node **24** (`.nvmrc`, `engines.node >= 24`). Node 22 fails the build.

---

## Repository layout

```
data/catalog/site.json              brand text, hero, nav, footer              (edit)
data/catalog/<gender>/<cat>.json    one file per category, with its products    (edit)
data/products.json                  GENERATED from data/catalog (do not edit)
data/shipping-rates.json            shipping fee by city; free over PKR 20,000  (edit)
public/data/                        public copies of products.json and shipping-rates.json
public/images/                      product, hero and campaign images
scripts/build-catalog.js            validates and builds the catalogue
scripts/seed-d1.js                  prints SQL for stock and the sample coupon
scripts/smoke-worker.mjs            smoke test against a running Worker
scripts/safepay-smoke.js            gateway check
src/index.js                        Worker entry (API router, scheduled handler)
src/pages/                          routes
src/components/layout/              page shell (StoreLayout)
src/components/store/               storefront components
src/styles/tokens.css               design values
src/styles/store.css                storefront styles
functions/api/*.js                  API handlers
functions/api/_middleware.js        CORS, origin and CSRF checks for /api/*
functions/lib/                      pricing, stock, gateway, email, invoice, reconcile, validation
functions/scheduled.js              cron jobs
migrations/                         D1 schema: 0001_initial.sql, 0002_balance_token.sql
tests/run.js                        46 checks
docs/                               documentation (see above)
```

---

## Pages

- **Home** (`/`), **Women** and **Men** (`/women`, `/men`), with category pages and sub-category pages (for example `/women/footwear/boots`).
- **New In** (`/<gender>/new-in`), **Shop** (`/shop`, with category, type, search and sort in the URL), **Product** (`/product/<slug>`).
- **Bag and checkout:** `/cart`, `/checkout`, `/order-success`, `/payment-cancelled`, `/order-lookup`.
- **Legacy:** `/pay-balance`, `/deposit-policy` (deposits were removed; see below).
- **Information:** about, contact, FAQ, shipping, shipping policy, size guide, boutiques, services, appointment, responsibility, journal, wishlist, gifts, new arrivals.
- **Policies:** privacy, terms, return policy, cookie policy, accessibility statement.
- **Custom 404.**

---

## Business rules (published defaults)

| Rule | Value |
|---|---|
| Currency | PKR, whole rupees, no floats |
| Countries served | Pakistan only |
| Cash on delivery | Not accepted |
| Payment | Full payment online only. Deposits were removed. |
| Stock hold at checkout | 15 minutes |
| Free shipping threshold | PKR 20,000 (same wording in the header, home, bag, FAQ and cart) |
| Shipping fees | `data/shipping-rates.json` (Karachi and Lahore 250, Islamabad and Rawalpindi 300, Quetta 500, other cities 600) |
| Courier | TCS (to confirm rates by city) |
| Return window | 7 days from delivery, unused, in original packaging |
| Refund | Original payment method |

> These are published defaults. Confirm them with the gateway, the accountant and a lawyer before public launch. Dispatch and delivery time claims in the policy pages are not yet confirmed.

---

## Quick start

### 1. Install

```bash
npm ci
```

### 2. Create the D1 database

Dashboard: **Storage & Databases → D1 → Create database** → `AASRA_DB`. Or, with `wrangler login`: `npx wrangler d1 create AASRA_DB`.

`wrangler.toml` already contains a `[[d1_databases]]` block for `AASRA_DB`. For a new site, replace its `database_id` with the new database's ID.

### 3. Apply the migrations

Easiest: dashboard → D1 → database → **Console**. Paste `migrations/0001_initial.sql`, then `migrations/0002_balance_token.sql`. Do not paste either file twice.

Or, with `wrangler login`: `npm run d1:migrate` (applies both to the remote database).

### 4. Seed stock (optional, once)

```bash
node scripts/seed-d1.js > /tmp/seed.sql
npx wrangler d1 execute AASRA_DB --remote --file=/tmp/seed.sql
```

The seed uses plain `INSERT`s. Running it twice on the same database fails on the primary key. Seed quantities are placeholders (`KNOWN_ISSUES.md` #14).

### 5. Set the secrets (never commit them)

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put SAFEPAY_SECRET_KEY
npx wrangler secret put SAFEPAY_WEBHOOK_SECRET
npx wrangler secret put EMAIL_PROVIDER_API_KEY
```

Optional: `SAFEPAY_V1_SECRET` (only if the Safepay dashboard shows a separate v1 secret; otherwise the signed return uses `SAFEPAY_SECRET_KEY`). Enter each value at the prompt. Do not put it on the command line. The dashboard path is **Workers & Pages → aasra → Settings → Variables and Secrets** (type **Secret**).

Non-secret variables are in `wrangler.toml` `[vars]`.

### 6. Turnstile

Create a Turnstile widget in the Cloudflare dashboard. Put the **site key** in the GitHub Actions repository variable `PUBLIC_TURNSTILE_SITE_KEY`. It is read at build time (`src/pages/checkout.astro`), so changing it needs a new build and deploy. Put the **secret** in `TURNSTILE_SECRET_KEY` (step 5).

### 7. Safepay webhook

In the Safepay dashboard, set the webhook URL for the environment you are using:

```
https://aasra.shop/api/webhook
```

Sandbox and live are separate. Use sandbox keys in staging and live keys only in production. **Never use live keys in preview.**

### 8. Custom domain

Dashboard: **Workers & Pages → aasra → Settings → Domains & Routes → Add → Custom domain**. Set `PUBLIC_BASE_URL` to the same domain. Enable HSTS and WAF rules on the zone. The WAF rate-limit rules are described in `docs/OPERATIONS.md` §6. They are not confirmed as created.

### 9. Run locally

```bash
npm run dev                                    # build, then wrangler dev on http://localhost:8787
BASE_URL=http://127.0.0.1:8787 node scripts/smoke-worker.mjs
npm test
```

Local development needs `.dev.vars` (copy `.dev.vars.example`). Never commit it. Without D1, the stock endpoint returns `stock: null` and checkout returns 503. That is expected.

### 10. Build and deploy

Every push to `main` runs `.github/workflows/deploy.yml`: `npm ci`, `npm run build` (with `PUBLIC_TURNSTILE_SITE_KEY` from the repository variable), then `npx wrangler deploy`. It needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The workflow can also be run by hand from the Actions tab.

Manual deploy from a terminal: `npm run build && npm run deploy`.

Before merging a change to `functions/`, check that the Worker bundles:

```bash
npx wrangler deploy --dry-run --outdir /tmp/wdry
```

---

## Environment variables

Names and kinds. Values are never written in this file.

| Name | Kind | Purpose |
|---|---|---|
| `DB` | D1 binding | `AASRA_DB` |
| `ASSETS` | binding | Static assets (`dist/`) |
| `PUBLIC_BASE_URL` | var | Site URL used in emails and links |
| `ALLOWED_ORIGIN` | var | Comma-separated origins allowed to call the API. If unset or `*`, the origin and CSRF checks are switched off (`KNOWN_ISSUES.md` #31). |
| `TAX_RATE_PCT` | var | Tax rate for invoices. `0` and marked VERIFY. Not added to order totals (`KNOWN_ISSUES.md` #5). |
| `BUSINESS_NAME`, `BUSINESS_EMAIL` | var | Invoice and receipt details |
| `BUSINESS_ADDRESS`, `TAX_REGISTRATION_NO` | var | Empty. Required before live. |
| `BUSINESS_PHONE` | read by `process.env` | Not set in `wrangler.toml`. See `KNOWN_ISSUES.md` #5. |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | var | Email settings. Provider `resend`. |
| `EMAIL_PROVIDER_API_KEY` | secret | Resend API key |
| `SAFEPAY_ENABLED`, `SAFEPAY_PROTOCOL_VERIFIED` | var | Both `true` in the production config. Previews set `SAFEPAY_ENABLED` to `false`. |
| `SAFEPAY_BASE_URL`, `SAFEPAY_CHECKOUT_URL` | var | Sandbox hosts now. Live hosts are not approved. |
| `SAFEPAY_ENVIRONMENT` | read by `gateway.js` | Not set in `wrangler.toml`. Defaults from the sandbox setting. |
| `SAFEPAY_API_KEY` | var | Public Safepay key (`sec_…`), kept in `wrangler.toml` |
| `SAFEPAY_SECRET_KEY` | secret | Safepay secret key |
| `SAFEPAY_WEBHOOK_SECRET` | secret | Webhook signature secret (`X-SFPY-SIGNATURE`) |
| `SAFEPAY_V1_SECRET` | secret, optional | Signed return. Falls back to `SAFEPAY_SECRET_KEY`. |
| `TURNSTILE_SECRET_KEY` | secret | Turnstile server check |
| `PUBLIC_TURNSTILE_SITE_KEY` | GitHub Actions variable | Build-time site key |
| `PAYFAST_ENABLED` | var | `false`. PayFast is not built (`KNOWN_ISSUES.md` #32). |
| `DEFAULT_DEPOSIT_PERCENT`, `BALANCE_REMINDER_DAYS`, `BALANCE_CANCEL_AFTER_DAYS` | var | Legacy deposit settings. Still read by the scheduled jobs. |

GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

---

## How it works

### Checkout

1. The browser posts `POST /api/checkout` with SKUs and quantities only (never prices), the customer details, an optional coupon and the Turnstile token.
2. The Worker checks Turnstile and CSRF, prices the cart on the server, applies the coupon, adds shipping, and reserves stock for 15 minutes.
3. The Worker creates the order (`pending-payment`), gives it a `balance_token`, creates a Safepay hosted-checkout session and returns its URL.
4. The browser goes to Safepay. The **webhook**, not the redirect, is the source of truth for payment.
5. `POST /api/webhook` checks the signature on the raw body, matches the tracker, order and amount, records the payment idempotently, marks the order paid, and sends the paid email.

The exact rules, including the known gaps in step 5, are in `docs/BACKEND.md` §5 and `docs/KNOWN_ISSUES.md` #2.

### Order lookup

`POST /api/order-lookup` with the order ID and phone number. Both must match. It returns that customer's order only.

### Invoices

`GET /api/invoice?order_id=…&token=…&type=deposit|balance|final`. The `balance_token` is the access token. It has no expiry, and the invoice does not check that the order is paid (`KNOWN_ISSUES.md` #6).

### Money

Prices are whole PKR, stored as integers. Order prices are copied into the order at checkout, so later price edits do not change existing orders. For deposit orders (legacy), `deposit + balance` must equal `total` (`assertMoneyInvariant`). Full orders carry zero deposit and balance.

### Deposits (removed)

Checkout accepts only `payment_type=full`. The balance-payment endpoint and page (`/api/pay-balance`, `/pay-balance`) still exist in code. They are not linked from the store and need a decision before use (`docs/PLAYBOOK.md` §11).

---

## Editing products and stock

### Products

Edit the category files in `data/catalog/<gender>/<category>.json`. Then run:

```bash
npm run catalog:build      # validates, writes data/products.json and public/data/products.json
npm test
```

The build fails on missing required fields, an empty size, colour or image list, a bad size, or a sub-category key that the category does not list. It does not check that slugs or SKUs are unique (`KNOWN_ISSUES.md` #11). Do not commit the two generated `products.json` files without the owner's agreement.

Each size and colour pair becomes a SKU, in the form `AS-<id>-<colour>-<size>`, for example `AS-W001-IVO-XS`. Do not rename SKUs after launch.

### Stock

Stock is in the D1 `stock` table, one row per SKU. Set a count:

```bash
npx wrangler d1 execute AASRA_DB --remote --command "UPDATE stock SET quantity_available = 10, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE sku = 'AS-W001-IVO-XS';"
```

---

## Refunds

Refunds are manual. `refundPayment` throws "not implemented" (`KNOWN_ISSUES.md` #9). Follow `docs/OPERATIONS.md` §4:

1. Refund at Safepay.
2. Set the order to `refunded` in D1, and log the event.
3. Restock only goods that came back unused.
4. Email the customer. The `refundedEmail` template exists, but no code sends it.

---

## Key rotation

1. Rotate the value at its provider first: Safepay, Resend, or Cloudflare Turnstile.
2. Set the new value with `npx wrangler secret put <NAME>`.
3. Check the logs for signature failures over the next hour (`docs/OPERATIONS.md` §10).

---

## Backup and restore

**Backup** (the file contains customer data; keep it out of Git and out of chat):

```bash
npx wrangler d1 export AASRA_DB --remote --output=backup-$(date +%F).sql
```

**Restore** (into a database that is empty or being replaced; check the target first):

```bash
npx wrangler d1 execute AASRA_DB --remote --file=backup-YYYY-MM-DD.sql
```

No scheduled backup is configured yet (`KNOWN_ISSUES.md` #27). Restore has not been tested.

---

## Testing

```bash
npm test          # 46 checks: validation, money, signatures, order states, reconciliation, invoices, email templates
npm run typecheck # astro check
npm run smoke     # against a running Worker
```

Not covered by the tests: newsletter storage, scheduled jobs, the signed return's HTTP behaviour, the stock race, the CORS and CSRF paths, and catalogue uniqueness. See `docs/BACKEND.md` §12.

---

## Launch checklist (status at snapshot `eb7e511`)

- [x] D1 database created and migrations applied (sandbox)
- [x] Secrets set (sandbox)
- [x] Turnstile site key in the build
- [ ] Safepay webhook URL confirmed in the sandbox dashboard
- [ ] Safepay webhook matching confirmed by a completed PAID test order
- [ ] Contact form works (`KNOWN_ISSUES.md` #33)
- [ ] Known issues #1–#5 fixed or accepted in writing by the owner
- [ ] WAF rate-limit rules created (`docs/OPERATIONS.md` §6)
- [ ] Email DNS: SPF, DKIM and DMARC checked with `nslookup`
- [ ] Tax rate, registration number and business address confirmed with the accountant
- [ ] Real stock counts set
- [ ] Backups scheduled and a restore tested
- [ ] A small real order placed, paid, shipped and refunded (requires live payments, not approved)
- [ ] Soft launch with friends and family; review the first 20 orders

---

## Failure runbook

Full runbook: `docs/OPERATIONS.md` §14. Short form:

| Failure | What happens | Action |
|---|---|---|
| Webhook missing | The 15-minute reconciliation checks pending payments with Safepay. | Check the logs for `[RECONCILE]`. |
| Customer paid, order still pending | Reconciliation or the order lookup settles it. | Check the Safepay dashboard. Do not mark paid by hand. |
| Double payment | Recorded as `duplicate` and flagged `refund_required`. The order stays paid. | Refund the second payment at Safepay. |
| Stock oversell | A hold lasts 15 minutes. Expired holds are released only in the daily run. A late payment can settle without a stock check (`KNOWN_ISSUES.md` #3, #4). | Check stock by hand after a late payment. |
| Email failure | Logged as `email_failed` in `order_events`. Checkout and payment continue. | Check Resend, then send the email by hand. |
| Key leak | — | Rotate at the provider, then `npx wrangler secret put` (see Key rotation). |
| Order lookup returns nothing | The order ID or phone does not match. | The customer must give the exact order ID and the phone used at checkout. |

---

## Monitoring

- **Workers Logs** are enabled in `wrangler.toml`. Look for `[WEBHOOK]`, `[RECONCILE]`, `[CHECKOUT]` and `email_failed`.
- Error alerts and uptime checks are **not configured** (`KNOWN_ISSUES.md` #28).

Weekly checks, daily queries and the shipping queue are in `docs/OPERATIONS.md` §2.

---

## Open decisions (owner)

Before public launch, the owner supplies or confirms:

1. **Safepay:** merchant onboarding (step 1 of 6), live keys, and written confirmation of the checkout, webhook and return contract. The config already sets `SAFEPAY_PROTOCOL_VERIFIED=true`, based on Safepay's official SDK. That is not the same as a confirmed live contract.
2. **Business details:** legal address, phone, tax registration, and tax rules confirmed with an accountant.
3. **Couriers:** TCS rates by city, then update `data/shipping-rates.json`.
4. **Content:** descriptions, size guides, policy text and email wording.
5. **Photos:** real product, colour and denim photos, and footwear images. Placeholders until then.
6. **Stock:** real counts.
7. **Retention:** how long customer data is kept (`docs/OPERATIONS.md` §9).
8. **Budget and launch date.**

---

## Security notes

- Never put secrets in code. `.env`, `.dev.vars` and `.dev.vars.example` values stay out of Git. Only names go in the example files.
- Never trust the browser for prices, stock, discounts or payment status. The server decides them.
- Amounts are integers (whole PKR).
- Checkout fails closed: it returns 503 unless D1, Turnstile and Safepay are configured. No mock checkout URL is returned.
- Security headers (HSTS, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) are in `public/_headers`. The CSP still allows `'unsafe-inline'` (`KNOWN_ISSUES.md` #17).
- Known security gaps are listed in `docs/KNOWN_ISSUES.md`. Read it before live payments.
