const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const notificationService = require('../services/notifications');

const router = express.Router();
router.use(authenticate);

// GET /api/notifications — get notification log
router.get('/', authorize('admin', 'operator'), (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const notifications = db.prepare(`
    SELECT n.*, u.username
    FROM notifications n
    LEFT JOIN users u ON u.id = n.user_id
    ORDER BY n.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json(notifications);
});

// POST /api/notifications/send
router.post('/send', authorize('admin', 'operator'), [
  body('type').isIn(['sms', 'email']),
  body('recipient').trim().notEmpty(),
  body('subject').optional().trim(),
  body('body').trim().notEmpty(),
  body('user_id').optional().isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { type, recipient, subject, body: msgBody, user_id } = req.body;

  // Log notification
  const info = db.prepare(`
    INSERT INTO notifications (user_id, type, recipient, subject, body, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(user_id || null, type, recipient, subject || '', msgBody);

  const notifId = info.lastInsertRowid;

  try {
    await notificationService.send({ type, recipient, subject, body: msgBody });
    db.prepare("UPDATE notifications SET status = 'sent' WHERE id = ?").run(notifId);
    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId);
    res.json(notif);
  } catch (err) {
    db.prepare("UPDATE notifications SET status = 'failed', error = ? WHERE id = ?").run(err.message, notifId);
    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId);
    res.status(500).json({ error: err.message, notification: notif });
  }
});

module.exports = router;
