const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const audit = require('../services/audit');

const router = express.Router();
router.use(authenticate);

// GET /api/products
router.get('/', (req, res) => {
  const db = getDb();
  const search = req.query.q || '';
  let products;
  if (search) {
    const q = `%${search}%`;
    products = db.prepare(`
      SELECT * FROM products WHERE sku LIKE ? OR name LIKE ? OR hs_code LIKE ?
      ORDER BY sku
    `).all(q, q, q);
  } else {
    products = db.prepare('SELECT * FROM products ORDER BY sku').all();
  }
  res.json(products);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/products
router.post('/', authorize('admin', 'operator'), [
  body('sku').trim().notEmpty().toUpperCase(),
  body('name').trim().notEmpty(),
  body('hs_code').optional().trim(),
  body('fragile').optional().isInt({ min: 0, max: 1 }),
  body('unit_cost').optional().isFloat({ min: 0 }),
  body('unit_sell').optional().isFloat({ min: 0 }),
  body('notes').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { sku, name, hs_code, fragile, unit_cost, unit_sell, notes } = req.body;

  const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
  if (existing) return res.status(409).json({ error: 'SKU already exists' });

  const info = db.prepare(`
    INSERT INTO products (sku, name, hs_code, fragile, unit_cost, unit_sell, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sku, name, hs_code || '', fragile || 0, unit_cost || 0, unit_sell || 0, notes || '');

  // Init inventory
  db.prepare('INSERT OR IGNORE INTO inventory (product_id, on_hand) VALUES (?, 0)').run(info.lastInsertRowid);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  audit.log({ user: req.user, action: 'CREATE', entity: 'product', entityId: product.id, details: { sku, name }, ip: req.ip });
  res.status(201).json(product);
});

// PUT /api/products/:id
router.put('/:id', authorize('admin', 'operator'), [
  body('sku').optional().trim().toUpperCase(),
  body('name').optional().trim().notEmpty(),
  body('hs_code').optional().trim(),
  body('fragile').optional().isInt({ min: 0, max: 1 }),
  body('unit_cost').optional().isFloat({ min: 0 }),
  body('unit_sell').optional().isFloat({ min: 0 }),
  body('notes').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const fields = [];
  const values = [];
  for (const key of ['sku', 'name', 'hs_code', 'fragile', 'unit_cost', 'unit_sell', 'notes']) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  // Check SKU uniqueness if changing
  if (req.body.sku && req.body.sku !== product.sku) {
    const dup = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(req.body.sku, id);
    if (dup) return res.status(409).json({ error: 'SKU already exists' });
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  audit.log({ user: req.user, action: 'UPDATE', entity: 'product', entityId: id, details: req.body, ip: req.ip });
  res.json(updated);
});

// DELETE /api/products/:id
router.delete('/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // Check if product is referenced in orders
  const inOrders = db.prepare('SELECT COUNT(*) as cnt FROM order_items WHERE product_id = ?').get(id);
  if (inOrders.cnt > 0) {
    return res.status(409).json({ error: 'Product is referenced in orders. Remove order items first.' });
  }

  db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  audit.log({ user: req.user, action: 'DELETE', entity: 'product', entityId: id, ip: req.ip });
  res.json({ message: 'Product deleted' });
});

module.exports = router;
