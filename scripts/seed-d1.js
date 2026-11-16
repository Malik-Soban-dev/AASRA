/**
 * Seed helper for the D1 database.
 * Populates the stock table from products.json variants and adds a sample coupon.
 * Run: node scripts/seed-d1.js  (then apply via wrangler d1 execute)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const products = JSON.parse(
  readFileSync(new URL('../data/products.json', import.meta.url), 'utf8')
);

const now = new Date().toISOString();
const statements = [];

// Stock rows from product variants
for (const p of products.products) {
  for (const v of p.variants) {
    // Seed a plausible quantity per variant (VERIFY against real inventory)
    const qty = p.price_pkr > 10000 ? 3 : 8;
    statements.push(
      `INSERT INTO stock (sku, quantity_available, updated_at) VALUES ('${v.sku}', ${qty}, '${now}');`
    );
  }
}

// Sample coupon: WELCOME10 = 10% off, min order 5000 PKR, expires 2027-12-31
statements.push(
  `INSERT INTO coupons (code, type, value, min_order, expires_at, usage_limit, used_count, created_at) VALUES ('WELCOME10', 'percentage', 10, 5000, '2027-12-31T23:59:59Z', 1000, 0, '${now}');`
);

console.log(statements.join('\n'));
console.log(`-- Seed complete: ${statements.length} statements. Pipe into: wrangler d1 execute AASRA_DB --file=<(node scripts/seed-d1.js)`);
