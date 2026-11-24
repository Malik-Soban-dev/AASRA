# AASRA — Build history, decisions and rules

This is the record that sits next to `docs/PLAYBOOK.md`. The playbook says how to build the store. This file says what was done, in what order, which decisions were made, which rules the owner set, and what did not work. Read it when you need to know why something is the way it is.

- **Snapshot:** against `main` at `eb7e511` (PR #90 merged), 2026-11-24. Later PRs are listed as they happen.
- **Scope:** storefront, catalog, payments, email, deploy, and the working process. Secret values are not recorded anywhere.

---

## 1. Timeline of merged work

### 1.1 Payments and backend (PRs #19–#40)
- Built checkout, webhook, safepay-return, order-lookup, pay-order, pay-balance, invoice, stock, newsletter, contact, Turnstile checks, and scheduled jobs.
- Resend domain `aasra.shop` verified. Worker secrets set.
- Two sandbox test orders created: `AAS-20261122-SRQP` and `AAS-20261122-CATP` (see §4).

### 1.2 Storefront (PRs #41–#77)
- **PR #41:** 15 new products went live. Treated as real products (see §3).
- PRs #54, #56 (flagged), #57–#61, #64, #65, #67, #72–#77: storefront, header, PLP, PDP, and carousel work. Each merged with its own approval.
- **PR #66:** closed, superseded.
- **PR #62:** still open. **PR #63:** the merge command ran without a confirmed owner approval. Check its state with `gh pr view 63`.
- **PR #74:** the filter panel stays inside `.as-plp-toolbar`.
- **PR #76:** the denim-only rail rule was removed. Do not add it back.
- **PR #77:** breadcrumb sits below the header through `--as-header-h`. Do not restore the fixed value.

### 1.3 Layout and PDP (PRs #79–#86)
- **PR #79:** merged `3deac42`.
- **PR #80:** open, superseded by #82.
- **PR #81:** merged `a610c3f`.
- **PR #82:** merged `c0ff153`. The category layout the owner approved ("this is the ss") after "the layout is so awkward". Do not change it without a clear request.
- **PR #83:** merged `bf5edd2`.
- **PR #84:** footwear everywhere. Merged `64c4f69`.
- **PR #85:** phone PDP photo slider. Merged `a366077`.
- **PR #86:** larger phone photo. Merged `55fe890`. At 390×844 the photo is 429 px tall and the details start 52 px below it.

### 1.4 Shop, sub-categories and navigation (PRs #87–#90)
- **PR #87:** shop fix, merged `6d34185`. `/shop` shows 34 items, Knitwear 8, and `?q=cable` 1.
- **PR #88:** sub-category pages, merged `a8a35d4`.
- **PR #89:** Shop chips follow the selected category, and the PDP breadcrumb shows the sub-category. Merged `535472300f03ca21abd992823c65b34630c9a0cd`.
- **PR #90:** client-side navigation between browse pages. Merged `eb7e5117caea2a398e7b9481ad2d1cc30ab28d30`.

### 1.5 Documentation (PR #91)
- This playbook and history, plus corrected `ARCHITECTURE.md` and `README.md`. Docs only.

## 2. Decisions and the reasons behind them

| Date | Decision | Reason or detail |
|---|---|---|
| Nov 2026 | Catalog as JSON files, no admin dashboard | Chosen for this build. No reason recorded. |
| Nov 2026 | Safepay hosted checkout | The gateway used. Reason not recorded. |
| Nov 2026 | Prepaid only; deposits removed | Owner decision |
| Nov 2026 | No manual "mark as paid" | Requested once and rejected. The webhook path must be fixed instead. |
| Nov 2026 | Shop filters in the browser | Static site cannot read the query at build time |
| 2026-11-23 | Footwear added to every nav, both genders, shop, Categories in Focus | Owner asked for it everywhere, matching the reference image |
| 2026-11-23 | Women's and men's categories match exactly | Owner rule |
| 2026-11-23 | Hero: full-screen carousel, scroll parallax, dots only, no arrows | Owner rule |
| 2026-11-23 | Desktop collection tiles and Categories fit one viewport; carousel scrollbars hidden, other carousels keep arrows | Owner rule |
| 2026-11-23 | Phone hero and tiles fill the screen; tiles are a carousel | Owner rule |
| 2026-11-23 | Denim is a full-width banner that fills the viewport height, then a carousel; New In sits above it | Owner rule |
| 2026-11-23 | PDP: two-column image grid, sticky info column | Owner asked for the reference layout ("make the product single like this") |
| 2026-11-23 | Phone PDP only: dots sit under the gallery and scroll to that photo; a colour swatch moves that colour's photo to the front and resets to photo 1 | Owner request. Desktop layout unchanged. |
| 2026-11-23 | Header: transparent at top, coloured on scroll, hides on scroll down, shows on scroll up | Owner rule |
| 2026-11-23 | Colour dots swap the card photo everywhere, including home | Owner rule |
| 2026-11-23 | Filter popup must open on screen wherever the shopper is on the list | Owner rule |
| 2026-11-23 | Headings Inter Tight, body Inter | Owner rule |
| 2026-11-23 | Placeholders for photos until the owner supplies final images | Owner rule |
| 2026-11-24 | Category changes must not reload the whole page | Owner request: "use ajax to manage everything so the site gets faster" |
| 2026-11-24 | Sub-categories on both the Shop chips and the PDP breadcrumb | Owner chose "both" |
| 2026-11-24 | Shop chips follow the selected category | Owner report: "the tabs are not changing" |

## 3. Products and content rules

- **Counts at this snapshot:** 34 visible products (women 18, men 16). 256 variants across 34 products.
- **Women's tiles:** Denim (large, left) and Dresses & Kurtas (right), then Knitwear and Outerwear & Shawls.
- **Men's tiles:** Denim and Knitwear, then Shirts (full width). Single column on phones.
- **Sub-category counts:**
  - Women denim: wide-leg 1, straight 1, barrel 1.
  - Women dresses: kurtas 1, wrap-midi 2, shirt-dresses 1, kaftans 1.
  - Women footwear: mules-sandals 1, boots 1, sneakers 1.
  - Women knitwear: cardigans 2, tops-pullovers 2.
  - Women outerwear: coats 2, jackets 1, gilets-shawls 1.
  - Men denim: relaxed 1, slim 1, overshirts 1.
  - Men footwear: derbys 1, loafers 1, sneakers 1.
  - Men knitwear: crewnecks-vnecks 2, half-zips 1, cable-knit 1.
  - Men shirts: casual 3, formal 1, kurta 1.
- **Sample products are real.** No "Sample" labels, no sample copy.
- **Placeholders:** product photos, colour photos, denim photos, footwear photos, and PDP crops. Replace them when the owner sends photos.
- **Greyscale product photos:** open question. Ask before changing.
- **Reference site:** used for layout and feel only. Do not reuse its photos, product names or copy.
- **Keep "Juniors."** Owner decision.
- **Do not commit** `data/products.json` or `public/data/products.json` without asking.

## 4. Payments: the sandbox record

- **Gateway:** Safepay sandbox. Live not approved.
- **Goal:** a completed test order through Safepay to a PAID order, a receipt, and a lookup page that shows PAID.
- **`AAS-20261122-SRQP`:** pending. Do not mark it paid by hand. Safepay's option to resend a payment link is unknown, and do not guess it.
- **`AAS-20261122-CATP` timeline (GMT+5):**
  - 07:28:23 checkout.
  - 07:29:26 webhook received.
  - 07:29:28 `POST /api/webhook`, and the receipt email sent.
  - 07:29:29 `/api/safepay-return`.
  - 07:29:45 `/api/order-lookup` twice.
  - The webhook's final status was not confirmed.
- **Duplicate guard** (commit `f53b0ed`): a second full payment is recorded as `duplicate` and flagged `refund_required`.
- **Lookup "Network error"** root cause: `can_pay_balance is not defined`. Fixed in `5fe1fb0`. Do not revert to GET.
- **Live blockers:** `BUSINESS_ADDRESS` empty; `TAX_REGISTRATION_NO` empty; tax rate VERIFY; Safepay still sandbox; live keys not obtained; Safepay onboarding at step 1 of 6.
- **Tax formula:** `Math.floor(subtotalAfterDiscount × TAX_RATE_PCT / 100)`. The rate is `0` for now.
- **Order numbers:** `AAS-YYYYMMDD-XXXX`, generated in `functions/api/checkout.js`.
- **Receipt email:** must be a full receipt showing Paid with correct details.
- **Priority:** payment works end to end before owner orders and product work start.

### 4.1 Payment rules set by the owner
- Keys and secrets never go in chat. Keys go only into PowerShell, the Resend dashboard, or the Cloudflare dashboard.
- Prepaid only.
- Real cards are never used. Sandbox test cards come only from Safepay's own docs or dashboard. Web search returned other providers' cards; do not use them.
- Live switch not approved.
- Checkout: one pass over the whole flow. Goal is a completed test order.
- **Standing permission (checkout errors only):** commit, push, open, and merge checkout-error fixes without asking. Not for Resend or email work.

## 5. Email rules

- One Resend step at a time.
- Do not create a second Resend account.
- Merging email work requires an explicit "yes".
- Resend pricing check (third-party summaries, Oct 2026): free tier 3,000 a month, 100 a day cap, 3 domains. Pro $20 for 50,000; overage $0.90 per 1,000. Check Resend's pricing page before budgeting.
- DKIM: the Resend dashboard "verified" badge does not prove DNS. Check with `nslookup`.

## 6. Cart rules

- One add click gives quantity 1.
- Returning to a product already in the bag must say so ("Already in your bag — view bag") and must not offer to buy again.
- **Cart quantity fix:** the owner has not decided whether to merge it. Ask before merging.

## 7. Working rules from the owner

- **Merge only on an explicit "merge"** (or "merge and show"). Each PR gets its own approval.
- **Branch rules:** use the branch the system names. Do not edit or push on a branch marked `pr_merged`. `arena/76836e03-aasra` was marked `pr_merged`. `arena/ab5524fc-aasra` was for edits.
- **Questions:** act when the request is clear. Ask one question at a time, and only for real ambiguity.
- **Cache:** when the owner says "no change", advise a hard refresh or a private window first.
- **Colour pass:** keep the error reds unless asked to change them.
- **Category layout:** do not change without a clear request.
- **Figma:** the connector is validated. Use it only with a file link or a clear instruction.
- **Owner verification:** the owner checks changes on their phone. Hard refresh on the phone for PRs #74–#77 is not confirmed.

## 8. Dead ends and what they taught us

| What was tried | What went wrong | Rule now |
|---|---|---|
| Shop chips read the query in frontmatter | Static build always showed "All" | Filter in the browser (`shop.astro`). No server or SSR route for this. |
| `pay-balance.astro` reads query params in frontmatter | Empty on the static build | Parked with payments. Do not change without asking. |
| `transition:persist` on the component tag | Mega menus stopped working after navigation | Put persist on root elements in `SiteHeader` and `SiteFooter` |
| `#site-search` as a selector | Does not exist | Overlay uses `#as-search-open` and `#as-search-input` |
| Global `main a` rule with plain anchors | Strip tiles collapsed to about 24 px | Give anchors a class starting with `as-` |
| Full-page screenshots for footwear | Lazy images not decoded yet | Scroll, then check `naturalWidth` |
| Build under Node 22 | Fails | Use Node 24 |
| `git checkout main` during a build check | Switched branches on a task branch | Do not switch branches to verify builds |
| HTML `height` on product photos | Overrode the 3:4 CSS ratio | Do not set `height` on product images |
| Writing a script into a missing `/tmp` folder | Failed | `mkdir -p` first |
| Preview `pkill -f "http.server 8792"` | Killed its own shell | Use `pkill -f "[h]ttp.server"` or stop by PID. Start `nohup` servers in their own tool call. |
| Empty screenshots | `.as-reveal` fades in on scroll | Scroll and add the revealed class before capturing |
| Gallery badge selector | Badge is a child of the gallery | Use `:last-of-type:nth-of-type` |
| Phone parallax with `position: relative` | Did not work | `position: sticky; top: 0` in the ≤720 px hero |
| Phone Categories with a fixed-height wrapper | Broke the layout | Do not reintroduce a fixed-height wrapper |
| Sticky PLP toolbar without a wrapper | Did not stick | Needs `.as-plp-body[data-plp-bar]` |
| PLP generator with `${…}` in a template literal | Left a stray `$` | Check generated output |
| Colour dot ring check on the whole card | Wrong crop | Element screenshot of `.as-card-colors` |
| Inline browser-check scripts | Failed silently | Write each check to a file |
| `gh pr edit` titles | Old title kept on #69 and #78 | Check the title after editing |
| `gh pr create` on a branch that already has a PR | Returns the existing PR | Run `gh pr view` first |
| `&&` chain with `gh pr merge` | Printed nothing | Verify with `gh pr view` |
| `gh pr merge 88 --merge` | Aborted before returning | Confirm the state with `gh pr view 88` before assuming |
| `gh pr merge 61` | Failed with "Base branch was modified" | Retry worked |
| Non-fast-forward push | Fixed with `git reset --soft` | Never force-push |
| Shallow clone, `git diff <sha>^1` | Failed | `git fetch --deepen=3 origin` |
| `gh run rerun 44926825439` | Failed | Do not retry. Push a fresh commit. |
| Importing `functions/api/checkout.js` from tests | Fails | Guard tests read the source |
| Manual paid-marking of `AAS-20261122-SRQP` | Rejected by the owner | Do not do it |
| Search results for test cards | Other providers' cards | Do not use them |
| Webhook field names guessed | Unreliable | Use only fields in the Safepay SDK |
| `/tmp/promote.mjs` | Overwrote tracked images | Do not rerun. Never overwrite tracked `m003–m006.jpg` or `w003–w007.jpg`. |
| `/tmp/dots-edit.cjs` | Failed | Do not reuse |
| Shell scripts with backticks in a heredoc | Broke | Write with `cat > file <<'EOF'` |
| Slider colour-swap check | Showed no change on one run | The phone slider screenshot showed the swap working. Verify with a screenshot. |
| `generate_image` | Limit of 10 images per turn | Plan batches |
| Medium guide "Safepay Checkout Integration Guide" (2019) | Sandbox card expired | Not a source of truth |
| An image link from awesomescreenshot | Returned no image | Not usable |

## 9. Recovery steps after a sandbox reset

The sandbox can lose `/tmp`, `node_modules` and `dist/`, and the repo can be re-cloned so local branches lag behind.

1. `git fetch origin`, then compare with the remote before doing anything.
2. Node 24: `npm i node@24` in a scratch folder, e.g. `/tmp/n24pkg`.
3. In the repo: `npm ci`, then `npm run build`.
4. Browser tools: `mkdir -p /tmp/chr`, then `npm i puppeteer-core @sparticuz/chromium` in it.
5. Chromium libraries: brotli-decompress `node_modules/@sparticuz/chromium/bin/al2023.tar.br` to `/tmp/libs/al2023.tar`, extract it, and move `lib` to `/tmp/libs/al2023/lib`. Use `.default` for `@sparticuz/chromium`.
6. Preview: build first, then `python3 -m http.server 8792 --bind 0.0.0.0 --directory dist`. Check it returns 200 for `/shop/`.
7. Safepay SDK reference: clone `getsafepay/safepay-python` into a scratch folder. Read it only.

## 10. Client-side navigation: how it was verified

- Read the Astro router source in `node_modules` (read-only) before changing anything.
- Applied the change through scripts in `/tmp/subcat/`. All of them have run. Do not run them again.
- Build exit 0. Tests 46/46.
- Browser checks passed: a click on Knitwear on `/shop/` kept the page alive and changed the URL to `/shop/?category=knitwear`. Cart still does a full load.
- `astro:page-load` fires on first load and after each client navigation. Back and forward are covered by Astro's `popstate` handling.

## 11. Open items (as of this snapshot)

- Confirm PRs #62 and #63.
- Confirm the hard refresh on the phone for PRs #74–#77.
- Footwear search placeholder and empty-state hint in `SiteHeader.astro` (about lines 112 and 205) are not updated.
- Breadcrumb gap tightening is unanswered.
- Whether checkout, pay-balance, order-lookup and order-success stay full page loads (`data-astro-reload`) is not answered. Storefront links into them are not browser-tested.
- `ERR_CONNECTION_CLOSED` console messages were seen once. Cause not confirmed.
- The sandbox cannot reach Google Fonts, so font-loading checks are not reliable here.
- Live payments and the live switch: not approved.
- Safepay onboarding: step 1 of 6.
- Order `AAS-20261122-SRQP` pending.
- Cart quantity fix: merge undecided.
