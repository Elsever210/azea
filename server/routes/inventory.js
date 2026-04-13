const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const audit = require('../services/audit');

const router = express.Router();
router.use(authenticate);

// GET /api/inventory
router.get('/', (req, res) => {
  const db = getDb();
  const search = req.query.q || '';
  let rows;
  if (search) {
    const q = `%${search}%`;
    rows = db.prepare(`
      SELECT i.*, p.sku, p.name, p.fragile
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE p.sku LIKE ? OR p.name LIKE ?
      ORDER BY p.sku
    `).all(q, q);
  } else {
    rows = db.prepare(`
      SELECT i.*, p.sku, p.name, p.fragile
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      ORDER BY p.sku
    `).all();
  }
  res.json(rows);
});

// POST /api/inventory/adjust
router.post('/adjust', authorize('admin', 'operator'), [
  body('product_id').isInt(),
  body('delta').isInt(),
  body('reason').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { product_id, delta, reason } = req.body;

  const inv = db.prepare('SELECT * FROM inventory WHERE product_id = ?').get(product_id);
  if (!inv) return res.status(404).json({ error: 'Product not in inventory' });

  db.prepare("UPDATE inventory SET on_hand = on_hand + ?, updated_at = datetime('now') WHERE product_id = ?")
    .run(delta, product_id);

  db.prepare('INSERT INTO inventory_log (product_id, delta, reason, created_by) VALUES (?, ?, ?, ?)')
    .run(product_id, delta, reason || '', req.user.id);

  const updated = db.prepare(`
    SELECT i.*, p.sku, p.name FROM inventory i JOIN products p ON p.id = i.product_id WHERE i.product_id = ?
  `).get(product_id);
  audit.log({ user: req.user, action: 'ADJUST', entity: 'inventory', entityId: product_id, details: { delta, reason }, ip: req.ip });
  res.json(updated);
});

// POST /api/inventory/rebuild
router.post('/rebuild', authorize('admin'), (req, res) => {
  const db = getDb();
  
  // Reset all to 0
  db.prepare('UPDATE inventory SET on_hand = 0').run();

  // Sum delivered order items
  const deliveredItems = db.prepare(`
    SELECT oi.product_id, SUM(oi.qty) as total_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'DELIVERED'
    GROUP BY oi.product_id
  `).all();

  const update = db.prepare("UPDATE inventory SET on_hand = on_hand - ?, updated_at = datetime('now') WHERE product_id = ?");
  for (const item of deliveredItems) {
    update.run(item.total_qty, item.product_id);
  }

  const inventory = db.prepare(`
    SELECT i.*, p.sku, p.name FROM inventory i JOIN products p ON p.id = i.product_id ORDER BY p.sku
  `).all();
  res.json(inventory);
});

// GET /api/inventory/log
router.get('/log', authorize('admin', 'operator'), (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const logs = db.prepare(`
    SELECT il.*, p.sku, p.name, u.username
    FROM inventory_log il
    JOIN products p ON p.id = il.product_id
    LEFT JOIN users u ON u.id = il.created_by
    ORDER BY il.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json(logs);
});

module.exports = router;
