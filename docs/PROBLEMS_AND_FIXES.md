# AASRA — Problems, blocks and fixes (running log)

This log records every problem found in the audit, what blocked the fix, what was changed, how it was checked, and the lesson for the next store. Each entry follows the same shape so that a new build can skip the same traps.

The problem list itself is `KNOWN_ISSUES.md`. This file is the record of what was done about each item.

**Status key:** *Fixed on branch* = code changed, tests added, build and dry-run pass, not yet merged. *Needs decision* = blocked until the owner chooses. *Needs owner action* = a dashboard or account step, not code.

---

## Batch 1 — branch `arena/3fc47406-aasra` (Nov 25, 2026)

### #1 Newsletter signups never saved — *Fixed on branch* (High)
- **Problem:** the insert into `newsletter` was built with `.bind(...)` but never run with `.run()`. The API still answered `subscribed`. Visitors were told they were signed up when nothing was stored.
- **Cause:** a missing `.run()`. D1 statements do nothing until executed. No test ran the handler against a database.
- **Fix:** `functions/api/newsletter.js` now calls `.run()`. The `already_subscribed` path works on the UNIQUE error. Other database errors return `500 signup_failed`.
- **Check:** three new tests in `tests/run.js` against a fake D1 (insert runs and email is normalised; duplicate is idempotent; a database error is reported).
- **Behaviour change:** if the `newsletter` table is missing, signups now show an error instead of a false success. Confirm migration `0001` is applied in production.
- **Lesson:** every D1 write needs `.run()` (or `.first()`/`.all()` for reads). Add a fake-D1 test for every write path. A test that only checks the response is not enough.

### #7 Contact email injected unescaped text — *Fixed on branch* (Low)
- **Problem:** name, email, phone, subject and message went into the business email HTML unescaped.
- **Fix:** `escapeHtml` is now exported from `functions/lib/email.js` and used on every field in both the business email and the auto-reply.
- **Check:** source-level test that each field is escaped.
- **Lesson:** escape at the point of output, using one shared helper. Keep the helper in one place.

### #8 Turnstile failed open (Low, now fixed where it matters)
- **Problem:** if `TURNSTILE_SECRET_KEY` was unset, `/api/contact` and `/api/pay-balance` skipped the bot check.
- **Fix:** both now return `503 turnstile_not_configured` when the secret is missing. Checkout already failed closed.
- **Still open:** `/api/pay-order` and `/api/newsletter` have no Turnstile. Decide whether they need one or only WAF rate limits. See Needs decision.
- **Lesson:** a security check must fail closed. Decide the behaviour when the secret is missing before writing the check.

### #20 Placeholder sender address — *Fixed on branch* (Low)
- **Problem:** if `EMAIL_FROM` was unset, mail used `orders@example.com` as the sender and the recipient.
- **Fix:** no placeholder fallback. `emailConfig` gives an empty sender, and `sendEmail` returns `email_provider_not_configured` without calling the provider. The contact handler sends to `BUSINESS_EMAIL` and returns `503 contact_not_configured` if neither is set.
- **Check:** test that no provider call happens without a sender.
- **Lesson:** never ship a placeholder domain as a default. A missing setting should stop the send, not send from somewhere wrong.

### #30 Tracking link on a placeholder domain — *Fixed on branch* (Low)
- **Problem:** `trackingUrl()` built `https://example.com/track?...`.
- **Fix:** removed. The shipped email shows the tracking number only. No courier URL is hard-coded, because none was verified.
- **To restore a link later:** verify the courier's real tracking page, then add a per-courier map. Do not guess the URL.
- **Lesson:** do not hard-code a third-party URL that has not been checked.

### #6 Invoices shown for unpaid orders — *Fixed on branch* (Medium)
- **Problem:** `/api/invoice` returned an invoice for any order, paid or not, to anyone holding the `balance_token`.
- **Fix:** after the token check, only orders with status `paid`, `packed` or `shipped` get a receipt. Others get `404`.
- **Still open:** the token never expires for full orders. See Needs decision.
- **Lesson:** check the payment state before showing a financial document. Check the token first, so an attacker learns nothing from the response.

### #16 Out-of-scope variable in reminder failure log — *Fixed on branch* (Medium)
- **Problem:** the balance-reminder failure handler used `o.id`, which is not in scope there. It would throw if a reminder failed.
- **Fix:** the handler now uses `dueOrders.results[i].id`.
- **Check:** source-level test.
- **Lesson:** an error handler is code too. Put it in the same tests as the happy path.

---

### #33 Contact form could never send a message — *Fixed on branch* (Medium)
- **Problem:** the contact page sent an empty Turnstile token and rendered no widget, so the API rejected every message.
- **Fix:** the page renders the Turnstile widget when `PUBLIC_TURNSTILE_SITE_KEY` is set at build time, loads the script the same way checkout does, and sends the real token. It shows a message and does not submit when there is no token.
- **Needs:** the site key in the GitHub variable `PUBLIC_TURNSTILE_SITE_KEY` and the secret `TURNSTILE_SECRET_KEY` in Cloudflare. Without the site key, the form will not send. Check both before launch.
- **Lesson:** a form that depends on a bot check needs the widget, the token, and the server check tested together. A server-side fix alone does not make the form work.

### Header label "Account and orders" — *Fixed on branch* (Low, UX)
- **Problem:** the header icon was labelled "Account and orders" but only opens order lookup, so customers expected an account.
- **Fix:** renamed to "Track your order" in both headers (`SiteHeader.astro`, `Header.astro`).
- **Lesson:** label controls by what they do. Decide whether a feature exists before naming it.

## Needs decision (not changed)

These items change money, stock, tax, or order status. Each needs a choice from the owner before code is written.

| # | Item | Decision needed | Why it is blocked |
|---|---|---|---|
| 2 | Webhook accepts non-final events and statuses; signed return has no amount check | Which Safepay event and state mean "paid", and is `TRACKER_ENDED` plus amount the only rule? | Tightening the list before we know the real payload from the sandbox could stop a real test order from settling. Confirm the `CATP` webhook outcome first. |
| 4 | Payment after hold expiry settles with no stock check | Extend the hold while Safepay is open, or re-check stock when the payment arrives and refuse or refund if it is gone? | This is a business policy, and it sets the timing for #3. |
| 3 | Expired holds released only at 09:00 UTC | Move the release to the 15-minute cron. **Do this only after #4 is decided**: releasing sooner makes a late payment more likely. | Depends on #4. |
| 5 | Tax not in totals; invoice reads settings from `process.env` | The tax rule (rate, inclusive or exclusive, and when it applies). Totals will change once it is set. | Legal and accounting decision. Confirm with an accountant. The `process.env` read is a code fix that can follow. |
| 9 | Shipped, delivered and refunded emails never sent | How the owner marks orders shipped (SQL, an admin page, or a Safepay step). | A process decision. Code can follow once it is chosen. |
| 15 | Coupon `used_count` never increases | When a coupon counts as used: on order creation, or only on payment. | Decides whether a failed payment uses up a coupon. |
| 27 | No automated D1 backup | Who runs backups, and where they are kept. | Account and cost decision. See `CLOUDFLARE.md` §7. |

---

## Needs owner action (not code)

- **Cloudflare WAF rate limits (#18):** create the rules listed in `CLOUDFLARE.md` §10 and record the date.
- **Alerts and uptime checks (#28):** set them up in Cloudflare and record where they go.
- **Backups (#27):** see decision 27 above.
- **Dashboard deploy command (`CLOUDFLARE.md` §5):** check it is `true` if the Worker is also connected to Git.

---

## Checks run for this batch

- `node tests/run.js`: 55 passed, 0 failed (Node 24.22.3). 46 existing tests and 9 new ones.
- `npm run build`: passes.
- `npx wrangler deploy --dry-run --outdir /tmp/wdry`: passes (upload about 280 KiB).
- Generated files `data/products.json` and `public/data/products.json` were restored after the test and build runs. They are not part of this change.

## Lessons for the next store

1. **Every D1 write needs `.run()`.** Test it with a fake D1.
2. **Fail closed on security checks.** Decide what happens when a secret is missing before writing the check.
3. **Never ship a placeholder domain or sender.** A missing setting should stop the send.
4. **Check payment state before showing a financial document.**
5. **Decide the money policy before changing timing.** Releasing stock sooner is only safe once a late payment is handled.
6. **Verify third-party contracts against the official SDK or sandbox**, not from memory (for example, Safepay's event names).

---

## Batch 2 — code items that needed no business decision (same branch)

| # | Change | Check |
|---|---|---|
| 31 | API middleware fails closed when `ALLOWED_ORIGIN` is unset or `*`. Only the webhook and the Safepay signed return still work, because they are checked by HMAC. | 3 middleware tests |
| 19 | Gateway callbacks are matched by exact path, not by substring. `/api/checkout?x=/api/webhook` no longer gets the exemption. | lookalike-path test |
| 13 | Order numbers are checked against existing rows before insert, with up to five new draws. The primary key still guards the insert. | source test |
| 11 | Catalogue test: product ids, slugs and SKUs are unique, and every product has images and variants. | catalogue test |
| 10 | `wrangler.toml` comment names the real build variable, `PUBLIC_TURNSTILE_SITE_KEY`. | source test |

Batch 2 test total: **64 passed, 0 failed** (Node 24.22.3). Build and `wrangler deploy --dry-run` pass.

---

## Status of all 34 issues (end of batch 2)

Key: **Fixed** = code changed, tested, on branch. **Partly** = some of it fixed, rest open. **Decision** = needs an owner choice first. **Owner action** = a dashboard or data step. **Deferred** = real work, not done in this batch, with the reason. **Accepted** = documented, no change.

| # | Severity | Issue | Status | Note |
|---|---|---|---|---|
| 1 | High | Newsletter insert never run | **Fixed** (PR #92) | Check the `newsletter` table exists in production |
| 2 | High | Webhook accepts non-final events; signed return has no amount check | **Decision** | Which Safepay event and state mean "paid". Check the `CATP` webhook first |
| 3 | Medium | Holds released only at 09:00 UTC | **Decision** | Depends on #4 |
| 4 | High | Late payment after hold expiry settles with no stock check | **Decision** | Extend the hold, or re-check stock and refuse or refund |
| 5 | High | Tax not in totals; invoice reads `process.env` | **Decision** | Tax rule from an accountant |
| 6 | Medium | Invoices for unpaid orders | **Partly** (PR #92) | Unpaid orders hidden. Token never expires: decision |
| 7 | Low | Contact email unescaped | **Fixed** (PR #92) | |
| 8 | Low | Turnstile fails open | **Partly** (PR #92) | Contact and balance fixed. Pay-order and newsletter: decision |
| 9 | Medium | Shipped, delivered, refunded emails never sent | **Decision** | How orders are marked shipped |
| 10 | Low | Wrong variable name in comments | **Fixed** (batch 2) | |
| 11 | Low | Catalogue has no assertions | **Fixed** (batch 2) | Uniqueness and completeness only, not image files |
| 12 | Low | Dormant deposit code | **Deferred** | Removing the public `/deposit-policy` and `/pay-balance` pages changes the site: owner OK needed |
| 13 | Low | Order-number collisions | **Fixed** (batch 2) | |
| 14 | Medium | Seed stock quantities are placeholders | **Owner action** | Real stock counts from the owner |
| 15 | Low | Coupon `used_count` never increases | **Decision** | When a coupon counts as used |
| 16 | Medium | Reminder log uses an out-of-scope variable | **Fixed** (PR #92) | |
| 17 | Low | CSP allows `unsafe-inline` | **Deferred** | Needs inline scripts moved out of many pages: a separate change |
| 18 | Medium | WAF rate limits not confirmed | **Owner action** | Create the rules in `CLOUDFLARE.md` §10 |
| 19 | Low | Exemptions by substring | **Fixed** (batch 2) | |
| 20 | Low | Placeholder sender | **Fixed** (PR #92) | |
| 21 | Low | Order lookup: only order ID and phone | **Deferred** | Needs an attempt-limit table (a migration) and a lockout policy: decision |
| 22 | Info | `GET /api/stock` shows quantities | **Decision** | Whether to show exact numbers publicly |
| 23 | Info | Public Safepay key and D1 ID in repo | **Accepted** | Identifiers, not secrets. Documented |
| 24 | Info | Unused `failed` and `refunded` payment statuses | **Accepted** | Documented |
| 25 | Info | Stale docs | **Partly** | README and ARCHITECTURE now label deposits and other legacy items |
| 26 | Info | Invalid coupon fails silently | **Deferred** | Needs wording from the owner for the message |
| 27 | Medium | No automated backup | **Owner action** | Who runs backups and where they are kept: decision |
| 28 | Medium | No alerts or uptime checks | **Owner action** | Set up in Cloudflare |
| 29 | Info | Test coverage gaps | **Partly** (batch 2) | Added middleware, catalogue and newsletter tests. Scheduled jobs and the stock race are still untested |
| 30 | Low | Tracking link on example.com | **Fixed** (PR #92) | |
| 31 | Medium | Unset origin disables origin and CSRF checks | **Fixed** (batch 2) | |
| 32 | Low | PayFast switch, not built | **Accepted** | Documented |
| 33 | Medium | Contact form could not send | **Fixed** (PR #92) | Needs `PUBLIC_TURNSTILE_SITE_KEY` set in GitHub and the secret in Cloudflare |
| 34 | Info | Generated product files out of date | **Deferred** | Committing them needs your approval |

**Totals:** Fixed 10 · Partly 5 · Decision 7 · Owner action 4 · Deferred 5 · Accepted 3 = 34.

**Before merging PR #92:** the email changes need your explicit "yes". Merging also needs the production checks listed above (newsletter table, `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `ALLOWED_ORIGIN` set to the real domains).
