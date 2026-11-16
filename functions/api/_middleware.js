/**
 * Middleware for all /api/* routes.
 *
 * - CORS restricted to the merchant domain (ALLOWED_ORIGIN).
 * - CSRF protection (double-submit cookie): state-changing requests must
 *   send X-CSRF-Token matching the csrf_token cookie.
 * - Origin validation for state-changing requests.
 * - Security headers for JSON endpoints.
 * - Rate limiting is enforced by Cloudflare WAF at the zone level
 *   (see wrangler.toml + README for the WAF rule config).
 */

export async function onRequest(context) {
  const { request, env, next } = context;
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const origin = request.headers.get('Origin') || '';
  const method = request.method;

  // --- CORS preflight ---
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token, X-SFPY-SIGNATURE',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // --- Origin validation for state-changing requests ---
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (isStateChanging && allowedOrigin !== '*') {
    if (!origin || origin !== allowedOrigin) {
      return new Response(JSON.stringify({ ok: false, error: 'origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin },
      });
    }
  }

  // --- CSRF protection (double-submit cookie) ---
  // Webhook is exempt (it's authenticated by signature, not cookies).
  const isWebhook = request.url.includes('/api/webhook');
  if (isStateChanging && !isWebhook && allowedOrigin !== '*') {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookieMatch = cookieHeader.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    const cookieToken = cookieMatch ? cookieMatch[1] : '';
    const headerToken = request.headers.get('X-CSRF-Token') || '';
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return new Response(JSON.stringify({ ok: false, error: 'csrf token missing or mismatched' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin },
      });
    }
  }

  const response = await next();

  // Apply CORS + security headers to all API responses
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  return response;
}
