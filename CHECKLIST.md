# BC-Replica Audit — Detailed Checklist

Status legend: ✅ done · 🟡 partial (needs upgrade) · ❌ missing · 🔒 needs decision/D1

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
| 2.3 | Mega menus | 🟡 | BC: multi-column (3-4 link columns) + multiple image tiles. Ours: 1 column + 1 tile. Upgrade available. |
| 2.4 | Full-screen search overlay w/ suggestions | ❌ | Ours is a slim collapsible row. BC opens an overlay with popular searches. |
| 2.5 | Search icon / wishlist / cart icons | ✅ | SVG line icons. |
| 2.6 | Mobile hamburger full-screen menu | ✅ | Staggered serif links. |
| 2.7 | Country modal first visit | ✅ | Change to per-session (BC prompts per visit). |
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
| 3.10 | Scroll reveals w/ stagger | ✅ | Upgrade image treatment: scale-from-1.1 settle (BC-style) — adding now. |
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
| 5.7 | Service links row | ✅ | + Find in boutique (adding now) |
| 5.8 | Accordions: Details/Packaging/Shipping | ✅ | |
| 5.9 | "You may also be interested in" carousel | 🟡 | Grid now; BC uses arrow carousel. |
| 5.10 | **Meet our Style Advisors banner** | ❌ | Adding now (→ /appointment). |
| 5.11 | **SHARE row (WhatsApp/Email/Copy)** | ❌ | Adding now (CSP-safe subset). |
| 5.12 | Sticky mobile add-to-cart bar | ❌ | Worth adding. |
| 5.13 | ADD TO CART label | ✅ | |

## 6. Cart & checkout

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6.1 | "Your selection ( N )" + Subtotal + GO TO CART | ✅ | |
| 6.2 | **Real product images in cart lines** | ❌ BUG | Always placeholder — fixing now. |
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
