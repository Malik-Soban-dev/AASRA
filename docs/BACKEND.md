# AASRA — Backend reference

Everything the server does: endpoints, money rules, stock holds, payment settlement, email, invoices, security layers, database schema, and tests. Written from the code at snapshot `eb7e511`. Where the code and an older doc disagree, the code wins and the disagreement is listed in `KNOWN_ISSUES.md`.

Companion docs: `PLAYBOOK.md` (how to build), `OPERATIONS.md` (how to run), `KNOWN_ISSUES.md` (defects to fix before reuse), `HISTORY.md` (how we got here).

---

## 1. Runtime model

- **One Cloudflare Worker** named `aasra` (`wrangler.toml`), serving static pages from `dist/` and the API.
- `src/index.js` is the Worker entry. It sends `/api/*` requests to the compiled Pages-style router (`dist-worker/index.js`, built from `functions/` by `wrangler pages functions build`). Everything else falls back to the static assets binding.
- `src/index.js` also exports `scheduled()`, which runs `functions/scheduled.js` on the cron triggers.
- `wrangler.toml [assets] run_worker_first = ["/api/*"]` makes sure API calls always reach the Worker. Without it, the static 404 page was returned for API routes.
- D1 binding `DB` (database `AASRA_DB`).
- Node compatibility: `nodejs_compat` flag. `process.env` is **not** populated by default; see the invoice defect in `KNOWN_ISSUES.md`.

## 2. Request pipeline (`functions/api/_middleware.js`)

Every `/api/*` request passes through this middleware before its handler:

1. **CORS.** `ALLOWED_ORIGIN` is a comma-separated list. The middleware echoes the origin if it is listed, otherwise it uses the first entry. `OPTIONS` returns 204. Allowed methods `POST, GET, OPTIONS`. Allowed headers `Content-Type, X-CSRF-Token, X-SFPY-SIGNATURE`.
2. **Origin check** for `POST`, `PUT`, `PATCH`, `DELETE`. The `Origin` header must be in `ALLOWED_ORIGIN`. Exempt: `/api/webhook` and `/api/safepay-return` (server-to-server, authenticated by HMAC).
3. **CSRF double-submit.** For the same state-changing methods, the `csrf_token` cookie must equal the `X-CSRF-Token` header. Same exemptions.
4. **Response headers.** `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store, no-cache, must-revalidate`.

Note: the exemption test is `request.url.includes('/api/webhook')`. It is a substring match, which is fine today but should be an exact path match in a reused project.

Rate limits are **not** in code. They are documented in `wrangler.toml` comments and must be created in the Cloudflare dashboard (see `OPERATIONS.md` §6).

## 3. Endpoint reference

All responses are JSON with `ok: true|false`, except the invoice (HTML), the safepay-return browser page (HTML), and the stock/CSRF responses (JSON with their own fields). Error responses have `error` (human text) and `code` (machine code).

| Method and path | Auth | Purpose | Source |
|---|---|---|---|
| `GET /api/csrf-token` | none; rejects foreign `Origin` | Issues a 48-hex-char token and sets cookie `csrf_token` (`SameSite=Strict; Secure`) | `csrf-token.js` |
| `POST /api/checkout` | Origin + CSRF + Turnstile | Creates an order, reserves stock, opens a Safepay session | `checkout.js` |
| `POST /api/webhook` | HMAC-SHA512 over raw body (`X-SFPY-SIGNATURE`) | Settles a payment from Safepay's webhook | `webhook.js` |
| `POST /api/safepay-return` | HMAC-SHA256 of tracker token with the v1 secret (`sig`) | Settles a payment from Safepay's signed server-to-server return | `safepay-return.js` |
| `GET /api/safepay-return` | none (display only) | Browser page after payment. Says "Payment received" only if D1 shows the order paid | `safepay-return.js` |
| `POST /api/order-lookup` | order ID + phone (must match) | Returns order status and what can be paid | `order-lookup.js` |
| `POST /api/pay-order` | order ID + phone | Opens a payment session for a pending full order (or a legacy balance) | `pay-order.js` |
| `POST /api/pay-balance` | order ID + `token` (= `balance_token`) + optional Turnstile | **Legacy deposit balance.** Kept for old orders | `pay-balance.js` |
| `GET /api/invoice?order_id=&token=&type=` | `token` = `balance_token` | HTML invoice or receipt. `type` is `deposit`, `balance`, or `final` (default) | `invoice.js` |
| `GET /api/stock?skus=A,B,…` | none | A status per SKU: `out`, `low` (1 to 3), `in_stock`. No counts. `stock: null` if D1 is unavailable | `stock.js` |
| `POST /api/contact` | Turnstile (only if its secret is set) | Sends the message to the business mailbox and an auto-reply to the customer | `contact.js` |
| `POST /api/newsletter` | none (WAF rate limit only) | Consent-based signup. **Currently does not store anything; see KNOWN_ISSUES** | `newsletter.js` |

### 3.1 `POST /api/checkout`

**Input:** `{ cart: [{ sku, qty }], payment_type: "full", customer: { name, phone, email, city, address, notes? }, coupon_code?, turnstile_token }`.

**Checks, in order:**
1. JSON parses; required fields `cart`, `payment_type`, `customer`, `turnstile_token`.
2. Configuration. Missing D1 → 503 `database_not_configured`. Missing Turnstile secret → 503 `turnstile_not_configured`. Safepay not fully configured (`SAFEPAY_ENABLED`, secret key, public key, `SAFEPAY_PROTOCOL_VERIFIED` must all be set) → 503 `safepay_not_fully_configured`. Checkout never falls back to a fake URL.
3. `payment_type` must be `full`. Otherwise 400 `deposit_disabled`.
4. Turnstile siteverify. Failure → 403 `turnstile_failed`.
5. Cart: array of 1–20 entries, each `sku` matching `^[A-Z0-9-]+$` (max 64 chars), no duplicate SKUs, `qty` clamped to 1–10 (default 1).
6. Customer: `name`, `phone`, `email`, `city`, `address` required. Phone normalised to `03XXXXXXXXX` (accepts `+92`, `92…`, `0092…`, spaces, dashes). Email format check. Strings trimmed and length-capped (name 100, address 500, notes 1000).
7. Pricing from the server catalogue (`data/products.json`), never from the browser. Products must have `visible !== false`.
8. Coupon, if given. Invalid or unknown coupons are **silently ignored** (no error to the customer).
9. Stock reservation for 15 minutes. Insufficient stock → 409 `out_of_stock:<sku>`.
10. Insert order (`status = pending-payment`), link reservations to the order, write events `order_created` and `stock_reserved`.
11. Create the Safepay session. On failure: release the reservations, set the order to `cancelled`, write `gateway_session_failed`, return 502 `payment_session_failed`.
12. Insert a `payments` row (`status = pending`, `kind = full`), write `payment_pending`.
13. Send the order-received email. A failure is logged as `email_failed` and does not block checkout.

**Output:** `{ ok, order_id, checkout_url, tracker_token, amount_due_now, total, deposit_amount: 0, balance_amount: 0, expires_at }`.

Any unexpected exception after the order row exists sets the order to `cancelled`, releases its reservations, and returns 500 `checkout_failed`.

**Order number:** `AAS-YYYYMMDD-XXXX`, where `XXXX` is 4 random base-36 characters. It is not checked for collisions; a collision fails the insert and the checkout returns an error.

### 3.2 `POST /api/webhook`

1. Reads the raw body. The signature is checked on the raw text, before parsing.
2. Signature: HMAC-SHA512 hex (SHA-256 also accepted) of the raw body, keyed with `SAFEPAY_WEBHOOK_SECRET`. Constant-time compare. Missing secret → always invalid (fail closed). Failure → 401 `invalid_signature`.
3. Parsed fields: event id (`token`), event type (`type`), tracker (`data.tracker`), amount (`data.amount`), currency, state (`data.state`), order id (`data.metadata.order_id`).
4. Missing any of event id, tracker, order id, type, status, amount, or currency → 400 `unverified_webhook_contract`.
5. Only event type `payment.succeeded` with state `TRACKER_ENDED` can settle (`isSettlementEvent`). Otherwise 200 `ignored: payment_not_successful`.
5a. Safepay is then asked directly (`confirmPaidWithSafepay`, `GET /reporter/api/v1/payments/{tracker}`). Not finished there → 200 `ignored: not_settled_at_gateway`. Safepay unreachable → 502 `verification_unavailable`, so Safepay retries. The webhook amount must match Safepay's amount, or 400 `amount_mismatch`.
6. Currency must be `PKR`.
7. `processPayment` (shared with the signed return and reconciliation, see §5).

**Known gap:** step 5 accepts `created` and `payment:created`, and processing does not check the state field. A non-final event could settle an order. See `KNOWN_ISSUES.md` #2.

### 3.3 `POST /api/safepay-return`

- Body may be JSON or form-encoded. Needs `tracker` (or `token`, `tracker_token`) and `sig` (or `signature`). `orderId` / `order_id` / `order` / `ref` are optional.
- `sig` must equal HMAC-SHA256 hex of the tracker token keyed with `SAFEPAY_V1_SECRET`, or with `SAFEPAY_SECRET_KEY` if no v1 secret is set. Failure → 401.
- Settlement goes through `processPayment` with **no amount check**. The comment in the code says the tracker-to-payment mapping is the trust anchor here. See `KNOWN_ISSUES.md` #2.

`GET /api/safepay-return?order=…&tracker=…` renders a short HTML page and redirects to `/order-success?order=…`. It looks up the order from `tracker` if `order` is missing. It says "Payment received" only if the order status is `paid` or `deposit-paid`. It never settles anything.

### 3.4 `POST /api/order-lookup`

**Input:** `{ order_id, phone }`. The phone is sent in the body, not the URL, so it stays out of request logs.

- Phone normalised as in checkout. Order must match both ID and phone. No match → 404 `order_not_found`, which does not reveal whether the ID exists.
- If the order is `pending-payment`, it first runs reconciliation on its payments older than 2 minutes. If Safepay reports the payment ended, the order updates before the response.
- **Output:** `order_id, status, payment_type, total, deposit_amount, balance_amount, balance_due, deposit_status, balance_status, balance_due_at, can_pay_balance, can_pay, amount_due, courier, tracking_number, created_at`.
- `can_pay` is true for a full order still `pending-payment`. `amount_due` is the total then.

### 3.5 `POST /api/pay-order`

**Input:** `{ order_id, phone }`. Same match rule as lookup.

- Cancelled or refunded → 409 `order_not_payable`.
- A full order still `pending-payment` → kind `full`, amount = total. A legacy deposit order with balance due → kind `balance`. Anything else → 409 `nothing_to_pay`.
- One open payment at a time: a pending payment younger than 30 minutes → 409 `payment_in_progress`.
- For a full order, earlier active holds are released and stock is reserved again (15 minutes). No stock → 409 `out_of_stock`.
- Creates a Safepay session and a `payments` row. Settlement still comes only from the webhook, the signed return, or reconciliation.

### 3.6 `POST /api/pay-balance` (legacy)

Deposit orders only. Input `{ order_id, token, turnstile_token }`. Turnstile is checked **only if** its secret is set. The `token` must equal `balance_token`. Expired balance (`balance_due_at` in the past) → 410. Creates a Safepay session for the balance. The page `src/pages/pay-balance.astro` reads its parameters at build time, so it is empty on the static site. See `KNOWN_ISSUES.md`.

### 3.7 `GET /api/invoice`

- Needs `order_id` and `token` (= `balance_token`). Wrong token → 403. Unknown order → 404.
- `type` is `deposit`, `balance`, or `final` (default). Other values → 400.
- Renders HTML from the order's item snapshot. Payment date and reference come from the latest `paid` payment of the matching kind. For `final`, the kind matched is `full`.
- The invoice does **not** check that the order is paid. An unpaid order renders as an invoice.
- Tax lines and business details come from `process.env`; see `KNOWN_ISSUES.md` #5.
- The token is the same secret used for balance payments, and it does not expire for full orders. Anyone holding the invoice link has the customer's items, name, address and total.

### 3.8 `GET /api/stock?skus=…`

- Up to 50 SKUs, each up to 64 characters. None given → 400 `missing_skus`.
- No D1 or a read error → `{ ok: true, stock: null, reason: "stock_unavailable" }`. The storefront then shows its generic availability note.
- Returns a status per SKU (`out`, `low` for 1 to 3 units, `in_stock`), never the number. No auth. The storefront does not call this endpoint yet.

### 3.9 `POST /api/contact`

- Required: `name`, `email`, `message`, `turnstile_token`. Optional: `phone`, `subject` (default "Contact form").
- Turnstile is checked **only if** `TURNSTILE_SECRET_KEY` is set. If it is unset, the check is skipped. See `KNOWN_ISSUES.md`.
- Sends the message to `EMAIL_FROM` (the business mailbox) and an auto-reply to the customer. A send failure → 502 `email_error`.
- The customer's text is inserted into the business email HTML **without escaping**. See `KNOWN_ISSUES.md`.

### 3.10 `POST /api/newsletter`

- Required: `email` (valid), `consent: true`. Email is lower-cased.
- The insert statement is built but **never executed** (`.run()` is missing), so nothing is stored. The API still returns `subscribed`. A `UNIQUE` error path returns `already_subscribed`, but it cannot be reached. See `KNOWN_ISSUES.md` #1.

## 4. Money rules

- **Currency:** PKR, whole rupees, integers only (`price_pkr`, totals, fees). The gateway receives paisa (`rupees × 100`).
- **Prices:** from the server catalogue at checkout. Each line is snapshotted into `orders.items` (name, sku, qty, unit price, line total, category). Later catalogue edits do not change old orders.
- **Subtotal:** sum of `unit price × qty`.
- **Coupon** (`coupons` table, validated at checkout):
  - `percentage`: `floor(subtotal × value / 100)`, value must be an integer 1–100.
  - `fixed`: `value`, integer ≥ 1.
  - Rejected with a reason (and ignored) if expired, usage limit reached, or below `min_order`. Discount is capped at the subtotal.
  - Usage is counted when the order is **paid** (`processPayment`). `used_count` goes up only while `usage_limit` allows. If the limit is already reached when payment arrives, the order is still paid and a `coupon_limit_reached` event is logged.
- **Shipping:** looked up by city in `data/shipping-rates.json` (case-insensitive). Unknown city → the `Other` rate. Free when the subtotal after discount is **≥ PKR 20,000** (`free_shipping_threshold_pkr`).
- **Total:** `subtotal − discount + shipping`.
- **Tax:** **not added to order totals.** `TAX_RATE_PCT` is `0`, and tax appears only on the invoice (see §3.7 and `KNOWN_ISSUES.md` #5).
- **Deposit split:** removed. Checkout accepts only `full`. Full orders store `deposit_amount = 0` and `balance_amount = 0`. The helper `assertMoneyInvariant` (`deposit + balance = total`) is still used by legacy code only.

### 4.1 Shipping table (`data/shipping-rates.json`, updated 2026-11-16)

| City | Fee (PKR) | Estimate (days) | Courier |
|---|---|---|---|
| Karachi | 250 | 2–3 | TCS |
| Lahore | 250 | 2–3 | TCS |
| Islamabad | 300 | 2–3 | TCS |
| Rawalpindi | 300 | 2–3 | TCS |
| Faisalabad | 350 | 3–4 | TCS |
| Multan | 350 | 3–4 | TCS |
| Peshawar | 400 | 3–4 | TCS |
| Quetta | 500 | 4–5 | TCS |
| Hyderabad | 350 | 3–4 | TCS |
| Sialkot | 350 | 3–4 | TCS |
| Gujranwala | 350 | 3–4 | TCS |
| Bahawalpur | 400 | 4–5 | TCS |
| Sukkur | 450 | 4–5 | TCS |
| Larkana | 450 | 4–5 | TCS |
| Sheikhupura | 350 | 3–4 | TCS |
| Other | 600 | 5–7 | TCS |

Free shipping at PKR 20,000 applies to all cities. The same threshold appears in the header announcement, the home page, the cart drawer, the cart page, and the FAQ. Change all of them together.

## 5. Payment settlement

Three paths reach the same function, `processPayment` (`webhook.js`). Each path has its own trust check.

| Path | Trigger | Trust check | Amount check | Status check |
|---|---|---|---|---|
| Webhook | Safepay POST to `/api/webhook` | HMAC-SHA512 of raw body | Yes (rupees or paisa) | Event type and status allowlist (see §3.2) |
| Signed return | Safepay POST to `/api/safepay-return` | HMAC-SHA256 of tracker with v1 secret | **No** | None |
| Reconciliation | Cron, or order lookup | Safepay reporter API with the merchant secret | Yes; fails closed if Safepay returns no amount | `state == TRACKER_ENDED` |

`processPayment` then:

1. **Idempotency.** If a `payments` row already has this event id as `raw_event_id`, return `duplicate`. The event id is `token` from the webhook, `sf-return-<tracker>` for the signed return, or `reconcile-<tracker>`.
2. **Match.** Find the `pending` payment by `tracker_token`. If none, return `duplicate` when a `paid` row exists for that tracker, otherwise 404 `no_pending_payment`.
3. **Check** `order_id` and `amount` (if given) and `kind` (if given). Mismatch → 400.
4. **Duplicate guard.** A second full payment on an order already `paid` is recorded as status `duplicate` with event `duplicate_payment` and `action: refund_required`. The order is not settled again and the customer is not emailed again. Refunds are done by hand.
5. **Transition.** Full payment → order `paid` (both payment statuses `paid`). Legacy deposit and balance transitions are still in the code.
6. **Update** the payment row to `paid`, set the raw event id, update the order, and set this order's `active` reservations to `confirmed`.
7. **Events.** `payment_paid_full` (or the deposit or balance equivalent), then `order_paid_in_full`.
8. **Email.** Full payment → `fullPaidEmail` (subject "Order paid in full — <id>"). A failure is logged as `email_failed` and does not undo settlement.

**Reconciliation schedule** (`functions/scheduled.js`, `wrangler.toml` crons):
- Every 15 minutes (`*/15 * * * *`): pending payments created 10 minutes to 6 hours ago.
- Daily at 09:00 UTC (`0 9 * * *`): the daily jobs below, plus pending payments up to 72 hours old.
- On order lookup: pending payments on that order older than 2 minutes.

**Daily jobs** (run only on the 09:00 UTC cron):
1. Release expired stock holds (`reservations` with status `active` and `expires_at` in the past): restore stock, mark `released`, write `reservation_expired`.
2. Balance reminders for legacy deposit orders (3 and 1 days before due). No new order can match this query, because deposits are removed.
3. Auto-cancel of legacy deposit orders with an unpaid balance after 7 days.
4. Wider reconciliation (72 hours).

**Consequence of the schedule:** an abandoned checkout keeps its stock held until the next 09:00 UTC run, because the 15-minute cron returns before step 1. See `KNOWN_ISSUES.md` #3.

## 6. Stock and holds

- `stock` table: one row per SKU. `quantity_available` is decremented when a hold is placed, not when payment succeeds.
- **Hold** (`reserveStock`): 15 minutes. Each item is checked in one D1 batch. A short stock fails the whole reservation with `insufficient_stock:<sku>`. Reservation rows start with `order_id = '__PENDING_ORDER__'`, then get the real order id.
- **Release** (`releaseReservations`): only rows still `active` go back to stock, so stock is never returned twice. Used on checkout failure, gateway failure, pay-order retries, and the daily expiry job.
- **Confirm:** on settlement, the order's `active` reservations become `confirmed`. Their stock is not changed again.
- **Race:** the check and the decrement are separate statements in a batch. D1 has no `SELECT … FOR UPDATE`. Two checkouts for the last unit can both pass the check in theory. The batch makes this unlikely, not impossible.
- **Late payment:** if a payment completes after its hold expired and the stock was released, settlement still succeeds and no stock is re-checked. See `KNOWN_ISSUES.md` #4.
- **Seed quantities** (`scripts/seed-d1.js`): 3 units for SKUs whose product price is above 10,000, otherwise 8. Marked VERIFY in the script. Replace with real inventory before launch.

## 7. Order states

Statuses reachable in current code:

| Status | Set by | Meaning |
|---|---|---|
| `pending-payment` | checkout insert | Waiting for payment |
| `paid` | `processPayment` (full) | Paid in full |
| `cancelled` | checkout failure paths; legacy auto-cancel | Not payable |
| `refunded` | **nothing in code** (manual) | Refund issued |
| `pending-deposit`, `deposit-paid` | legacy deposit flow | Kept for old orders |
| `packed`, `shipped`, `delivered`, `returned` | **nothing in code** (manual) | Fulfilment, set by hand in D1 |

Other order fields: `deposit_status` and `balance_status` are `unpaid` for every new order. `tracking_number` and `courier` (from the shipping table) exist. `balance_token` is set on every order, and is the secret for invoice links.

`payments.status` values: `pending`, `paid`, `duplicate`. `failed` and `refunded` exist in the schema but are not written by code.

## 8. Email

**Sender:** `sendEmail` (`functions/lib/email.js`) calls the Resend API (`https://api.resend.com/emails`) when `EMAIL_PROVIDER = resend` and `EMAIL_PROVIDER_API_KEY` is set. Any other provider returns `email_provider_not_implemented`. Missing config returns `email_provider_not_configured`. Nothing claims success when sending is off. Sender defaults: `EMAIL_FROM` and `EMAIL_FROM_NAME`. Fallback address `orders@example.com` if unset.

**Layout:** `wrapEmail` puts each message in the same branded frame (header, intro, button, outro, footer with the business name and `EMAIL_FROM`).

**Templates and when they are sent:**

| Template | Subject | Sent by | Status |
|---|---|---|---|
| `orderReceivedEmail` | "Order received — <id>" | checkout | In use |
| `fullPaidEmail` | "Order paid in full — <id>" | `processPayment` (full) | In use. Shows Paid, line items, totals, discount, invoice link |
| `paymentPaidEmail` | routes to full / balance / deposit | `processPayment` | In use (routes) |
| `depositPaidEmail`, `balancePaidEmail`, `balanceReminderEmail` | deposit or balance subjects | legacy | Legacy |
| `shippedEmail` | "Order shipped — <id>" (tracking link for TCS) | **nothing** | Template only |
| `deliveredEmail` | "Order delivered — <id>" | **nothing** | Template only |
| `cancelledEmail` | "Order cancelled — <id>" | **nothing** | Template only |
| `refundedEmail` | "Refund issued — <id>" | **nothing** | Template only |
| Contact emails | "[Contact] <subject>" and "We received your message — AASRA" | `contact.js` | In use |

Send failures are written to `order_events` as `email_failed`. They never fail checkout or settlement.

**Email rules:** the order-received and paid emails link to `/order-lookup` and to the invoice with the balance token. Those links are long-lived bearer links; treat forwarded email as a data exposure.

## 9. Invoices and receipts

- `buildInvoiceHtml` (`functions/lib/invoice.js`) renders an HTML document: business block, customer block, item table, subtotal, discount, shipping, tax, total, payment date and reference when a matching payment exists. Titles: "Tax Invoice" for `final`; "Deposit Receipt" and "Balance Payment Receipt" for the legacy types.
- Business name, address, phone, email, tax registration number and tax rate come from `process.env` (see `KNOWN_ISSUES.md` #5).
- Print-to-PDF is done by the browser. No PDF is generated server-side.

## 10. Security layers

| Layer | Where | Notes |
|---|---|---|
| HTTPS, HSTS (1 year, includeSubDomains, preload) | `public/_headers` | Min TLS 1.2 is set at the edge |
| CSP | `public/_headers` | `default-src 'self'`; scripts allow `'unsafe-inline'` and Turnstile; styles allow Google Fonts; `frame-ancestors 'none'`. `'unsafe-inline'` is a hardening item |
| Framing and sniffing | `public/_headers`, middleware | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` |
| Permissions | `public/_headers` | camera, microphone, geolocation, payment, usb off |
| Cache | `public/_headers` | HTML revalidates; `/_astro/*` and `/images/*` immutable; `/data/*` 60 seconds |
| Origin and CSRF | middleware | See §2 |
| Turnstile | checkout (fails closed), contact (skipped if no secret), pay-balance (skipped if no secret), pay-order (none) | See `KNOWN_ISSUES.md` #8 |
| HMAC | webhook, signed return, reconciliation | Constant-time compare |
| Phone match | order lookup, pay-order | Required with the order ID |
| Price and stock from server | checkout, pay-order | Browser never sends prices |
| Integers only | pricing | Whole PKR |
| Logs | `wrangler.toml [observability.logs]` | Workers logs on, sampling 100%. Card data never reaches the Worker: Safepay's hosted page takes it |
| Rate limits | Cloudflare WAF (dashboard) | Documented in `wrangler.toml`. Not created by code. See `OPERATIONS.md` §6 |

## 11. Database

Migrations: `migrations/0001_initial.sql`, then `migrations/0002_balance_token.sql`. Apply with `npm run d1:migrate` (or the dashboard console). The schema sets `PRAGMA foreign_keys = ON`, but no table declares a foreign key (`REFERENCES` appears nowhere). Referential integrity is by convention only.

| Table | Key columns | Notes |
|---|---|---|
| `stock` | `sku` (PK), `quantity_available`, `updated_at` | One row per SKU |
| `reservations` | `id` (PK), `order_id`, `sku`, `qty`, `expires_at`, `status` (`active`, `released`, `confirmed`), `created_at` | 15-minute holds |
| `orders` | `id` (PK, public order number), `status`, `customer_name`, `phone`, `email`, `city`, `address`, `notes`, `items` (JSON snapshot), `subtotal`, `shipping_fee`, `discount`, `total`, `payment_type`, `deposit_amount`, `balance_amount`, `deposit_status`, `balance_status`, `balance_due_at`, `coupon_code`, `courier`, `tracking_number`, `created_at`, `updated_at`, `balance_token` (0002) | Indexes on status, created_at, phone, balance_token |
| `payments` | `id` (PK), `order_id`, `kind` (`full`, `deposit`, `balance`), `gateway`, `tracker_token`, `amount`, `currency`, `status`, `raw_event_id`, `created_at`, `updated_at` | Indexes on order, tracker, raw event id, status |
| `order_events` | `id` (PK), `order_id`, `type`, `details` (JSON), `created_at` | The audit log. Every state change writes here |
| `coupons` | `code` (PK), `type`, `value`, `min_order`, `expires_at`, `usage_limit`, `used_count`, `created_at` | Seed adds `WELCOME10` (10%, min 5,000, to 2027-12-31). Remove or change before launch if not wanted |
| `newsletter` | `id` (PK), `email` (UNIQUE), `source`, `subscribed_at`, `unsubscribed_at` | Empty, because the insert never runs (see §3.10) |

**Personal data held:** names, phone numbers, emails and delivery addresses in `orders`; emails in `newsletter` and `order_events` details. There is no retention rule in code. See `OPERATIONS.md` §9.

## 12. Tests

`npm test` runs `tests/run.js` (46 checks at this snapshot). `pretest` rebuilds the catalogue first.

- **Validation:** phone normalisation, email, cart validation (empty, duplicates, bad SKU), string sanitising.
- **Money:** full payment has zero deposit and balance; deposit invariant; ineligible deposit cart throws; odd amounts keep the invariant; coupon caps and expiry.
- **Signatures:** webhook HMAC-SHA512 accepted; SHA-256 variant accepted; wrong signature rejected; missing secret rejected; redirect HMAC-SHA256 accepted.
- **Gateway:** checkout refuses to simulate a gateway when configuration is absent; email reports "unconfigured" rather than a fake success.
- **Order state:** transitions; a duplicate full payment on a paid order is not settled again; pay-order refuses phone mismatch, a second payment while one is in progress, and orders with nothing to pay; checkout accepts only full payment; order lookup takes the phone in the POST body.
- **Reconciliation:** fetches state and amount with the merchant secret; settles an ended full payment; does nothing while not ended; refuses to settle on an amount mismatch.
- **Invoices and emails:** invoice contains order id and totals; receipt types; full payment email shows items, totals, Paid; deposit and balance emails keep their own subjects; shipped, delivered, cancelled, refunded templates render; the layout wrapper.
- **Catalogue:** the test file loads `data/products.json` but has no catalogue-integrity assertions. The build script (`scripts/build-catalog.js`) is the only check: required fields, sizes, colours, images, valid size labels, and sub-category keys. Unique slugs and SKUs are not checked anywhere. See `KNOWN_ISSUES.md` #11.

**Not covered by tests:** newsletter storage (the defect is not caught), the scheduled jobs, the Safepay return endpoint's HTTP behaviour, the D1 stock race, the middleware CORS and CSRF paths, and catalogue uniqueness. Several tests read source text instead of importing modules, because importing `checkout.js` directly fails in Node.

## 13. Known defects

See `KNOWN_ISSUES.md`. Summary of the ones that affect money, orders, or customer data: webhook status allowlist (#2), signed return without amount check (#2), stock hold timing (#3, #4), tax and business details on invoices (#5), newsletter not stored (#1), unescaped contact email HTML (#7).
