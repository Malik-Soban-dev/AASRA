# AASRA — Build history, decisions and rules

The record of how this store was built: every pull request, the decisions and why they were made, the owner's rules, what failed and what fixed it, the sandbox payment record, and open items. Read it when you need to know *why* something is the way it is. `PLAYBOOK.md` says how to build the store. `BACKEND.md` and `OPERATIONS.md` say how it works and how to run it.

- **Snapshot:** against `main` at `eb7e511`, 2026-11-24. This file was regenerated from the GitHub PR list and the git history on that date. The PR table in §1 is generated, not typed.
- **Scope:** the store, catalogue, payments, email, deploy, and the working process. No secret values appear here.
- **Reliability:** PR titles, states and merge commits come from GitHub. Decisions marked "reason not recorded" were never written down. Do not invent a reason later.

---

## 1. Every pull request

All 91 pull requests in the repository, oldest first. "Merged" means GitHub shows the PR as merged. The merge commit is the commit on `main`.

| PR | State | Merged | Merge commit | Title | Branch |
|---|---|---|---|---|---|
| #1 | Merged | 2026-11-17 | `6c47d1b` | Improve storefront header and Shop mega menu | `arena/63469d02-aasra` |
| #2 | Merged | 2026-11-17 | `ad7d22d` | Refresh AASRA editorial storefront and fail-closed commerce setup | `arena/92b4c960-aasra` |
| #3 | Merged | 2026-11-17 | `f72dbb4` | Redesign AASRA storefront with original editorial system | `arena/334c1b77-aasra` |
| #4 | Merged | 2026-11-18 | `304edb9` | Brunello Cucinelli full-site deep dive + product badge system | `arena/1714f962-aasra` |
| #5 | Merged | 2026-11-18 | `b46c439` | BC-study merch patterns: quick-shop, stock states, complete-the-look + API URL fix | `arena/b6ea0eef-aasra` |
| #6 | Merged | 2026-11-18 | `8c6df1a` | Design language alignment with the reference site | `arena/614ae227-aasra` |
| #7 | Merged | 2026-11-18 | `812003e` | Fix broken restyle + quiet monochrome alignment (non-structural) | `arena/6bd045da-aasra` |
| #8 | Merged | 2026-11-18 | `e73b84b` | Fashion storefront rebuild: design system + women/men store + research-driven UX | `arena/59e7fe95-aasra` |
| #9 | Merged | 2026-11-19 | `1f2e82b` | Unified cinematic hero + full-screen section scroll + scroll animation | `arena/8dab5ac6-aasra` |
| #10 | Merged | 2026-11-19 | `cdef6e8` | Smoother section-to-section scroll with exact full-height sections | `arena/5c302ac1-aasra` |
| #11 | Merged | 2026-11-19 | `8783554` | Docs: research application report + deep root-cause investigation | `arena/14a90954-aasra` |
| #12 | Merged | 2026-11-19 | `a94e8d6` | feat(payments): Safepay sandbox integration — hosted checkout + signed settlement | `arena/ef881da0-aasra` |
| #13 | Merged | 2026-11-19 | `0d66374` | fix(payments): safepay-return route + middleware exemption for signed return | `arena/1c7c466f-aasra` |
| #14 | Merged | 2026-11-19 | `58c84ec` | fix(payments): real Safepay Express Checkout protocol (order/payments/v3 + TBT + embedded URL) | `arena/b11b0267-aasra` |
| #15 | Merged | 2026-11-20 | `0bcb26f` | Storefront: bag and checkout redesign, accessibility and touch-target pass | `arena/7d905137-aasra` |
| #16 | Merged | 2026-11-20 | `22f7d2b` | Storefront: whole-store shell, WCAG 2.2 AA and touch-target pass on all pages | `arena/b7fcf8ad-aasra` |
| #17 | Merged | 2026-11-20 | `38f6058` | Storefront visuals: shop cards, phone header, tiles, footer overflow | `arena/5dc1e1ab-aasra` |
| #18 | Merged | 2026-11-21 | `d2e3246` | Home page redesign | `arena/767c0e2a-aasra` |
| #19 | Merged | 2026-11-21 | `041b26e` | Safepay payment path: fix checkout, webhook and D1 binding | `arena/4e0a649d-aasra` |
| #20 | Merged | 2026-11-21 | `7118b8c` | Redeploy with corrected Turnstile site key | `arena/9a043713-aasra` |
| #21 | Merged | 2026-11-21 | `be19380` | CSP: allow Turnstile frame on checkout | `arena/fad514ab-aasra` |
| #22 | Merged | 2026-11-21 | `496d94c` | Redeploy with corrected Turnstile site key | `arena/c82a3000-aasra` |
| #23 | Merged | 2026-11-21 | `f6623cc` | Checkout: send CSRF token | `arena/64eeb1d1-aasra` |
| #24 | Merged | 2026-11-21 | `4e6860f` | TEMP: show Turnstile error codes at checkout | `arena/6cf0f6ce-aasra` |
| #25 | Merged | 2026-11-21 | `fef85cb` | TEMP: surface checkout server errors | `arena/2bd81247-aasra` |
| #26 | Merged | 2026-11-21 | `5619290` | Checkout: fix undefined normalizePhone | `arena/3ef30715-aasra` |
| #27 | Merged | 2026-11-21 | `0df1df8` | Checkout: fix money invariant for full payments | `arena/cfdc26f8-aasra` |
| #28 | Merged | 2026-11-21 | `018e6e3` | TEMP debug: show Safepay session error code | `arena/26569a74-aasra` |
| #29 | Merged | 2026-11-21 | `b0f2cc3` | TEMP debug: show Safepay error messages at checkout | `arena/14096fb0-aasra` |
| #30 | Merged | 2026-11-21 | `9ed0b6d` | Checkout: stop losing stock on failed checkouts | `arena/0c18e7a7-aasra` |
| #31 | Merged | 2026-11-21 | `24310f5` | TEMP debug: show Safepay raw error body | `arena/32356605-aasra` |
| #32 | Merged | 2026-11-21 | `4b1d539` | TEMP debug: Safepay key shape on empty 400 | `arena/a887787a-aasra` |
| #33 | Merged | 2026-11-21 | `cbd43eb` | Checkout: remove temporary debug output | `arena/85ca0d51-aasra` |
| #34 | Merged | 2026-11-21 | `4bced06` | Payment return: show the order and clear the cart | `arena/a978c96f-aasra` |
| #35 | Merged | 2026-11-21 | `d98707e` | Order success: show the order number | `arena/c6d83796-aasra` |
| #36 | Merged | 2026-11-21 | `d48e313` | Send order confirmation email via Resend | `arena/0341380b-aasra` |
| #37 | Merged | 2026-11-22 | `bd76d85` | Enable Workers Logs in wrangler config | `arena/3f8e1089-aasra` |
| #38 | Merged | 2026-11-22 | `8f4b552` | Fix Safepay webhook field mapping so paid orders settle | `arena/d8d6a022-aasra` |
| #39 | Merged | 2026-11-23 | `ad57cef` | Send paid-in-full email for full payments | `arena/467217fa-aasra` |
| #40 | Merged | 2026-11-23 | `8fe6a43` | Fix deploy of PR #39: scheduled.js import path | `arena/467217fa-aasra` |
| #41 | Merged | 2026-11-23 | `3eea022` | Storefront: black-and-white palette, Inter Tight headings, 15 new products | `arena/3f7f96a6-aasra` |
| #42 | Merged | 2026-11-23 | `18f1303` | Storefront: announcement bar, add-to-bag panel, home page flow | `arena/4b51b26a-aasra` |
| #43 | Merged | 2026-11-23 | `72ee81a` | Home hero: full screen height on desktop and phone | `arena/a97766f9-aasra` |
| #44 | Merged | 2026-11-23 | `e606bed` | Header: transparent at top, coloured on scroll down, hides on scroll up | `arena/b28288c8-aasra` |
| #45 | Merged | 2026-11-23 | `5f96d87` | Header: semi-transparent when coloured | `arena/ce23f4a5-aasra` |
| #46 | Merged | 2026-11-23 | `ff17544` | Home: sticky hero, Categories in Focus section | `arena/613da6a2-aasra` |
| #47 | Merged | 2026-11-23 | `38ebde5` | Home: Categories in Focus matches reference; filter bar fixed | `arena/15d41327-aasra` |
| #48 | Merged | 2026-11-23 | `5b5fc63` | Phone: hero and collection tiles fill one screen | `arena/d3845c3f-aasra` |
| #49 | Merged | 2026-11-23 | `aa74592` | Categories in Focus: closer to reference proportions | `arena/8974010f-aasra` |
| #50 | Merged | 2026-11-23 | `8b2cc0b` | Header: show on scroll up, hide on scroll down | `arena/b1855db4-aasra` |
| #51 | Merged | 2026-11-23 | `5272ca1` | Desktop: collection tiles and Categories in Focus fit one screen | `arena/ffafb0b1-aasra` |
| #52 | Merged | 2026-11-23 | `207dedf` | Categories in Focus: one screen, hidden scrollbars, arrows | `arena/421511a7-aasra` |
| #53 | Merged | 2026-11-23 | `1d84bce` | Desktop: collection rows and Categories photo fill one screen | `arena/034d2cf6-aasra` |
| #54 | Merged | 2026-11-23 | `dc154ca` | Categories in Focus: bigger card photos | `arena/8e5c8f17-aasra` |
| #55 | Merged | 2026-11-23 | `6cd19d2` | Categories in Focus: taller card photos | `arena/c05b5909-aasra` |
| #56 | Merged | 2026-11-23 | `ff5cc6f` | Categories in Focus: card photos 700px tall | `arena/c6880990-aasra` |
| #57 | Merged | 2026-11-23 | `da57866` | Categories in Focus: one screen, no scroll | `arena/c582911d-aasra` |
| #58 | Merged | 2026-11-23 | `890446c` | Categories in Focus: full-bleed photo | `arena/f8ba44d0-aasra` |
| #59 | Merged | 2026-11-23 | `196420d` | Categories in Focus: bigger photos, still one screen | `arena/c698f7c7-aasra` |
| #60 | Merged | 2026-11-23 | `b52c496` | Phone hero: photo fills the full screen | `arena/a7b6b4e3-aasra` |
| #61 | Merged | 2026-11-23 | `ca87ee5` | Phone hero: sticky reveal like desktop | `arena/73f01fed-aasra` |
| #62 | Merged | 2026-11-23 | `665f5a5` | Phone: collection tiles as one carousel | `arena/674d5d5b-aasra` |
| #63 | Merged | 2026-11-23 | `7ce0b89` | Phone: separate women's and men's carousels | `arena/53b4273c-aasra` |
| #64 | Merged | 2026-11-23 | `53f8229` | Phone Categories: product photos at full size | `arena/a3e6c15f-aasra` |
| #65 | Merged | 2026-11-23 | `4eff042` | Colour dots work everywhere | `arena/b2aea2e3-aasra` |
| #66 | Closed (not merged) | — | `—` | Colour photos for products (batch 1 of 3) | `arena/b2aea2e3-aasra` |
| #67 | Merged | 2026-11-23 | `b6156e9` | Colour photos for products (20 of 22) | `arena/a5672bb3-aasra` |
| #68 | Merged | 2026-11-23 | `917e8fa` | Colour dots swap the card photo (home and shop) | `arena/781c8084-aasra` |
| #69 | Merged | 2026-11-23 | `d3e23cc` | Colour dots: selected ring is not cut off | `arena/088a624b-aasra` |
| #70 | Merged | 2026-11-23 | `92d4cc0` | Home: bigger denim cards on phone | `arena/c61d50e1-aasra` |
| #71 | Merged | 2026-11-23 | `5c1b807` | Home: denim banner above Categories in Focus | `arena/466c07da-aasra` |
| #72 | Merged | 2026-11-23 | `648e2f1` | Category filters: compact toolbar and filter panel | `arena/96c4a20e-aasra` |
| #73 | Merged | 2026-11-23 | `beed2ae` | Category filter bar: sticky on mobile | `arena/2f10df73-aasra` |
| #74 | Merged | 2026-11-23 | `86fbce3` | Home: New in above denim drop; full-height denim banner | `arena/28c296a0-aasra` |
| #75 | Merged | 2026-11-23 | `b352fc3` | Phone: sub-category chips scroll sideways on one line | `arena/090ec699-aasra` |
| #76 | Merged | 2026-11-23 | `51567fd` | Phone: product rail cards are large everywhere | `arena/e31e12fb-aasra` |
| #77 | Merged | 2026-11-23 | `2ae61c8` | Breadcrumb no longer hides under the header | `arena/f3268ed2-aasra` |
| #78 | Merged | 2026-11-23 | `450ce3b` | Product page: fix tall photo and spacing on phones | `arena/5b573443-aasra` |
| #79 | Merged | 2026-11-23 | `3deac42` | Hero strip: one style and shorter wording | `arena/f35a298c-aasra` |
| #80 | Open | — | `—` | Gender pages: collection tiles fill each row | `arena/f35a298c-aasra` |
| #81 | Merged | 2026-11-23 | `a610c3f` | PDP: two-column photo grid with sticky info column | `arena/6ccbaf80-aasra` |
| #82 | Merged | 2026-11-23 | `c0ff153` | Collection tiles: clean two-row layout on women and men | `arena/148d963c-aasra` |
| #83 | Merged | 2026-11-23 | `bf5edd2` | Women and men pages: full-screen carousel and home sections | `arena/7ad33c69-aasra` |
| #84 | Merged | 2026-11-23 | `64c4f69` | Footwear category and gender page sections | `arena/e286c97b-aasra` |
| #85 | Merged | 2026-11-23 | `a366077` | PDP phone: product photos as a swipe slider | `arena/de606ee1-aasra` |
| #86 | Merged | 2026-11-23 | `55fe890` | PDP phone: larger photo fills the gap | `arena/2c9e8589-aasra` |
| #87 | Merged | 2026-11-24 | `6d34185` | Shop: category chips, search and sort work | `arena/ab5524fc-aasra` |
| #88 | Merged | 2026-11-24 | `a8a35d4` | Sub-categories under each parent category | `arena/76836e03-aasra` |
| #89 | Merged | 2026-11-24 | `5354723` | Sub-categories on Shop and in product breadcrumb | `arena/d020066b-aasra` |
| #90 | Merged | 2026-11-24 | `eb7e511` | Client-side navigation between storefront pages | `arena/7a59b187-aasra` |
| #91 | Open | — | `—` | docs: build playbook and corrected architecture | `arena/b0e24a8e-aasra` |

Notes on the table:
- **#66** was closed, not merged. Its work was superseded by #67.
- **#80** is still open. It was superseded by #82. Close it when the owner says so.
- **#91** is the documentation PR this file belongs to.
- **#62 and #63** were merged on 2026-11-23. The owner's approval for each is not recorded in the earlier notes.
- **Approvals recorded in the earlier notes:** #54, #56 (flagged), #57–#61, #64, #65, #67, #72–#77, #79, #81–#90. Merges not in that list (for example #1–#53, #68–#71, #78) are in GitHub, but their approvals are not in this record.
- **Branch names** repeat: #39 and #40 share a branch, as do #65 and #66, and #79 and #80. The second PR in each pair reused the branch. Use the PR list, not the branch name, to see what merged.

## 2. Phases

**Phase 1 — Storefront foundation (#1–#11, 17–19 Nov).** Header and shop mega menu. Editorial redesign. A reference-led design pass against a luxury-fashion site named in the PR titles (#4–#6). A "fail-closed commerce setup" (#2): checkout refuses to run without its configuration. Scroll and section work (#9, #10). A research report (#11). Research and design rules are in `docs/RESEARCH.md`, `docs/research/STORE_RESEARCH_2026.md`, `docs/RESEARCH_APPLICATION_REPORT.md`, and `skills/`.

**Phase 2 — Payments (#12–#14, #19–#40, 19–23 Nov).** Safepay sandbox integration (#12). Corrected protocol after reading Safepay's SDK (#14). Then a long debugging run: Turnstile keys, CSRF, CSP, a phone normalisation bug, a money invariant bug, stock loss on failed checkouts, the payment return page, the webhook field mapping, emails, and a deploy failure. Temporary debug PRs #24, #25, #28, #29, #31, #32 were removed in #33. The lessons are in §3.

**Phase 3 — Bag, checkout and visuals (#15–#18, 20–21 Nov).** Bag and checkout redesign, accessibility pass to WCAG 2.2 AA, touch targets, home page redesign.

**Phase 4 — Storefront visuals (#41–#86, 23 Nov).** Palette and font change (#41), 15 new products (#41), header behaviour (#44, #45, #50), hero and Categories in Focus (#43, #46–#59), phone hero and tiles (#48, #60–#63), colour dots (#65, #68, #69), denim banner (#70, #71, #74), filter toolbar (#72, #73), phone rails and breadcrumb (#75–#77), product page (#78, #81, #85, #86), collection tiles (#79–#82), gender pages and footwear (#83, #84).

**Phase 5 — Shop, sub-categories and navigation (#87–#90, 24 Nov).** Shop filters that work (#87), sub-categories (#88), Shop chips and product breadcrumb (#89), client-side navigation between browse pages (#90).

**Phase 6 — Documentation (#91, 24 Nov).** This set of documents.

## 3. Lessons from the PR record

Each lesson is tied to the PR that taught it. These are the mistakes most likely to repeat in a new project.

| Problem | PR | What fixed it | Rule |
|---|---|---|---|
| CSP blocked the Turnstile frame on checkout | #21 | CSP changed to allow the Turnstile frame | Any third-party widget needs a CSP entry. Check the console, not only the page |
| Checkout did not send the CSRF token | #23 | Checkout sends the token | Every state-changing request sends the token. Test the browser path, not only the API |
| Checkout crashed on an undefined `normalizePhone` | #26 | Fixed the missing function | Run the checkout once in the browser after any change to validation |
| Money invariant applied to full payments | #27 | Invariant applies to deposit orders only | Check invariants against each payment type. A full payment has zero deposit and zero balance |
| Stock lost when checkouts failed | #30 | Failed checkouts release their holds | Every failure path after a hold must release it |
| Paid orders did not settle | #38 | Webhook field mapping corrected to Safepay's envelope | Map fields from the provider's documentation, not from memory. Log the contract mismatch |
| Deploy failed after a merge | #40 | Import path in `scheduled.js` corrected | Dry-run the Worker bundle before merging any change to `functions/` |
| Signed return rejected by middleware | #13 | Middleware exempts the signed return (HMAC is the auth) | Server-to-server endpoints need an explicit exemption and their own verification |
| Protocol mismatch with Safepay | #14 | Rebuilt on Safepay's Express Checkout flow (order/payments, token, embedded URL) | Verify the protocol against the official SDK before the first real request |
| Turnstile site key wrong | #20, #22 | Key corrected and redeployed | The site key is baked in at build time. A change needs a new build |
| Debug output reached production | #24, #25, #28, #29, #31, #32 → #33 | Debug removed in #33 | Put temporary debug behind a flag and remove it the same day |
| Shop tabs never changed | #87, #89 | Filters run in the browser from the URL | A static site cannot read the query at build time |
| Category changes reloaded the page | #90 | Client-side navigation with persistent chrome | Scripts must initialise on `astro:page-load`; persist on root elements |
| Sub-category chips did not follow the selected category | #89 | Chips follow the selected category | Test the active state after each navigation |

Additional lessons from the sandbox record (§6) and the code review that produced `KNOWN_ISSUES.md`:
- The webhook accepts more event and status names than the final state. Settlement should check the final state explicitly.
- Stock holds are released on a daily schedule, so abandoned checkouts can hold stock for about a day.
- Tax was never added to order totals, and the invoice reads its tax and business settings from `process.env`. Confirm both before live payments.

## 4. Decisions and reasons

Dates are the date the decision was recorded in the notes. "Reason not recorded" means the reason was never written down.

| Date | Decision | Reason |
|---|---|---|
| Nov 2026 | Catalogue as JSON files, no admin dashboard | Chosen for this build. Reason not recorded |
| Nov 2026 | Safepay hosted checkout | The gateway used. Reason not recorded |
| Nov 2026 | Prepaid only; deposits removed | Owner decision |
| Nov 2026 | No manual "mark as paid" | Requested once and rejected. The webhook path must be fixed instead |
| Nov 2026 | Shop filters in the browser | A static site cannot read the query at build time |
| Nov 2026 | Resend for email | Chosen for this build. Reason not recorded |
| 2026-11-23 | Footwear in every nav, both genders, shop and Categories in Focus | Owner asked for it everywhere, matching the reference image |
| 2026-11-23 | Women's and men's categories match exactly | Owner rule |
| 2026-11-23 | Hero: full-screen carousel, scroll parallax, dots only, no arrows | Owner rule |
| 2026-11-23 | Desktop collection tiles and Categories fit one viewport. Carousel scrollbars hidden; other carousels keep arrows | Owner rule |
| 2026-11-23 | Phone hero and tiles fill the screen; tiles are a carousel | Owner rule |
| 2026-11-23 | Denim is a full-width banner that fills the viewport height, then a carousel. New In sits above it | Owner rule |
| 2026-11-23 | Product page: two-column image grid with a sticky info column | Owner asked for the layout in the reference screenshot (image-183) |
| 2026-11-23 | Phone product page only: dots sit under the gallery and scroll to that photo. A colour swatch moves that colour's photo to the front and resets to photo 1 | Owner request. Desktop layout unchanged |
| 2026-11-23 | Category layout (PR #82): "this is the ss" after "the layout is so awkward" | Owner approved. Do not change without a clear request |
| 2026-11-23 | Header: transparent at top, coloured on scroll, hides on scroll down, shows on scroll up | Owner rule |
| 2026-11-23 | Colour dots swap the card photo everywhere, including home | Owner rule |
| 2026-11-23 | Filter popup must open on screen wherever the shopper is on the list | Owner rule |
| 2026-11-23 | Headings Inter Tight, body Inter | Owner rule |
| 2026-11-23 | Placeholders for photos until the owner supplies final images | Owner rule |
| 2026-11-24 | Category changes must not reload the whole page | Owner request: category changes must not reload the whole page |
| 2026-11-24 | Sub-categories on both the Shop chips and the product breadcrumb | Owner chose "both" |
| 2026-11-24 | Shop chips follow the selected category | Owner report: "the tabs are not changing" |

## 5. Products and content

- **Counts at this snapshot:** 34 visible products (women 18, men 16), 256 variants. The full list is `CATALOG_INDEX.md`.
- **Tiles and sub-category counts:** not recorded in the notes. The current list is in `CATALOG_INDEX.md` (generated from `data/catalog/`).
- **Sample products are real.** No "Sample" labels, no sample copy.
- **Placeholders:** product photos, colour photos, denim photos, footwear photos, and product-page crops. Replace them when the owner sends photos.
- **Greyscale product photos:** open question. Ask before changing.
- **Reference site:** used for layout and feel only. Do not reuse its photos, product names or copy.
- **Keep "Juniors."** Owner decision.
- **Do not commit** `data/products.json` or `public/data/products.json` without asking.
- **Error reds** are kept unless the owner asks for a change (the list is in `PLAYBOOK.md` §7.8).

## 6. Payments: sandbox record

- **Gateway:** Safepay sandbox. Live not approved.
- **Goal:** a completed test order through Safepay to a PAID order, a receipt, and a lookup page that shows PAID. This goal is still open.
- **Sandbox orders created:** `AAS-20261122-SRQP` and `AAS-20261122-CATP`.
  - `SRQP`: still pending. Do not mark it paid by hand. Safepay's option to resend a payment link is unknown. Do not guess it.
  - `CATP`: the timeline below is from the logs. The webhook's final status was not confirmed.
- **`CATP` timeline (GMT+5):**
  - 07:28:23 checkout.
  - 07:29:26 webhook received.
  - 07:29:28 `POST /api/webhook` and the receipt email.
  - 07:29:29 `/api/safepay-return`.
  - 07:29:45 `/api/order-lookup`, twice.
- **Duplicate guard** (commit `f53b0ed`): a second full payment is recorded as `duplicate` and flagged `refund_required`.
- **Lookup "Network error"** cause: `can_pay_balance is not defined` (fixed in `5fe1fb0`). Do not revert to GET. Lookup now sends the phone in the POST body (`5cb4851`).
- **Live blockers:** `BUSINESS_ADDRESS` empty; `TAX_REGISTRATION_NO` empty; tax rate `0` and marked VERIFY; Safepay still sandbox; live keys not obtained; Safepay onboarding at step 1 of 6.
- **Tax:** not added to order totals. The invoice applies `TAX_RATE_PCT` from `process.env` (see `KNOWN_ISSUES.md` #5). Confirm the intended rule with the accountant before live.
- **Order numbers:** `AAS-YYYYMMDD-XXXX`, generated in `functions/api/checkout.js`.
- **Receipt email:** must be a full receipt showing Paid with correct details.
- **Priority:** payment works end to end before owner orders and product work start.

### 6.1 Payment rules set by the owner
- Keys and secrets never go in chat. Keys go only into PowerShell, the Resend dashboard, or the Cloudflare dashboard.
- Prepaid only.
- Real cards are never used. Sandbox test cards come only from Safepay's own docs or dashboard. Other providers' test cards that appeared in search results were not used.
- The live switch is not approved.
- Checkout: one pass over the whole flow. The goal is a completed test order.
- **Standing permission (checkout errors only):** commit, push, open, and merge checkout-error fixes without asking. Not for Resend or email work.

## 7. Email rules

- One Resend change at a time.
- Do not create a second Resend account.
- Merging email work requires an explicit "yes".
- Free-tier limits quoted by third parties (October 2026): 3,000 emails a month, 100 a day, 3 domains. Pro is $20 for 50,000, with overage at $0.90 per 1,000. Check Resend's pricing page before budgeting.
- The Resend dashboard saying "verified" does not prove DNS. Check with `nslookup`.

## 8. Cart rules

- One add click gives quantity 1.
- Returning to a product already in the bag says so ("Already in your bag — view bag") and does not offer to buy it again.
- **Cart quantity fix:** the owner has not decided whether to merge it. Ask before merging.

## 9. Working rules from the owner

- **Merge only on an explicit "merge"** (or "merge and show"). Each PR gets its own approval.
- **Branch rules:** use the branch the system names. Do not edit or push on a branch marked `pr_merged`. 
- **Questions:** act when the request is clear. Ask one question at a time, and only for real ambiguity.
- **Cache:** when the owner says "no change", advise a hard refresh or a private window first.
- **Category layout:** do not change it without a clear request.
- **Figma:** the connector was validated. Use it only with a file link or a clear instruction.
- **Owner verification:** the owner checks changes on a phone. A hard refresh on the phone for PRs #74–#77 is not confirmed.

## 10. Dead ends and what they taught us

| What was tried | What went wrong | Rule now |
|---|---|---|
| Shop chips read the query in frontmatter | The static build always showed "All" | Filter in the browser (`shop.astro`). No server or SSR route for this |
| `pay-balance.astro` reads query params in frontmatter | Empty on the static build | Legacy. Do not change without asking. See `KNOWN_ISSUES.md` #12 |
| `transition:persist` on the component tag | Mega menus stopped working after navigation | Put persist on root elements in `SiteHeader` and `SiteFooter` |
| `#site-search` as a selector | Does not exist | The overlay uses `#as-search-open` and `#as-search-input` |
| Global `main a` rule with plain anchors | Strip tiles collapsed to about 24 px | Give anchors a class starting with `as-` |
| Full-page screenshots for footwear | Lazy images not decoded yet | Scroll, then check `naturalWidth` |
| Build under Node 22 | Fails | Use Node 24 |
| `git checkout main` during a build check | Switched branches on a task branch | Do not switch branches to verify a build |
| HTML `height` on product photos | Overrode the 3:4 CSS ratio | Do not set `height` on product images |
| Writing a script into a missing `/tmp` folder | Failed | `mkdir -p` first |
| `pkill -f "http.server 8792"` | Killed its own shell | Use `pkill -f "[h]ttp.server"` or stop by PID |
| Empty screenshots | `.as-reveal` fades in on scroll | Scroll and add the revealed class before capturing |
| Gallery badge selector | The badge is a child of the gallery | Use `:last-of-type:nth-of-type` |
| Phone parallax with `position: relative` | Did not work | `position: sticky; top: 0` in the ≤720 px hero |
| Phone Categories with a fixed-height wrapper | Broke the layout | Do not reintroduce a fixed-height wrapper |
| Sticky PLP toolbar without a wrapper | Did not stick | Needs `.as-plp-body[data-plp-bar]` |
| PLP generator with `${…}` in a template literal | Left a stray `$` | Check the generated output |
| Colour dot ring check on the whole card | Wrong crop | Element screenshot of `.as-card-colors` |
| Inline browser-check scripts | Failed silently | Write each check to a file and run it |
| `gh pr edit` titles | Old title kept on #69 and #78 | Check the title after editing |
| `gh pr create` on a branch that already has a PR | Returns the existing PR | Run `gh pr view` first |
| `&&` chain ending in `gh pr merge` | Printed nothing | Verify with `gh pr view` |
| `gh pr merge 88 --merge` | Aborted before returning | Confirm the state with `gh pr view 88` before assuming |
| `gh pr merge 61` | Failed with "Base branch was modified" | A retry worked |
| Non-fast-forward push | Fixed with `git reset --soft` | Never force-push shared work |
| Shallow clone, `git diff <sha>^1` | Failed | `git fetch --unshallow` (done in this session) |
| `gh run rerun 44926825439` | Failed | Do not retry. Push a fresh commit |
| Importing `functions/api/checkout.js` from tests | Fails | Guard tests read the source |
| Manual paid-marking of `AAS-20261122-SRQP` | Rejected by the owner | Do not do it |
| Test cards from search results | Other providers' cards | Do not use them |
| Webhook field names guessed | Unreliable | Use only fields in Safepay's SDK and docs |
| `/tmp/promote.mjs` | Overwrote tracked images | Do not rerun. Never overwrite tracked `m003–m006.jpg` or `w003–w007.jpg` |
| `/tmp/dots-edit.cjs` | Failed | Do not reuse |
| Shell scripts with backticks written inline | Broke | Write with `cat > file <<'EOF'` |
| `generate_image` | Limit of 10 images per turn | Plan batches |
| 2019 Safepay integration guide | Sandbox card expired | Not a source of truth |
| An image link from awesomescreenshot | Returned no image | Not usable |
| Denim-only rail rule | Removed in PR #76 | Do not add it back |
| Filter panel outside `.as-plp-toolbar` | Reason not recorded in the notes | Keep the filter panel inside `.as-plp-toolbar`. The compact toolbar came in #72 |

## 11. Open items (as of this snapshot)

- **PR #80:** open and superseded by #82. Close it on the owner's word.
- **PR #91:** this documentation, open. Merge only on an explicit "merge".
- **PR #62 and #63:** merged on 2026-11-23 per GitHub. The earlier notes did not record approval for them. Confirm with the owner that they are wanted.
- **Hard refresh on the phone** for PRs #74–#77: not confirmed.
- **Footwear search placeholder and empty-state hint** in `SiteHeader.astro` (about lines 112 and 205): not updated.
- **Breadcrumb gap tightening:** unanswered.
- **Checkout and order pages as full loads:** the code uses full loads (`data-astro-reload`). Whether they should stay that way is not decided. Links into them from the storefront are not browser-tested.
- **`ERR_CONNECTION_CLOSED` console messages** seen once. Cause not confirmed.
- **The sandbox cannot reach Google Fonts**, so font checks are not reliable there.
- **Newsletter does not store signups** (`KNOWN_ISSUES.md` #1). Found in the audit, not yet fixed.
- **Settlement checks** (`KNOWN_ISSUES.md` #2) and **stock timing** (#3, #4) need decisions before live.
- **Live payments and the live switch:** not approved.
- **Safepay onboarding:** step 1 of 6.
- **Order `AAS-20261122-SRQP`:** pending.
- **Order `AAS-20261122-CATP`:** webhook result not confirmed.
- **Cart quantity fix:** merge undecided.
- **Greyscale product photos:** open. Ask first.
- **Logo in Cormorant:** proposed. Confirm.

## 12. Recovery after a sandbox reset

The sandbox can lose `/tmp`, `node_modules` and `dist/`, and the repo can be re-cloned so local branches lag behind.

1. `git fetch origin`, then compare with the remote before doing anything.
2. Node 24: install it in a scratch folder (for example `/tmp/n24pkg`).
3. In the repo: `npm ci`, then `npm run build`.
4. Browser tools: `mkdir -p /tmp/chr`, then `npm i puppeteer-core @sparticuz/chromium` in that folder.
5. Chromium libraries: the headless browser needed system libraries. They were rebuilt by hand into `/tmp/libs/al2023/lib`; the exact method was not recorded. Import `@sparticuz/chromium` through `.default`.
6. Preview: build first, then `python3 -m http.server 8792 --bind 0.0.0.0 --directory dist`. Check it returns 200 for `/shop/`.
7. Safepay SDK reference: clone `getsafepay/safepay-python` into a scratch folder. Read it only.

## 13. Client-side navigation: how it was verified

- The Astro router source in `node_modules` was read (read-only) before the change.
- The change was applied with scripts in `/tmp/subcat/`. They have all run. Do not run them again.
- Build exit 0. Tests 46 of 46.
- Browser check: a click on Knitwear on `/shop/` kept the page alive and changed the URL to `/shop/?category=knitwear`. The cart still does a full load.
- `astro:page-load` fires on first load and after each client navigation.

## 14. Conversation record: the owner's requests, in order

This section follows the working conversation: what was asked, what was corrected or rejected, and how each item ended. Sections 4 and 9 hold the rules; this section shows how they came about. It is built from the session notes kept during the work, so the owner's exact early wording may be shortened. Quoted phrases are the owner's own words.

### 14.1 Standing requests

- **Documentation (Nov 24):** "i want every thing documented everything that we did so far because if i want to make a new site with similar things i dont need to do everything from zero again." Scope: architecture, decisions, setup, deploy, payments, catalogue, design rules, lessons from failures, and build history.
- **Completeness (Nov 24):** "make sure you dont leave anything this project is the base for many to come." Operations, risks, and open items are included.
- **Cloudflare (Nov 25):** "did you documented the cloudflare?" Answered by `CLOUDFLARE.md`. Its gaps are listed in that file.
- **Branch and merge rules (Nov 24):** use the branch the system names. Never push to a `pr_merged` branch. Merge only on an explicit "merge".

### 14.2 Payments (Nov 22 to Nov 23)

| Owner request or correction | What was done | Status |
|---|---|---|
| Prepaid only; the deposit option is removed | Deposit removed from checkout; code remains (`KNOWN_ISSUES.md` #12) | Done. Dormant code remains |
| "Manual payment marking" was offered and rejected for `AAS-20261122-SRQP` | Fix the webhook path instead | Done for the rule. SRQP still pending |
| Keys and secrets never in chat | Keys entered only in PowerShell or the Resend or Cloudflare dashboards | Standing rule |
| Real cards never used; test cards only from Safepay's own docs or dashboard | Test cards from third-party search results were not used | Standing rule |
| Paid receipt must be a full receipt showing Paid with correct details | Receipt email built; the `CATP` webhook result is unconfirmed | Partly done |
| Goal: a completed test order that reaches PAID, a receipt, and a lookup page showing PAID | Not reached. `CATP` webhook outcome unconfirmed; `SRQP` pending | Open |
| Live switch | Not approved | Open |
| Priority: payments work end to end before owner orders or product work | Storefront and catalogue work continued in parallel | Open |

### 14.3 Storefront (Nov 22 to Nov 23)

- **Products (Nov 22):** 15 new products went live in PR #41. The owner said to treat them as real until photos arrive. No "Sample" labels.
- **Footwear (Nov 23):** "Add everywhere, matching image-185." Women's and men's categories match exactly. Reuse home sections where they fit, and build new sections rather than copy home.
- **Hero (Nov 23):** full-screen carousel with parallax and dots only; no arrows.
- **Category layout (Nov 23):** the owner said "the layout is so awkward," then approved the new layout with "this is the ss" (image-184). Fixed in PR #82, which supersedes PR #80. Do not change without a clear request.
- **Product page (Nov 23):** "make the product single like this" (image-183). Two-column image grid, with the info column sticky. Header offset fixed in PR #77.
- **Phone product page (Nov 23):** "make the image larger to fill the gap" (image-187), fixed in PR #86. Dots sit under the gallery and scroll to that photo. A colour swatch moves that colour's photo to the front and resets to the first photo. Desktop stays unchanged.
- **Filter popup (Nov 23):** must open on screen wherever the shopper is on the list. Kept inside `.as-plp-toolbar` (PR #74).
- **Denim (Nov 23):** full-width banner filling the viewport height, then a carousel. New In sits above it. The denim-only rail rule was removed in PR #76 and must not return.
- **Colour dots:** swap the card photo everywhere, including home.
- **Header:** transparent at the top, coloured on scroll, hides on scroll down, shows on scroll up.
- **Font:** Inter Tight for headings, Inter for body.
- **Greyscale product photos:** raised, not decided. Ask before changing.
- **"Keep Juniors."** Owner decision.
- **Cormorant logo:** proposed; awaiting confirmation.

### 14.4 Shop, sub-categories and navigation (Nov 24)

- **"The tabs are not changing."** The Shop chips did not follow the selected category. The static build rendered the active state from the build-time URL. Fixed with browser-side filtering (PR #87).
- **Sub-categories:** the owner chose "both," meaning Shop chips and the PDP breadcrumb. Requested "make and merge." Done in PRs #88 and #89.
- **Performance:** "category changes must not reload the whole page." Done with client-side navigation in PR #90. Checkout and non-storefront pages still load fully.
- **Cart:** one add click gives quantity 1. Returning to a product already in the bag says so and does not offer to buy again. The owner has not yet decided whether to merge the cart quantity fix.

### 14.5 Corrections and rejections

- Rejected: a manual "mark as paid" for a pending order (`AAS-20261122-SRQP`).
- Corrected: "the tabs are not changing" (Shop chips, Nov 24).
- Corrected: "the layout is so awkward" (category layout, Nov 23). Replaced by the approved layout ("this is the ss").
- Corrected: the phone product page image gap ("make the image larger to fill the gap", Nov 23).

### 14.6 PR approvals

Approval, as recorded in the notes. Each PR needs its own "merge."

| Status | PRs |
|---|---|
| Approved | #54, #56 (flagged), #57–#61, #64, #65, #67, #72–#77, #79, #81–#90 |
| Closed as superseded | #66 |
| Open | #80 (superseded by #82), #91 (this documentation) |
| Merged on GitHub, approval not recorded | #62, #63 (merged 2026-11-23; confirm with the owner) |
| Not recorded in the notes | #68–#71, #78 |

### 14.7 Waiting on the owner

These need a decision or confirmation. None has been done without one.

1. Confirm that PRs #62 and #63 are wanted.
2. Confirm that the phone hard refresh for PRs #74–#77 shows the changes.
3. Decide whether to merge the cart quantity fix.
4. Decide on greyscale product photos.
5. Confirm the Cormorant logo.
6. Answer the breadcrumb gap tightening request. It is unanswered.
7. Decide whether checkout, pay-balance, order-lookup and order-success stay full-page loads.
8. Decide the Safepay steps for `AAS-20261122-SRQP`. Do not guess Safepay's resend option.
9. Approve the code risks in `KNOWN_ISSUES.md` for fixing, starting with the newsletter insert (#1).
10. Live switch: not approved. It needs the owner's explicit approval.

### 14.8 Limits of this record

- The record is built from the session notes, not a full transcript. Early wording and some intermediate steps may be missing.
- Some image references (image-183, -184, -185, -187) are the owner's screenshots. They are not stored in the repo.
- This record does not change the code. Where the code and this record disagree, the code is the source of truth.
