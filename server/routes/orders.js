const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const audit = require('../services/audit');

const router = express.Router();
router.use(authenticate);

function generateOrderNo() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORD-${t}-${r}`;
}

function getOrderWithItems(db, orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  order.items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.unit_sell
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(orderId);
  order.shipments = db.prepare(`
    SELECT s.id, s.shipment_no, s.status
    FROM shipments s
    JOIN shipment_orders so ON so.shipment_id = s.id
    WHERE so.order_id = ?
  `).all(orderId);
  return order;
}

// GET /api/orders
router.get('/', (req, res) => {
  const db = getDb();
  const search = req.query.q || '';
  const status = req.query.status || '';
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;

  let where = [];
  let params = [];

  if (search) {
    where.push("(order_no LIKE ? OR customer_name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  // Customers can only see their own orders
  if (req.user.role === 'customer') {
    where.push("customer_id = ?");
    params.push(req.user.id);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const orders = db.prepare(`
    SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Attach items summary
  for (const o of orders) {
    o.item_count = db.prepare('SELECT COALESCE(SUM(qty), 0) as cnt FROM order_items WHERE order_id = ?').get(o.id).cnt;
    o.total = db.prepare(`
      SELECT COALESCE(SUM(oi.qty * oi.unit_price), 0) as total
      FROM order_items oi WHERE oi.order_id = ?
    `).get(o.id).total;
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM orders ${whereClause}`).get(...params);
  res.json({ data: orders, total: countRow.total, limit, offset });
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const order = getOrderWithItems(db, parseInt(req.params.id, 10));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(order);
});

// POST /api/orders
router.post('/', authorize('admin', 'operator'), [
  body('customer_name').trim().notEmpty(),
  body('customer_id').optional().isInt(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('status').optional().isIn(['NEW', 'PAID', 'PICK_PACK', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  body('logistics').optional().isFloat({ min: 0 }),
  body('customs').optional().isFloat({ min: 0 }),
  body('notes').optional().trim(),
  body('items').isArray({ min: 1 }),
  body('items.*.product_id').isInt(),
  body('items.*.qty').isInt({ min: 1 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { customer_name, customer_id, phone, address, status, logistics, customs, notes, items } = req.body;

  const orderNo = generateOrderNo();
  const info = db.prepare(`
    INSERT INTO orders (order_no, customer_id, customer_name, phone, address, status, logistics, customs, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(orderNo, customer_id || null, customer_name, phone || '', address || '', status || 'NEW', logistics || 0, customs || 0, notes || '', req.user.id);

  const orderId = info.lastInsertRowid;
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, sku, qty, unit_price)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const item of items) {
    const product = db.prepare('SELECT sku, unit_sell FROM products WHERE id = ?').get(item.product_id);
    if (!product) continue;
    insertItem.run(orderId, item.product_id, product.sku, item.qty, product.unit_sell);
  }

  const order = getOrderWithItems(db, orderId);
  audit.log({ user: req.user, action: 'CREATE', entity: 'order', entityId: orderId, details: { order_no: orderNo, customer_name }, ip: req.ip });
  res.status(201).json(order);
});

// PUT /api/orders/:id
router.put('/:id', authorize('admin', 'operator'), [
  body('customer_name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('status').optional().isIn(['NEW', 'PAID', 'PICK_PACK', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  body('logistics').optional().isFloat({ min: 0 }),
  body('customs').optional().isFloat({ min: 0 }),
  body('notes').optional().trim(),
  body('items').optional().isArray(),
], (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  // Update order fields
  const fields = [];
  const values = [];
  for (const key of ['customer_name', 'customer_id', 'phone', 'address', 'status', 'logistics', 'customs', 'notes']) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (fields.length) {
    fields.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  // Replace items if provided
  if (req.body.items) {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, sku, qty, unit_price)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of req.body.items) {
      const product = db.prepare('SELECT sku, unit_sell FROM products WHERE id = ?').get(item.product_id);
      if (!product) continue;
      insertItem.run(id, item.product_id, product.sku, item.qty, product.unit_sell);
    }
  }

  audit.log({ user: req.user, action: 'UPDATE', entity: 'order', entityId: id, details: req.body, ip: req.ip });
  res.json(getOrderWithItems(db, id));
});

// DELETE /api/orders/:id
router.delete('/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare('DELETE FROM shipment_orders WHERE order_id = ?').run(id);
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  audit.log({ user: req.user, action: 'DELETE', entity: 'order', entityId: id, ip: req.ip });
  res.json({ message: 'Order deleted' });
});

module.exports = router;
