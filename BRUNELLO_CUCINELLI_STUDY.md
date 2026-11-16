# Brunello Cucinelli Shop — Core Study

**Subject:** https://shop.brunellocucinelli.com/ (official e-commerce boutique for women, men & kids)
**Studied:** 2026-11-16
**Scope:** Homepage, category PLP, product PDP, fragrances, gifts, AI boutique, cart/account chrome

---

## 1. Platform & Technology

| Layer | Detail |
|-------|--------|
| **E-commerce engine** | Salesforce Commerce Cloud (Demandware). Backend endpoints appear as `/on/demandware.store/Sites-bc-us-Site/en_US/...` |
| **Storefront framework** | Mobify / PWA-style bundle (`/mobify/bundle/837/static/img/...`) |
| **Media CDN** | `media.brunellocucinelli.com` with Cloudinary-style transformations (`f_auto`, `q_auto`, `w_900`, `dpr_auto`, `c_fill`, `e_blur`) |
| **Product image variants** | Per-SKU images suffixed `_D`, `_F`, `_R`, `_K`, `_E`, `_G` (front, detail, back, etc.) |
| **Placeholder** | `/mobify/bundle/837/static/img/product_placeholder.jpg` |
| **AI boutique** | `/en-us/ai` — "Where ideas become endless possibilities." Adaptive, intent-driven UI built on **Solomei AI's Callimacus** interface; no fixed pages, modules emerge in real time based on user signals. |
| **Locale pattern** | `/<lang><country>/` e.g. `/en-us/`, `/en-gb/` |

## 2. Design Philosophy (the "core")

From brand & industry coverage:

* **Dual environment:** one part philosophy/corporate, one part e-commerce — complementary, not separate.
* **Humanistic capitalism:** quality, manual skills, dignity of work, attachment to local community. Digital interface mirrors this: "humanist artisans of the web."
* **Inspiration over navigation:** editorial rhythm rather than conventional menus. Mobile-first, full-screen, scroll-based flow with subtle snapping between modules; the interface adapts to user intent rather than asking the user to navigate a fixed map.
* **Aesthetic:** minimal, clean, image-heavy, high findability, ease of use; luxury pricing ($600–$19,000+ per piece).

## 3. Information Architecture

### Top-level (from homepage)
* Campaign: **"A Winter Fairytale"** (Holiday Season) — Gift Selection + Discover the Story
* **Seasonal suggestions** tiles:
  * Women's Knitwear → `/en-us/women/ready-to-wear/knitwear/`
  * Men's Knitwear → `/en-us/men/ready-to-wear/knitwear/`
  * Women's Hats → `/en-us/women/accessories/hats/`
  * Men's Bags → `/en-us/men/accessories/bags/`
  * Men's Gifts → `/en-us/men/men-gifts/`
  * Women's Gifts → `/en-us/women/women-gifts/`
* **Fragrance Collection** hero → `/en-us/fragrances.html`
* **Explore the Collection** editorial module
* **AI Boutique** → `/en-us/ai`
* Newsletter subscription

### Women's category taxonomy (ready-to-wear)
New arrivals > Shirts > Blazers > Coats & Jackets > Dresses & Jumpsuits > **Knitwear** > ...

Other departments: Bags (handbags, clutch & pouch), Shoes (heels), Accessories (hats, other-accessories).

### URL patterns
* PLP: `/en-us/<gender>/<department>/<subdepartment>/`
* PDP: `/en-us/<gender>/<department>/<subdepartment>/<slug>-<SKU>.html`
  * Example SKU: `262M12750806C9986` (14-char product code)
* Fragrance: `/en-us/fragrances/<collection>/<slug>-<size>.html`
* Gifts: `/en-us/<gender>/<gender>-gifts/`

## 4. Page Anatomy

### Global chrome (observed on PLP/PDP/gift pages)
* Accessibility links: "Enable Accessibility", "Go to main content"
* **Log in** / **Create an account**
* Registration: `/en-us/registration` ("Enjoy a personalized experience and discover all the exclusive services")
* Mini cart: `Your selection ( 0 )`, `Subtotal $0.00`, `GO TO THE CART`, "or proceed with quick payment"
  * Note: "The gift option is not available with Express Checkout"
* Breadcrumb trail on PLPs (e.g. Women > Shirts > Blazers > ...)

### PLP (category listing)
* **Filters** panel
* Product grid cards: image (with hover alt views `_D`/`_F`), product name, color, price, `N COLORS` swatch count
* **WINTER EDIT** editorial badge on select products
* Full-bleed inspiration/banner images between product rows
* Pagination (`<` / `>` seen on gifts page)

### PDP (product detail)
* Image gallery: multiple views (`_F`, `_R`, `_D`, `_K`, `_E`, `_G`) at `w_1400`
* Product name, price, color
* **Select your size:** XXS / XS / S / M / L / XL / XXL / 3XL with stock states:
  * "Only one left", "No longer available", "Request product" (links to Demandware Product-Show with pid/size/color)
* Size Guide · "May we help you?" · **ADD TO CART**
* Tabs/sections: **Details**, **Packaging**, **Shipping and returns**, **FIND IN BOUTIQUE**
* Book appointment: `/bookAppointment` — Style Advisors via boutique or video conference
* Cross-sell: **"You may also be interested in"** / **"Complete the look"** (4–6 product recs)
* Share: Email, WhatsApp, Pinterest, Facebook, Twitter, Copy link

### Fragrance PDP
* "Available sizes" (often One Size), size select, ADD TO CART
* Collection storytelling ("Segreto, Silenzio, Ricordo — olfactory journey… endless shades of the sky")
* Individual scent ~$345.00

### Gifts page
* Gift Selection: **For Her** / **For Him** (+ little ones, home & free-time accessories)
* Products with full size/color availability matrix and "Request Product" fallback for out-of-stock

## 5. Conversion & Service Features

* Express Checkout (quick payment) — gift option disabled with it
* Back-in-stock / "Request product" for unavailable sizes
* Find in boutique (store locator / clienteling)
* Book a boutique appointment or video call with Style Advisors
* Newsletter capture (site-wide)
* Social share sheet on every PDP
* Account: log in / create account / registration for personalized experience

## 6. Content Strategy

* Seasonal campaigns (Holiday / "A Winter Fairytale", "The Holiday Ball", "Hotel of Dreams")
* Editorial collections ("WINTER EDIT", "Incanti Poetici", "Explore the Collection")
* Brand philosophy & AI-driven discovery (BrunelloCucinelli.ai / Callimacus)
* Social amplification: campaigns cross-posted to Instagram Reels, TikTok, YouTube

---

**Takeaway for a rebuild:** A luxury e-commerce frontend needs (1) image-first PDP/PLP with variant swatches, (2) size/stock states incl. "request product", (3) mini cart + express checkout, (4) editorial campaign/homepage modules, (5) clienteling (appointments, find-in-boutique, style advisor), and (6) an adaptive/AI discovery layer. The brand's essence is editorial elegance + human service, not a generic marketplace.
