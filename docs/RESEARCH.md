# Research — fashion e-commerce UX & design (2026)

Collected 2026-11-18 before building the storefront (per `skills/research-first.md`).
Sources: Ecom Design Pro / Convertica / ConvertCart / Tenten (navigation guides),
Envato / Figma / Grokipedia / Inspire Fusion / SocialScript (2026 trend reports),
SamayWeb / HubSpot / MuffinGroup (fashion site teardowns: Gucci, SSENSE, Zara,
Jacquemus, Net-a-Porter, COS, GANNI, The Frankie Shop, Chanel).

## Navigation & taxonomy (applied)
- Fashion = **audience first** (Women / Men), then product type, then highlights
  (New In). Mega menu: 4–6 groups, concrete plural labels ("Shirts & Kurtas"),
  every heading clickable, images sparingly, one feature tile. [used: SiteHeader]
- ≤ 3–4 levels home → product; category pages act as mini-homepages (sub-category
  chips at top, then filters, then products). [used: PLP subcat chips]
- Desktop filters above the grid; multi-select, no reload; live result counts;
  sort kept separate from filters. [used: PLP filter bar]
- Uniform add-to-cart buttons everywhere; search with instant results (3+ chars),
  thumbnails and prices in suggestions. [used: header search overlay]
- Mobile: drawer with accordions, ≥44px targets, sticky bag. [used: drawer + sticky bar]

## Fashion-site patterns (applied)
- Zara: large editorial images that link straight into categories — "let the
  clothes do the talking". [used: home edit grid]
- Net-a-Porter: shoppable "Shop the Look" modules. [used: home shop-the-look]
- Jacquemus / Gucci: oversized display type on full-bleed campaign imagery,
  editorial magazine feel. [used: runway hero + campaign banner]
- The Frankie Shop / COS: muted warm palettes, large visuals, quiet CTAs.
  [used: tokens — warm neutrals + clay/olive accents per brand decision]

## 2026 motion/tech trends (applied, with restraint)
- Cursor-reactive hero imagery (subtle tilt/parallax) — used in runway hero.
- Kinetic type (staggered word reveals) — used in hero headline + marquee.
- Scroll-driven reveals + parallax on one campaign banner only ("motion that
  earns its place"; avoid parallax on every section).
- Native CSS scroll animations preferred over heavy JS libraries; motion must
  degrade gracefully and respect reduced-motion. [used: CSS-first, tiny vanilla JS]
- Skip: 3D Spline heroes on every page (kills LCP), neumorphism, scroll-jacking,
  autoplay carousels. A true 3D garment viewer remains a later enhancement.

## Why previous attempts failed (root-cause, per skills/research-first.md)
1. Worked blind: styled a rendered site without seeing it → override layers that
   fought animations/grids ("it looks so bad"). Fix: design system first, edit
   owning files, mechanical verification (build/tests/curl) at every step.
2. No design source of truth → drift and generic "AI slop" look. Fix: tokens +
   hard anti-slop rules in docs/DESIGN_SYSTEM.md.
3. Feature-first patching on a home-goods template instead of researching fashion
   UX. Fix: this document + taxonomy rebuild (Women/Men + sub-categories).
