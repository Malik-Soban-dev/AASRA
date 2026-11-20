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
