/**
 * Audit logs API — view activity logs
 */
const express = require('express');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/logs — list audit logs (admin sees all, others see own)
router.get('/', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;
  const action = req.query.action || '';
  const entity = req.query.entity || '';
  const userId = req.query.user_id || '';
  const search = req.query.q || '';

  const where = [];
  const params = [];

  // Non-admin users can only see their own logs
  if (req.user.role !== 'admin') {
    where.push('user_id = ?');
    params.push(req.user.id);
  } else if (userId) {
    where.push('user_id = ?');
    params.push(parseInt(userId, 10));
  }

  if (action) {
    where.push('action = ?');
    params.push(action);
  }
  if (entity) {
    where.push('entity = ?');
    params.push(entity);
  }
  if (search) {
    where.push('(username LIKE ? OR details LIKE ? OR action LIKE ? OR entity LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const logs = db.prepare(`
    SELECT * FROM audit_logs ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`).get(...params);

  res.json({ data: logs, total: countRow.total, limit, offset });
});

// GET /api/logs/stats — summary stats for admin dashboard
router.get('/stats', authorize('admin'), (req, res) => {
  const db = getDb();

  const today = db.prepare(`
    SELECT COUNT(*) as count FROM audit_logs
    WHERE created_at >= date('now')
  `).get().count;

  const byAction = db.prepare(`
    SELECT action, COUNT(*) as count FROM audit_logs
    GROUP BY action ORDER BY count DESC LIMIT 10
  `).all();

  const byUser = db.prepare(`
    SELECT username, role, COUNT(*) as count FROM audit_logs
    WHERE username != 'system'
    GROUP BY username ORDER BY count DESC LIMIT 10
  `).all();

  res.json({ today, byAction, byUser });
});

module.exports = router;
