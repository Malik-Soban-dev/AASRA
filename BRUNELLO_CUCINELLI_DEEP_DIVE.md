# Brunello Cucinelli Shop — Full-Site Deep Dive

**Subject:** https://shop.brunellocucinelli.com/en-it/ (Italian locale, prices in EUR incl. VAT)
**Studied:** 2026-11-17 · Companion to `BRUNELLO_CUCINELLI_STUDY.md` (core study, US locale)
**Method:** Systematic crawl via page extraction — every department, category, sample PDPs, editorial & service pages. Prices as displayed on the IT store. ~35 pages read.

---

## 1. Platform & global scale ✅

* **Engine:** Salesforce Commerce Cloud + Mobify PWA bundle (per core study). EU site id `Sites-bc-eu-Site`, APAC `Sites-bc-apac-Site`, US `Sites-bc-us-Site`.
* **Localization footprint (from `sitemap_index.xml`):** one sitemap set per locale — `en-jp` alone has `sitemap_0..16.xml`. Product URLs replicated across **40+ locale storefronts**: `en-it`, `it-it`, `en-us`, `en-gb`, `en-jp`, `es-es`, `fr-fr`, `fr-lu`, `fr-mc`, `fr-be`, `de-de`, `de-at`, `en-be/bg/dk/ee/fi/gr/ie/lv/lt/lu/nl/pl/pt/mc/cz/ro/sk/si/es/se/ua/hu/hr/cy/mt`. Localized slugs too (`/it-it/bambini/bambina/`, `/de-de/kinder/madchen/`, `/fr-fr/enfants/fille/`).
* **Category SEO copy:** every PLP ends with an editorial paragraph (e.g. Women's Knitwear: *"…pullovers and sweaters, cardigans and tops with clean lines and noble fibers. The enveloping textures and sophisticated workmanship enhance femininity with natural elegance…"*) + newsletter CTA + geo-IP country switcher.
* **PLP pagination:** batch loading — "1-19 of 189 products" + `VIEW 21 MORE` (`?start=21&sz=42`).
* **Image pipeline:** Cloudinary-style (`f_auto,q_auto,w_900,dpr_auto`), per-SKU views `_D/_F/_R/_K/_E/_G` (+ `_A` on fragrances), PDPs at `w_1400`, lazy placeholder `/mobify/bundle/837/static/img/product_placeholder.jpg`.

## 2. Complete taxonomy (as crawled) ✅

### Women (`/en-it/women/…` + `/en-it/new-arrivals/women/`)
| Department | URL | Sub-categories |
|---|---|---|
| New Arrivals | `/en-it/new-arrivals/women/` | — |
| Ready to Wear | `/en-it/women/ready-to-wear/` | knitwear (189 products), shirts, blazers, coats-jackets, dresses-jumpsuits, denim, pants/shorts, matching-sets (shop-by-look) |
| Shoes | `/en-it/women/shoes/` | sandals, boots, heels, loafers-flat-shoes |
| Bags | `/en-it/women/bags/` | shoulder-bags, crossbody-bags, handbags, small-mini-bags, clutch-pouch-bags |
| Accessories | `/en-it/women/accessories/` | hats, other-accessories (gloves, organza necktie…) |
| Eyewear *(shared dept)* | `/en-it/eyewear/` | aviator-frames, rectangle-frames |
| Women's Gifts | `/en-it/women/women-gifts/` | — |

### Men (`/en-it/men/…` + `/en-it/new-arrivals/men/`)
| Department | URL | Sub-categories |
|---|---|---|
| New Arrivals | `/en-it/new-arrivals/men/` | quick links: coats-jackets, knitwear, sneakers, blazers |
| Ready to Wear | `/en-it/men/ready-to-wear/` | knitwear, shirts, blazers, coats-jackets, pants, t-shirts-polos, suits (shop-by-look) |
| Shoes | `/en-it/men/shoes/` | sneakers, loafers, lace-ups, boots (per hub copy) |
| Accessories | `/en-it/men/accessories/` | **bags**, hats, scarves, small-leather-goods, other-accessories (neckties), belts, eyewear |
| Men's Gifts | `/en-it/men/men-gifts/` | — |

*Note the structural asymmetry:* women's bags are a top-level department (`/women/bags/`), men's bags live **inside** accessories (`/men/accessories/bags/`).

### Kids (`/en-it/kids/`) — Baby · Boys · Girls (+ shop-by-look outfit tiles)
* **Baby** `/kids/baby/` (outfit SKUs `2628OUTFIT…`) · **Boys** `/kids/boys/`: travelwear, shop-by-look (`262HOUTFIT…`) · **Girls** `/kids/girls/`: **dresses-jumpsuits, coats-jackets, knitwear, bags, accessories, footwear**, shop-by-look (`262FOUTFIT…`)
* Kids Gifts `/kids/kids-gifts/`

### Lifestyle (`/en-it/lifestyle/`) — home & free-time
* `home-living/throws-blankets` · `home-living/bathrobes-towels` · `decor/decorative-accessories`
* Lifestyle Gifts `/lifestyle/lifestyle-gifts/` (**empty** at study time)

### Cross-department hubs
Gifts hub `/en-it/gifts.html` · Gift PLPs (women/men/kids/lifestyle) · Fragrances `/en-it/fragrances.html` + `/en-it/fragrances/` · AI Boutique `/en-it/ai` · Campaign `/en-it/a-winter-fairytale.html`

## 3. Women's world ✅

### 3.1 Ready-to-Wear landing (`/women/ready-to-wear/`)
Editorial grid mixing products with "Discover the look" outfit tiles (`/ready-to-wear/matching-sets-262WOUTFIT…`):
* Cotton marina net sweater (Red) **€ 2.400** · Linen dazzling abstract leaf cardigan (Blue) **€ 2.000**, 2 colors
* Dazzling chevron embroidery dress (Rope) **€ 10.000** · Dazzling Craquelé Embroidery Mini dress (Silver) **€ 5.900**
* Nylon outerwear (White) **€ 2.800** · Loose Curved trousers (Denim) **€ 1.550** · Wool formal shorts

### 3.2 Knitwear (`/women/ready-to-wear/knitwear/`) — **189 products**
Signature "Dazzling" line (mohair net knits, Zigzag Cables, Prince of Wales intarsia):
* Cashmere rib cardigan (Origano) **€ 3.700** · Cashmere turtleneck sweater **€ 1.750**, 5 colors · Cashmere English rib sweater (Beige) **€ 2.900**
* Dazzling Zigzag Cables cardigan **€ 3.000** · Dazzling net cardigan in mohair **€ 2.900** · Dazzling net knit bomber jacket **€ 3.200** · Dazzling Prince of Wales sweater **€ 2.500**
* Silk poplin shirt **€ 1.850** (shirts dept) · Cashmere feather yarn heritage cable cardigan (Ruby) **€ 4.900** · **Vicuña cardigan € 6.500 (VICUÑA badge)**

### 3.3 Shoes (`/women/shoes/`)
Leather/Suede sandals **€ 950** · Chalk stripe denim espadrilles **€ 850** · Nappa leather city heels **€ 950** · Lamé leather slingback heels **€ 1.050** · Suede slingback heels with monili **€ 970**
Boots (WINTER EDIT): Suede and knit **€ 1.800** · Leather boots **€ 2.100** · Suede with monili **€ 1.900**

### 3.4 Bags (`/women/bags/`) — signature **BC Duo** family (TIMELESS badge)
* BC Duo bag in suede with monili **€ 3.100** · Calfskin BC Duo bag **€ 3.100** · Calfskin BC Duo mini bag (Ivory)
* Pouch bag in lizard-effect calfskin **€ 1.600** · Pouch bag in calfskin with monili **€ 1.400** · Suede Essence clutch **€ 2.500** · Sparkling textured leather pouch **€ 1.850**
* Leather sartorial small bucket bag **€ 2.900** · Essence small top-handle bag in suede **€ 2.800**, 6 colors

### 3.5 Accessories & Eyewear
* Hats: denim baseball cap **€ 600** · Leather/shearling reversible hat **€ 1.200** (GIFTING EXCLUSIVE) · Lux shearling hat **€ 1.400** · Dazzling mohair balaclava **€ 450** (GIFTING EXCLUSIVE) · Cashmere rib knit beanie **€ 450**, 4 colors
* Gloves/other: Dazzling texture knit gloves **€ 450** · Organza necktie with monili **€ 250**
* Eyewear: Acetate aviator sunglasses **€ 520** · Gold-plated shield sunglasses **€ 1.200**

## 4. Men's world ✅

### 4.1 New Arrivals — WINTER EDIT drop
Suede biker jacket (Light Brown) **€ 7.900** · Chalk stripe flannel Tailor blazer **€ 5.150** · Chalk stripe chevron outerwear jacket **€ 4.700** · Chalk stripe flannel trousers **€ 1.600** · Nubuck Country Weekender bag **€ 4.750** · Cashmere sweater with argyle intarsia **€ 3.950**

### 4.2 Ready-to-Wear
* Knitwear: Cashmere English rib sweater **€ 1.800** (TIMELESS, 4 colors) · Cashmere and silk lightweight sweater **€ 1.100** (TIMELESS, 4 colors) · English Rib knit sweater **€ 1.200** · Cotton knit vest with logo **€ 1.000** (**GOLF** badge) · argyle intarsia **€ 3.950**
* Shirts: Linen shirt with spread collar **€ 580** (TIMELESS) · Lightweight denim shirt **€ 750** · Cotton gabardine overshirt **€ 1.250** · Overshirt with spread collar **€ 1.450**, 5 colors · Knit shirt **€ 2.400**
* Outerwear top end: Shearling bomber **€ 8.600–9.300** · Nubuck blazer with peak lapels **€ 8.500** · Nappa leather biker **€ 8.900** · Nubuck shirt-style bomber **€ 7.200** · Suede bomber with quilting **€ 7.700** · **Nappa leather overcoat with padding € 11.800** (highest RTW seen)

### 4.3 Sneakers (`/men/shoes/sneakers/`) — "hero SKU" pattern
* Suede sneakers **€ 950** — single SKU in **9 COLORS** (each colorway a card; one is the PLP hero banner product)
* Nubuck and suede runners **€ 990**, 5 colors (WINTER EDIT) · Knit runners with heat-bonded details **€ 1.100**, 4 colors (WINTER EDIT)

### 4.4 Bags (`/men/accessories/bags/`) — Nubuck "Country" + suede + flannel lines, **€ 4.100–4.950**
Nubuck country bag **€ 4.850** / travel backpack **€ 4.100** (both GIFTING EXCLUSIVE) · Nubuck Country Weekender **€ 4.750** · Suede leisure backpack **€ 4.450** · Suede boston **€ 4.150** · Flannel leisure **€ 4.650** / field backpack **€ 4.950** / street bag **€ 4.850**

### 4.5 Small accessories
Cashmere rib knit beanie **€ 420** (6 colors) · Cashmere rib knit scarf **€ 590** (7 colors) · Flannel necktie **€ 210** · Nubuck watch box **€ 1.600** · Nubuck card holder **€ 500** (TIMELESS)

### 4.6 Hub pages with zero products (UX finding)
`/men/shoes/` and `/men/accessories/` render "1-0 of 0 products" + SEO prose only — discovery happens in subcategories.

## 5. Kids ✅

* **"Starting from € X" price pattern** on size-graded items (price varies by size/age) — Double cloth trousers **from € 420** · Lamé calfskin sneakers **from € 760** · Cable knit cardigan **from € 1.000** · Dazzling chevron embroidery dress **from € 1.700** · bomber jacket **from € 1.300** · Nappa/wool boots **from € 800**
* Accessories: Wool felt beret with monili **€ 170** · Knit beret **€ 180** · Cashmere beanie with monili **€ 240** · Knit gloves **€ 250** (5 colors) · Grained calfskin belt **€ 380** · Cashmere scarf with monili **€ 330** · Lamé calfskin phone case **€ 500**
* Shop-by-look outfit tiles everywhere (Baby/Boys/Girls `…OUTFIT…` SKUs)

## 6. Gifts ✅

### 6.1 Gifts hub `/en-it/gifts.html` — the site's most advanced PLP (14 chunks)
* "Gift Selection — Holiday Season" → FOR HER / FOR HIM; copy: *"Like a special message, gift giving is a symbol of the feelings and bonds we have for those we hold dear…"*
* **Inline quick-shop carousels** (arrow-paginated): every card embeds the full purchase module — size matrix inline (knitwear **XXS–3XL**; shoes **EU 35–41 incl. half sizes**), color swatch lists, live stock states (**"Only one left" / "No longer available" / [Request Product]** → `Product-Show?pid=<SKU>&size=<n>&color=<c>`), **ADD TO CART** + "Select the size to proceed" — no PDP visit needed
* Cart chrome: "Your selection ( 0 ) / Subtotal € 0,00 / GO TO THE CART / or proceed with quick payment / **The gift option is not available with Express Checkout** / One or more products are not currently available. Update your cart to proceed."

### 6.2 Women Gifts `/women/women-gifts/`
Balaclava **€ 450** & shearling reversible hat **€ 1.200** (GIFTING EXCLUSIVE) · Stardust embroidery blazer **€ 11.000** (WINTER EDIT) · Dazzling net cardigan **€ 2.900** · Lamé slingback heels **€ 1.050** · Sparkling pouch **€ 1.850**

### 6.3 Men Gifts `/men/men-gifts/`
Nubuck country bag **€ 4.850** / travel backpack **€ 4.100** (GIFTING EXCLUSIVE) · beanie **€ 420** / scarf **€ 590** (GIFTING EXCLUSIVE) · Nubuck watch box **€ 1.600** / card holder **€ 500** (TIMELESS)

### 6.4 Kids Gifts `/kids/kids-gifts/`
"Gifts for Girls" curation across all girls sub-departments (dress from € 1.700, phone case € 500, beret € 170…) — same gift-nav: Women/Men/Kids/Lifestyle Gifts + Fragrances.

### 6.5 Lifestyle (`/en-it/lifestyle/`) + Lifestyle Gifts (⚠ empty)
* `home-living`: Silk double cloth throw **€ 1.350** (6 colors) · Cashmere throw with contrasting border **€ 4.500** · 2-piece terrycloth towel set **€ 360** (7 colors)
* `decor`: Playing cards with box **€ 600** · Tangram set **€ 3.900** · Wood/Krion®/brass backgammon set **€ 8.300** (luxury games as gifts)
* ⚠ `/lifestyle/lifestyle-gifts/` is **empty** ("1-0 of 0 products") during the holiday season.

## 7. Fragrances ✅ — "Incanti Poetici" collection
All eaux **€ 295 / 100 ml** (3.4 US fl.oz.) — vs **$345** on the US store. Color "Transparent", images `_A/_F`. Scents at `/fragrances/incanti-poetici/<name>-perfume-3.4-us-fl.oz.-100-ml-<SKU>.html`:
**Segreto · Silenzio · Ricordo · Vie Eteree · Brezza Gentile · Sogno Notturno · Soffio Zenit** …
Hero `/en-it/fragrances.html` + directory PLP `/en-it/fragrances/` both exist.

## 8. Editorial & AI boutique ✅

### 8.1 "A Winter Fairytale" — Holiday Season 2026 (`/en-it/a-winter-fairytale.html`)
* Title **"Where Magic Feels Real"**. Story: *"Set aboard a vintage train on an enchanted winter night, the Holiday Season 2026 story invites us on a journey suspended between dream and reality. Unexpected encounters, captivating melodies and unforeseen stops… reality and imagination intertwine… magic fades into the glow of a star-filled sky, inviting us to preserve a sense of wonder…"*
* Hosts the **newsletter + preference center**: First/Last name, lines of interest (**Men · Women · Kids · Eyewear · Fragrances · Lifestyle** — the canonical 6 lines), GDPR profiling consent (I agree / I do not agree), reCAPTCHA, "Save Preferences", duplicate-registration error states, "Create an account… Not now" post-subscribe nudge.
* Geo-IP popup is per-session dynamic (suggested "switch to **United States**" on some fetches, "**Canada**" on others); 190-country delivery selector; legal URLs `/en-it/privacypolicy`, `/en-it/legalarea`.
* **Bug:** an image `src=…/en-it/null` recurs in the page flow (also on `/bookAppointment`).

### 8.2 AI Boutique (`/en-it/ai`) — "Callimacus" interface
* Hero: **"Where ideas become endless possibilities"** — "Welcome to the AI Online Boutique"
* Loading microcopy with letter-level italics: *"Crafting y_o_ur experience · Gathering i_n_spiration · Curating s_u_ggestions"*
* **Named, deletable AI sessions**: "Delete session? By proceeding, you will delete **Visual inspiration**" — curated explorations persist as sessions
* Layered-Cloudinary art (`e_blur:2000`, `l_Callimacus_background_development_version…`) + video loader. No static catalog in DOM — modules generated at runtime.

## 9. PDP anatomy ✅ (3 samples)

### 9.1 Women — Cashmere rib cardigan € 3.700 (Origano)
* SEO title *"Cashmere rib cardigan for Woman in Origano | Brunello Cucinelli"*; 6 gallery views (`_F _R _D _K _E _G`) at `w_1400`
* Sizes **XXS–3XL** with inline states (XXS/XS **"Only one left"**, L **"Request product"**); Size Guide · "MAY WE HELP YOU?" · ADD TO CART
* Accordions: **Details / Packaging / Shipping and returns / FIND IN BOUTIQUE** (content in JS — not extractable)
* Dual recs: **"You may also be interested in"** + **"Complete the look"**, cross-category (knitwear + handbag + necktie)
* Style Advisors block + share row (below)

### 9.2 Men — Suede biker jacket € 7.900 (Light Brown, WINTER EDIT)
* Sizes **XXS–5XL** (men extend to 5XL); states: XXS "Request product", XS/S/3XL/4XL/5XL "Only one left"
* Recs cluster at € 7.200–11.800 outerwear + € 210 necktie — strong "complete the look" upsell

### 9.3 Fragrance — Segreto 100 ml € 295
* Simplified buy box ("Size: One Size", "Color: Transparent")
* **Style Advisors clienteling block**: "Meet our Style Advisors… Book an appointment in one of our Boutiques or via a video conference" → `/bookAppointment`
* Share row: Email (`mailto` subject "I would like to share my **wishlist** with you" — copy reuse), WhatsApp `wa.me`, Pinterest, Facebook, Twitter, Copy link

## 10. Service layer ✅

* **Appointments** (`/bookAppointment`, locale-less): 3-step wizard — 1) Appointment Details (Country: 23 countries AU→US; Collection: WOMEN / MEN / WOMEN AND MEN; Date → "Select the Boutique and the time of interest") 2) Contact Details (e-mail) 3) PROCEED. Embedded config string `JPJPYexclusive-serviceboutique-appointmentstep1en200false0`.
* **Geo-routing quirk:** locale-less root URLs resolve to *your inferred region* — this session's `/bookAppointment` rendered the **Japan/JPY** context (¥ 0 subtotal, `/en-jp/registration`, `Sites-bc-apac-Site` loader).
* **Account:** Log in / Create an account / "Enjoy a personalized experience and discover all the exclusive services" → `/en-it/registration`
* **Cart/checkout:** mini-cart with subtotal, "quick payment" (Express Checkout), gift-option caveat with Express Checkout, unavailable-items guard
* **Clienteling:** Find in Boutique (PDP tab), Style Advisors on every PDP, boutique/video appointments
* **Newsletter:** preference-center modal (6 lines + GDPR profiling consent + reCAPTCHA) + generic footer signup + post-subscribe account nudge
* **Accessibility:** "Enable Accessibility", "Go to main content" skip links

## 11. Pricing map (EUR, IT store) ✅

| Category | Observed range | Anchors |
|---|---|---|
| Women knitwear | € 950 – 6.500 | silk tee € 950 · cashmere € 1.750–3.700 · vicuña € 6.500 |
| Women dresses/blazers | € 5.900 – 11.000 | Craquelé mini € 5.900 · chevron dress € 10.000 · Stardust blazer € 11.000 |
| Women outerwear/trousers | € 1.550 – 2.800 | nylon outerwear € 2.800 |
| Women shoes | € 850 – 2.100 | sandals/heels ≈ € 950–1.050 · boots € 1.800–2.100 |
| Women bags | € 1.400 – 3.100 | pouches € 1.400–1.850 · BC Duo € 3.100 |
| Accessories (hats/gloves) | € 250 – 1.400 | balaclava/gloves € 450 · shearling hat € 1.400 |
| Eyewear | € 520 – 1.200 | acetate € 520 · gold-plated € 1.200 |
| Men knitwear | € 1.000 – 3.950 | vest € 1.000 · lightweight c/s € 1.100 · argyle € 3.950 |
| Men shirts | € 580 – 2.400 | linen € 580 · overshirts € 1.250–1.450 · knit shirt € 2.400 |
| Men outerwear | € 4.700 – 11.800 | chevron € 4.700 · suede biker € 7.900 · shearling € 8.600–9.300 · nappa overcoat € 11.800 |
| Men sneakers | € 950 – 1.100 | suede € 950 · runners € 990–1.100 |
| Men bags | € 4.100 – 4.950 | entire line tightly clustered |
| Men SLG | € 500 – 1.600 | card holder € 500 · watch box € 1.600 |
| Men scarf/beanie/necktie | € 210 – 590 | |
| Kids | € 170 – 1.700 | beret € 170 · gloves € 250 · "from" prices on apparel |
| Lifestyle/home | € 360 – 8.300 | towels € 360 · silk throw € 1.350 · backgammon € 8.300 |
| Fragrance | € 295 / 100 ml | flat pricing across the collection |

**Ladder insight:** entry gifts (€ 170–590) → everyday icons (€ 950–3.100) → craftsmanship statements (€ 4k–11.8k) → rare materials (vicuña € 6.500). Bags cluster tightly per line (men's nubuck/flannel all € 4.1–4.95k) — deliberate price architecture per family.

### 11b. US vs Italy pricing (same SKUs, en-us vs en-it) ✅
| SKU | Italy (EUR, VAT incl.) | US (USD, pre-tax) | $/€ ratio |
|---|---|---|---|
| Cashmere rib cardigan `262M12750806C9986` | € 3.700 | $ 6,000 | **1.62** |
| Cashmere turtleneck sweater `262M12175403C9986` | € 1.750 | $ 3,000 | **1.71** |
| Sparkling double-knit net cardigan `262MGG270506CYB14` | € 2.200 | $ 3,400 | **1.55** |
| Essence small top-handle bag in suede `262MBDLD2499C9885` | € 2.800 | $ 3,600 | **1.29** |
| Segreto perfume 100 ml `262MQ40093210C00S` | € 295 | $ 345 | **1.17** |

* Apparel is marked up ~55–70% over IT retail (IT includes ~22% VAT); bags ~30%; fragrance only ~17% — **tiered pricing by category**, not a flat FX conversion.
* US-only recs glimpse the US floor: embroidered knit tee **$ 8,900**, lynx jacquard cardigan $ 4,700, sparkling cashmere cardigan $ 4,100, rib sweater vest $ 2,500.
* **US fragrance PDP carries extra content the IT one hides:** "**The Scent of Sensations**" — a **Spotify playlist** per scent ("the olfactory notes of Segreto blend with the emotional power of musical notes… LISTEN TO THE PLAYLIST" → open.spotify.com) + "Olfactory Identity" storytelling ("The brightness of florals and citrus fruits settles over a warm base of woods and resins, leaving a soft, precious trail"). Cross-sensory merchandising worth stealing.

### 11c. Sub-PLP sweeps (filling the gaps) ✅
* **Women's blazers** (`/women/ready-to-wear/blazers/`, "blazers and vests"): € 3.900 (velvet w/ monili) → € 4.500 (sparkling knit) → € 5.500 (cable knit) → € 7.500 (Prince of Wales) → **€ 11.000** (Dazzling chevron embroidery & Stardust embroidery).
* **Women's shirts** (`/women/ready-to-wear/shirts/`): € 1.300–2.000 (poplin/linen € 1.3–1.6k · silk satin € 1.9–2.0k · monili shirts € 1.5–1.7k).
* **Men's pants** (`/men/ready-to-wear/pants/`, "pants and bermuda shorts"): € 1.250 (corduroy) → € 1.500–1.800 (corduroy/gabardine/wool-cashmere) → € 1.600 (chalk stripe flannel) → € 2.200 (diagonal cargo). Quick-nav reveals two more men's subcats: **denim**, **travelwear**.
* Deploy note: pages serve mixed Mobify bundles (`/mobify/bundle/837/` and `/861/`) — live A/B or rolling deploy of the PWA shell.

## 12. Merchandising & UX patterns ✅

* **Badge system (5 tiers):** WINTER EDIT (seasonal story) · TIMELESS (continuity icons) · GIFTING EXCLUSIVE (holiday-only) · GOLF (line) · VICUÑA (rare material tier)
* **Size stock states:** "Only one left" · "No longer available" · "Request product" (→ `Product-Show?pid&size&color`). Women XXS–3XL, men XXS–**5XL**, shoes EU 35–41 half sizes
* **"Starting from € X"** pricing on size-graded kids items
* **Color-count chips** ("9 COLORS") + hover image swap (`_D`↔`_F`↔`_R`); hero-SKU pattern (one colorway featured as PLP banner)
* **Inline quick-shop carousels** on the gifts hub (full size/color/stock matrix + add-to-cart in-card)
* **"Discover the look"** outfit tiles interleaved in grids (`…OUTFIT…` SKUs)
* **Full-bleed inspiration banners** injected between product rows (campaign image URLs encode month/campaign: `inspiration-2026/11_NOVEMBRE/10-11_HOLIDAY/ESECUTIVI/…`)
* **Dual recommendation modules** on PDP: "You may also be interested in" + "Complete the look"
* **Batch pagination** ("VIEW 21 MORE", `?start=&sz=`)
* **SEO prose footer** per category + newsletter + geo-IP locale switcher (dynamic suggestion US/Canada observed)
* **Named AI sessions** with delete confirmations
* **Bugs found:** `…/en-it/null` image src (campaign + appointment pages) · empty hub PLPs ("1-0 of 0 products") on `/men/shoes/`, `/men/accessories/`, `/lifestyle/lifestyle-gifts/` — the last one empty *during* holiday gifting season · geo-routing of locale-less URLs to JP context

## 13. Implications for AASRA ✅

1. **Steal the badge system.** 5 purposeful badge tiers (seasonal / continuity / exclusive / line / material) give merchandising a vocabulary. For AASRA: e.g. `SEASON`, `ICON`, `LIMITED`, plus a craft/material tag (hand-embroidered, pashmina).
2. **Inline quick-shop** (gifts hub pattern) is the single highest-value interaction to replicate on a gifts/new-arrivals page — size matrix, stock states and add-to-cart in the card.
3. **Stock-state language** ("Only one left" / "Request product") creates urgency + a concierge fallback — AASRA already has order-lookup/deposit flows; a "request size" endpoint would fit the clienteling story.
4. **Price ladder:** entry gifts (PKR small goods/stoles/fragrance equivalents) → core → statement pieces. Cluster prices per product family like the men's bags line.
5. **"Starting from" pricing** for size-graded items (kids) — useful for AASRA's deposit/balance model (show "from" price + size matrix).
6. **Dual recs + shop-by-look:** "Complete the look" drives basket size; outfit tiles turn PLPs into editorial. AASRA's journal + product pages should cross-link looks.
7. **Taxonomy convention:** pick ONE bag placement (top-level like women's) — BC's men/women asymmetry is a wart. Keep hub pages out of the nav if empty (BC ships empty hubs + an empty lifestyle-gifts page in season — don't replicate).
8. **Editorial campaign pages** with real narrative copy ("A Winter Fairytale") + preference-center newsletter (interest lines + explicit consent) beat a bare email box. Map "lines of interest" to AASRA's own categories.
9. **Clienteling:** Style Advisors + 3-step appointment wizard + find-in-boutique are all in AASRA's scope already (`appointment.astro`, `boutiques.astro`) — the wizard's country→collection→date→boutique→time flow is a clean template.
10. **Localization lessons:** BC runs 40+ locales from one catalog; AASRA needs en-PK (+ maybe ur) with PKR and city-based shipping. Avoid BC's geo-routing pitfalls: locale-less URLs serving the wrong region (JP/JPY), per-session conflicting country prompts.
11. **Image discipline:** consistent 6-view SKU photography (`_D/_F/_R/_K/_E/_G`), lazy placeholders, responsive CDN params — model AASRA's product image manifest on this.

---
*Crawl coverage: homepage, both new-arrivals, all women's/men's department landings, knitwear (women), shirts + sneakers + bags (men), bags/accessories/shoes (women), kids landing + kids gifts, all four gift PLPs, lifestyle + lifestyle gifts, fragrances hub + directory + PDP, campaign page, AI boutique, 3 PDPs (2 apparel, 1 fragrance), appointment wizard, sitemap index + sitemap_0. Not individually opened: every one of the ~2,000 product pages and the remaining sub-PLPs (women's pants/skirts, men's pants/blazers/coats, boots/heels/sandals sub-PLPs) — representative samples cover each pattern.*
