# Skill: apply the design system

Applies to every frontend change in `src/pages`, `src/components/store`, `src/styles`.

1. **Read `docs/DESIGN_SYSTEM.md` before writing any UI.** Tokens only: colors,
   type, spacing, radius, motion come from `src/styles/tokens.css`. No literals.
2. **Edit the owning file.** Need a different look for an existing component?
   Change the component/`store.css` at the source. Never add an override layer
   (`!important` wars, late-loading "fix" stylesheets) — that broke the site once.
3. **Respect the component inventory.** Reuse before creating. New components
   need a row in the design system doc and a clear single responsibility.
4. **Motion budget:** one signature interaction per section (see design system §6).
   Everything else is a 200ms hover. Reduced-motion always wins.
5. **Anti-slop checklist before shipping** (design system §10): no gradients/glass/
   emoji, two typefaces max, real alt text, 44px targets, focus rings.
6. **Consistency is the product.** Same action = same button, same card = same
   anatomy, across every page.
