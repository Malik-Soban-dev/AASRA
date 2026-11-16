/**
 * GET /api/csrf-token
 *
 * Returns a CSRF token that the frontend echoes back as the X-CSRF-Token
 * header on state-changing requests. The token is also set as a SameSite
 * cookie so cross-site origins cannot read it (double-submit pattern).
 *
 * This endpoint itself is idempotent and safe to call from the same origin.
 */

// Web Crypto API (available in Node 22 and Cloudflare Workers)

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequestGet(context) {
  const { env, request } = context;

  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const origin = request.headers.get('Origin') || '';
  // Only issue tokens to our own origin
  if (allowedOrigin !== '*' && origin !== allowedOrigin) {
    return jsonResponse({ ok: false, error: 'origin not allowed' }, 403);
  }

  const buf = new Uint8Array(24); crypto.getRandomValues(buf); const token = Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');

  return new Response(JSON.stringify({ ok: true, csrf_token: token }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
      // SameSite=Strict: cookie is not sent on cross-site requests
      'Set-Cookie': `csrf_token=${token}; Path=/; SameSite=Strict; Secure`,
    },
  });
}
