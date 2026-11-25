# AASRA — Operations runbook

How to run the store day to day: fulfilment, refunds, stock, coupons, deploys, secrets, backups, the payment-mode switch, and incidents. Every command here is written for a Worker named `aasra` with D1 database `AASRA_DB`.

Read `KNOWN_ISSUES.md` first. Several steps below are manual because the code does not yet do them.

**Placeholders:** text in `<angle brackets>` is replaced by you. Never paste real secret values into a command you save, a commit, or a chat.

---

## 1. Who does what

| Task | Done by | How |
|---|---|---|
| Edit products, copy, prices | Owner or developer | `data/catalog/**` JSON, then build and deploy (§12) |
| Stock counts | Owner | SQL on the `stock` table (§5) |
| Coupons | Owner | SQL on the `coupons` table (§5) |
| Packing and shipping | Owner | SQL update (§3). The courier is TCS |
| Refunds | Owner | Gateway dashboard, then SQL (§4) |
| Customer questions | Owner | The contact form emails the business mailbox |
| Deploys | Developer | Push to `main` (CI) (§7) |
| Secrets | Developer, with the owner's dashboard access | §10 |

## 2. Daily and weekly checks

**Every day (5 minutes):**
- Open **Workers & Pages → aasra → Logs** (Observability). Look for `[WEBHOOK]` contract mismatches, `[RECONCILE]` lines with `state=` other than `TRACKER_ENDED`, `[CHECKOUT]` failures, and `email_failed` events.
- In D1, check orders still `pending-payment` more than 1 hour after creation. Expired holds should not pile up (see `KNOWN_ISSUES.md` #3).
- Check the shipping queue: orders with status `paid` and no `tracking_number`.

```sql
-- Paid orders waiting to ship (run with --remote)
SELECT id, customer_name, city, total, created_at FROM orders
WHERE status = 'paid' AND (tracking_number IS NULL OR tracking_number = '')
ORDER BY created_at;

-- Orders stuck in pending-payment for more than 2 hours
SELECT id, total, created_at FROM orders
WHERE status = 'pending-payment' AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 hours')
ORDER BY created_at;

-- Events that need a look
SELECT order_id, type, details, created_at FROM order_events
WHERE type IN ('email_failed', 'duplicate_payment', 'checkout_failed', 'gateway_session_failed')
ORDER BY created_at DESC LIMIT 50;
```

**Every week:**
- Compare Safepay settlements with paid orders (sum of `paid` orders against the gateway report).
- Unpaid balances: none expected, because deposits are removed. Confirm with the query above.
- Stock accuracy: spot-check five SKUs against the shelf or the warehouse.
- Returns and support backlog.
- Confirm a backup exists (§9).

Run commands in D1 with `--remote`. Without it, `wrangler d1 execute` runs against the local database.

## 3. Fulfilment: marking an order shipped

Today: update the order by SQL (below). Planned: a "Mark shipped" page for the owner only, behind Cloudflare Access, which sends the shipped email. That page is not built yet.

No code sets `shipped` or sends the shipped email (see `KNOWN_ISSUES.md` #9). Until that is built, do it by hand, in one transaction, so the audit log stays complete:

```bash
npx wrangler d1 execute AASRA_DB --remote --command "UPDATE orders SET status = 'shipped', tracking_number = '<TCS_NUMBER>', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = '<ORDER_ID>' AND status = 'paid';"

npx wrangler d1 execute AASRA_DB --remote --command "INSERT INTO order_events (id, order_id, type, details, created_at) VALUES ('evt-manual-<UNIQUE>', '<ORDER_ID>', 'shipped', '{\"tracking\":\"<TCS_NUMBER>\",\"by\":\"manual\"}', strftime('%Y-%m-%dT%H:%M:%fZ','now'));"
```

Check that the first statement reports one row changed. If it reports none, the order was not `paid`. Do not change the status by hand to force it.

`shippedEmail` in `functions/lib/email.js` is written, but nothing calls it yet. Until it is wired in, send the shipping message from the business mailbox, copying its wording, with the TCS tracking link. Do not use the tracking-link helper in that file: it points to a placeholder domain (`KNOWN_ISSUES.md` #30).

## 4. Refunds

Refunds are manual until a refund step is built. Orders in status `paid-stock-short` must always be refunded in full, because the customer has already been told.

Refunds are manual. `refundPayment` in the code throws "not implemented".

1. **Decide**: confirm the order, the reason, and the amount with the owner. Refund the full amount unless the owner says otherwise.
2. **Refund at Safepay**: use the Safepay dashboard for the payment (find it by the tracker token shown in `payments` or `order_events`). Keep the refund reference.
3. **Update D1** (in one command so the log stays complete):

```bash
npx wrangler d1 execute AASRA_DB --remote --command "UPDATE orders SET status = 'refunded', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = '<ORDER_ID>';"
npx wrangler d1 execute AASRA_DB --remote --command "INSERT INTO order_events (id, order_id, type, details, created_at) VALUES ('evt-manual-<UNIQUE>', '<ORDER_ID>', 'refunded', '{\"amount\":<AMOUNT>,\"reference\":\"<SAFEPAY_REF>\",\"by\":\"manual\"}', strftime('%Y-%m-%dT%H:%M:%fZ','now'));"
```

4. **Restock** only if the goods came back unused and are sellable. Do not restock for goods that were shipped and not returned.

```bash
npx wrangler d1 execute AASRA_DB --remote --command "UPDATE stock SET quantity_available = quantity_available + <QTY>, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE sku = '<SKU>';"
```

5. **Tell the customer** by email, following the refund template in `functions/lib/email.js` (`refundedEmail`). Copy its wording. Nothing sends it for you.
6. Also check `payments`: the refund does not change the payment row, because `refunded` is not written by code. Note the refund in `order_events` (step 3).

**Duplicate payments:** a second payment for a paid order shows as `payments.status = duplicate` and an event `duplicate_payment` with `refund_required`. Refund it at Safepay using the steps above, and keep the order `paid`.

## 5. Stock and coupons

**Stock** is the `stock` table, one row per SKU. Quantities are decremented when a hold is placed. Set a count:

```bash
npx wrangler d1 execute AASRA_DB --remote --command "UPDATE stock SET quantity_available = <QTY>, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE sku = '<SKU>';"
```

Check a SKU exists before you change it: `SELECT * FROM stock WHERE sku = '<SKU>';`. SKUs follow `AS-<ID>-<COLOUR3>-<SIZE>`, for example `AS-W001-IVO-XS`. The list is in `docs/CATALOG_INDEX.md` and the variant SKUs are generated into `data/products.json`.

**Re-seeding** with `node scripts/seed-d1.js` writes `INSERT` statements for every SKU. Running it on a database that already has the rows fails on the primary key. Use it only on a new database, or edit the output first.

**Coupons** are rows in `coupons`:

```bash
npx wrangler d1 execute AASRA_DB --remote --command "INSERT INTO coupons (code, type, value, min_order, expires_at, usage_limit, used_count, created_at) VALUES ('<CODE>', 'percentage', <PERCENT>, <MIN_ORDER_PKR>, '<EXPIRY_ISO_UTC>', <LIMIT_OR_NULL>, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'));"
```

- `type` is `percentage` (value 1–100) or `fixed` (value in PKR).
- Codes are upper-cased at checkout. Store them in upper case.
- Usage is **not counted** by code (see `KNOWN_ISSUES.md` #15). A usage limit does nothing until that is fixed.
- The seed adds `WELCOME10`. Delete it if you do not want it: `DELETE FROM coupons WHERE code = 'WELCOME10';`.

## 6. Rate-limit rules to create (WAF)

Dashboard steps and the other Cloudflare settings are in `CLOUDFLARE.md` §10.

Rate limits are not in the code. Create them in **Cloudflare dashboard → Security → WAF → Rate limiting rules**, then record the date here. The limits below are the ones written in `wrangler.toml`:

| Path | Method | Limit (per IP) |
|---|---|---|
| `/api/checkout` | POST | 10 per minute |
| `/api/pay-balance` | POST | 5 per minute |
| `/api/contact` | POST | 5 per minute |
| `/api/newsletter` | POST | 5 per minute |
| `/api/order-lookup` | GET or POST | 10 per minute |
| `/api/invoice` | GET | 10 per minute |
| `/api/webhook` | POST | 60 per minute (gateway traffic. Allow the gateway's IPs, or raise the limit) |

Note: `/api/order-lookup` is a POST in the code. The rule in `wrangler.toml` says GET. Create the rule for POST.

Status: **not confirmed as created.** Record the date when done: `<DATE>`.

## 7. Deploys

**Normal deploy:** push to `main`. `.github/workflows/deploy.yml` runs `npm ci`, `npm run build` (with `PUBLIC_TURNSTILE_SITE_KEY` from the repository variable), then `npx wrangler deploy`. It needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

**Before merging a change to `functions/`:**

```bash
npx wrangler deploy --dry-run --outdir /tmp/wdry
```

This checks that the Worker bundles. A failed bundle is the usual cause of a deploy that works in the build and fails in CI.

**Dashboard deploy command:** if the Cloudflare Git integration is connected, keep its deploy command as `true` (a no-op). The workflow header says so, so the two do not race each other.

**Manual run:** the workflow also has a manual trigger (`workflow_dispatch`) in the Actions tab.

**Manual deploy from a terminal:** `npm run build && npm run deploy`. Use only when CI is down, and tell the team.

**Rollback:** the quickest fix is `git revert <commit>` and push to `main`, which redeploys. For a faster rollback, use the Worker's deployment history in the Cloudflare dashboard (check the current menu; the names change between dashboard versions).

**Turnstile site key:** it is read at **build** time. Changing it means a new build and deploy. PRs #20 and #22 were both redeploys for this reason.

**Re-running a failed workflow** (`gh run rerun`) did not work for us. Push a fresh commit instead.

## 8. Migrations

Apply migrations in order, before the code that needs them is deployed:

```bash
npm run d1:migrate            # applies migrations/ to AASRA_DB (remote)
```

Or, with the dashboard console, paste `migrations/0001_initial.sql` then `migrations/0002_balance_token.sql`. Do not paste a migration twice: `0002` is an `ALTER TABLE ADD COLUMN`, and it fails the second time.

Check the schema with `SELECT name FROM sqlite_master WHERE type = 'table';`. You should see the seven tables listed in `BACKEND.md` §11.

## 9. Personal data

The store holds names, phone numbers, emails and addresses (`orders`), the email of each newsletter signup (`newsletter`, once that works), and emails inside `order_events` details. Backups contain all of it.

- Keep the D1 export file out of Git and out of shared chat. `.gitignore` does not exclude database exports, so add `backup-*.sql` to `.gitignore` before the first export is made.
- Access to the Cloudflare account is personal data access. Use two-factor authentication on Cloudflare, GitHub, the gateway, the email provider, and the domain registrar. Keep the registrar lock on.
- There is no retention rule in code. Decide one with the owner and record it here: `<RETENTION_RULE>`. A starting point is to delete or anonymise orders older than the legal retention period for tax records.
- Customer requests (access, deletion) are handled by hand in D1. Find the customer by email or phone. Anonymise rather than delete where tax records must be kept.

## 10. Secrets and rotation

**Secrets** (names only): `TURNSTILE_SECRET_KEY`, `SAFEPAY_SECRET_KEY`, `SAFEPAY_WEBHOOK_SECRET`, `EMAIL_PROVIDER_API_KEY`, and optionally `SAFEPAY_V1_SECRET`. Full list in `PLAYBOOK.md` §16.

**Set or change a secret** (this is a Worker, so use `wrangler secret put`, not `wrangler pages secret put`):

```bash
npx wrangler secret put <NAME>
```

It prompts for the value. Do not put the value on the command line.

**If a secret leaks:**
1. Rotate it at its provider first (Safepay dashboard, Resend dashboard, Cloudflare Turnstile). Old values stop working at once.
2. Run `npx wrangler secret put <NAME>` with the new value.
3. Check the logs for signature failures (`invalid_signature`) for the next hour. Those mean something is still using the old value, or someone is probing.
4. Write the date and the cause in the history file.

**Safepay signing secrets:** the webhook uses `SAFEPAY_WEBHOOK_SECRET`. The signed return uses `SAFEPAY_V1_SECRET` if set, otherwise `SAFEPAY_SECRET_KEY`. If you rotate the secret key, check whether the v1 secret changes too.

## 11. Email

- Sending uses Resend (`EMAIL_PROVIDER = resend`) with the key in `EMAIL_PROVIDER_API_KEY`.
- The sender domain `aasra.shop` must have SPF, DKIM and DMARC records. Check them with `nslookup` (set the record type to TXT for SPF and DMARC, and look up the DKIM selector Resend gives you). The Resend dashboard saying "verified" is not proof.
- One Resend change at a time. Do not create a second Resend account.
- Free-tier limits from third-party summaries (October 2026): 3,000 emails a month, 100 a day, 3 domains. Check Resend's pricing page before you budget.
- A failed send is logged to `order_events` as `email_failed`. Find them with the query in §2.

## 12. Catalogue and product changes

1. Edit the category file in `data/catalog/<gender>/<category>.json`. Copy an existing product. Keep `id`, `slug` and `sku` unique (the build does not check them yet, see `KNOWN_ISSUES.md` #11).
2. Add photos under `public/images/` (3:4 portrait), following the names already used in that folder.
3. Run `npm run catalog:build` and `npm test`.
4. Do not commit `data/products.json` or `public/data/products.json` unless the owner has agreed. They are generated.
5. Add the matching `stock` rows for any new SKU (§5).
6. Commit the source files, push, and check the deployed page with a hard refresh.

**Price edits do not change existing orders.** Prices are copied into `orders.items` at checkout.

**Hiding a product:** set `"visible": false`. It disappears from the storefront, and checkout refuses it.

## 13. Payment mode: sandbox to live

**Do not start this without the owner's written approval.** The live switch is not approved as of this snapshot.

Blockers (all must be closed, and recorded here):
- Safepay merchant onboarding complete (currently step 1 of 6).
- Live keys obtained and stored as secrets, not in the repo. The public key in `wrangler.toml` must also change to the live one.
- Live URLs in `wrangler.toml`: `SAFEPAY_BASE_URL` `https://api.getsafepay.com` and `SAFEPAY_CHECKOUT_URL` `https://getsafepay.com`. Confirm both against Safepay's live documentation. The code comment says sandbox serves API and checkout from one host, and live splits them.
- Webhook URL set in the live Safepay dashboard to `https://aasra.shop/api/webhook`. The sandbox and live URLs are separate. **Never use live keys in preview.**
- `BUSINESS_ADDRESS` and `TAX_REGISTRATION_NO` filled in, and tax rate confirmed with the accountant (`TAX_RATE_PCT`). See `KNOWN_ISSUES.md` #5.
- `KNOWN_ISSUES.md` #1, #2, #4 and #5 fixed or formally accepted by the owner.
- A completed sandbox order that reaches PAID through the webhook, with a receipt email and a lookup page that shows PAID.
- One small real order, paid, shipped, and refunded, per the launch checklist.

## 14. Incident runbook

| Symptom | First check | Action |
|---|---|---|
| Customer paid, order still `pending-payment` | `order_events` for `payment_pending`; the Safepay dashboard for the tracker | Wait for the 15-minute reconciliation, or open the order lookup page (it reconciles). If still pending after 30 minutes, check the logs for `[RECONCILE]` lines and `state=`. Settle by hand only through the webhook path, never by SQL |
| Checkout shows an error | Logs for `[CHECKOUT]`; `checkout_failed` events | Config errors return 503 with a code such as `checkout_unavailable:database_not_configured`, `turnstile_not_configured`, `safepay_not_configured`, or `email_provider_not_configured`. Fix the variable. Build-time variables (such as `PUBLIC_TURNSTILE_SITE_KEY`) also need a new build and deploy |
| Checkout reports a stock problem | `stock` for the SKU; `reservations` `active` rows | Expired holds release on the daily run (§2). Release by hand only with a SQL check, and log it |
| Webhook returns 401 | `invalid_signature` in logs | Secret mismatch. Compare `SAFEPAY_WEBHOOK_SECRET` with the value in the Safepay dashboard. Do not log the secret |
| Webhook returns 400 `unverified_webhook_contract` | Logs `[WEBHOOK] contract mismatch` | Safepay changed a field name or sent an event without an amount. Compare with Safepay's current payload before changing code |
| Duplicate charge | `duplicate_payment` event | Refund at Safepay (§4). Keep the order `paid` |
| Order is `paid-stock-short` | `stock_short_after_payment` and `refund_required` events. The customer was emailed | The hold lapsed and the items sold out. Refund the full amount at Safepay (§4), then record it in `order_events`. |
| Paid order, coupon limit reached | `coupon_limit_reached` event | The order is honoured. Check the coupon's `used_count` against `usage_limit` in `coupons` (§5). |
| Customer gets no email | `email_failed` event with the error | Check Resend's dashboard for the message. Check SPF, DKIM and DMARC (§11). Send the email by hand |
| Order lookup says "not found" | Customer's order ID and phone | The phone must match the one used at checkout, after normalising (+92 and 0 prefixes are accepted). Do not reveal the order to someone who cannot match it |
| Balance link expired | — | Legacy only. New orders have no balance link |
| Site shows the static 404 page for `/api/*` | `wrangler.toml` has `run_worker_first = ["/api/*"]` | Restore that line. Without it API calls get the 404 page |
| "No change" after a deploy | Browser cache | Hard refresh or a private window |
| Site is blank or 500s | Logs for an exception in `src/index.js` or the compiled router | Roll back (§7). Then fix and dry-run the bundle |

## 15. Launch checklist (status at snapshot `eb7e511`)

| Item | Status |
|---|---|
| D1 database created and migrations applied | Done (sandbox orders exist). Re-verify with `sqlite_master` |
| Secrets set (Turnstile, Safepay, email) | Done for sandbox. Verify the set with the dashboard |
| Turnstile site key in the build | Done (corrected in PRs #20 and #22) |
| Safepay webhook URL set in sandbox | Verify in the Safepay dashboard |
| Custom domain `aasra.shop` | Set as `PUBLIC_BASE_URL` in `wrangler.toml`. Confirm it resolves and serves over HTTPS |
| HSTS, WAF rate limits | HSTS set in `_headers`. **WAF rules not confirmed** (§6) |
| Email DNS: SPF, DKIM, DMARC | Sending verified. **DMARC not confirmed** (§11) |
| Tax rate and registration confirmed | **Not done** |
| Full sandbox test matrix | Not written down yet. Write it from `BACKEND.md` §3 (endpoints) and §5 (settlement), then run it |
| Small real order placed, settled, refunded | **Not done** (requires live) |
| Soft launch with friends and family, review of the first 20 orders | **Not done** |
| Stock counts set to real inventory | **Not done** (`KNOWN_ISSUES.md` #14) |
| Backups scheduled and a restore tested | **Not done** (`KNOWN_ISSUES.md` #27) |

## 16. Owner items still needed

Before public launch, the owner supplies (or confirms):

1. Live Safepay merchant onboarding and keys (currently step 1 of 6).
2. Written confirmation of Safepay's checkout, webhook and return contract, including the webhook event names and state values (`KNOWN_ISSUES.md` #2).
3. Legal business address, business phone, and tax registration details. Tax rules confirmed with an accountant.
4. Courier rates confirmed by city (TCS). Update `data/shipping-rates.json`.
5. Brand content: descriptions, size guides, policy text, email wording.
6. Real product photos and colour photos.
7. Real stock counts.
8. A retention rule for personal data (§9).
9. Budget and launch date.

## 17. Local development

```bash
npm ci
npm run dev                # builds, compiles functions, serves on http://localhost:8787
BASE_URL=http://127.0.0.1:8787 node scripts/smoke-worker.mjs
npm test
```

Local development needs `.dev.vars` with local values (copy `.dev.vars.example`). Never commit it. Without D1, the stock endpoint returns `stock: null` and checkout returns 503. That is correct behaviour, not a bug.

## 18. Keeping the docs true

- When you change behaviour, change the matching doc in the same commit: `BACKEND.md` for endpoints and money, `OPERATIONS.md` for steps, `KNOWN_ISSUES.md` when you fix or add a defect, `HISTORY.md` for the PR and decision record.
- Regenerate `docs/CATALOG_INDEX.md` after catalogue edits with the snippet in §19.

## 19. Regenerating the catalogue index

```bash
node -e '
const fs=require("fs"),path=require("path");
const rows=[],cats=[];
for(const g of ["women","men"]){const d=path.join("data/catalog",g);for(const f of fs.readdirSync(d).sort()){const j=JSON.parse(fs.readFileSync(path.join(d,f),"utf8"));cats.push([g,j.category,j.label,(j.subcategories||[]).map(s=>s.key).join(", ")||"—",j.products.length]);for(const p of j.products){rows.push([g,j.category,p.subcategory||"—",p.id,p.slug,p.name,p.price_pkr,p.badge||"",p.visible===false?"hidden":"",p.colors.length,p.sizes.join("/"),p.images.length]);}}}
const esc=s=>String(s).replace(/\|/g,"\\|");
let out="# AASRA — Catalogue index (generated)\n\nGenerated from `data/catalog/**` at snapshot `eb7e511`. Do not edit by hand. Regenerate after catalogue edits with the snippet in OPERATIONS.md §19.\n\n## Categories\n\n| Gender | Category | Label | Sub-categories | Products |\n|---|---|---|---|---|\n";
for(const c of cats) out+="| "+c.map(esc).join(" | ")+" |\n";
out+="\nTotal products: "+rows.length+".\n\n## Products\n\n| Gender | Category | Type | ID | Slug | Name | Price (PKR) | Badge | Hidden | Colours | Sizes | Photos |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n";
for(const r of rows) out+="| "+r.map(esc).join(" | ")+" |\n";
fs.writeFileSync("docs/CATALOG_INDEX.md",out);'
```
