/**
 * POST /api/newsletter
 *
 * Newsletter signup with consent. Stored privately in D1 (never in repo).
 * Rate-limited via WAF.
 */

import { isValidEmail, sanitizeString } from '../lib/validation.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function errorResponse(message, status = 400, code) {
  return jsonResponse({ ok: false, error: message, code }, status);
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse('invalid_json', 400, 'invalid_json');
  }

  const { email, consent } = body;

  if (!isValidEmail(email)) {
    return errorResponse('invalid email address', 400, 'invalid_email');
  }
  if (consent !== true) {
    return errorResponse('consent required', 400, 'consent_required');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const now = new Date().toISOString();

  try {
    await context.env.DB.prepare(
      `INSERT INTO newsletter (id, email, source, subscribed_at) VALUES (?, ?, ?, ?)`
    ).bind(makeId('nl'), normalizedEmail, 'website', now).run();
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      // Already subscribed — idempotent
      return jsonResponse({ ok: true, message: 'already_subscribed' });
    }
    return errorResponse('signup_failed', 500, 'db_error');
  }

  return jsonResponse({ ok: true, message: 'subscribed' });
}
