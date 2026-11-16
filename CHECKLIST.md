# Reference-led storefront audit (working document)

## Evidence, limits, and what the screenshots actually show (2026-11-16)

This audit is based on the two screenshots supplied in chat, plus readable page content fetched from the reference homepage, Women's Collection PLP, Knitwear PLP, Gifts, and the Winter campaign story. **I have not visually inspected every reference page or directly replayed its hover, scroll, carousel, or mobile interactions.** Page-text extraction does not reveal animation timing or exact CSS dimensions; do not treat an interaction as matched until it has been visually compared in a browser.

The supplied desktop screenshots (1568 × 800) make the header/mega-menu mismatch unambiguous:

- **Reference menu:** a full-width white flyout aligned directly below the category navigation. Its left ~59% is four compact link columns (e.g. READY TO WEAR, SHOES, ACCESSORIES, COLLECTIONS); the right ~38% is three equally sized editorial image cards with small headings and “Discover more” captions. A separate, centered “DISCOVER THE LINE” link sits in a thin full-width footer strip. The reference header itself is a separate stack: thin utility row, centered emblem/wordmark, then centered category links.
- **AASRA before this pass:** a narrow ~880 px dropdown anchored around “Shop,” with one long link column and one image tile. It exposed the homepage image around the panel and had no three-card promo rail or full-width bottom link. This was not a close structural match; the previous “mega menu” completion claim overstated the result.
- **Change now in the working branch:** the Shop dropdown has four AASRA-specific link groups, three original AASRA image cards, and a centered footer link; on desktop the homepage header overlays the hero image and switches to a light sticky treatment after scrolling. These are local-build verified, **not yet visually compared against a browser screenshot or deployed to production**. Other category flyouts still need review and the full reference hierarchy is not copied; taxonomy must remain appropriate to AASRA.

The reference pages extracted also confirm specific content patterns: PLPs start with a category strip/title/Filters and product cards with multiple product views, variant labels and editorial banners interleaved in the grid; Gifts begins with a full-bleed campaign image, title and audience links before editorial gift tiles and product carousels; the story page is a long-form campaign narrative. Extraction does not tell us exact scroll transitions, sticky thresholds, hover states, or animation curves.

**Status legend:** ✅ implemented in source (not a claim of pixel parity) · 🟡 partial / needs visual comparison · ❌ missing · 🔒 blocked on user decision or production data. “Live” means verified on production, which is a separate status and must be explicitly stated.


## 1. Visual foundation — THE BIGGEST GAP

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | **Photography quality/consistency** | ❌ | BC = world-class editorial photography (models, interiors, one warm grade). Ours = AI still-lifes, no people, inconsistent depth. Drives ~60-70% of perceived difference. Options: regenerate a single-palette consistent set; add lifestyle shots with people; or real product photography later. 🔒 |
| 1.2 | Type feel — headings | 🟡 | BC uses a lighter, airier proprietary serif. Cormorant Garamond is close but more decorative. Could self-host a closer cut. |
| 1.3 | Palette coldness | 🟡 | BC = pure white canvas + grey hairlines. Ours has warm beige surface tones. Small CSS shift available. |
| 1.4 | Letterspaced caps labels | ✅ | Kickers, small-caps everywhere. |
| 1.5 | Hairline borders, squared buttons | ✅ | |

## 2. Header / navigation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | Utility bar + scroll collapse | ✅ | |
| 2.2 | Centered logotype row | ✅ | |
| 2.3 | Desktop mega menu | 🟡 | Shop flyout now has 4 link columns + 3 original-image tiles + bottom link; local build only, not yet screenshot-compared. Other flyouts and open/close/focus behavior need review. |
| 2.4 | Full-screen search overlay w/ suggestions | ❌ | Ours is a slim collapsible row. BC opens an overlay with popular searches. |
| 2.5 | Search icon / wishlist / cart icons | ✅ | SVG line icons. |
| 2.6 | Mobile hamburger full-screen menu | 🟡 | Implemented with staggered links; needs viewport-by-viewport visual and keyboard/focus comparison. |
| 2.7 | Country modal | 🟡 | Per-session display is implemented; dimensions, initial timing, imagery, switching and dismissal behavior are not verified against reference. |
| 2.8 | Skip-to-content | ✅ | |

## 3. Homepage

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.1 | Full-bleed hero + 2 text links | ✅ | |
| 3.2 | **Hero carousel (multi-slide crossfade)** | ❌ | BC rotates seasonal slides with slow fade + text swap. Ours: single static slide. |
| 3.3 | Hero entrance sequence (staggered rise + zoom) | ✅ | |
| 3.4 | Seasonal suggestions 4-up | ✅ | |
| 3.5 | Gift 2-up banners | ✅ | |
| 3.6 | Full-width collection banner | ✅ | |
| 3.7 | Explore-the-collection band | ✅ | |
| 3.8 | Story widget | ✅ | |
| 3.9 | Newsletter underline form | ✅ | |
| 3.10 | Scroll reveals / image-settle motion | 🟡 | Reveal/stagger and image-settle code exists; no motion timing or section-by-section parity review has been done. |
| 3.11 | Smooth section scrolling | 🟡 | anchor scroll smooth; consider inertial smooth-scroll lib (risky for perf — decide). 🔒 |

## 4. Shop / PLP

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | Category nav strip, title, toolbar, sort | ✅ | |
| 4.2 | Product grid 4-col, hover image swap | ✅ | |
| 4.3 | **Quick-add size flyout on card hover** | ❌ | BC shows size buttons + ADD TO CART directly on card hover. Big interaction gap. |
| 4.4 | "N COLORS" / variant line | ✅ | as "N variants" |
| 4.5 | WINTER EDIT tags | ✅ | |
| 4.6 | Filters drawer w/ facets | 🟡 | Ours: sidebar category list. BC: rich filter drawer (size/color/price). |
| 4.7 | Interleaved editorial banner in grid | ❌ | BC injects campaign banners mid-PLP. |
| 4.8 | "WINTER EDIT" hero banner inside PLP | ❌ | (4.7 covers) |

## 5. Product page

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1 | Stacked editorial gallery | ✅ | |
| 5.2 | **Image zoom on hover/pan** | ❌ | BC magnifies on hover. |
| 5.3 | Hairline dividers, size block | ✅ | |
| 5.4 | Per-size availability ("Only one left", "Request product") | 🔒 | Data lives in D1 stock table — wire when D1 lands. |
| 5.5 | Color swatches | 🟡 | Variants are sizes, not colors — swatches when catalog expands. |
| 5.6 | Size Guide / May we help you links | ✅ | |
| 5.7 | Service links row | 🟡 | Service links and Find in Boutique exist in source; visual placement and destinations need comparison. |
| 5.8 | Accordions: Details/Packaging/Shipping | ✅ | |
| 5.9 | "You may also be interested in" carousel | 🟡 | Grid now; BC uses arrow carousel. |
| 5.10 | **Meet our Style Advisors / appointment banner** | 🟡 | Appointment banner exists in source; reference layout and transition not visually checked. |
| 5.11 | **SHARE row (Email/WhatsApp/social/copy)** | 🟡 | Share row exists in source; only implemented channels are listed, and styling/behavior still need comparison. |
| 5.12 | Sticky mobile add-to-cart bar | ❌ | Worth adding. |
| 5.13 | ADD TO CART label | ✅ | |

## 6. Cart & checkout

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6.1 | "Your selection ( N )" + Subtotal + GO TO CART | ✅ | |
| 6.2 | **Real product images in cart lines** | 🟡 | Cart now carries product image URLs in source; verify real items and empty state in browser. |
| 6.3 | Qty steppers, remove | ✅ | restyle available |
| 6.4 | Gift-option checkbox in mini-cart | ❌ | Gift wrap note exists at checkout; add checkbox later. |
| 6.5 | Hosted checkout (Safepay) | 🔒 | Code done; needs D1 + secrets. |

## 7. Pages catalog

✅ Home, Shop/PLP, PDP, Gifts, New Arrivals, Journal (3), About, Responsibility,
Services, Boutiques, Appointment, Cart, Checkout, Order success, Pay balance,
Payment cancelled, Order lookup, Wishlist, Contact, FAQ, Shipping, Size guide,
Deposit/Return/Shipping/Privacy/Terms/Cookie policies, Accessibility, 404

## 8. Motion & polish backlog (priority order)

1. **1.1 Photography set** — decide + regenerate (biggest visual delta)
2. **3.2 Hero carousel** with slow crossfade
3. **2.3 Mega menu multi-column** + 2.4 full-screen search
4. **4.3 PLP quick-add flyout**
5. **5.2 PDP zoom** + 5.12 sticky mobile bar
6. **4.7 PLP interleaved banners** + 5.9 arrow carousel
7. 6.4 gift checkbox, 1.2/1.3 type/palette coldness tune
8. 3.11 inertial smooth-scroll (test carefully)
