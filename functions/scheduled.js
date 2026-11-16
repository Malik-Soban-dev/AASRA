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
        const baseUrl = env.PUBLIC_BASE_URL || 'https://shop.example.com';
        const emailPromises = dueOrders.results.map((o) =>
          sendBalanceReminder(env, o, baseUrl)
        );
        await Promise.all(emailPromises.map((p) => p.catch((e) => console.warn('[REMINDER] email failed', o.id, e.message))));
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

  // ---- 4. Reconcile pending payments against gateway ----
  // VERIFY: Safepay reconciliation endpoint to list pending/failed payments.
  // This is a placeholder; implement against Safepay's payment list/lookup API.
  results.push({ reconciliation: 'not_implemented_verify_gateway_api' });

  return new Response(
    JSON.stringify({ ok: true, ran_at: nowIso, results }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function sendBalanceReminder(env, order, baseUrl) {
  const { sendEmail } = await import('../lib/email.js');
  return sendEmail(env, {
    to: order.email,
    subject: `Balance due for order ${order.id}`,
    html: `
      <h1>Balance due</h1>
      <p>Your order <strong>${order.id}</strong> has a remaining balance of <strong>${order.balance_amount.toLocaleString()} PKR</strong>.</p>
      <p>Please pay the balance before your order can be shipped.</p>
      <p><a href="${baseUrl}/pay-balance?order=${order.id}&token=${order.id}">Pay balance now</a></p>
    `,
  });
}
