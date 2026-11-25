# AASRA — Cloudflare setup and reference

Everything this store uses on Cloudflare, what is set in the repo, what is set only in the dashboard, and how to set it up again for a new site.

**How to read this file.** Each item is marked:
- **Repo** — written in a file in this repository (name given).
- **Dashboard** — set in the Cloudflare dashboard. It is not in the repo, so it must be recorded here and checked by hand. Menu names change over time; the names below are the ones the earlier README used. Check them against the current dashboard.
- **Not verified** — not checked in this snapshot.

Never write secret values in this file. Names only.

---

## 1. What Cloudflare provides

| Service | Used for | Where it is set |
|---|---|---|
| Workers | Runs the site's API and serves the static pages | `wrangler.toml` (Repo) |
| Workers static assets | Serves `dist/` (the Astro build) | `wrangler.toml` `[assets]` (Repo) |
| D1 | The database (`AASRA_DB`) | `wrangler.toml` `[[d1_databases]]` (Repo) |
| Cron Triggers | Reconciliation, stock release, daily jobs | `wrangler.toml` `[triggers]` (Repo) |
| Workers Logs | Request and error logs | `wrangler.toml` `[observability.logs]` (Repo) |
| Turnstile | Bot check on checkout | Widget in the dashboard (Dashboard); keys in GitHub and Worker secrets (Repo names only) |
| Custom domain and DNS | `aasra.shop` | Dashboard only (Dashboard) |
| WAF rate limiting | Limits on `/api/*` | Dashboard only (Dashboard). Written down in `OPERATIONS.md` §6, not confirmed as created |
| HSTS | Strict transport security | Sent by `public/_headers` (Repo). A dashboard toggle may also exist (Dashboard, Not verified) |
| Workers Builds (branch previews) | Preview builds for non-production branches | A `wrangler.toml` comment says Workers Builds runs `wrangler preview`. The connection itself is Dashboard, Not verified |

## 2. Names and identifiers

| Item | Value | Where |
|---|---|---|
| Worker name | `aasra`. It must match the Worker name in the dashboard. | Repo (`wrangler.toml` `name`) |
| Main entry | `src/index.js` | Repo |
| D1 database name | `AASRA_DB`, binding `DB` | Repo |
| D1 database ID | Written in `wrangler.toml`. An identifier, not a secret. A new site must create its own database and replace this ID. | Repo |
| Production domain | `aasra.shop` (`PUBLIC_BASE_URL`) | Repo (`wrangler.toml` `[vars]`). The domain binding is Dashboard |
| Preview host | `aasra.shanzeeey.workers.dev` (`[previews.vars]`) | Repo |
| `www` host | `ALLOWED_ORIGIN` lists `https://www.aasra.shop`. Whether `www` is routed is Dashboard, Not verified | Repo / Dashboard |
| Cloudflare account ID | Stored as the GitHub secret `CLOUDFLARE_ACCOUNT_ID`. Not written here. | GitHub (Dashboard) |
| API token | Stored as the GitHub secret `CLOUDFLARE_API_TOKEN`. Created from the "Edit Cloudflare Workers" template, per `deploy.yml`. Not written here. | GitHub (Dashboard) |
| Compatibility | `compatibility_date = "2026-01-01"`, flag `nodejs_compat` | Repo |

## 3. Configuration in `wrangler.toml`

Read the file itself for the exact values. In short:

- **`[assets]`**: `directory = "./dist"`, binding `ASSETS`, `not_found_handling = "404-page"`. **`run_worker_first = ["/api/*"]`** must stay. Without it, the static 404 page answers every API call in production.
- **`[vars]`**: non-secret settings, including `PUBLIC_BASE_URL`, `ALLOWED_ORIGIN`, the Safepay mode and hosts, the Resend settings and the legacy deposit settings. The full list is in `README.md` and `PLAYBOOK.md` §16.
- **`[[d1_databases]]`**: the `DB` binding to `AASRA_DB`.
- **`[triggers]`**: `crons = ["0 9 * * *", "*/15 * * * *"]`. Wrangler deploys these from the file.
- **`[observability.logs]`**: enabled, sampling rate 1, persisted, invocation logs on.
- **`[previews.vars]`**: the preview settings. Safepay and PayFast are off there, so a preview cannot reach a payment gateway.

The file has no `routes`, `zone`, or custom-domain entries. The custom domain is set in the dashboard, so a new deploy does not create it. This is important for a new site.

## 4. Secrets and variables

| Kind | Name | Where it is set |
|---|---|---|
| Worker secret | `TURNSTILE_SECRET_KEY`, `SAFEPAY_SECRET_KEY`, `SAFEPAY_WEBHOOK_SECRET`, `EMAIL_PROVIDER_API_KEY`, optional `SAFEPAY_V1_SECRET` | `npx wrangler secret put NAME`, or the dashboard: **Workers & Pages → aasra → Settings → Variables and Secrets** (Dashboard) |
| Worker var | Everything in `wrangler.toml` `[vars]` | Repo. Changes need a deploy |
| GitHub variable | `PUBLIC_TURNSTILE_SITE_KEY` | GitHub repository variables. Read at build time, so a change needs a new build and deploy |
| GitHub secret | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub repository secrets |
| Local | `.dev.vars` (copied from `.dev.vars.example`) | Local only. Never commit |

Rules:
- Put a value in the dashboard or the terminal prompt only. Never in chat, a commit, or this file.
- Do not set one name in both `wrangler.toml` `[vars]` and the dashboard. Which value wins after a deploy has not been checked (Not verified). Use one place for each name.
- `wrangler.toml` comments name the Turnstile variable as `TURNSTILE_SITE_KEY`. The code and the build use `PUBLIC_TURNSTILE_SITE_KEY`. Use the latter (`KNOWN_ISSUES.md` #10).

## 5. Deployment

**Normal path (Repo):** `.github/workflows/deploy.yml` runs on every push to `main`:
1. `npm ci`
2. `npm run build` with `PUBLIC_TURNSTILE_SITE_KEY` from the GitHub variable. The build runs `astro build`, then `wrangler pages functions build` into `dist-worker/`, which `src/index.js` imports.
3. `npx wrangler deploy` with the two GitHub secrets.

The workflow can also be started by hand (`workflow_dispatch`) from the Actions tab.

**Dashboard deploy command (Dashboard):** if the Worker is also connected to Git in the dashboard, its deploy command must be `true`, a no-op. The workflow header says so. Otherwise the dashboard and the workflow both deploy.

**Before merging a change to `functions/` (Repo, `OPERATIONS.md` §7):**

```bash
npx wrangler deploy --dry-run --outdir /tmp/wdry
```

**Rollback:** `git revert` and push to `main` redeploys the revert (fastest, and keeps Git true). The Worker's version history in the dashboard can also roll back (Dashboard; menu names not verified).

## 6. Routing and the Worker

- The Worker (`src/index.js`) handles `/api/*` through the compiled router, and every other path through the static assets.
- It also handles the cron events by calling `functions/scheduled.js`.
- The router mirrors Cloudflare Pages Functions behaviour, including `functions/api/_middleware.js`.
- `public/_headers` sets the security headers and cache rules for all responses (Repo). `public/_redirects` has only comments. Its first comment says "Cloudflare Pages redirects", which is out of date (Repo).

## 7. Database (D1)

- Create: `npm run d1:create` (wraps `wrangler d1 create AASRA_DB`). Copy the printed database ID into `wrangler.toml` `database_id`.
- Migrate: `npm run d1:migrate` applies `migrations/` to the remote database. `0002` uses `ALTER TABLE … ADD COLUMN`, so it fails if run twice. Do not re-run a migration by hand.
- Seed: `node scripts/seed-d1.js > /tmp/seed.sql`, then run that file with `wrangler d1 execute AASRA_DB --remote --file=/tmp/seed.sql`. The seed uses plain `INSERT` and `stock.sku` is the primary key, so running it again on a database that already has rows fails.
- Export and restore: `OPERATIONS.md` §9 and `README.md`. No export is scheduled (`KNOWN_ISSUES.md` #27).
- Region: not recorded (Dashboard, Not verified).

## 8. Turnstile

- **Dashboard:** create a widget for the site. Its allowed hostnames should include `aasra.shop`, and any preview host that shows the widget. Not verified in the dashboard.
- **Site key:** the GitHub variable `PUBLIC_TURNSTILE_SITE_KEY`. The checkout reads it at build time (`src/pages/checkout.astro`). Without it, the widget does not render.
- **Secret key:** the Worker secret `TURNSTILE_SECRET_KEY`. Checkout fails closed without it.
- **Known gaps:** the contact page sends no Turnstile token, and the API rejects every submission (`KNOWN_ISSUES.md` #33). Turnstile is skipped on `/api/contact` and `/api/pay-balance` when `TURNSTILE_SECRET_KEY` is unset (#8).

## 9. Domain, DNS and HSTS

Dashboard steps (names from the earlier README; check them):
1. **Workers & Pages → aasra → Settings → Domains & Routes → Add → Custom domain** → `aasra.shop`. The zone must already be on Cloudflare; the DNS record is then created.
2. Confirm `PUBLIC_BASE_URL` matches the domain.
3. Enable HSTS on the zone if you want it set outside the Worker. `_headers` already sends HSTS on every response.
4. Email DNS (SPF, DKIM, DMARC) for `aasra.shop` is for Resend, not Cloudflare. Check it with `nslookup` (`OPERATIONS.md` §11).

Not verified: whether `www.aasra.shop` is routed, and whether the `workers.dev` route is still enabled.

## 10. WAF and rate limiting (Dashboard)

Create the rules in **Security → WAF → Rate limiting rules**. The full list is in `OPERATIONS.md` §6. Two points:
- The `wrangler.toml` comment lists `GET /api/order-lookup`, but the endpoint is `POST`. Create the rule for `POST`.
- Status: **not confirmed as created.** Record the date when done in `OPERATIONS.md` §6.

Other zone settings (bot fight mode, managed rules, and similar) are not recorded. Add them here when chosen.

## 11. Logs, monitoring and alerts

- **Workers Logs:** on, from `wrangler.toml`. Find them in the Worker's Observability tab (Dashboard).
- Searchable tags in the logs: `[CHECKOUT]` and `[WEBHOOK]`. Order events: `email_failed`, `duplicate_payment`. Error codes: `invalid_signature`, `unverified_webhook_contract` (see `OPERATIONS.md` §2 and §14).
- **Alerts and uptime checks:** not configured (`KNOWN_ISSUES.md` #28). Set them up in the dashboard and record where they go.
- **Cron runs:** check the Worker's Triggers and logs for the scheduled runs (Dashboard, Not verified).

## 12. Access and account security

- Two-factor authentication on the Cloudflare account, GitHub, the Safepay dashboard, the Resend account and the domain registrar.
- Use an API token scoped to the Worker. Do not use the global API key.
- Keep the registrar lock on for `aasra.shop` (recommended; the repo does not record it).
- Rotation steps: `OPERATIONS.md` §10.
- Who has dashboard access, and when it was last reviewed: not recorded.

## 13. Setting up a new site on Cloudflare

1. Create or pick the Cloudflare account. Turn on two-factor authentication.
2. Add the domain as a zone on Cloudflare. Point its registrar nameservers to Cloudflare.
3. Create an API token from the "Edit Cloudflare Workers" template. Store it as the GitHub secret `CLOUDFLARE_API_TOKEN`. Store the account ID as `CLOUDFLARE_ACCOUNT_ID`.
4. Clone the repo. Set the Worker `name` in `wrangler.toml`. Set `PUBLIC_BASE_URL`, `ALLOWED_ORIGIN` and the `BUSINESS_*` values.
5. Create the D1 database (`npm run d1:create`). Put its ID in `wrangler.toml`. Run `npm run d1:migrate`. Seed if needed.
6. Set the Worker secrets with `npx wrangler secret put` (names in §4).
7. Create the Turnstile widget. Set the GitHub variable `PUBLIC_TURNSTILE_SITE_KEY`.
8. Run `npm ci && npm run build`, then `npx wrangler deploy --dry-run --outdir /tmp/wdry`.
9. Push to `main` (or run the workflow by hand). Check the deploy in the Actions tab.
10. Add the custom domain (§9). Check that `/api/stock?skus=…` answers JSON, and that the page loads.
11. Set the WAF rate-limit rules (§10). Enable alerts (§11).
12. If the Worker is also connected to Git, set its deploy command to `true` (§5).
13. Record the date of each dashboard step in `OPERATIONS.md` §15.

## 14. What is not in the repo (keep a record)

| Item | Where it lives | Recorded in |
|---|---|---|
| Cloudflare account ID, API token | GitHub secrets | §2 (names only) |
| Custom domain and DNS records | Dashboard | §9 |
| WAF rate-limit rules | Dashboard | §10 (not confirmed) |
| Turnstile widget and hostnames | Dashboard | §8 |
| Worker secrets | Dashboard or `wrangler secret` | §4 (names only) |
| Dashboard deploy command | Dashboard | §5 |
| Workers Builds connection (previews) | Dashboard | §1 (not verified) |
| D1 region and backups | Dashboard | §7 (not verified; no backup scheduled) |
| Alerts and uptime checks | Not set up | §11 |

## 15. Known Cloudflare-related issues

- `KNOWN_ISSUES.md` #10: Turnstile variable naming.
- #17: the Content Security Policy in `_headers` allows `'unsafe-inline'`.
- #18: WAF rate limits not confirmed.
- #27: no scheduled D1 backup.
- #28: no alerts or uptime checks.
- #31: an unset `ALLOWED_ORIGIN` turns off the origin and CSRF checks.
- #33: the contact form sends an empty Turnstile token.
- The `_redirects` comment says "Cloudflare Pages"; this is a comment only.
