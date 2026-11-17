/**
 * Smoke test for AASRA against a running `wrangler dev` server.
 *
 * Usage:
 *   npx wrangler dev --port 8787   # in one terminal
 *   BASE_URL=http://127.0.0.1:8787 node scripts/smoke-worker.mjs
 */

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787';
const ALLOWED_PREVIEW = 'https://aasra.shanzeeey.workers.dev';

let failed = 0;
function check(name, cond, detail = '') {
  if (!cond) failed++;
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
}

// 1. Static homepage served from assets
let res = await fetch(BASE + '/');
let text = await res.text();
check('GET / serves homepage (200 HTML)', res.status === 200 && /<html/i.test(text), `status ${res.status}, ${text.length} bytes`);

// 1b. The homepage must link a stylesheet that actually resolves and contains CSS.
//     (Regression guard: a bad href here means the whole site ships unstyled.)
const cssHref = (text.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/) || [])[1];
if (cssHref) {
  const cssRes = await fetch(BASE + cssHref);
  const cssBody = await cssRes.text();
  check(
    `stylesheet ${cssHref} resolves (200, text/css, non-empty)`,
    cssRes.status === 200 &&
      (cssRes.headers.get('Content-Type') || '').includes('text/css') &&
      cssBody.includes('{') &&
      cssBody.length > 1000,
    `status ${cssRes.status}, type ${cssRes.headers.get('Content-Type')}, ${cssBody.length} bytes`
  );
} else {
  check('homepage links a stylesheet', false, 'no rel="stylesheet" link found in head');
}

// 2. Static product page served from assets
res = await fetch(BASE + '/shop');
text = await res.text();
check('GET /shop serves static page', res.status === 200 && /<html/i.test(text), `status ${res.status}`);

// 3. Unknown path -> 404 page (not_found_handling = 404-page)
res = await fetch(BASE + '/this-page-does-not-exist');
text = await res.text();
check('unknown path returns 404 page', res.status === 404 && /<html/i.test(text), `status ${res.status}`);

// 4. GET /api/csrf-token — middleware passes, handler responds
res = await fetch(BASE + '/api/csrf-token');
let body = await res.json().catch(() => null);
const csrfToken = body?.csrf_token || '';
const csrfCookie = (res.headers.get('Set-Cookie') || '').split(';')[0];
check('GET /api/csrf-token returns 200 JSON', res.status === 200 && !!body, `status ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
check(
  'csrf-token response has no-store cache header',
  (res.headers.get('Cache-Control') || '').includes('no-store'),
  String(res.headers.get('Cache-Control'))
);

// 5. POST /api/checkout with disallowed origin -> 403 origin not allowed
res = await fetch(BASE + '/api/checkout', {
  method: 'POST',
  headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
  body: '{}',
});
body = await res.json().catch(() => null);
check('checkout evil origin -> 403', res.status === 403, `status ${res.status} ${JSON.stringify(body)}`);

// 6. POST /api/checkout from allowed preview origin but no CSRF token -> 403 csrf
res = await fetch(BASE + '/api/checkout', {
  method: 'POST',
  headers: { Origin: ALLOWED_PREVIEW, 'Content-Type': 'application/json' },
  body: '{}',
});
body = await res.json().catch(() => null);
check(
  'checkout allowed origin, no CSRF -> 403 csrf',
  res.status === 403 && /csrf/.test(String(body && body.error)),
  `status ${res.status} ${JSON.stringify(body)}`
);

// 6b. Even with valid same-origin CSRF, checkout must fail closed before
// touching inventory when production D1/payment configuration is absent.
res = await fetch(BASE + '/api/checkout', {
  method: 'POST',
  headers: {
    Origin: 'https://aasra.shop',
    Cookie: csrfCookie,
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ cart: [], payment_type: 'full', customer: {}, turnstile_token: 'test-token' }),
});
body = await res.json().catch(() => null);
check('checkout without D1 fails closed with 503', res.status === 503 && body?.code === 'configuration_missing', `status ${res.status} ${JSON.stringify(body)}`);

// 7. POST /api/webhook with NO Origin header -> passes middleware (gateway case)
res = await fetch(BASE + '/api/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
text = await res.text();
check('webhook without Origin is not blocked by middleware', !text.includes('origin not allowed'), `status ${res.status}`);

// 8. OPTIONS preflight
res = await fetch(BASE + '/api/checkout', { method: 'OPTIONS', headers: { Origin: 'https://aasra.shop' } });
check('preflight returns 204', res.status === 204, `status ${res.status}`);

console.log(failed === 0 ? '\nAll smoke checks passed.' : `\n${failed} smoke check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
