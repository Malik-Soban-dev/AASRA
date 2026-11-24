# AASRA Store — Architecture

> **Start here:** `docs/PLAYBOOK.md` is the full guide (setup, recipes, navigation, payments, deploy, pitfalls). This file is the short reference for the data model and routes.

Fashion e-commerce (women + men, sub-categories) on the existing AASRA stack:
Astro static pages → Cloudflare Workers (static + API) → D1, Safepay/PayFast.
No admin dashboard exists: **the catalog is edited as plain JSON files** (below).

## Directory map

```
data/catalog/                 ← HUMANS EDIT THESE (one file per category)
  site.json                     nav, hero copy, marquee, footer
  women/{dresses,knitwear,outerwear}.json
  men/{shirts,knitwear}.json
data/products.json            ← GENERATED (do not hand-edit)
public/data/products.json     ← GENERATED mirror (client-side cart pages)
scripts/build-catalog.js      ← merges catalog/ → products.json

src/components/store/         ← design-system components (see DESIGN_SYSTEM.md)
src/components/layout/StoreLayout.astro   ← new storefront layout (fonts CDN, cart lib)
src/styles/tokens.css         ← the tokens (only place raw values appear)
src/styles/store.css          ← the system styles (uses tokens only)

src/pages/index.astro         ← home (runway hero, the edit, new-in rail, campaign)
src/pages/[gender]/index.astro        ← women/ men landing
src/pages/[gender]/[category]/index.astro ← category + "new-in" PLP
src/pages/[gender]/[category]/[sub].astro ← sub-category PLP
src/components/store/CategoryPage.astro   ← the PLP body both pages render
src/pages/product/[slug].astro        ← PDP

src/lib/catalog.js            ← reads data/products.json (single source at runtime)
functions/                    ← API: checkout, order-lookup, invoice, stock, newsletter
tests/run.js                  ← node tests (API + catalog integrity)
```

## Data model

Product (in category files — keep them small and readable):

```json
{
  "id": "W001", "slug": "chanderi-silk-kurta-ivory",
  "name": "Chanderi Silk Kurta — Ivory", "price_pkr": 18900,
  "badge": "NEW",
  "colors": [{ "name": "Ivory", "hex": "#efe9dc" }],
  "sizes": ["XS","S","M","L","XL"],
  "images": ["/images/garments/w-kurta-ivory.jpg"],
  "description": "…", "details": ["…"], "fabric": "…", "care": "…"
}
```

Category files may also declare sub-categories (`"subcategories": [{ "key": "boots", "label": "Boots" }]`).
Each product in such a category must set `"subcategory": "<key>"`; the build fails otherwise.
`deposit_eligible` is a legacy field: deposits were removed (see PLAYBOOK §11).

`npm run catalog:build` expands `sizes × colors` into `variants[{sku,size,color,stock_key}]`
(`AS-W001-IVO-XS`) and writes the generated aggregate. It runs automatically
(`prebuild`) before every `npm run dev` / `npm run build`.

Deposit rule: `deposit_eligible` is true for products priced ≥ PKR 15,000
(overridable per product in the category file). Checkout deposit plans apply
only when every item in the cart is deposit-eligible.

### Adding / editing a product (no dashboard)

1. Open the right file in `data/catalog/<gender>/<category>.json`.
2. Add/edit the object (copy an existing one — fields are self-explanatory).
3. Drop the photos in `public/images/garments/` (3:4 portrait jpg).
4. Save. Next build picks it up. (`node scripts/build-catalog.js` to refresh the
   aggregate without a full build.)

Prices are integer PKR. SKU pattern `AS-{ID}-{COLOR3}-{SIZE}` — checkout, stock
and order APIs key off `sku`/`stock_key`, unchanged from the previous system.

## Page routes

| Route | Page | Data |
|---|---|---|
| `/` | Home | site.json + all products (new-in) |
| `/women`, `/men` | Gender landing | catalog + category tiles |
| `/women/new-in`, `/men/new-in` | New-in PLP | products with `badge: "NEW"` |
| `/women/dresses`, `/men/shirts`, … | PLP | category file |
| `/women/footwear/boots`, `/men/knitwear/cable-knit`, … | Sub-category PLP | category file `subcategories` |
| `/shop?category=…&type=…&q=…&sort=…` | Shop | all products; filters applied in the browser (static site) |
| `/product/<slug>` | PDP | product lookup |

Legacy pages (`/shop`, `/gifts`, old `/product/*` slugs from the home-goods
catalog) remain until migration v2; nothing in the new UI links to them.

## CDN policy

- Google Fonts CDN (`Fraunces`, `Inter`) in `StoreLayout` — with system fallbacks,
  the site is fully usable if the CDN is unreachable.
- Any future motion/3D enhancement libs load from jsdelivr with `defer` and must
  **degrade gracefully** (content first, effects optional).
- Never bundle large third-party frameworks. Plain Astro components + small
  vanilla JS modules only.

## Cart & checkout (unchanged)

`window.__aasra_addToCart(sku, name, price, qty, image)` → localStorage
`aasra_cart_v1` → `/cart` → `/checkout` → Workers API (deposit/balance orders,
Turnstile, Safepay/PayFast) → D1. The new ProductCard/PDP call exactly this API.

## Testing

`npm test` — API invariants (phone/email/cart validation, checkout math, emails)
+ catalog integrity (every product has images, variants, unique slugs/SKUs).
Run `npm run catalog:build` before `npm test` (pretest hook).
