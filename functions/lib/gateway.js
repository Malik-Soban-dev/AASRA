/**
 * Payment gateway adapter for AASRA — Safepay (hosted checkout only).
 *
 * Protocol verified against Safepay's merchant documentation (2026-11):
 *  - Sessions are "trackers": POST {base}/tracker/v1/ authenticated with the
 *    X-SFPY-MERCHANT-SECRET header (the secret key). Card data NEVER touches
 *    this Worker — customers pay on Safepay's hosted checkout page.
 *  - Amounts are sent in the LOWEST denomination (paisa = PKR × 100).
 *  - Hosted checkout URL: {checkoutHost}/checkout?token={tracker}.
 *  - After payment, Safepay makes a server-to-server POST to redirect_url with
 *    { tracker, token, orderId, ref, sig } where sig = HMAC-SHA256 hex of the
 *    tracker token keyed with the v1 secret. The browser redirect is
 *    informational; only a verified signature settles an order.
 *  - Webhooks carry X-SFPY-SIGNATURE over the raw body (HMAC-SHA512 or
 *    HMAC-SHA256 depending on endpoint configuration; both are accepted,
 *    keyed by the webhook shared secret, compared constant-time).
 *
 * Sandbox: sandbox.api.getsafepay.com / sandbox.getsafepay.com
 * Live:    api.getsafepay.com / getsafepay.com  (set SAFEPAY_BASE_URL +
 *          SAFEPAY_CHECKOUT_URL for production; keep sandbox for testing).
 */

// ---- Configuration (set via wrangler secrets / env vars) ----
export function gatewayConfig(env) {
  const baseUrl = env.SAFEPAY_BASE_URL || 'https://sandbox.api.getsafepay.com';
  return {
    provider: env.PAYFAST_ENABLED === 'true' ? 'payfast' : 'safepay',
    enabled: env.SAFEPAY_ENABLED === 'true',
    baseUrl,
    checkoutHost: env.SAFEPAY_CHECKOUT_URL || 'https://sandbox.getsafepay.com',
    trackerEndpoint: env.SAFEPAY_CHECKOUT_ENDPOINT || `${baseUrl}/tracker/v1/`,
    protocolVerified: env.SAFEPAY_PROTOCOL_VERIFIED === 'true',
    secretKey: env.SAFEPAY_SECRET_KEY || '',
    // The "v1 secret" signs the payment-return POST. Older accounts use the
    // secret key for this; a dedicated SAFEPAY_V1_SECRET takes precedence.
    v1Secret: env.SAFEPAY_V1_SECRET || env.SAFEPAY_SECRET_KEY || '',
    webhookSecret: env.SAFEPAY_WEBHOOK_SECRET || '',
    returnUrl: env.PUBLIC_BASE_URL || 'https://aasra.shop',
  };
}

function assertHttps(url, label) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label}_invalid`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${label}_must_use_https`);
  return parsed;
}

function hmacHex(secret, data, hash) {
  return crypto.subtle
    .importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash }, false, ['sign'])
    .then((key) => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)))
    .then((sig) => Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join(''));
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Create a hosted checkout session (Safepay tracker).
 * Returns { provider, checkoutUrl, trackerToken, amount, currency, expiresAt }.
 * @param {object} env
 * @param {object} params { orderId, amountPkr, currency, customerEmail, customerPhone, reference, description, kind }
 */
export async function createCheckoutSession(env, params) {
  const cfg = gatewayConfig(env);
  // Never manufacture a tracker or a same-site URL: that would look like a
  // successful payment session even though no gateway was contacted.
  if (!cfg.enabled || !cfg.secretKey) throw new Error('safepay_not_configured');
  if (!cfg.protocolVerified) throw new Error('safepay_protocol_not_verified');
  assertHttps(cfg.trackerEndpoint, 'safepay_checkout_endpoint');
  const checkoutHost = assertHttps(cfg.checkoutHost, 'safepay_checkout_url');

  const amountPaisa = Math.round(Number(params.amountPkr) * 100);
  if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) throw new Error('safepay_amount_invalid');

  const response = await fetch(cfg.trackerEndpoint, {
    method: 'POST',
    headers: {
      'X-SFPY-MERCHANT-SECRET': cfg.secretKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      order: { reference: params.reference || params.orderId },
      invoice: { amount: amountPaisa, currency: params.currency || 'PKR' },
      redirect_url: `${cfg.returnUrl}/api/safepay/return`,
      cancel_url: `${cfg.returnUrl}/payment-cancelled?order=${encodeURIComponent(params.orderId)}`,
      webhook: true,
    }),
  });
  if (!response.ok) throw new Error(`safepay_session_http_${response.status}`);
  const data = await response.json();
  const body = data.data || data;
  const trackerToken = body.token || body.tracker || body.tracker_token;
  if (!trackerToken) throw new Error('safepay_response_missing_tracker');

  const hostedUrl = new URL('/checkout', cfg.checkoutHost);
  hostedUrl.searchParams.set('token', String(trackerToken));
  return {
    provider: 'safepay',
    checkoutUrl: hostedUrl.toString(),
    trackerToken: String(trackerToken),
    amount: Math.round(Number(params.amountPkr)),
    currency: params.currency || 'PKR',
    expiresAt: body.expires_at || null,
  };
}

/**
 * Verify a webhook signature (X-SFPY-SIGNATURE over the raw request body).
 * Safepay endpoints sign with HMAC-SHA512 or HMAC-SHA256 depending on
 * configuration; both are checked against the webhook shared secret and
 * compared constant-time.
 */
export async function verifyWebhookSignature(env, rawBody, signature) {
  const cfg = gatewayConfig(env);
  const secret = cfg.webhookSecret;
  // Authentication depends only on the shared secret — not on feature flags —
  // so in-flight payments still settle if the adapter is later disabled.
  if (!secret || !signature) return false;

  const clean = String(signature).replace(/^sha(256|512)=/i, '').toLowerCase();
  const bodyStr = typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody);
  try {
    const h512 = await hmacHex(secret, bodyStr, 'SHA-512');
    const h256 = await hmacHex(secret, bodyStr, 'SHA-256');
    return timingSafeEqual(h512, clean) || timingSafeEqual(h256, clean);
  } catch {
    return false;
  }
}

/**
 * Verify the signed server-to-server payment return:
 * sig = HMAC-SHA256 hex of the tracker token keyed with the v1 secret.
 */
export async function verifyRedirectSignature(env, trackerToken, signature) {
  const cfg = gatewayConfig(env);
  if (!cfg.v1Secret || !trackerToken || !signature) return false;
  const clean = String(signature).replace(/^sha256=/i, '').toLowerCase();
  try {
    const expected = await hmacHex(cfg.v1Secret, String(trackerToken), 'SHA-256');
    return timingSafeEqual(expected, clean);
  } catch {
    return false;
  }
}

/**
 * Refund a payment via the gateway API (used for cancellations/refunds).
 * TODO: implement against Safepay's refunds endpoint when needed.
 */
export async function refundPayment(env, { trackerToken, amountPkr, reason }) {
  throw new Error('refund_payment_not_implemented');
}
