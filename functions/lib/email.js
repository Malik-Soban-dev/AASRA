/**
 * Transactional email layer for AASRA.
 * Called from the Worker, sending from the merchant's domain.
 *
 * PROVIDER: choose one (Resend, Mailgun, SendGrid, Postmark, Amazon SES).
 * VERIFY with an accountant/lawyer: tax & invoice rules, required footer content.
 *
 * Set via wrangler secrets: EMAIL_PROVIDER_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME.
 * The provider below is intentionally a stub with a Resend-shaped interface.
 * Replace `send()` with the real provider once credentials are available.
 * Never log full email bodies (they contain customer PII).
 */

export function emailConfig(env) {
  return {
    provider: env.EMAIL_PROVIDER || 'resend',
    apiKey: env.EMAIL_PROVIDER_API_KEY || '',
    from: env.EMAIL_FROM || 'orders@example.com',
    fromName: env.EMAIL_FROM_NAME || 'AASRA',
    baseUrl: env.PUBLIC_BASE_URL || 'https://aasra.shop',
  };
}

/**
 * Send a transactional email.
 * Returns { ok: boolean, messageId?: string, error?: string }.
 * Logs only metadata (recipient domain, subject) — never full body/PII.
 */
export async function sendEmail(env, { to, subject, html, text }) {
  const cfg = emailConfig(env);

  // Metadata-only log (no PII in logs)
  const domain = String(to || '').split('@')[1] || 'unknown';
  console.log('[EMAIL]', { to: domain, subject, provider: cfg.provider });

  if (!cfg.apiKey) {
    console.log('[EMAIL STUB]', { to: domain, subject, from: cfg.from });
    return { ok: true, messageId: 'stub-' + Date.now(), warning: 'no_email_provider_configured' };
  }

  // Real provider call (Resend example — uncomment and adjust once verified):
  /*
  const resp = await fetch(`${cfg.baseUrl}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${cfg.fromName} <${cfg.from}>`,
      to,
      subject,
      html,
      text,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    return { ok: false, error: `provider_${resp.status}: ${err}` };
  }
  const data = await resp.json();
  return { ok: true, messageId: data.id };
  */

  return { ok: false, error: 'email_provider_not_implemented' };
}

/* ---------------------------------------------------------------- helpers */

function money(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function invoiceLink(env, orderId, token, type) {
  return `${env.PUBLIC_BASE_URL || 'https://aasra.shop'}/api/invoice?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}&type=${type}`;
}

function lookupLink(env) {
  return `${env.PUBLIC_BASE_URL || 'https://aasra.shop'}/order-lookup`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fromEmail(env) {
  return env.EMAIL_FROM || 'orders@example.com';
}

/* ---------------------------------------------------------------- templates */

/**
 * Order received (after checkout creates the order, before payment).
 */
export function orderReceivedEmail({ order, env }) {
  const b = env.PUBLIC_BASE_URL || 'https://aasra.shop';
  const payLink =
    order.payment_type === 'deposit' && order.balance_amount > 0
      ? invoiceLink(env, order.id, order.balance_token, 'deposit')
      : null;
  return {
    subject: `Order received — ${order.id}`,
    html: `
      <p>Hello ${escapeHtml(order.customer_name)},</p>
      <p>Thank you for your order <span class="hl">${escapeHtml(order.id)}</span>.</p>
      <p>Order total: <span class="hl">${money(order.total)}</span></p>
      ${order.payment_type === 'deposit'
        ? `<p>Deposit paid: <span class="hl">${money(order.deposit_amount)}</span><br/>
           Balance due: <span class="hl">${money(order.balance_amount)}</span> — pay online before shipping.</p>
           ${payLink ? `<p><a href="${payLink}">View deposit receipt</a></p>` : ''}`
        : `<p>Payment status: <span class="hl">${order.deposit_status}</span></p>`}
      <p>Track your order: <a href="${lookupLink(env)}">${lookupLink(env)}</a></p>
    `,
    intro: 'Your order has been received and is awaiting payment confirmation.',
    outro: 'No card data is stored by AASRA — payments are processed on a secure hosted gateway.',
  };
}

/**
 * Deposit payment confirmed.
 */
export function depositPaidEmail({ order, amount, env }) {
  const b = env.PUBLIC_BASE_URL || 'https://aasra.shop';
  const balanceLink =
    order.balance_amount > 0
      ? invoiceLink(env, order.id, order.balance_token, 'balance')
      : null;
  return {
    subject: `Deposit received — ${order.id}`,
    html: `
      <p>Hello ${escapeHtml(order.customer_name)},</p>
      <p>Your deposit of <span class="hl">${money(amount)}</span> for order <span class="hl">${escapeHtml(order.id)}</span> has been received.</p>
      <p>Remaining balance: <span class="hl">${money(order.balance_amount)}</span> — due online before shipping.</p>
      ${balanceLink ? `<p><a href="${balanceLink}">Pay balance now</a></p>` : ''}
    `,
    intro: 'Your order is secured. The balance must be paid before we ship.',
    outro: 'You will receive another confirmation once the balance is paid in full.',
  };
}

/**
 * Balance payment confirmed / order paid in full.
 */
export function balancePaidEmail({ order, amount, env }) {
  return {
    subject: `Order paid in full — ${order.id}`,
    html: `
      <p>Hello ${escapeHtml(order.customer_name)},</p>
      <p>Your balance payment of <span class="hl">${money(amount)}</span> for order <span class="hl">${escapeHtml(order.id)}</span> has been received.</p>
      <p>Your order is now <span class="hl">paid in full</span> and will be shipped shortly.</p>
      <p><a href="${invoiceLink(env, order.id, order.balance_token, 'final')}">View final invoice</a></p>
    `,
    intro: 'Thank you — your order is complete and will be dispatched.',
    outro: 'You will receive a shipping confirmation with tracking once your order is on its way.',
  };
}

/**
 * Balance reminder (cron-triggered).
 */
export function balanceReminderEmail({ order, env }) {
  return {
    subject: `Balance due for order ${order.id}`,
    html: `
      <p>Hello ${escapeHtml(order.customer_name)},</p>
      <p>Your order <span class="hl">${escapeHtml(order.id)}</span> has a remaining balance of <span class="hl">${money(order.balance_amount)}</span>.</p>
      <p>Please pay the balance before your order can be shipped. Orders unpaid after the deadline are auto-cancelled.</p>
      <p><a href="${invoiceLink(env, order.id, order.balance_token, 'balance')}">Pay balance now</a></p>
    `,
    intro: 'A balance is still outstanding on your order.',
    outro: 'If you have already paid, please disregard this email.',
  };
}

/**
 * Order shipped (with tracking).
 */
export function shippedEmail({ order, tracking, env }) {
  return {
    subject: `Order shipped — ${order.id}`,
    html: `
      <p>Hello ${escapeHtml(order.customer_name)},</p>
      <p>Great news — order <span class="hl">${escapeHtml(order.id)}</span> has been shipped.</p>
      ${tracking
        ? `<p>Courier: <span class="hl">${escapeHtml(order.courier)}</span><br/>
           Tracking: <a href="${escapeHtml(trackingUrl(order.courier, tracking))}">${escapeHtml(tracking)}</a></p>`
        : `<p>Tracking details will follow shortly.</p>`}
    `,
    intro: 'Your order has been dispatched.',
    outro: 'You can also check status anytime at the order lookup page.',
  };
}

/**
 * Order delivered.
 */
export function deliveredEmail({ order, env }) {
  return {
    subject: `Order delivered — ${order.id}`,
    html: `
      <p>Hello ${escapeHtml(order.customer_name)},</p>
      <p>Order <span class="hl">${escapeHtml(order.id)}</span> has been marked as delivered.</p>
      <p>We hope you enjoy your purchase. If anything is not right, please contact us within 7 days of delivery.</p>
    `,
    intro: 'Your order has been delivered.',
    outro: 'Thank you for shopping with AASRA.',
  };
}

/**
 * Order cancelled.
 */
export function cancelledEmail({ order, reason, env }) {
  const b = env.PUBLIC_BASE_URL || 'https://aasra.shop';
  return {
    subject: `Order cancelled — ${order.id}`,
    html: `
      <p>Hello ${escapeHtml(order.customer_name)},</p>
      <p>Order <span class="hl">${escapeHtml(order.id)}</span> has been cancelled.</p>
      ${reason ? `<p>Reason: ${escapeHtml(reason)}</p>` : ''}
      <p>Any amounts paid will be refunded per our <a href="${b}/deposit-policy">Deposit &amp; Cancellation Policy</a>.</p>
    `,
    intro: 'Your order has been cancelled.',
    outro: 'We are sorry to see the order go. Please contact us if you have questions.',
  };
}

/**
 * Refund issued.
 */
export function refundedEmail({ order, amount, reason, env }) {
  return {
    subject: `Refund issued — ${order.id}`,
    html: `
      <p>Hello ${escapeHtml(order.customer_name)},</p>
      <p>A refund of <span class="hl">${money(amount)}</span> has been issued for order <span class="hl">${escapeHtml(order.id)}</span>.</p>
      ${reason ? `<p>Reason: ${escapeHtml(reason)}</p>` : ''}
      <p>The refund will appear on your original payment method within the timeframe set by your bank or card issuer.</p>
    `,
    intro: 'Your refund has been processed.',
    outro: 'Thank you for your understanding.',
  };
}

/**
 * Generic payment confirmation (delegate to deposit/balance template).
 */
export function paymentPaidEmail({ order, kind, amount, env }) {
  if (kind === 'balance') return balancePaidEmail({ order, amount, env });
  return depositPaidEmail({ order, amount, env });
}

/**
 * Shared wrapper HTML used by the webhook/email callers.
 * Returns { subject, html } with a consistent branded layout.
 */
export function wrapEmail(env, { subject, title, body, intro, outro, btnText, btnUrl }) {
  const b = env.PUBLIC_BASE_URL || 'https://aasra.shop';
  const from = fromEmail(env);
  const sender = env.EMAIL_FROM_NAME || 'AASRA';
  return {
    subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(subject)}</title>
<style>
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.6; margin: 0; padding: 0; background: #f3f3f3; }
  .wrap { width: 100%; padding: 24px 0; background: #f3f3f3; }
  .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; padding: 32px 28px; }
  h1 { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-weight: 400; font-size: 24px; margin: 0 0 12px; color: #1a1a1a; }
  .kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #666; margin-bottom: 6px; }
  p { margin: 0 0 14px; }
  a { color: #1a1a1a; text-decoration: underline; font-weight: 500; }
  .hl { font-weight: 600; }
  .btn { display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 10px 20px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; border: 1px solid #1a1a1a; margin: 14px 0; }
  .btn:hover { background: #333; }
  .hr { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
  .footer { font-size: 11px; color: #666; margin-top: 28px; }
  .footer p { margin: 0 0 6px; }
  .footer a { color: #666; text-decoration: none; }
  @media (max-width: 480px) { .card { padding: 20px 16px; } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:16px;letter-spacing:0.06em;margin-bottom:4px;">AASRA</div>
      <div class="kicker">${escapeHtml(title)}</div>
      <h1>${escapeHtml(subject)}</h1>
      ${body}
      ${btnText && btnUrl ? `<a href="${btnUrl}" class="btn">${escapeHtml(btnText)}</a>` : ''}
      <div class="hr"></div>
      <div class="footer">
        <p>${escapeHtml(intro)}</p>
        <p>${escapeHtml(outro)}</p>
        <p>Questions? <a href="https://wa.me/923000000000" target="_blank" rel="noopener">WhatsApp us</a> or email <a href="mailto:${from}">${from}</a>.</p>
        <p>&copy; 2026 ${escapeHtml(sender)}. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`,
    text: subject,
  };
}

function trackingUrl(courier, tracking) {
  return `https://example.com/track?courier=${encodeURIComponent(courier || '')}&id=${encodeURIComponent(tracking || '')}`;
}
