/**
 * GET /api/stock?skus=SKU1,SKU2,...
 *
 * Availability lookup for the storefront size selector and quick-shop cards.
 * Reads the D1 `stock` table (sku, quantity_available) seeded by scripts/seed-d1.js.
 *
 * Graceful degradation: when D1 is not bound (local dev before `wrangler d1 create`
 * + uncommenting the binding in wrangler.toml), returns stock: null and the client
 * falls back to the generic "Availability confirmed when your order is reviewed" note.
 *
 * Never exposes more than quantities; read-only, no auth required.
 */

const MAX_SKUS = 50;

/** Parse and sanitize a comma-separated sku list. Exported for tests. */
export function parseSkus(raw) {
  if (!raw) return [];
  return [...new Set(
    raw.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 64)
  )].slice(0, MAX_SKUS);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Shoppers see a status, not a count (KNOWN_ISSUES #22).
 * 0 = out, 1 to 3 = low, more than 3 = in_stock.
 */
export function stockStatus(quantity) {
  const n = Number(quantity) || 0;
  if (n <= 0) return 'out';
  if (n <= 3) return 'low';
  return 'in_stock';
}

export async function onRequestGet(context) {
  const { env } = context;
  const url = context.url || new URL(context.request.url);

  const skus = parseSkus(url.searchParams.get('skus'));
  if (skus.length === 0) {
    return jsonResponse({ ok: false, error: 'skus parameter is required', code: 'missing_skus' }, 400);
  }

  // D1 not bound yet (see wrangler.toml) — tell the client to fall back.
  if (!env || !env.DB) {
    return jsonResponse({ ok: true, stock: null, reason: 'stock_unavailable' });
  }

  try {
    const placeholders = skus.map(() => '?').join(',');
    const stmt = env.DB.prepare(
      `SELECT sku, quantity_available FROM stock WHERE sku IN (${placeholders})`
    ).bind(...skus);
    const { results } = await stmt.all();

    const stock = {};
    for (const row of results || []) {
      stock[row.sku] = stockStatus(row.quantity_available);
    }
    return jsonResponse({ ok: true, stock });
  } catch (err) {
    // Missing table or transient DB error — degrade gracefully.
    return jsonResponse({ ok: true, stock: null, reason: 'stock_unavailable' });
  }
}
