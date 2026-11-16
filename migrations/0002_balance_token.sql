-- Add unguessable balance-payment token to orders.
-- The balance pay-balance link uses this token (not the order id) so the link
-- is unguessable and expires. Order lookup continues to use order ID + phone.
ALTER TABLE orders ADD COLUMN balance_token TEXT;

-- Index for fast lookup by token (used by /api/pay-balance and /api/invoice).
CREATE INDEX IF NOT EXISTS idx_orders_balance_token ON orders(balance_token);
