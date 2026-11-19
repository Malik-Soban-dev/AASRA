# Research Application Report — 2026-11-19

Answers three standing requirements: (1) was the research applied to project
changes, (2) were those changes pushed, (3) deep root-cause investigation of why
problems have been happening. Evidence is reproducible (commands noted).

---

## 1. Was the research applied to new project changes? — YES

Research record: `docs/RESEARCH.md` (fashion e-commerce UX + 2026 design trends,
with sources). Every shipped change traces to it:

| Research finding (source) | Applied change | Where | Shipped in |
|---|---|---|---|
| Audience-first taxonomy: Women/Men → product type → New In (Convertica, ConvertCart, Ecom Design Pro) | `/women` `/men` landings, `[gender]/[category]` PLPs, "new-in" pseudo-category | `src/pages/[gender]/**` | PR #8 |
| Mega menu: 4–6 groups, concrete plural labels, one feature tile (Tenten, Ecom Design Pro) | WOMEN/MEN mega-nav with feature image | `src/components/store/SiteHeader.astro` | PR #8 |
| PLP: filters above grid, multi-select, no reload, live counts, sort separate (ConvertCart audit checklist) | Colour/size filter chips + sort select, client-side | `[gender]/[category].astro` | PR #8 |
| Search with instant visual results (ConvertCart) | Header search overlay querying generated catalog | `SiteHeader.astro` | PR #8 |
| Net-a-Porter "Shop the Look"; Zara image→category grids; Jacquemus oversized type on campaign imagery | Shop-the-look module, "The Edit" tile row, display type over full-bleed campaign | `src/pages/index.astro` | PR #8 |
| 2026 trends: cursor-reactive heroes, kinetic type, scroll-driven motion "that earns its place" (Envato/Figma trend reports) | Hero cursor parallax, word-rise headline, image scroll-settle, scroll-progress line | `RunwayHero.astro`, `store.css` | PR #8/#9 |
| Runway / model-forward hero (user brief + trend research) | Unified slideshow hero: crossfading campaign slides with Ken Burns | `RunwayHero.astro` | PR #9 |
| Full-screen section scrolling (user brief) | Native CSS scroll-snap sections, exact 100dvh, snap-stop always, smooth steps | `store.css` (`html.as-snap`) | PR #9, refined PR #10 |
| Anti-slop discipline (user brief) | `docs/DESIGN_SYSTEM.md` rules + `skills/design-system.md` | `docs/`, `skills/` | PR #8 |
| No-dashboard editing (user brief) | Per-category JSON authoring + `scripts/build-catalog.js` aggregate | `data/catalog/**` | PR #8 |

The earlier Brunello Cucinelli deep-dive research (PR #4/#5) is likewise live in
git history (badge system, quick-shop patterns, `/api/stock` endpoint).

## 2. Were the research-driven changes pushed? — YES

All work landed on `main` via branch → PR → merge (the sanctioned path), and
deploys to https://aasra.shop through `.github/workflows/deploy.yml` on every
push to main. Live delivery was verified by fetching the production site after
each merge (runway hero, taxonomy, snap scroll all serving).

| PR | Title | Merged |
|---|---|---|
| #8 | Fashion storefront rebuild: design system + women/men store + research-driven UX | 2026-11-18 |
| #9 | Unified cinematic hero + full-screen section scroll + scroll animation | 2026-11-19 |
| #10 | Smoother section-to-section scroll with exact full-height sections | 2026-11-19 |
| #4–#7 | BC research + badges, merch patterns, design-language work (earlier research cycles) | 2026-11-18 |

Research docs and skills are on `main` too (`docs/RESEARCH.md`,
`docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md`, `skills/*` — verified via
`git ls-tree -r main`).

## 3. Deep investigation — why problems happen / why it has not worked well

### 3.1 Historical root causes (why earlier iterations failed) — mitigated

1. **Blind visual work.** Styling was done without seeing rendered pixels;
   patches became `!important` override layers that fought the real layout
   engine (hero animation clobbering transforms, forced grid columns). The PR #6
   incident is the case study; reverted in PR #7. *Mitigation now: edit owning
   files only, never override layers (`skills/design-system.md`), mechanical
   verification (build/tests/curl) at every step.*
2. **No design source of truth.** Without tokens/rules, every patch drifted →
   generic "AI slop" look. *Mitigation: `docs/DESIGN_SYSTEM.md` + tokens.css
   (values may exist only there) + anti-slop checklist.*
3. **Feature-first, not research-first.** Building before studying fashion UX
   produced a home-goods template wearing features. *Mitigation:
   `skills/research-first.md`; this cycle research preceded every change.*

### 3.2 Live problems found today (evidence, reproducible)

Scan method: link-scan of all built pages (`dist/**/*.html` vs existing routes),
source greps, test run. Results:

1. **≈218 genuine dead product links on legacy pages.** Every page using the old
   `Layout.astro` (cart, checkout, wishlist, about, legal, journal, 404 —
   ~27 pages) carries `src/components/Header.astro` mega-menu links hardcoding
   retired home-goods slugs (`/product/linen-curtain-panel-ivory`,
   `/product/ceramics-dinner-plate-set`, … ×8 per page). They 404 since the
   catalog became fashion. **The new store routes themselves are clean** (0 real
   dead links on home/PLP/PDP; one JS template-literal false positive).
2. **Transaction pages still wear the old visual system.** `src/pages/cart.astro`,
   `checkout.astro`, `wishlist.astro` use `Layout.astro` with zero `as-` design-
   system classes — the look/feel breaks exactly at the trust-critical moment.
3. **Live stock is inert.** `grep` shows nothing in the new store calls
   `/api/stock` (it exists from the BC cycle), and the D1 binding is still
   commented out (`wrangler.toml:57`). The size selector therefore always shows
   every size as available — no "Only one left" / "No longer available" states.
4. **Single-image products.** All 7 catalog products have exactly 1 image
   (`data/products.json`), so the PDP gallery duplicates the same shot — the
   weakest point versus reference PDPs (multi-angle is table stakes).
5. **Stale test/email fixtures.** 6 occurrences of retired SKUs/names
   ("Linen Curtain Panel — Ivory", `LIN-IV-…`) remain in `tests/run.js` email
   assertions — harmless but confusing next to the fashion catalog.
6. **Infrastructure fragility (recurring).** Every session reset wipes
   `node_modules` and `dist/` and reverts Node to v22 → "astro: not found"
   (hit again *during this investigation*: `dist/` had 0 pages, an earlier
   link-scan was vacuously "clean"). Repair is a manual 3-step sequence each
   time. This cost several failed turns earlier.
7. **Visual-QA gap.** The sandbox has no browser and browser downloads are
   network-blocked (Electron install TLS-failed). Layout is verified
   structurally (HTML/CSS/build/tests), never pixel-wise — this gap is the
   deepest reason "it looks bad" surprises reached the user instead of being
   caught by me.

### 3.3 Recommended fixes, priority order

1. Purge the 8 hardcoded product links from legacy `Header.astro` (point them at
   category pages) — kills ~218 404s in one small change.
2. Restyle `cart` / `checkout` / `wishlist` onto the design system
   (StoreLayout + `as-` components) — same look through purchase.
3. Wire `/api/stock` into the new PDP size selector and enable the D1 binding
   (`wrangler.toml`) when the database is created.
4. Multi-angle product photography (2–3 images per piece) + the missing 8th
   piece (image quota hit last cycle).
5. Redirect map for retired product/story URLs if SEO/history matters.
6. `scripts/env-doctor.sh` — one command that repairs node/npm/dist after any
   sandbox reset (the manual sequence, automated).
7. Retry screenshot tooling (WeasyPrint+PyMuPDF fallback) to close the
   visual-QA gap.

Verified state at report time: `npm test` 29/29, 48 pages build, new store
routes clean, all research docs on `main`.
