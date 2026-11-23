/**
 * Payment gateway adapter for AASRA — Safepay (hosted checkout only).
 *
 * Protocol verified against Safepay's official Python SDK
 * (getsafepay/safepay-python, client.py — the Express Checkout flow):
 *
 *  1. Create a payment session (tracker):
 *       POST {base}/order/payments/v3/
 *       Headers: X-SFPY-MERCHANT-SECRET: {secret key}
 *       Body: { merchant_api_key: "sec_..." (public key), intent: "CYBERSOURCE",
 *               mode: "payment", currency: "PKR", amount: <paisa>,
 *               include_fees: false, metadata: { order_id } }
 *       Response: data.tracker.token  ("track_...")
 *  2. Create a short-lived auth token (TBT):
 *       POST {base}/client/passport/v1/token   (same secret header)
 *       Response: data = "<token string>"
 *  3. Hosted checkout URL (no network call):
 *       {checkoutBase}/embedded/?tbt=...&tracker=...&environment=sandbox
 *         &source=hosted&redirect_url=...&cancel_url=...&order_id=...
 *
 * Card data NEVER touches this Worker — customers pay on Safepay's hosted
 * checkout page. Amounts are sent in the LOWEST denomination (paisa).
 *
 * After payment, Safepay POSTs server-to-server to redirect_url with
 * { tracker, sig, ... } where sig = HMAC-SHA256 hex of the tracker token
 * keyed with the v1 secret. Only a verified signature settles an order.
 * Webhooks carry X-SFPY-SIGNATURE = HMAC-SHA512 hex of the raw body keyed
 * by the webhook shared secret (SHA-256 variant also accepted).
 *
 * Sandbox:  API + checkout both on sandbox.api.getsafepay.com
 * Live:     API api.getsafepay.com, checkout getsafepay.com
 *           (set SAFEPAY_BASE_URL / SAFEPAY_CHECKOUT_URL for production).
 */

// ---- Configuration (set via wrangler secrets / env vars) ----
export function gatewayConfig(env) {
  const baseUrl = env.SAFEPAY_BASE_URL || 'https://sandbox.api.getsafepay.com';
  const isSandbox = baseUrl.includes('sandbox');
  return {
    provider: env.PAYFAST_ENABLED === 'true' ? 'payfast' : 'safepay',
    enabled: env.SAFEPAY_ENABLED === 'true',
    baseUrl,
    // Sandbox serves API + checkout from the same host; live splits them.
    checkoutHost: env.SAFEPAY_CHECKOUT_URL || (isSandbox ? baseUrl : 'https://getsafepay.com'),
    environment: env.SAFEPAY_ENVIRONMENT || (isSandbox ? 'sandbox' : 'production'),
    protocolVerified: env.SAFEPAY_PROTOCOL_VERIFIED === 'true',
    // Public key ("sec_...") — sent as merchant_api_key when creating sessions.
    apiKey: env.SAFEPAY_API_KEY || '',
    // Secret key — sent as X-SFPY-MERCHANT-SECRET on every API call.
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

async function safepayPost(cfg, path, body) {
  const response = await fetch(`${cfg.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'X-SFPY-MERCHANT-SECRET': cfg.secretKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`safepay_api_http_${response.status}`);
  const json = await response.json();
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('safepay_response_unexpected');
  }
  return json.data;
}

/**
 * Create a hosted checkout session (Safepay Express Checkout).
 * Returns { provider, checkoutUrl, trackerToken, amount, currency, expiresAt }.
 * @param {object} env
 * @param {object} params { orderId, amountPkr, currency, customerEmail, customerPhone, reference, description, kind }
 */
export async function createCheckoutSession(env, params) {
  const cfg = gatewayConfig(env);
  // Never manufacture a tracker or a same-site URL: that would look like a
  // successful payment session even though no gateway was contacted.
  if (!cfg.enabled || !cfg.secretKey || !cfg.apiKey) throw new Error('safepay_not_configured');
  if (!cfg.protocolVerified) throw new Error('safepay_protocol_not_verified');
  assertHttps(cfg.baseUrl, 'safepay_api_url');
  assertHttps(cfg.checkoutHost, 'safepay_checkout_url');

  const amountPaisa = Math.round(Number(params.amountPkr) * 100);
  if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) throw new Error('safepay_amount_invalid');
  const currency = params.currency || 'PKR';
  const orderId = String(params.orderId);

  // 1. Payment session (tracker).
  const session = await safepayPost(cfg, '/order/payments/v3/', {
    merchant_api_key: cfg.apiKey,
    intent: 'CYBERSOURCE',
    mode: 'payment',
    currency,
    amount: amountPaisa,
    include_fees: false,
    metadata: { order_id: orderId },
  });
  const trackerToken = session && session.tracker && session.tracker.token;
  if (!trackerToken) throw new Error('safepay_response_missing_tracker');

  // 2. Short-lived auth token (TBT) for the hosted page.
  const tbt = await safepayPost(cfg, '/client/passport/v1/token');
  if (typeof tbt !== 'string' || !tbt) throw new Error('safepay_response_missing_auth_token');

  // 3. Hosted checkout URL (pure string building — no network call).
  const hostedUrl = new URL('/embedded/', cfg.checkoutHost);
  hostedUrl.searchParams.set('tbt', tbt);
  hostedUrl.searchParams.set('tracker', String(trackerToken));
  hostedUrl.searchParams.set('environment', cfg.environment);
  hostedUrl.searchParams.set('source', 'hosted');
  hostedUrl.searchParams.set('redirect_url', `${cfg.returnUrl}/api/safepay-return`);
  hostedUrl.searchParams.set('cancel_url', `${cfg.returnUrl}/payment-cancelled?order=${encodeURIComponent(orderId)}`);
  hostedUrl.searchParams.set('order_id', orderId);

  return {
    provider: 'safepay',
    checkoutUrl: hostedUrl.toString(),
    trackerToken: String(trackerToken),
    amount: Math.round(Number(params.amountPkr)),
    currency,
    expiresAt: (session.tracker && session.tracker.expires_at) || null,
  };
}

/**
 * Verify a webhook signature (X-SFPY-SIGNATURE over the raw request body).
 * Safepay signs with HMAC-SHA512; the SHA-256 variant is also accepted for
 * endpoints configured differently. Both are checked against the webhook
 * shared secret and compared constant-time.
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

/**
 * Read a payment's state straight from Safepay. Used when a webhook never
 * arrives. Same endpoint and header as the Safepay SDK's fetch_payment:
 * GET /reporter/api/v1/payments/{tracker}, authenticated with the merchant secret.
 * Returns { state, amount }. amount is null when Safepay does not report one.
 */
export async function fetchTrackerState(env, trackerToken) {
  const cfg = gatewayConfig(env);
  if (!cfg.enabled || !cfg.secretKey) throw new Error('safepay_not_configured');
  if (!trackerToken) throw new Error('tracker_required');
  const response = await fetch(
    `${cfg.baseUrl}/reporter/api/v1/payments/${encodeURIComponent(String(trackerToken))}`,
    {
      method: 'GET',
      headers: { 'X-SFPY-MERCHANT-SECRET': cfg.secretKey, Accept: 'application/json' },
    }
  );
  if (!response.ok) throw new Error(`safepay_api_http_${response.status}`);
  const json = await response.json();
  const root = json && typeof json === 'object' ? (json.data && typeof json.data === 'object' ? json.data : json) : {};
  const tracker = root.tracker && typeof root.tracker === 'object' ? root.tracker : {};
  const state = typeof tracker.state === 'string' ? tracker.state : null;
  const rawAmount = tracker.amount ?? root.amount ?? null;
  return { state, amount: rawAmount == null ? null : Number(rawAmount) };
}
