const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const audit = require('../services/audit');

const router = express.Router();
router.use(authenticate);

function generateShipmentNo() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SHP-${t}-${r}`;
}

function getShipmentFull(db, id) {
  const s = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);
  if (!s) return null;
  s.orders = db.prepare(`
    SELECT o.id, o.order_no, o.customer_name, o.status
    FROM orders o
    JOIN shipment_orders so ON so.order_id = o.id
    WHERE so.shipment_id = ?
  `).all(id);
  s.events = db.prepare('SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY occurred_at DESC').all(id);
  return s;
}

// GET /api/shipments
router.get('/', (req, res) => {
  const db = getDb();
  const search = req.query.q || '';
  let shipments;
  if (search) {
    const q = `%${search}%`;
    shipments = db.prepare(`
      SELECT * FROM shipments WHERE shipment_no LIKE ? OR awb LIKE ? ORDER BY created_at DESC
    `).all(q, q);
  } else {
    shipments = db.prepare('SELECT * FROM shipments ORDER BY created_at DESC').all();
  }
  for (const s of shipments) {
    s.order_count = db.prepare('SELECT COUNT(*) as cnt FROM shipment_orders WHERE shipment_id = ?').get(s.id).cnt;
  }
  res.json(shipments);
});

// GET /api/shipments/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const s = getShipmentFull(db, parseInt(req.params.id, 10));
  if (!s) return res.status(404).json({ error: 'Shipment not found' });
  res.json(s);
});

// POST /api/shipments
router.post('/', authorize('admin', 'operator'), [
  body('route').optional().trim(),
  body('status').optional().isIn(['CREATED', 'AT_CN_WAREHOUSE', 'IN_TRANSIT', 'CUSTOMS', 'AT_AZ_WAREHOUSE', 'DELIVERED']),
  body('eta').optional().trim(),
  body('awb').optional().trim(),
  body('notes').optional().trim(),
  body('order_ids').optional().isArray(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { route, status, eta, awb, notes, order_ids } = req.body;
  const shipmentNo = generateShipmentNo();

  const info = db.prepare(`
    INSERT INTO shipments (shipment_no, route, status, eta, awb, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(shipmentNo, route || 'CN→AZ Air Express', status || 'CREATED', eta || '', awb || '', notes || '', req.user.id);

  const shipmentId = info.lastInsertRowid;
  if (order_ids && order_ids.length) {
    const link = db.prepare('INSERT OR IGNORE INTO shipment_orders (shipment_id, order_id) VALUES (?, ?)');
    for (const oid of order_ids) {
      link.run(shipmentId, oid);
    }
  }

  audit.log({ user: req.user, action: 'CREATE', entity: 'shipment', entityId: shipmentId, details: { shipment_no: shipmentNo, route: route || 'CN→AZ Air Express' }, ip: req.ip });
  res.status(201).json(getShipmentFull(db, shipmentId));
});

// PUT /api/shipments/:id
router.put('/:id', authorize('admin', 'operator'), [
  body('route').optional().trim(),
  body('status').optional().isIn(['CREATED', 'AT_CN_WAREHOUSE', 'IN_TRANSIT', 'CUSTOMS', 'AT_AZ_WAREHOUSE', 'DELIVERED']),
  body('eta').optional().trim(),
  body('awb').optional().trim(),
  body('notes').optional().trim(),
  body('order_ids').optional().isArray(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const s = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);
  if (!s) return res.status(404).json({ error: 'Shipment not found' });

  const fields = [];
  const values = [];
  for (const key of ['route', 'status', 'eta', 'awb', 'notes']) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (fields.length) {
    fields.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE shipments SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  // Update order links
  if (req.body.order_ids !== undefined) {
    db.prepare('DELETE FROM shipment_orders WHERE shipment_id = ?').run(id);
    const link = db.prepare('INSERT OR IGNORE INTO shipment_orders (shipment_id, order_id) VALUES (?, ?)');
    for (const oid of req.body.order_ids) {
      link.run(id, oid);
    }
  }

  audit.log({ user: req.user, action: 'UPDATE', entity: 'shipment', entityId: id, details: req.body, ip: req.ip });
  res.json(getShipmentFull(db, id));
});

// DELETE /api/shipments/:id
router.delete('/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const s = db.prepare('SELECT id FROM shipments WHERE id = ?').get(id);
  if (!s) return res.status(404).json({ error: 'Shipment not found' });

  db.prepare('DELETE FROM shipment_orders WHERE shipment_id = ?').run(id);
  db.prepare('DELETE FROM tracking_events WHERE shipment_id = ?').run(id);
  db.prepare('DELETE FROM shipments WHERE id = ?').run(id);
  audit.log({ user: req.user, action: 'DELETE', entity: 'shipment', entityId: id, ip: req.ip });
  res.json({ message: 'Shipment deleted' });
});

module.exports = router;
