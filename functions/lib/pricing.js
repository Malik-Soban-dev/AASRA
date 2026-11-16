/**
 * Server-side pricing engine for AASRA.
 * MONEY RULES: all amounts are integers (whole PKR). Never floats.
 * deposit + balance must always equal total exactly.
 * Prices are loaded server-side from products.json — never trusted from the browser.
 */

import { isNonNegativeInteger } from './validation.js';

// Load product catalog server-side (bundled at edge deploy time).
let PRODUCTS = null;
export function setProducts(products) {
  PRODUCTS = products;
}
export function getProducts() {
  return PRODUCTS;
}

export function findProductBySku(sku) {
  if (!PRODUCTS || !PRODUCTS.products) return null;
  for (const p of PRODUCTS.products) {
    const v = p.variants.find((x) => x.sku === sku);
    if (v) return { product: p, variant: v };
  }
  return null;
}

export function findVariant(product, sku) {
  return product.variants.find((x) => x.sku === sku) || null;
}

/**
 * Look up shipping fee by city from shipping-rates.json.
 * Falls back to "Other" rate if city not found.
 */
export function computeShipping(city, subtotal, shippingConfig) {
  if (!shippingConfig || !shippingConfig.rates) return { fee: 0, courier: null, est: null };
  const threshold = shippingConfig.free_shipping_threshold_pkr || 0;
  let matched = shippingConfig.rates.find(
    (r) => r.city && r.city.toLowerCase() === String(city).toLowerCase()
  );
  if (!matched) matched = shippingConfig.rates.find((r) => r.city === 'Other') || null;
  let fee = matched ? matched.fee_pkr : 0;
  const courier = matched ? matched.courier : null;
  const est = matched ? matched.estimated_days : null;
  if (threshold > 0 && subtotal >= threshold) fee = 0;
  return { fee, courier, est };
}

/**
 * Apply a coupon to a subtotal.
 * - percentage: discount = floor(subtotal * value / 100), capped at subtotal
 * - fixed: discount = min(value, subtotal)
 * Returns { discount, code, applied: boolean, reason }.
 */
export function applyCoupon(coupon, subtotal, nowIso) {
  if (!coupon) return { discount: 0, code: null, applied: false, reason: null };
  const code = String(coupon.code || '').trim().toUpperCase();
  if (!code) return { discount: 0, code: null, applied: false, reason: null };

  // Expiry check
  if (coupon.expires_at && nowIso > coupon.expires_at) {
    return { discount: 0, code, applied: false, reason: 'coupon_expired' };
  }
  // Usage limit
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { discount: 0, code, applied: false, reason: 'coupon_limit_reached' };
  }
  // Minimum order
  const minOrder = coupon.min_order || 0;
  if (subtotal < minOrder) {
    return { discount: 0, code, applied: false, reason: 'min_order_not_met' };
  }

  let discount = 0;
  if (coupon.type === 'percentage') {
    const pct = Number(coupon.value);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      return { discount: 0, code, applied: false, reason: 'invalid_coupon' };
    }
    discount = Math.floor((subtotal * pct) / 100);
  } else if (coupon.type === 'fixed') {
    const fixed = Number(coupon.value);
    if (!Number.isInteger(fixed) || fixed < 1) {
      return { discount: 0, code, applied: false, reason: 'invalid_coupon' };
    }
    discount = fixed;
  } else {
    return { discount: 0, code, applied: false, reason: 'invalid_coupon' };
  }

  // Discount cannot exceed subtotal
  if (discount > subtotal) discount = subtotal;
  return { discount, code, applied: true, reason: null };
}

/**
 * Compute the full order money breakdown.
 *
 * Rules:
 * - subtotal = sum(unit_price * qty)
 * - discount applies to subtotal first (coupon logic)
 * - shipping added after discount
 * - total = subtotal - discount + shipping
 * - deposit = deposit_percentage * total / 100 (floored), only if payment_type === 'deposit' and product eligible
 * - balance = total - deposit (guarantees deposit + balance === total exactly)
 * - if payment_type === 'full': deposit = 0, balance = 0
 *
 * Returns { subtotal, discount, shipping_fee, total, deposit_amount, balance_amount, perItem: [...] }
 */
export function computeOrder({ items, products, shippingConfig, paymentType, depositPercent, couponResult, nowIso }) {
  if (!products || !products.products) throw new Error('products catalog not loaded');

  // Build item snapshot with server-side prices
  const perItem = [];
  let subtotal = 0;
  for (const it of items) {
    const found = findProductBySku(it.sku);
    if (!found) throw new Error(`unknown SKU: ${it.sku}`);
    const { product, variant } = found;
    if (!product.visible) throw new Error(`product not visible: ${it.sku}`);
    const unitPrice = product.price_pkr;
    const lineTotal = unitPrice * it.qty;
    subtotal += lineTotal;
    perItem.push({
      name: product.name,
      sku: it.sku,
      qty: it.qty,
      unit_price_pkr: unitPrice,
      line_total_pkr: lineTotal,
      category: product.category,
      deposit_eligible: !!product.deposit_eligible,
    });
  }

  // Coupon applied to subtotal
  let discount = 0;
  let couponCode = null;
  if (couponResult && couponResult.applied) {
    discount = couponResult.discount;
    couponCode = couponResult.code;
  }

  // Subtotal after discount (never negative)
  const subtotalAfterDiscount = Math.max(0, subtotal - discount);

  // Shipping
  const city = (items[0] && items[0]._city) || null;
  // NOTE: city is passed separately in practice; this is a fallback.
  const { fee: shippingFee, courier, est } = computeShipping(
    city || 'Other',
    subtotalAfterDiscount,
    shippingConfig
  );

  const total = subtotalAfterDiscount + shippingFee;

  // Deposit / balance split
  let depositAmount = 0;
  let balanceAmount = 0;
  if (paymentType === 'deposit') {
    const dp = Number(depositPercent);
    if (!Number.isInteger(dp) || dp < 1 || dp > 100) {
      throw new Error('invalid deposit percentage');
    }
    // Deposit applies to ALL items only if every item is deposit_eligible.
    // Per-product eligibility: brief says "which products are deposit-eligible".
    // We require the whole cart to be deposit-eligible for deposit option.
    const allEligible = perItem.every((x) => x.deposit_eligible);
    if (!allEligible) {
      throw new Error('deposit not eligible for this cart');
    }
    depositAmount = Math.floor((total * dp) / 100);
    if (depositAmount > total) depositAmount = total;
    balanceAmount = total - depositAmount; // guarantees deposit + balance == total
  } else if (paymentType === 'full') {
    depositAmount = 0;
    balanceAmount = 0;
  } else {
    throw new Error('invalid payment type');
  }

  return {
    subtotal,
    discount,
    shipping_fee: shippingFee,
    total,
    deposit_amount: depositAmount,
    balance_amount: balanceAmount,
    coupon_code: couponCode,
    courier,
    est,
    per_item: perItem,
  };
}

/**
 * Validate that deposit + balance === total exactly (money invariant).
 */
export function assertMoneyInvariant({ total, deposit_amount, balance_amount }) {
  if (deposit_amount + balance_amount !== total) {
    throw new Error(`money invariant violated: ${deposit_amount} + ${balance_amount} !== ${total}`);
  }
  if (deposit_amount < 0 || balance_amount < 0) {
    throw new Error('negative money amount');
  }
}
