-- VSF Global Cargo — Database Schema
-- SQLite

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Users & RBAC
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  email       TEXT    NOT NULL UNIQUE,
  password    TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'operator' CHECK(role IN ('admin','operator','customer')),
  full_name   TEXT    DEFAULT '',
  phone       TEXT    DEFAULT '',
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- Products catalog
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sku         TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  hs_code     TEXT    DEFAULT '',
  fragile     INTEGER DEFAULT 0,
  unit_cost   REAL    DEFAULT 0,
  unit_sell   REAL    DEFAULT 0,
  notes       TEXT    DEFAULT '',
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no    TEXT    NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT  NOT NULL DEFAULT '',
  phone       TEXT    DEFAULT '',
  address     TEXT    DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','PAID','PICK_PACK','SHIPPED','DELIVERED','CANCELLED')),
  logistics   REAL    DEFAULT 0,
  customs     REAL    DEFAULT 0,
  notes       TEXT    DEFAULT '',
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- Order items (line items)
CREATE TABLE IF NOT EXISTS order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  sku         TEXT    NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 1,
  unit_price  REAL    DEFAULT 0,
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_no TEXT    NOT NULL UNIQUE,
  route       TEXT    DEFAULT 'CN→AZ Air Freight',
  status      TEXT    NOT NULL DEFAULT 'CREATED' CHECK(status IN ('CREATED','AT_CN_WAREHOUSE','IN_TRANSIT','CUSTOMS','AT_AZ_WAREHOUSE','DELIVERED')),
  eta         TEXT    DEFAULT '',
  awb         TEXT    DEFAULT '',
  notes       TEXT    DEFAULT '',
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- Shipment ↔ Order mapping
CREATE TABLE IF NOT EXISTS shipment_orders (
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  PRIMARY KEY (shipment_id, order_id)
);

-- Tracking events
CREATE TABLE IF NOT EXISTS tracking_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  event       TEXT    NOT NULL,
  location    TEXT    DEFAULT '',
  source      TEXT    DEFAULT 'manual',
  occurred_at TEXT    DEFAULT (datetime('now')),
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Reports (metadata — file blobs stored on disk)
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  filename    TEXT    NOT NULL,
  mime_type   TEXT    DEFAULT 'application/octet-stream',
  size        INTEGER DEFAULT 0,
  tag         TEXT    DEFAULT '',
  link_type   TEXT    DEFAULT 'none' CHECK(link_type IN ('none','shipment','order')),
  link_id     INTEGER DEFAULT NULL,
  file_path   TEXT    NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  on_hand     INTEGER DEFAULT 0,
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- Inventory log (adjustments)
CREATE TABLE IF NOT EXISTS inventory_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta       INTEGER NOT NULL,
  reason      TEXT    DEFAULT '',
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT    PRIMARY KEY,
  value       TEXT    DEFAULT ''
);

-- Notifications log
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT    NOT NULL CHECK(type IN ('sms','email')),
  recipient   TEXT    NOT NULL,
  subject     TEXT    DEFAULT '',
  body        TEXT    DEFAULT '',
  status      TEXT    DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  error       TEXT    DEFAULT '',
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    TEXT    NOT NULL DEFAULT '',
  role        TEXT    NOT NULL DEFAULT '',
  action      TEXT    NOT NULL,
  entity      TEXT    NOT NULL DEFAULT '',
  entity_id   INTEGER DEFAULT NULL,
  details     TEXT    DEFAULT '',
  ip          TEXT    DEFAULT '',
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_tracking_shipment ON tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_reports_link ON reports(link_type, link_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- Default settings
INSERT OR IGNORE INTO settings(key, value) VALUES
  ('company', ''),
  ('cn_warehouse', 'Guangzhou'),
  ('az_warehouse', 'Baku'),
  ('currency', 'USD'),
  ('language', 'az');
