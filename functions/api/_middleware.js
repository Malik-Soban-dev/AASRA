/**
 * Middleware for all /api/* routes.
 *
 * - CORS restricted to the merchant origin(s) (ALLOWED_ORIGIN; comma-separated
 *   list supported, e.g. production + workers.dev preview).
 * - CSRF protection (double-submit cookie): state-changing requests must
 *   send X-CSRF-Token matching the csrf_token cookie.
 * - Origin validation for state-changing requests.
 * - Security headers for JSON endpoints.
 * - Rate limiting is enforced by Cloudflare WAF at the zone level
 *   (see wrangler.toml + README for the WAF rule config).
 */

export async function onRequest(context) {
  const { request, env, next } = context;
  const allowedOrigins = (env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowAll = allowedOrigins.includes('*');
  const origin = request.headers.get('Origin') || '';
  const method = request.method;

  // Gateway callbacks are matched by exact path (KNOWN_ISSUES #19). They are
  // server-to-server POSTs authenticated by HMAC inside the handler, so they
  // carry no Origin and no cookie.
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const isWebhook = path === '/api/webhook';
  const isSafepayReturn = path === '/api/safepay-return';
  const isGatewayCallback = isWebhook || isSafepayReturn;

  // Fail closed: an unset or wildcard ALLOWED_ORIGIN is a misconfiguration.
  // Refuse every browser-facing API call until it is fixed (KNOWN_ISSUES #31).
  if (allowAll && !isGatewayCallback) {
    return new Response(JSON.stringify({ ok: false, error: 'origin_not_configured', code: 'origin_not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  // Echo the requesting origin when allowed; otherwise fall back to the first
  // configured origin. (Credentials + '*' is invalid per the CORS spec, so
  // never return '*' when credentials are enabled.)
  const corsOrigin = allowAll
    ? '*'
    : origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0] || '';

  // --- CORS preflight ---
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token, X-SFPY-SIGNATURE',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // --- Origin validation for state-changing requests ---
  // Webhook is exempt (it's authenticated by HMAC signature, not browser
  // origin — gateway servers POST without an Origin header). The Safepay
  // signed return (/api/safepay-return) is exempt for the same reason: it's
  // a server-to-server POST authenticated by HMAC signature inside the
  // function, and it carries no Origin header or cookies.
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (isStateChanging && !isWebhook && !isSafepayReturn && !allowAll) {
    if (!origin || !allowedOrigins.includes(origin)) {
      return new Response(JSON.stringify({ ok: false, error: 'origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin },
      });
    }
  }

  // --- CSRF protection (double-submit cookie) ---
  // Webhook and the Safepay signed return are exempt (both are authenticated
  // by HMAC signature, not cookies).
  if (isStateChanging && !isWebhook && !isSafepayReturn && !allowAll) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookieMatch = cookieHeader.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    const cookieToken = cookieMatch ? cookieMatch[1] : '';
    const headerToken = request.headers.get('X-CSRF-Token') || '';
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return new Response(JSON.stringify({ ok: false, error: 'csrf token missing or mismatched' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin },
      });
    }
  }

  const response = await next();

  // Apply CORS + security headers to all API responses
  response.headers.set('Access-Control-Allow-Origin', corsOrigin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  return response;
}
