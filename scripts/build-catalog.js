#!/usr/bin/env node
/**
 * build-catalog.js — merges the human-editable category files in data/catalog/
 * into the generated aggregate data/products.json (+ public/data/products.json)
 * that the storefront pages, APIs and tests consume.
 *
 * Edit products in data/catalog/<gender>/<category>.json, then run:
 *   npm run catalog:build     (also runs automatically before every build)
 *
 * NEVER hand-edit data/products.json — it is generated.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogDir = join(root, 'data', 'catalog');

const VALID_SIZE = /^[A-Z0-9]+$/i;

function slugifySize(size) {
  return String(size).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function colorCode(name) {
  return String(name)
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.slice(0, 3))
    .join('')
    .slice(0, 4) || 'STD';
}

const products = [];
const categories = { women: [], men: [] };

for (const gender of ['women', 'men']) {
  const dir = join(catalogDir, gender);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (!data.category || !Array.isArray(data.products)) {
      throw new Error(`${gender}/${file}: needs { category, label, products[] }`);
    }
    const subcategories = Array.isArray(data.subcategories) ? data.subcategories : [];
    const subKeys = new Set(subcategories.map((sc) => sc.key));
    categories[gender].push({ category: data.category, label: data.label, href: `/${gender}/${data.category}`, subcategories });
    for (const p of data.products) {
      if (!p.id || !p.slug || !p.name || !p.price_pkr) throw new Error(`${gender}/${file}: product missing id/slug/name/price_pkr`);
      if (!Array.isArray(p.sizes) || !p.sizes.length) throw new Error(`${p.id}: sizes[] required`);
      if (!Array.isArray(p.colors) || !p.colors.length) throw new Error(`${p.id}: colors[] required`);
      if (!Array.isArray(p.images) || !p.images.length) throw new Error(`${p.id}: images[] required`);
      for (const size of p.sizes) if (!VALID_SIZE.test(size)) throw new Error(`${p.id}: bad size "${size}"`);
      if (subcategories.length && !subKeys.has(p.subcategory)) throw new Error(`${p.id}: subcategory "${p.subcategory}" not in ${gender}/${data.category} subcategories`);

      // Expand sizes x colors into variants (the units cart/checkout/stock track).
      const variants = [];
      for (const color of p.colors) {
        for (const size of p.sizes) {
          const sku = `AS-${p.id}-${colorCode(color.name)}-${slugifySize(size)}`;
          variants.push({ sku, size, color: color.name, stock_key: sku });
        }
      }
      products.push({
        id: p.id,
        slug: p.slug,
        name: p.name,
        gender,
        category: data.category,
        category_label: data.label,
        subcategory: p.subcategory || data.category,
        price_pkr: p.price_pkr,
        compare_at_pkr: p.compare_at_pkr || null,
        badge: p.badge || null,
        color: p.colors[0],
        colors: p.colors,
        sizes: p.sizes,
        images: p.images,
        description: p.description || '',
        details: p.details || [],
        fabric: p.fabric || '',
        care: p.care || '',
        visible: p.visible !== false,
        // Deposit rule: pieces >= PKR 15,000 are deposit-eligible (override per
        // product with "deposit_eligible": true/false in the category file).
        deposit_eligible: p.deposit_eligible ?? p.price_pkr >= 15000,
        variants,
      });
    }
  }
}

// "New in" pseudo-category rides on the badge.
for (const gender of ['women', 'men']) {
  categories[gender].unshift({ category: 'new-in', label: 'New In', href: `/${gender}/new-in`, subcategories: [] });
}

const out = {
  version: 3,
  currency: 'PKR',
  updated_at: new Date().toISOString(),
  categories,
  products,
};

for (const target of ['data/products.json', 'public/data/products.json']) {
  mkdirSync(dirname(join(root, target)), { recursive: true });
  writeFileSync(join(root, target), JSON.stringify(out, null, 2) + '\n');
}
console.log(`catalog: ${products.length} products, ${products.reduce((n, p) => n + p.variants.length, 0)} variants -> data/products.json + public/data/products.json`);
