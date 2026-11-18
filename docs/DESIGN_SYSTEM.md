# AASRA Design System

The single source of visual truth. Every color, size, spacing and motion value in
the store comes from here. If a value isn't in this document, it doesn't ship.

Design target: quiet-luxury fashion editorial (see `docs/RESEARCH.md`) — the feel
of Brunello Cucinelli / COS / Jacquemus storefronts, with AASRA's own warm identity.
Brand decision (user-confirmed): keep the **clay + olive accent colors**.

---

## 1. Color tokens

| Token | Value | Use |
|---|---|---|
| `--as-paper` | `#f7f5ef` | Page background (warm off-white) |
| `--as-canvas` | `#ffffff` | Cards, drawers, inputs |
| `--as-ink` | `#23211d` | Headings, body, solid buttons |
| `--as-graphite` | `#6f6a60` | Secondary text, captions |
| `--as-line` | `#e3ddd2` | Hairline borders (1px only) |
| `--as-sand` | `#eee7da` | Soft surfaces, image placeholders |
| `--as-clay` | `#a65e45` | **Brand accent** — links, marquee, sale/badge highlights |
| `--as-olive` | `#36433a` | **Brand accent** — dark bands, footer, secondary solid |
| `--as-error` | `#8c2f2f` | Errors only |

Rules: never use pure `#000` or `#fff` for text; max **two accent colors per
screen**; clay is never a large background except the marquee band.

## 2. Typography

Two families only, loaded from Google Fonts CDN:

- **Display:** `Fraunces` (variable serif) — headlines, product names, prices.
- **UI:** `Inter` — navigation, labels, buttons, body copy.

| Role | Size | Notes |
|---|---|---|
| display-xl | `clamp(3.5rem, 9vw, 7.5rem)` | Hero only. Tight leading (0.95). |
| display-l | `clamp(2.25rem, 4.5vw, 4rem)` | Section titles, PDP name. |
| h2 | `clamp(1.6rem, 2.5vw, 2.25rem)` | Sub-sections. |
| body | `0.95rem / 1.7` | Copy. `--as-graphite` for secondary. |
| label | `0.7rem`, uppercase, `0.22em` tracking | Nav, buttons, kickers. `500` weight. |
| micro | `0.625rem`, uppercase, `0.18em` tracking | Badges, meta, color names. |

Rules: serif for content, sans for controls (never mixed); kickers always sit
directly above their heading (0.75rem gap); max line length 65ch.

## 3. Spacing & geometry

- 4px base. Scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.
- Section rhythm: `128px` desktop / `64px` mobile between sections.
- Container: `min(100% - 5rem, 1440px)`, 2.5rem side gutters (1.25rem mobile).
- **Radius `0`** everywhere (fashion-sharp) except pill chips (`999px`) and dots.
- Borders: 1px `--as-line`. **No drop shadows** except drawer/modal scrim.

## 4. Grid

- Product grids: 4-col desktop → 2-col mobile, gap `24px / 12px`.
- Editorial ("broken") grids: 12-col with intentional 2–4 col spans and 1 offset
  tile per section — asymmetry is allowed **only** in editorial modules.
- Everything else aligns to the container.

## 5. Components (owned by `src/components/store/`)

Button (solid `--as-ink` / outline / light-on-image), TextLink (underline sweep on
hover), Marquee, SiteHeader (mega-nav + search + bag), MobileDrawer, ProductCard
(image 3:4, hover zoom + quick-add slide-up, name serif, price sans, color dots),
ProductRail (scroll-snap + arrow controls), SizeSelector (uppercase micro labels,
selected = ink fill), ColorSwatch (12px dot + name), Accordion (line-separated),
Badge (NEW / HANDLOOM / LIMITED — micro caps on sand chip), EditorialTile,
CampaignBanner (full-bleed + parallax), ShopTheLook, FilterBar (chips, multi-select),
Footer, NewsletterLine, StickyAddBar.

Uniformity rule: the same action looks the same everywhere — one primary button
style, one card style, one input style. No one-off components.

## 6. Motion

- Easings: `--as-ease: cubic-bezier(.2,.7,.2,1)` (default), `--as-spring: cubic-bezier(.34,1.56,.64,1)` (interactive pops).
- Durations: 200ms (hover) · 400ms (panels) · 700ms (reveals).
- Patterns (max **one signature interaction per section**):
  - Reveal: fade + 24px rise, staggered 60ms (IntersectionObserver).
  - Hero: cursor-parallax on images (±10px), staggered word reveal on the headline.
  - Marquee: infinite CSS translate, pause on hover.
  - Cards: image scale 1.04 on hover, quick-add slides up from image bottom.
  - Header: transparent over hero → solid paper after 40px scroll.
- `prefers-reduced-motion: reduce` disables all of it (final state shown).
- Never: bounce on text, parallax on every section, loading curtains, scroll-jacking.

## 7. Imagery

- Warm-neutral grade (ivory/sand/clay/olive world), natural light, visible
  fabric texture, real models in calm poses. Film grain welcome.
- Product images 3:4 portrait on `--as-sand` backdrops; campaign images wide with
  negative space for type. Consistent grade across the catalog.
- Lazy-load below the fold; hero images `fetchpriority="high"`.

## 8. Copy

- Product names: `Material + Garment — Color` ("Linen Shirt — Slate"). Concrete,
  never clever. Prices always `PKR 12,400` (comma-grouped).
- Kickers: 2–3 words, uppercase ("THE HANDLOOM EDIT").
- Banned: "elevate", "luxury redefined", "unleash", exclamation marks, emoji.

## 9. Accessibility (hard requirements)

- Contrast ≥ 4.5:1 for text; visible `:focus-visible` ring (2px clay, 2px offset).
- Touch targets ≥ 44px. Semantic landmarks (`header/nav/main/footer`).
- All images have real alt text; accordions are buttons with `aria-expanded`.
- Keyboard: mega-nav, drawer, rail arrows and size selector fully operable.

## 10. Anti-slop rules (never do)

1. No gradient meshes, glassmorphism, neon, purple/blue defaults.
2. No emoji icons; icons are inline SVG, 1.5px stroke, `currentColor`.
3. No generic stock-photo vibes, no AI-looking plastic renders.
4. No default framework styling; no `!important` override layers on live styles —
   edit the owning file instead.
5. No ad-hoc values: every value comes from these tokens.
6. No more than two typefaces; no text-shadows except on image overlays.
7. No carousel autoplay; no infinite scroll; no dark patterns.
8. Nothing ships that research didn't support and this document doesn't define.
