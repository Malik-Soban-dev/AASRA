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
