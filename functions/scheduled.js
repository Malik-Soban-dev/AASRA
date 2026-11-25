/**
 * Scheduled handler (Cloudflare Cron Trigger) for AASRA.
 *
 * Runs on the cron schedule defined in wrangler.toml.
 * Tasks:
 *   1. Balance reminders at N1 and N2 days before due date.
 *   2. Auto-cancel unpaid balance orders after N days (per policy).
 *   3. Release expired stock reservations (older than hold).
 *   4. Reconcile pending payments against the gateway (missed webhooks).
 *
 * VERIFY: actual intervals (N1, N2, N days) and gateway reconciliation endpoint.
 */

import { reconcilePendingPayments } from './lib/reconcile.js';

// The daily job (reminders, auto-cancel, stock release) must only run once a day.
const DAILY_CRON = '0 9 * * *';

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createOrderEvent(db, orderId, type, details = null) {
  const id = makeId('evt');
  try {
    await db.prepare(
      'INSERT INTO order_events (id, order_id, type, details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, orderId, type, details ? JSON.stringify(details) : null, nowIso());
  } catch (e) {
    console.warn('[ORDER_EVENT] failed', type, e.message);
  }
}

export async function onRequestScheduled(context) {
  const { env } = context;
  const now = new Date();
  const nowIso = now.toISOString();
  const results = [];

  // Frequent run (every 15 minutes): only reconcile recent pending payments.
  if (context.cron && context.cron !== DAILY_CRON) {
    let reconciliation;
    try {
      reconciliation = await reconcilePendingPayments(env, env.DB, { maxAgeHours: 6 });
    } catch (e) {
      reconciliation = { error: e.message };
    }
    return new Response(
      JSON.stringify({ ok: true, ran_at: nowIso, results: [{ reconciliation }] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ---- 1. Release expired reservations (older than 15-minute hold) ----
  try {
    const expired = await env.DB.prepare(
      "SELECT id, order_id, sku, qty FROM reservations WHERE status = 'active' AND expires_at < ?"
    ).bind(nowIso).all();

    if (expired.results && expired.results.length > 0) {
      const stmt = env.DB.prepare(
        "UPDATE reservations SET status = 'released' WHERE id = ? AND status = 'active'"
      );
      const restore = env.DB.prepare(
        'UPDATE stock SET quantity_available = quantity_available + ?, updated_at = ? WHERE sku = ?'
      );
      const batch = [];
      for (const r of expired.results) {
        batch.push(stmt.bind(r.id));
        batch.push(restore.bind(r.qty, nowIso, r.sku));
        await createOrderEvent(env.DB, r.order_id, 'reservation_expired', { sku: r.sku, qty: r.qty });
      }
      await env.DB.batch(batch);
      results.push({ released_reservations: expired.results.length });
    }
  } catch (e) {
    results.push({ release_error: e.message });
  }

  // ---- 2. Balance reminders (orders with unpaid balance, not yet cancelled) ----
  // VERIFY: N1 and N2 days — read from env or hardcode defaults here.
  const REMINDER_DAYS = (env.BALANCE_REMINDER_DAYS || '3,1').split(',').map(Number);
  try {
    for (const days of REMINDER_DAYS) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const targetISO = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD

      const dueOrders = await env.DB.prepare(
        `SELECT * FROM orders
         WHERE payment_type = 'deposit'
           AND deposit_status = 'paid'
           AND balance_status = 'unpaid'
           AND status = 'deposit-paid'
           AND balance_due_at IS NOT NULL
           AND date(balance_due_at) = ?`
      ).bind(targetISO).all();

      if (dueOrders.results && dueOrders.results.length > 0) {
        const baseUrl = env.PUBLIC_BASE_URL || 'https://aasra.shop';
        const emailPromises = dueOrders.results.map((o) =>
          sendBalanceReminder(env, o, baseUrl)
        );
        await Promise.all(emailPromises.map((p, i) => p.catch((e) => console.warn('[REMINDER] email failed', dueOrders.results[i].id, e.message))));
        for (const o of dueOrders.results) {
          await createOrderEvent(env.DB, o.id, 'balance_reminder_sent', { days_until_due: days });
        }
        results.push({ balance_reminders: dueOrders.results.length, days });
      }
    }
  } catch (e) {
    results.push({ reminder_error: e.message });
  }

  // ---- 3. Auto-cancel unpaid balance orders after N days ----
  const CANCEL_AFTER_DAYS = Number(env.BALANCE_CANCEL_AFTER_DAYS || 7);
  try {
    const cancelDate = new Date(now);
    cancelDate.setDate(cancelDate.getDate() - CANCEL_AFTER_DAYS);
    const cancelISO = cancelDate.toISOString();

    const staleOrders = await env.DB.prepare(
      `SELECT * FROM orders
       WHERE payment_type = 'deposit'
         AND deposit_status = 'paid'
         AND balance_status = 'unpaid'
         AND status = 'deposit-paid'
         AND created_at < ?`
    ).bind(cancelISO).all();

    if (staleOrders.results && staleOrders.results.length > 0) {
      const update = env.DB.prepare(
        "UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'deposit-paid'"
      );
      const batch = [];
      for (const o of staleOrders.results) {
        batch.push(update.bind(nowIso, o.id));
        await createOrderEvent(env.DB, o.id, 'auto_cancelled_balance_unpaid', { days: CANCEL_AFTER_DAYS });
      }
      await env.DB.batch(batch);
      results.push({ auto_cancelled: staleOrders.results.length });
    }
  } catch (e) {
    results.push({ cancel_error: e.message });
  }

  // ---- 4. Reconcile pending payments against Safepay (missed webhooks) ----
  // Wider window than the 15-minute run: payments up to 72 hours old.
  try {
    results.push({ reconciliation: await reconcilePendingPayments(env, env.DB, { maxAgeHours: 72 }) });
  } catch (e) {
    results.push({ reconciliation_error: e.message });
  }

  return new Response(
    JSON.stringify({ ok: true, ran_at: nowIso, results }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function sendBalanceReminder(env, order) {
  const { sendEmail, balanceReminderEmail } = await import('./lib/email.js');
  const email = balanceReminderEmail({ order, env });
  return sendEmail(env, {
    to: order.email,
    subject: email.subject,
    html: wrapEmail(env, email.subject, email.html, email.intro, email.outro),
  });
}

function wrapEmail(env, subject, bodyHtml, intro, outro) {
  const b = env.PUBLIC_BASE_URL || 'https://aasra.shop';
  const from = env.EMAIL_FROM || 'orders@example.com';
  const sender = env.EMAIL_FROM_NAME || 'AASRA';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title>
<style>body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;margin:0;padding:0;background:#f3f3f3}.wrap{width:100%;padding:24px 0;background:#f3f3f3}.card{max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;padding:32px 28px}h1{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;margin:0 0 12px;color:#1a1a1a}.kicker{font-size:11px;text-transform:uppercase;letter-spacing:0.16em;color:#666;margin-bottom:6px}p{margin:0 0 14px}a{color:#1a1a1a;text-decoration:underline;font-weight:500}.hl{font-weight:600}.btn{display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 20px;font-size:13px;text-transform:uppercase;letter-spacing:0.12em;border:1px solid #1a1a1a;margin:14px 0}.btn:hover{background:#333}.hr{border:none;border-top:1px solid #e5e5e5;margin:24px 0}.footer{font-size:11px;color:#666;margin-top:28px}.footer p{margin:0 0 6px}.footer a{color:#666;text-decoration:none}</title></head>
<body><div class="wrap"><div class="card"><div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:16px;letter-spacing:0.06em;margin-bottom:4px;">AASRA</div><div class="kicker">Balance reminder</div><h1>${subject}</h1>${bodyHtml}<div class="hr"></div><div class="footer"><p>${intro}</p><p>${outro}</p><p>Questions? Email <a href="mailto:${from}">${from}</a>.</p><p>&copy; 2026 ${sender}. All rights reserved.</p></div></div></div></body></html>`;
}
