/**
 * Payment gateway adapter for AASRA.
 *
 * PRIMARY GATEWAY: Safepay (hosted checkout only).
 * ALTERNATIVE: PayFast (same interface, different credentials/endpoints).
 *
 * IMPORTANT: Card data NEVER touches this Worker or the frontend — all payments
 * happen on the gateway's hosted checkout page.
 *
 * VERIFY BEFORE LIVE (get answers in writing from Safepay):
 *  - Base URL and exact endpoints for creating a checkout session.
 *  - Authentication method (API key in header? Basic auth?).
 *  - Request/response shape for session creation (amount, currency, reference, return/cancel URLs, webhook URL).
 *  - Signature method for webhooks (brief says X-SFPY-SIGNATURE on raw body) — confirm header name and algorithm (HMAC-SHA256?).
 *  - Whether two separate payments per order (deposit + balance) are supported.
 *  - Minimum amount per payment, fees, session expiry, retry behavior.
 *  - Refund / partial-refund API, chargeback handling, settlement timeline.
 *  - Merchant onboarding documents and required website policy pages.
 *  - IP allowlist for webhooks (if any).
 *
 * The functions below use placeholder endpoints. Replace with Safepay's real API.
 */

// ---- Configuration (set via wrangler secrets / env vars) ----
export function gatewayConfig(env) {
  return {
    provider: (env.SAFEPAY_ENABLED === 'true' || !env.PAYFAST_ENABLED) ? 'safepay' : 'payfast',
    baseUrl: env.SAFEPAY_BASE_URL || 'https://api.safepay.example.com/v1',
    secretKey: env.SAFEPAY_SECRET_KEY || '',
    webhookSecret: env.SAFEPAY_WEBHOOK_SECRET || '',
    returnUrl: env.PUBLIC_BASE_URL || 'https://shop.example.com',
  };
}

/**
 * Create a hosted checkout session with the gateway.
 * Returns { checkoutUrl, trackerToken, expiresAt }.
 *
 * @param {object} env
 * @param {object} params { orderId, amountPkr, currency, customerEmail, customerPhone, reference, description, kind }
 */
export async function createCheckoutSession(env, params) {
  const cfg = gatewayConfig(env);
  const amount = Math.round(params.amountPkr);

  // TODO: Replace with Safepay's real session-create request once verified.
  // Example shape (placeholder — DO NOT use in production until confirmed):
  const body = JSON.stringify({
    merchant_reference: params.reference, // our order id
    amount,
    currency: params.currency || 'PKR',
    customer_email: params.customerEmail,
    customer_phone: params.customerPhone,
    description: params.description || `AASRA order ${params.orderId}`,
    success_url: `${cfg.returnUrl}/order-success?order=${params.orderId}`,
    cancel_url: `${cfg.returnUrl}/payment-cancelled?order=${params.orderId}`,
    webhook_url: `${cfg.returnUrl}/api/webhook`,
    payment_type: params.kind, // 'full' | 'deposit' | 'balance'
    expiry_minutes: 60,
  });

  // Placeholder: simulate a gateway response. In production, fetch(cfg.baseUrl + '/checkout/sessions', ...)
  const trackerToken = `sp_${params.orderId}_${params.kind}_${Date.now()}`;
  const checkoutUrl = `${cfg.returnUrl}/gateway/checkout?token=${encodeURIComponent(trackerToken)}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    provider: cfg.provider,
    checkoutUrl,
    trackerToken,
    amount,
    currency: params.currency || 'PKR',
    expiresAt,
    raw: body, // keep for debugging (do not log secrets)
  };
}

/**
 * Verify a webhook signature from the gateway.
 * Safepay: signature sent in X-SFPY-SIGNATURE header over the raw request body.
 *
 * @param {object} env
 * @param {string} rawBody - the raw request body (string or ArrayBuffer)
 * @param {string} signature - the signature header value
 * @returns {boolean}
 */
export async function verifyWebhookSignature(env, rawBody, signature) {
  const cfg = gatewayConfig(env);
  const secret = cfg.webhookSecret;
  if (!secret || !signature) return false;

  // TODO: Confirm Safepay's exact algorithm. Common: HMAC-SHA256 hex of raw body.
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const bodyData = typeof rawBody === 'string' ? encoder.encode(rawBody) : rawBody;
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, bodyData);
    const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');

    // Constant-time comparison
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  } catch (e) {
    return false;
  }
}

/**
 * Refund a payment via the gateway API (used for cancellations/refunds).
 * TODO: Implement once Safepay refund API is verified.
 */
export async function refundPayment(env, { trackerToken, amountPkr, reason }) {
  // Placeholder — implement against Safepay refunds endpoint.
  throw new Error('refund_payment_not_implemented');
}
