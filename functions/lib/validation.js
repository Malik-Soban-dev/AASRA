/**
 * Shared input validation helpers for AASRA checkout/contact/newsletter endpoints.
 * All validation runs server-side. Never trust the browser.
 */

// Pakistani mobile: 11 digits starting with 03 (e.g. 03001234567)
// Accepts: 03001234567, 0300-1234567, 0300 1234567, +923001234567
const PHONE_DIGITS_RE = /^03\d{9}$/;

export function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let digits = raw.replace(/\s|-|\(|\)|\./g, '');
  // Convert +92 or 92 prefix to leading 0
  if (digits.startsWith('+92')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('92') && digits.length === 12) digits = '0' + digits.slice(2);
  else if (digits.startsWith('0092')) digits = '0' + digits.slice(4);
  if (!PHONE_DIGITS_RE.test(digits)) return null;
  return digits;
}

export function isValidPhone(raw) {
  return normalizePhone(raw) !== null;
}

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Reasonable RFC-ish check; not exhaustive but catches obvious errors
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function requireFields(obj, fields) {
  const missing = [];
  for (const f of fields) {
    const v = obj[f];
    if (v === undefined || v === null || v === '') missing.push(f);
  }
  return missing;
}

export function clampQty(qty) {
  const q = Number.parseInt(qty, 10);
  if (!Number.isInteger(q) || q < 1) return 1;
  if (q > 10) return 10; // per-order quantity limit
  return q;
}

/**
 * Sanitize a string: trim, collapse whitespace, cap length.
 * Returns null if input is not a string.
 */
export function sanitizeString(raw, maxLen = 500) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/\s+/g, ' ');
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Validate cart items: array of { sku: string, qty: number }.
 * Returns { ok: true, items } or { ok: false, error }.
 */
export function validateCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { ok: false, error: 'cart must be a non-empty array' };
  }
  if (cart.length > 20) {
    return { ok: false, error: 'cart too large' };
  }
  const items = [];
  const seenSkus = new Set();
  for (const entry of cart) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: 'invalid cart entry' };
    }
    const sku = sanitizeString(entry.sku, 64);
    if (!sku || !/^[A-Z0-9-]+$/.test(sku)) {
      return { ok: false, error: `invalid SKU: ${entry.sku}` };
    }
    if (seenSkus.has(sku)) {
      return { ok: false, error: `duplicate SKU: ${sku}` };
    }
    seenSkus.add(sku);
    const qty = clampQty(entry.qty);
    items.push({ sku, qty });
  }
  return { ok: true, items };
}
