const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const trackingService = require('../services/tracking');

const router = express.Router();
router.use(authenticate);

// GET /api/tracking/:shipmentId — get all events for a shipment
router.get('/:shipmentId', (req, res) => {
  const db = getDb();
  const shipmentId = parseInt(req.params.shipmentId, 10);
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId);
  if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

  const events = db.prepare('SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY occurred_at DESC').all(shipmentId);
  res.json({ shipment, events });
});

// POST /api/tracking/:shipmentId/track — fetch from external provider
router.post('/:shipmentId/track', authorize('admin', 'operator'), async (req, res) => {
  try {
    const db = getDb();
    const shipmentId = parseInt(req.params.shipmentId, 10);
    const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    const provider = req.body.provider || 'demo';
    const events = await trackingService.track(provider, shipment);

    const insert = db.prepare(`
      INSERT INTO tracking_events (shipment_id, event, location, source, occurred_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    let added = 0;
    for (const ev of events) {
      // Dedup by shipment+event+timestamp
      const exists = db.prepare(`
        SELECT id FROM tracking_events
        WHERE shipment_id = ? AND event = ? AND occurred_at = ?
      `).get(shipmentId, ev.event, ev.occurred_at);

      if (!exists) {
        insert.run(shipmentId, ev.event, ev.location || '', ev.source || provider, ev.occurred_at);
        added++;
      }
    }

    const allEvents = db.prepare('SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY occurred_at DESC').all(shipmentId);
    res.json({ added, events: allEvents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tracking/:shipmentId/event — manual event
router.post('/:shipmentId/event', authorize('admin', 'operator'), [
  body('event').trim().notEmpty(),
  body('location').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const shipmentId = parseInt(req.params.shipmentId, 10);
  const shipment = db.prepare('SELECT id FROM shipments WHERE id = ?').get(shipmentId);
  if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

  const { event, location } = req.body;
  db.prepare(`
    INSERT INTO tracking_events (shipment_id, event, location, source, occurred_at)
    VALUES (?, ?, ?, 'manual', datetime('now'))
  `).run(shipmentId, event, location || '');

  const events = db.prepare('SELECT * FROM tracking_events WHERE shipment_id = ? ORDER BY occurred_at DESC').all(shipmentId);
  res.json(events);
});

// GET /api/tracking — live feed (latest events across all shipments)
router.get('/', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const events = db.prepare(`
    SELECT te.*, s.shipment_no, s.awb
    FROM tracking_events te
    JOIN shipments s ON s.id = te.shipment_id
    ORDER BY te.occurred_at DESC
    LIMIT ?
  `).all(limit);
  res.json(events);
});

module.exports = router;
