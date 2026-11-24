# AASRA Store — Architecture

Short reference for the shape of the system. Read `PLAYBOOK.md` to build one, `BACKEND.md` for every endpoint and money rule, `OPERATIONS.md` to run it, and `KNOWN_ISSUES.md` for defects.

## What it is

A fashion store for women and men in Pakistan (PKR, prepaid only, Pakistan delivery). Static pages built by Astro, one Cloudflare Worker that serves the pages and the API, one D1 database, a hosted card payment page (Safepay), and transactional email (Resend). There is no admin dashboard. Products are JSON files.

```
Browser ──► Cloudflare Worker "aasra"
             ├─ static assets (dist/)            Astro pages, CSS, JS, images
             ├─ /api/* (compiled functions/)     checkout, webhook, lookup, invoice, …
             ├─ cron triggers (scheduled.js)     reconciliation, stock release, daily jobs
             └─ D1 "AASRA_DB"                    stock, orders, payments, events, coupons

Checkout ──► Safepay hosted page (card data never touches our servers)
Safepay  ──► POST /api/webhook  and  POST /api/safepay-return   (server to server)
Worker   ──► Resend API (email)     ──► Cloudflare Turnstile (bot checks)
```

## Directory map

```
data/catalog/site.json              brand text, hero, marquee, nav, footer   ← edit
data/catalog/<gender>/<cat>.json    one file per category (9 files)         ← edit
data/products.json                  GENERATED from the catalogue, do not edit
data/shipping-rates.json            shipping fee by city, free over PKR 20,000 ← edit
public/data/products.json           GENERATED copy served to the browser
scripts/build-catalog.js            validates and builds the generated catalogue

src/index.js                        Worker entry: API router + scheduled handler
src/pages/                          routes (Astro, static)
src/components/layout/              StoreLayout (head, header, footer, bag helpers)
src/components/store/               storefront components
src/styles/tokens.css               design values (the only raw values)
src/styles/store.css                storefront styles (tokens only)

functions/api/*.js                  API handlers (see BACKEND.md §3)
functions/api/_middleware.js        CORS, origin, CSRF, headers for /api/*
functions/lib/                      pricing, stock, gateway, email, invoice, reconcile, validation
functions/scheduled.js              cron jobs

migrations/                         D1 schema (0001, 0002)
tests/run.js                        46 checks
scripts/                            seed, smoke test, Safepay smoke test, catalogue build
docs/                               this set of documents
skills/                             rules for editing the project (see below)
```

## Pages

The route table is in `PLAYBOOK.md` §6. In short:

- `/` home, `/women`, `/men` gender landing pages.
- `/<gender>/<category>` and `/<gender>/<category>/<sub>` category and sub-category pages, both rendered by `CategoryPage.astro`.
- `/<gender>/new-in` the New In list.
- `/shop` all products. Category, type, search and sort are URL parameters applied in the browser.
- `/product/<slug>` product page.
- `/cart`, `/checkout`, `/order-success`, `/payment-cancelled`, `/order-lookup`, `/pay-balance` (legacy) bag and payment pages.
- Content and policy pages, including `/faq`, `/shipping`, `/size-guide`, `/deposit-policy` (legacy, to be rewritten).

**Navigation:** pages marked `spa` use Astro's client router, so moving between browse pages does not reload the whole site. Cart, checkout and payment pages do full loads. Details in `PLAYBOOK.md` §9.

## Data model

- **Catalogue (files):** category, label, optional sub-categories, products. A product has `id`, `slug`, `name`, `price_pkr`, `colors`, `sizes`, `images`, and optional `subcategory`, `badge`, `visible`, `compare_at_pkr`. Full schema in `PLAYBOOK.md` §5 and `CATALOG_INDEX.md` for the current list.
- **Variants (generated):** every size × colour pair gets a SKU `AS-<ID>-<COLOUR3>-<SIZE>`. Stock, bag and orders key off the SKU.
- **Database (D1):** `stock`, `reservations`, `orders`, `payments`, `order_events`, `coupons`, `newsletter`. Schema and states in `BACKEND.md` §7 and §11.

## Key rules

- All money is whole PKR. No floats.
- Prices and stock are decided on the server. The browser sends SKUs and quantities only.
- Orders snapshot prices when created.
- Stock is held for 15 minutes at checkout and confirmed on payment.
- The payment webhook (or the signed return, or reconciliation) is the source of truth, never the browser redirect.
- Customers pay in full online. Cash on delivery and deposits are not offered.

## Editing rules

The project's own rules are in `skills/`:
- `store-architecture.md`: catalogue is data; schema changes update the build, the components and the docs in one commit; API contracts are stable; every commit keeps tests green.
- `design-system.md`: tokens only; edit the owning file; no override layers; motion budget; anti-slop checklist.
- `research-first.md`: research before code; find root causes before patching; say what cannot be verified.

## Testing and checks

- `npm test`: 46 checks (validation, money, signatures, order states, reconciliation, invoices and emails). See `BACKEND.md` §12 for the gaps.
- `npm run typecheck`: `astro check`.
- `npm run smoke`: runs against a local server.
- The catalogue build (`npm run catalog:build`) validates required fields, sizes, colours, images and sub-category keys.

## Research and design records

- `docs/DESIGN_SYSTEM.md`: tokens, typography, spacing, grid, components, motion, imagery, copy, accessibility, anti-slop rules.
- `docs/research/STORE_RESEARCH_2026.md`: conversion, visual and interaction research, with sources and decisions for the owner.
- `docs/RESEARCH.md`: navigation and fashion-site patterns applied to the store.
- `docs/RESEARCH_APPLICATION_REPORT.md`: 2026-11-19 report on how the research was applied and the root causes of earlier failures.
- `CHECKLIST.md` (repo root): reference-led storefront audit, checked against screenshots of a reference site. Used for layout and feel only.

## Stack versions

Node 24.22.3 (`.nvmrc`, `engines >= 24`). Astro 7 (`astro` ^7.4.12). Wrangler 4. TypeScript 5.6. Fonts: Inter Tight and Inter from Google Fonts. Cormorant Garamond is a dependency (`@fontsource`) and is referenced only by the legacy `global.css`; the logo choice is an open decision (`PLAYBOOK.md` §18).
