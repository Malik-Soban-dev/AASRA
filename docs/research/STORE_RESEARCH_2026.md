# AASRA storefront research — conversion, visual design, interaction (2026)

Status: research brief + first implementation pass. Written 2026-11-19.
Scope: what top stores and conversion research say about turning visitors into buyers, and what that means for AASRA.

## 1. Method and limits (read first)

- **Sources used:** primary Baymard Institute checkout research (fetched directly, updated 3 Nov 2026); Toimi's 2026 review of e-commerce design leaders; several 2026 CRO guides (secondary); Shopify Horizon vs Dawn analysis; open-source Next.js/Astro/Medusa repos and template roundups; Astro View Transitions discussions.
- **Not done:** I could not watch Instagram reels, TikTok, or YouTube channels. Video content was not analysed. Trend claims below come from written 2026 sources, not from direct observation of those videos. If you want video-based trend input, send links (or transcripts/notes) and I will fold them in.
- **Live site audits:** I did not audit Nike, Aesop, Bottega Veneta or others live. Their design claims come from the Toimi review and similar write-ups.
- **Vendor claims:** many "+X% conversion" figures come from agencies and A/B-testing vendors selling their own services. They are directional, not proof. Where a claim is vendor-only, it is marked **[vendor]** below.

## 2. What drives purchase decisions (evidence-ranked)

### 2.1 Checkout friction (strongest evidence)
Primary source: Baymard, "Checkout UX 2026" (updated 3 Nov 2026).
- 59% of leading US/EU desktop sites rate "mediocre or worse" on checkout UX; 2% "good"; none "perfect". Mobile: 59% mediocre-or-worse. Apps: 60%.
- Reasons US shoppers say they abandoned an online purchase in the last 3 months (2026 survey, n=1,083):
  - Browsing / not ready 42%
  - Extra costs too high (shipping, etc.) 40%
  - Delivery too slow 20%
  - Didn't trust site with card 19%
  - Had to create an account 18%
  - Checkout too long/complex 17%
  - Errors/crashes 17%
  - Return policy not satisfactory 13%
  - Couldn't see total cost upfront 12%
- Baymard's 10 practices include: save account creation for the confirmation step; make guest checkout prominent; show total cost early.
- Note: Baymard says it is re-testing its checkout research for a Q2 2027 release. Treat checkout specifics as current but not final.
- Correction to earlier notes: several blog posts quote "64%" or "65%" mediocre-or-worse. The primary Nov 2026 update says 59%. Use 59%.

### 2.2 Product page (strong, mostly consistent across sources)
- Show price, shipping cost, and return terms near the buy button. (Supported by Baymard's cost/returns figures above.)
- 5+ images including detail and in-use shots; video helps for fabric/movement. Most sources agree; exact uplift numbers are **[vendor]**.
- Reviews above the fold. Spiegel Research Center (Northwestern), widely cited: reviews raise purchase likelihood substantially; purchase likelihood peaks around 4.0–4.7 stars. Apply only when AASRA has real reviews. Do not fabricate reviews.
- Size guidance near the size selector. Reduces size-related returns (**[vendor]** for the 30–50% figure).
- Sticky add-to-cart on mobile. Multiple sources; uplift figures are **[vendor]**.
- Benefit-led copy with specific, verifiable material and craft detail (luxury guides, 2026).
- Do not use fake urgency. Sources agree that fabricated scarcity hurts trust; genuine low-stock messages are fine.

### 2.3 Mobile
- Mobile conversion is consistently lower than desktop in 2026 benchmarks, and page speed is a major factor. Load-time figures vary by source; the consistent message is "fast, thumb-reachable, few fields."

### 2.4 Pricing and thresholds
- Free-shipping threshold progress bars in the cart are reported to lift cart value (**[vendor]**, one A/B write-up). Worth testing once cart is on the new layout.

## 3. Visual and interaction direction (2026)

Reference points named in 2026 reviews: Nike and Apple (editorial heroes, scroll storytelling), Bottega Veneta and Aesop (restraint), Glossier, Poppi and Oatly (challenger DTC voice), Patagonia (values-led), Gymshark (mobile-first DTC), KidSuper (3D storefront). These are described from secondary reviews, not verified live.

Patterns that recur across those sources:
1. **One clear brand conviction.** Typography, spacing, motion and copy agree.
2. **Product photography as the hero.** Custom or intentional imagery, not stock.
3. **Motion that carries meaning** (product demonstration, atmosphere, feedback), not decoration. Respect reduced-motion.
4. **Typography as a brand asset.** Serif display with a readable sans or serif body.
5. **Homepage as a magazine front page.** Frequent editorial/campaign changes.
6. **PDPs as editorial content:** process, provenance, fit, care, sustainability.
7. **Muted luxury palettes** (warm neutrals, sage, terracotta) with restrained accents **[trend pieces]**.
8. **Dark UI for premium categories**: plausible, but one 2026 source reports AOV gains only for premium categories. Test before adopting site-wide.
9. **AI product discovery and 3D/AR**: reported as rising in 2026, mostly relevant for larger catalogues or configurable products. Lower priority for AASRA's current catalogue size.

## 4. Open-source and free starting points

Evaluated, not adopted yet. Adopting a whole template would replace the working AASRA storefront and its Safepay flow, so these are reference material, not a base.

| Project | What it is | License | Fit for AASRA |
|---|---|---|---|
| Vercel Next.js Commerce | Canonical Next.js App Router store (~14k stars) | MIT | Shopify-first; Next.js 15 canary as of Sep 2026. Reference patterns for PDP/cart. |
| Medusa DTC Starter | Official Medusa Next.js storefront + backend | MIT | Full self-hosted backend. Heavy if we only need a storefront. |
| Saleor Storefront / Paper | Next.js storefront for Saleor GraphQL backend | FSL-1.1-ALv2 (source-available) | License restricts competing commercial use. Check before use. |
| astro-medusa-starter (Bystrol) | Astro 6 + Medusa v2 + Stripe, Cloudflare Workers | MIT | Closest stack to ours (Astro + Cloudflare). Patterns for islands-based cart and region routing. |
| Storeplate (Zeon Studio) | Astro storefront for Shopify | MIT | Only useful if we move to Shopify. |
| Astro AI Shop | No-backend Astro store, Stripe Payment Links | MIT | Interesting for minimal ops; not a fit for our order/tracker flow. |

Stack note: the Astro + Medusa starter and our Astro + Cloudflare stack match closely. Its README also warns that Medusa must allow the storefront origin via CORS.

Caution from Astro practitioners (r/astrojs, Jan 2026): View Transitions can break analytics and tag-manager page-view tracking unless transition events are forwarded manually. If we add View Transitions, measure before and after.

## 5. What this means for AASRA

Ranked by evidence strength and effort. Items marked ✅ are in this pass.

1. ✅ **Show shipping threshold and return terms beside the buy button** (PDP). Uses real data: PKR 20,000 threshold, 7-day returns, final-sale marking. Addresses the 40% "extra costs" and 13% "return policy" reasons.
2. ✅ **Card-grid and PDP rendering fixes** from the previous pass (quick-add clipping, touch quick-add, legible size buttons, font loading).
3. ⬜ **Migrate cart and checkout onto the new layout.** Largest remaining gap. Legacy pages show a different nav, typography and a blocking country popup. Blocks a coherent conversion funnel.
4. ⬜ **Guest checkout first; account creation after purchase** (Baymard #1). Requires checkout changes; coordinate with the Safepay flow.
5. ⬜ **Total cost visible before the final step** (shipping, any fees) in cart and checkout.
6. ⬜ **Mobile sticky add-to-cart** (the existing `as-stickybar` should be verified on the PDP at phone width).
7. ⬜ **Cart free-shipping progress bar** using the existing threshold.
8. ⬜ **Reviews module** once real reviews exist. Do not seed fake reviews.
9. ⬜ **Video on PDP** for fabric and movement (requires product footage).
10. ⬜ **A/B framework**: at AASRA's traffic, test one change at a time; significance needs roughly 1,000+ conversions per variant per the cited guides.

## 6. Decisions needed from the owner

- Visual direction: keep the current "quiet luxury" palette and serif system, or move toward a bolder challenger-DTC voice? The research supports either; it is a brand call.
- Is dark UI wanted for premium categories?
- Real review collection: will AASRA collect and display reviews?
- Video budget for PDP footage.

## 7. Sources

- Baymard Institute, "Checkout UX 2026: 10 Pitfalls and Best Practices" (updated 3 Nov 2026): https://baymard.com/research-articles/current-state-of-checkout-ux
- Toimi, "Top 10 Best E-commerce Website Designs 2026": https://toimi.pro/blog/best-ecommerce-website-designs/
- VNTANA, "9 Product Page Conversion Optimization Strategies for 2026": https://www.vntana.com/blog/product-page-conversion-optimization/
- Audit Your Store, "15 Product Page Best Practices (2026)": https://www.audityourstore.com/cro-guides/product-page-best-practices/
- Convertibles, "Ecommerce Conversion Rate by Industry (2026)": https://convertibles.dev/blogs/optimization/increase-ecommerce-conversion-rate
- Redefine Web, "Top Ecommerce Web Design Trends 2026 for DTC": https://redefineweb.com/blog/top-ecommerce-web-design-trends-2026-dtc-conversions/
- Suplex, "Ecommerce Website Design for Luxury Brands: 2026": https://suplex.design/blog/ecommerce-website-design-for-luxury-brands
- Astro Medusa Starter (Bystrol): https://github.com/Bystrol/astro-medusa-starter
- Next.js Commerce / Medusa / Saleor / Spree / Vendure roundup (YNS, Sep 2026): https://yournextstore.com/blog/best-nextjs-ecommerce-templates
- Free Astro ecommerce themes review (Nov 2026): https://getastrothemes.com/blog/astro-ecommerce-templates/
- r/astrojs, "Astro JS for e-commerce" (Jan 2026): https://www.reddit.com/r/astrojs/comments/1qh0hif/astro_js_for_ecommerce/

---

## 8. Second pass (2026-11-19): expanded evidence and corrections

**Scope of this pass:** 12 web searches and 7 page fetches across both passes (about 19 research calls in total). Primary sources read in full: Baymard checkout 2026 and Baymard product-page 2026 (both baymard.com), Spiegel Research Center report (PDF snippets and the International Journal of Advertising abstract), and live homepages for Gymshark, Aesop and Everlane (November 2026 snapshots). This is still a small sample. It is not a survey of "millions of websites." A systematic study would need automated crawling of several hundred stores.

### 8.1 Corrections to the first pass
- Checkout "mediocre or worse": 59% on desktop and on mobile (Baymard, Nov 2026). Earlier notes said 64%; that figure belongs to Baymard's homepage/navigation benchmark, not checkout.
- Review peak rating: the International Journal of Advertising paper abstract says purchase probability rises to about **4.2–4.5 stars**, then falls. Blogs quote **4.0–4.7**. Use 4.2–4.5 as the paper's figure.
- The 270% reviews figure is from the Spiegel report (purchase likelihood for a product with five reviews vs none, from one high-end gift retailer). It is not a general rule. The 380% vs 190% split by price comes from the same report, as quoted by secondary sources.

### 8.2 Product page (Baymard, primary, 2026)
- Product page UX: only 48% of leading desktop sites and 38% of mobile sites rate "decent" or better. 52% desktop, 62% mobile and 64% apps are "mediocre or worse."
- 57% of sites use dropdowns, not buttons, for size selection.
- 37% of sites have no "in scale" image. 42% of users judge size from images.
- 44% do not show or link to the return policy on the product page. 60% of shoppers look for it there.
- 67% do not show an estimated total order cost (including shipping) on the product page.
- 89% never respond to negative reviews. Baymard says responding is perceived as good customer care.
- Implication for AASRA: our PDP fix (shipping threshold and returns beside the buy button) addresses two of the most common gaps. Next candidates: size buttons (we already use buttons), an in-scale reference image, and a "total with shipping" estimate.

### 8.3 Live store observations (homepages only, Nov 2026 snapshots)
- **Everlane:** the cart drawer shows "$75.00 away from free shipping," then "You've received free shipping!" It is a live example of the threshold progress bar. The cart also shows "Free Shipping | Free Returns" and an Express checkout option. A "Black Friday: 40% off everything" banner links to exclusions.
- **Gymshark:** the announcement bar stacks offers (free shipping over $75, 10% off on email sign-up, $10 off referrals, extra 12% for students). Product cards show star ratings and strikethrough prices.
- **Aesop:** the hero carries one clear offer with a code and an end date (15% off through 11/22, exclusions apply). Gift kits show "Old price / New price," "Limited release," and "One size only." The editorial voice is strong.
- Common pattern: free-shipping thresholds are visible in the header or cart. Offers are stated with exclusions. Product cards carry price and rating directly.
- Limitation: three homepages, one snapshot each. These are observations, not a benchmark.

### 8.4 Conversion benchmarks: sources disagree
Fashion/apparel conversion rates in 2026 sources range from about **1.0% to 3.1%**. Examples:
- Dynamic Yield (blended): ~2.8%
- Shopify median, fashion (Littledata): 1.0%, with the top 20% at 1.9%
- Shopify 12-month industry average, fashion (as quoted by Propel): 3.06%
- Propel: 1.45%
- Other vendor tables: 2.1%

Device split is also contradictory. Some sources show mobile well below desktop, others show near parity on Shopify (Littledata, Oct 2026: mobile 1.5%, desktop 1.4%). Reliable finding: mobile add-to-cart is lower (5.4% vs 9.8% on desktop, Littledata), and mobile checkout completion is higher (63% vs 35%, Littledata). **Conclusion:** do not set AASRA targets from a single external benchmark. Measure our own baseline first.

### 8.5 Platform and marketplace claims (low confidence)
- Shopify Editions 2026 (Spring and Fall): Catalog-syndicated data is reported to convert about 2x in AI chats; agentic checkout is live; Shopify removed bot traffic from sessions, which lifts reported conversion rate without any change in sales. All of these are Shopify-reported and not independently audited.
- Social commerce: "tagged posts increase sales by 37%," "tagged Reels convert 55–61% better," and "shoppable video lifts site conversion 17–33%." These figures recirculate across many vendor blogs with no primary source. Treat them as unverified.
- Dark UI for premium categories and minimal one-page checkout: only vendor and agency claims found. No independent data.

### 8.6 Updated priorities for AASRA (adds to section 5)
1. Add an in-scale reference image (a model or object next to the product). Baymard says 37% of sites lack one, and users rely on images for size.
2. Add a "free shipping progress" line to the cart, using the threshold we already have (PKR 20,000). Everlane's live example supports this.
3. Put a clear returns summary in the cart and checkout, not only on the PDP.
4. Show shipping cost estimate before the final checkout step. Baymard: 40% of checkout abandonments cite extra costs.
5. Respond publicly to negative reviews once reviews exist (Baymard: 89% of sites don't).

### 8.7 What "millions of websites" would take
- A crawl of 200–500 fashion and apparel stores, collecting PDP and cart features (size controls, in-scale images, return policy placement, shipping display, sticky add-to-cart, rating display), plus page speed.
- I have a working headless Chromium in the sandbox. Whether it can reach arbitrary third-party sites is untested. `fetch_page` can read public pages, so a crawl would have to run through that tool. This should be confirmed before committing to the plan.
