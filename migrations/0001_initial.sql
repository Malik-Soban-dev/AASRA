-- D1 schema for AASRA headless e-commerce store
-- All monetary amounts are stored as integers in whole PKR.
-- Prices, names, and stock snapshots are frozen into orders at checkout time.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- stock: live inventory, keyed by SKU
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock (
  sku              TEXT PRIMARY KEY,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_sku ON stock(sku);

-- ---------------------------------------------------------------------------
-- reservations: 15-minute holds placed at checkout start
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL,
  sku              TEXT NOT NULL,
  qty              INTEGER NOT NULL,
  expires_at       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active', -- active | released | confirmed
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reservations_order ON reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_sku_status ON reservations(sku, status);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON reservations(expires_at);

-- ---------------------------------------------------------------------------
-- orders: one row per order (public order number = id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,      -- public order number (e.g. AAS-20261116-0001)
  status           TEXT NOT NULL,         -- pending-payment | pending-deposit | deposit-paid | balance-pending | paid | packed | shipped | delivered | cancelled | refunded | returned
  customer_name    TEXT NOT NULL,
  phone            TEXT NOT NULL,         -- Pakistani mobile, normalized (no full logging)
  email            TEXT NOT NULL,
  city             TEXT NOT NULL,
  address          TEXT NOT NULL,
  notes            TEXT,
  items            TEXT NOT NULL,         -- JSON snapshot: [{name, sku, qty, unit_price_pkr}]
  subtotal         INTEGER NOT NULL,
  shipping_fee     INTEGER NOT NULL DEFAULT 0,
  discount         INTEGER NOT NULL DEFAULT 0,
  total            INTEGER NOT NULL,
  payment_type     TEXT NOT NULL,         -- 'full' | 'deposit'
  deposit_amount   INTEGER NOT NULL DEFAULT 0,
  balance_amount   INTEGER NOT NULL DEFAULT 0,
  deposit_status   TEXT NOT NULL DEFAULT 'unpaid',   -- unpaid | paid | refunded
  balance_status   TEXT NOT NULL DEFAULT 'unpaid',   -- unpaid | paid
  balance_due_at   TEXT,                  -- ISO timestamp when balance becomes due
  coupon_code      TEXT,
  courier          TEXT,
  tracking_number  TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);

-- ---------------------------------------------------------------------------
-- payments: every payment attempt (full, deposit, balance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL,
  kind             TEXT NOT NULL,         -- 'full' | 'deposit' | 'balance'
  gateway          TEXT NOT NULL,         -- 'safepay' | 'payfast'
  tracker_token    TEXT NOT NULL,         -- gateway checkout/reference token
  amount           INTEGER NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'PKR',
  status           TEXT NOT NULL,         -- pending | paid | failed | refunded
  raw_event_id     TEXT,                  -- gateway webhook event id (idempotency)
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tracker ON payments(tracker_token);
CREATE INDEX IF NOT EXISTS idx_payments_raw_event ON payments(raw_event_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ---------------------------------------------------------------------------
-- order_events: full audit log of every state change
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_events (
  id        TEXT PRIMARY KEY,
  order_id  TEXT NOT NULL,
  type      TEXT NOT NULL,               -- order_created | stock_reserved | payment_pending | payment_paid | balance_link_sent | balance_paid | shipped | cancelled | refunded | reservation_expired | ...
  details   TEXT,                        -- JSON payload
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_type ON order_events(type);
CREATE INDEX IF NOT EXISTS idx_order_events_created ON order_events(created_at);

-- ---------------------------------------------------------------------------
-- coupons: discount codes validated server-side at checkout
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  code         TEXT PRIMARY KEY,
  type         TEXT NOT NULL,           -- 'percentage' | 'fixed'
  value        INTEGER NOT NULL,        -- percentage points or fixed PKR amount
  min_order    INTEGER NOT NULL DEFAULT 0,
  expires_at   TEXT,
  usage_limit  INTEGER,
  used_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- ---------------------------------------------------------------------------
-- newsletter: consent-based newsletter signups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS newsletter (
  id        TEXT PRIMARY KEY,
  email     TEXT NOT NULL UNIQUE,
  source    TEXT DEFAULT 'website',
  subscribed_at TEXT NOT NULL,
  unsubscribed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter(email);
