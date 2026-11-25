/**
 * POST /api/contact
 *
 * Contact form. Validates Turnstile, sanitizes input, sends email.
 * Rate-limited via WAF (configured in _headers / wrangler).
 */

import { sendEmail, escapeHtml } from '../lib/email.js';
import { validateCart } from '../lib/validation.js'; // unused import, kept for pattern consistency
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

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse('invalid_json', 400, 'invalid_json');
  }

  const { name, email, phone, subject, message, turnstile_token } = body;

  const missing = [];
  if (!sanitizeString(name, 100)) missing.push('name');
  if (!isValidEmail(email)) missing.push('email');
  if (!sanitizeString(message, 2000)) missing.push('message');
  if (!turnstile_token) missing.push('turnstile_token');
  if (missing.length) {
    return errorResponse(`missing_fields: ${missing.join(', ')}`, 400, 'missing_fields');
  }

  // Turnstile: fail closed. Without the secret the form cannot check for a human (KNOWN_ISSUES #8).
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return errorResponse('turnstile_not_configured', 503, 'turnstile_not_configured');
  }
  if (secret) {
    try {
      const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(turnstile_token)}`,
      });
      const result = await resp.json();
      if (!result.success) {
        return errorResponse('turnstile verification failed', 403, 'turnstile_failed');
      }
    } catch (e) {
      return errorResponse('turnstile_request_failed', 502, 'turnstile_error');
    }
  }

  const customerEmail = sanitizeString(email, 254);
  const customerName = sanitizeString(name, 100);
  const customerPhone = (sanitizeString(phone, 50) || '').replace(/\s|-|\(|\)|\./g, '');
  const customerSubject = sanitizeString(subject, 200) || 'Contact form';
  const customerMessage = sanitizeString(message, 2000);

  const baseUrl = env.PUBLIC_BASE_URL || 'https://aasra.shop';

  const businessTo = env.BUSINESS_EMAIL || env.EMAIL_FROM;
  if (!businessTo) {
    return errorResponse('contact_not_configured', 503, 'contact_not_configured');
  }
  try {
    await sendEmail(env, {
      to: businessTo,
      subject: `[Contact] ${customerSubject}`,
      html: `
        <h1>Contact form submission</h1>
        <p><strong>Name:</strong> ${escapeHtml(customerName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(customerEmail)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(customerPhone || 'not provided')}</p>
        <p><strong>Subject:</strong> ${escapeHtml(customerSubject)}</p>
        <p><strong>Message:</strong><br/>${escapeHtml(customerMessage).replace(/\n/g, '<br/>')}</p>
      `,
    });
    // Auto-reply to customer
    await sendEmail(env, {
      to: customerEmail,
      subject: `We received your message — AASRA`,
      html: `
        <h1>Thank you, ${escapeHtml(customerName)}</h1>
        <p>We received your message and will respond soon.</p>
        <p>You can also reach us on Email or at ${escapeHtml(businessTo)}.</p>
      `,
    });
  } catch (e) {
    return errorResponse('email_send_failed', 502, 'email_error');
  }

  return jsonResponse({ ok: true, message: 'message_sent' });
}
