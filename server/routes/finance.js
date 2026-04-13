const express = require('express');
const { getDb } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/finance?period=ALL|30|90
router.get('/', (req, res) => {
  const db = getDb();
  const period = req.query.period || 'ALL';
  const days = period === 'ALL' ? null : parseInt(period, 10);

  let whereClause = '';
  const params = [];
  if (days) {
    whereClause = "WHERE o.created_at >= datetime('now', ?)";
    params.push(`-${days} days`);
  }

  // Revenue = sum of (qty * unit_price) for all orders
  const revenueRow = db.prepare(`
    SELECT COALESCE(SUM(oi.qty * oi.unit_price), 0) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    ${whereClause}
  `).get(...params);

  // COGS = sum of (qty * product.unit_cost) for all orders
  const cogsRow = db.prepare(`
    SELECT COALESCE(SUM(oi.qty * p.unit_cost), 0) as cogs
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    ${whereClause}
  `).get(...params);

  // Logistics + Customs
  const extraRow = db.prepare(`
    SELECT COALESCE(SUM(o.logistics), 0) as logistics, COALESCE(SUM(o.customs), 0) as customs
    FROM orders o
    ${whereClause}
  `).get(...params);

  const revenue = revenueRow.revenue;
  const cogs = cogsRow.cogs;
  const logistics = extraRow.logistics;
  const customs = extraRow.customs;
  const costs = cogs + logistics + customs;
  const profit = revenue - costs;

  // Order stats
  const orderStats = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM orders o
    ${whereClause}
    GROUP BY status
  `).all(...params);

  res.json({ revenue, cogs, logistics, customs, costs, profit, orderStats, period });
});

module.exports = router;
