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
 */

export function emailConfig(env) {
  return {
    provider: env.EMAIL_PROVIDER || 'resend', // 'resend' | 'mailgun' | 'sendgrid' | 'postmark' | 'ses'
    apiKey: env.EMAIL_PROVIDER_API_KEY || '',
    from: env.EMAIL_FROM || 'orders@example.com',
    fromName: env.EMAIL_FROM_NAME || 'AASRA',
    baseUrl: env.EMAIL_PROVIDER_BASE_URL || 'https://api.resend.com',
  };
}

/**
 * Send a transactional email.
 * Returns { ok: boolean, messageId?: string, error?: string }.
 */
export async function sendEmail(env, { to, subject, html, text }) {
  const cfg = emailConfig(env);

  // Stub: if no API key, log and return success (dev mode) — do NOT do this in production.
  if (!cfg.apiKey) {
    console.log('[EMAIL STUB]', { to, subject, from: cfg.from });
    return { ok: true, messageId: 'stub-' + Date.now(), warning: 'no_email_provider_configured' };
  }

  // TODO: Replace with real provider call.
  // Resend example (uncomment and adjust once verified):
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

/**
 * Email templates (HTML). Keep copy minimal; replace with brand copy.
 */
export function orderReceivedEmail({ order, customerName, baseUrl }) {
  const payLink = order.balance_amount > 0
    ? `${baseUrl}/pay-balance?order=${order.id}&token=${order.id}`
    : null;
  return {
    subject: `Order received — ${order.id}`,
    html: `
      <h1>Order received</h1>
      <p>Hello ${customerName},</p>
      <p>Thank you for your order <strong>${order.id}</strong>.</p>
      <p>Order total: <strong>${order.total.toLocaleString()} PKR</strong></p>
      ${order.payment_type === 'deposit'
        ? `<p>Deposit paid: <strong>${order.deposit_amount.toLocaleString()} PKR</strong><br/>
           Balance due: <strong>${order.balance_amount.toLocaleString()} PKR</strong><br/>
           ${payLink ? `<p><a href="${payLink}">Pay balance now</a></p>` : ''}</p>`
        : `<p>Payment status: <strong>${order.deposit_status}</strong></p>`}
      <p>You can track your order at <a href="${baseUrl}/order-lookup">${baseUrl}/order-lookup</a></p>
      <p>Questions? WhatsApp us or email ${envEmail(env)}.</p>
    `,
  };
}

export function paymentPaidEmail({ order, kind, amount }) {
  return {
    subject: `Payment confirmed — ${order.id}`,
    html: `
      <h1>Payment confirmed</h1>
      <p>Your ${kind} payment of <strong>${amount.toLocaleString()} PKR</strong> for order <strong>${order.id}</strong> has been received.</p>
      ${kind === 'balance'
        ? `<p>Your order is now <strong>paid in full</strong> and will be shipped shortly.</p>`
        : `<p>Remaining balance: <strong>${order.balance_amount.toLocaleString()} PKR</strong>. Pay before shipping.</p>`}
    `,
  };
}

export function balanceReminderEmail({ order, baseUrl }) {
  return {
    subject: `Balance due for order ${order.id}`,
    html: `
      <h1>Balance due</h1>
      <p>Your order <strong>${order.id}</strong> has a remaining balance of <strong>${order.balance_amount.toLocaleString()} PKR</strong>.</p>
      <p>Please pay the balance before your order can be shipped.</p>
      <p><a href="${baseUrl}/pay-balance?order=${order.id}&token=${order.id}">Pay balance now</a></p>
    `,
  };
}

export function shippedEmail({ order, tracking }) {
  return {
    subject: `Order shipped — ${order.id}`,
    html: `
      <h1>Your order has shipped</h1>
      <p>Order <strong>${order.id}</strong> is on its way.</p>
      ${tracking ? `<p>Courier: <strong>${order.courier}</strong><br/>Tracking: <a href="${trackingUrl(order.courier, tracking)}">${tracking}</a></p>` : ''}
    `,
  };
}

function envEmail(env) {
  return env.EMAIL_FROM || 'orders@example.com';
}

function trackingUrl(courier, tracking) {
  // TODO: Map courier to its tracking URL once couriers are selected.
  return `https://example.com/track?courier=${encodeURIComponent(courier)}&id=${encodeURIComponent(tracking)}`;
}
