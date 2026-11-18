/**
 * Client/shared helpers for product data.
 * In the Astro build, products.json is imported at build time.
 * At runtime, the same data is available via the public /data/products.json endpoint
 * (served as a static asset) for client-side filtering.
 */

export async function loadProducts() {
  const res = await fetch('/data/products.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('failed to load products');
  return res.json();
}

export function getProductBySlug(products, slug) {
  return products.products.find((p) => p.slug === slug) || null;
}

export function getVariantBySku(product, sku) {
  return product.variants.find((v) => v.sku === sku) || null;
}

export function getVisibleProducts(products) {
  return products.products.filter((p) => p.visible);
}

export function getProductsByCategory(products, category) {
  return products.products.filter((p) => p.visible && p.category === category);
}

export function getCategories(products) {
  const cats = new Set();
  for (const p of products.products) {
    if (p.visible) cats.add(p.category);
  }
  return [...cats];
}

/**
 * Badge system (adapted from the Brunello Cucinelli deep-dive study, §12–13):
 * purposeful merchandising tiers instead of ad-hoc tags.
 * Types: season (seasonal story) · signature (continuity icon) · limited (scarcity) · craft (artisan/material).
 */
export const BADGE_LABELS = {
  season: 'SEASONAL EDIT',
  signature: 'SIGNATURE',
  limited: 'LIMITED EDITION',
  craft: 'ARTISAN MADE',
};

export function getBadge(product) {
  const type = product?.badge;
  if (!type || !BADGE_LABELS[type]) return null;
  return { type, label: BADGE_LABELS[type] };
}

export function formatPKR(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function depositAmount(totalPkr, percent) {
  return Math.floor((totalPkr * percent) / 100);
}

export function balanceAmount(totalPkr, depositPkr) {
  return totalPkr - depositPkr;
}
