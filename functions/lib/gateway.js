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
    provider: env.PAYFAST_ENABLED === 'true' ? 'payfast' : 'safepay',
    enabled: env.SAFEPAY_ENABLED === 'true',
    baseUrl: env.SAFEPAY_BASE_URL || '',
    checkoutEndpoint: env.SAFEPAY_CHECKOUT_ENDPOINT || '',
    protocolVerified: env.SAFEPAY_PROTOCOL_VERIFIED === 'true',
    secretKey: env.SAFEPAY_SECRET_KEY || '',
    webhookSecret: env.SAFEPAY_WEBHOOK_SECRET || '',
    returnUrl: env.PUBLIC_BASE_URL || 'https://aasra.shop',
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
  // Never manufacture a tracker or a same-site URL: that would look like a
  // successful payment session even though no gateway was contacted.
  if (!cfg.enabled || !cfg.secretKey || !cfg.checkoutEndpoint) {
    throw new Error('safepay_not_configured');
  }
  // Safepay's merchant API contract (endpoint, authentication and response
  // fields) must be confirmed with the merchant account before enabling calls.
  // This guard intentionally keeps payment disabled until that confirmation is
  // supplied in Worker configuration.
  if (!cfg.protocolVerified) throw new Error('safepay_protocol_not_verified');
  let endpoint;
  try {
    endpoint = new URL(cfg.checkoutEndpoint);
  } catch {
    throw new Error('safepay_checkout_endpoint_invalid');
  }
  if (endpoint.protocol !== 'https:') throw new Error('safepay_checkout_endpoint_must_use_https');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      merchant_reference: params.reference,
      amount: Math.round(params.amountPkr),
      currency: params.currency || 'PKR',
      customer_email: params.customerEmail,
      customer_phone: params.customerPhone,
      description: params.description || `AASRA order ${params.orderId}`,
      success_url: `${cfg.returnUrl}/order-success?order=${encodeURIComponent(params.orderId)}`,
      cancel_url: `${cfg.returnUrl}/payment-cancelled?order=${encodeURIComponent(params.orderId)}`,
      webhook_url: `${cfg.returnUrl}/api/webhook`,
      payment_type: params.kind,
    }),
  });
  if (!response.ok) throw new Error(`safepay_session_http_${response.status}`);
  const data = await response.json();
  const checkoutUrl = data.checkout_url || data.redirect_url || data.url;
  const trackerToken = data.tracker_token || data.token || data.reference;
  if (!checkoutUrl || !trackerToken) throw new Error('safepay_response_missing_checkout_fields');
  let hostedUrl;
  try { hostedUrl = new URL(checkoutUrl); } catch { throw new Error('safepay_checkout_url_invalid'); }
  if (hostedUrl.protocol !== 'https:') throw new Error('safepay_checkout_url_must_use_https');
  return {
    provider: 'safepay',
    checkoutUrl: hostedUrl.toString(),
    trackerToken: String(trackerToken),
    amount: Math.round(params.amountPkr),
    currency: params.currency || 'PKR',
    expiresAt: data.expires_at || null,
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
  if (!cfg.enabled || !cfg.protocolVerified || !secret || !signature) return false;

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
