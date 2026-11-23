/**
 * Stock holds and order events, shared by checkout and the pay-now endpoint.
 * Kept out of the route module so tests can import it (no JSON imports here).
 */

import { findProductBySku } from './pricing.js';

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function reserveStock(db, items, holdMinutes = 15) {
  const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();
  const now = nowIso();
  const reservations = [];

  // Acquire an explicit transaction for consistency.
  // D1 supports batch execution via db.batch(...).
  const statements = [];
  const reservationRows = [];

  for (const it of items) {
    const found = findProductBySku(it.sku);
    if (!found) throw new Error(`unknown SKU: ${it.sku}`);
    const sku = it.sku;
    const qty = it.qty;

    // Check stock (SELECT ... for consistency within transaction).
    // D1 doesn't support SELECT FOR UPDATE; we check then update conditionally.
    statements.push(
      db.prepare('SELECT quantity_available FROM stock WHERE sku = ?').bind(sku)
    );
    reservationRows.push({ sku, qty });
  }

  const results = await db.batch(statements);

  // Now validate stock and build reservation inserts + stock decrements.
  const insertReservations = [];
  const updateStock = [];

  for (let i = 0; i < reservationRows.length; i++) {
    const { sku, qty } = reservationRows[i];
    const selectResult = results[i];
    let available = 0;
    if (selectResult.results && selectResult.results.length > 0) {
      available = Number(selectResult.results[0].quantity_available) || 0;
    }
    if (available < qty) {
      throw new Error(`insufficient_stock:${sku}`);
    }

    const resId = makeId('res');
    insertReservations.push(
      db.prepare(
        'INSERT INTO reservations (id, order_id, sku, qty, expires_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(resId, '__PENDING_ORDER__', sku, qty, expiresAt, 'active', now)
    );
    updateStock.push(
      db.prepare('UPDATE stock SET quantity_available = quantity_available - ?, updated_at = ? WHERE sku = ?').bind(
        qty,
        now,
        sku
      )
    );
    reservations.push({ id: resId, sku, qty, expires_at: expiresAt });
  }

  // Execute: insert reservations (with placeholder order id), decrement stock.
  await db.batch([...insertReservations, ...updateStock]);

  return { ok: true, reservations };
}

export async function releaseReservations(db, reservationIds) {
  if (!reservationIds || reservationIds.length === 0) return;
  // Only reservations still 'active' are released; their units go back to stock.
  // Already-released rows are skipped, so stock is never returned twice.
  const placeholders = reservationIds.map(() => '?').join(', ');
  const active = await db
    .prepare(`SELECT id, sku, qty FROM reservations WHERE status = 'active' AND id IN (${placeholders})`)
    .bind(...reservationIds)
    .all();
  const now = nowIso();
  const stmts = [];
  for (const r of active.results || []) {
    stmts.push(db.prepare("UPDATE reservations SET status = 'released' WHERE id = ? AND status = 'active'").bind(r.id));
    stmts.push(
      db.prepare('UPDATE stock SET quantity_available = quantity_available + ?, updated_at = ? WHERE sku = ?').bind(r.qty, now, r.sku)
    );
  }
  if (stmts.length) await db.batch(stmts);
}

export async function linkReservationsToOrder(db, reservationIds, orderId) {
  if (!reservationIds || reservationIds.length === 0) return;
  const stmts = reservationIds.map((id) =>
    db.prepare("UPDATE reservations SET order_id = ? WHERE id = ? AND status = 'active'").bind(orderId, id)
  );
  await db.batch(stmts);
}

export async function createOrderEvent(db, orderId, type, details = null) {
  const id = makeId('evt');
  try {
    await db.prepare(
      'INSERT INTO order_events (id, order_id, type, details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, orderId, type, details ? JSON.stringify(details) : null, nowIso()).run();
  } catch (e) {
    // Event logging must not fail the order.
    console.warn('[ORDER_EVENT] failed to log', type, e.message);
  }
}
