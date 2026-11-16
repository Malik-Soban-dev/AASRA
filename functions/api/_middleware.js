/**
 * Middleware for all /api/* routes.
 *
 * - CORS restricted to the merchant domain (VERIFY: set ALLOWED_ORIGIN to your production domain).
 * - Basic security headers for JSON endpoints.
 * - Rate limiting is enforced by Cloudflare WAF at the zone level (see README + wrangler.toml).
 */

export async function onRequest(context) {
  const { request } = context;
  const allowedOrigin = context.env.ALLOWED_ORIGIN || '*';
  const origin = request.headers.get('Origin') || '';

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-SFPY-SIGNATURE',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const response = await context.next();

  // Apply CORS + security headers to all API responses
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  return response;
}
