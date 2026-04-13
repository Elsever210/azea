const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const audit = require('../services/audit');

const router = express.Router();
router.use(authenticate);

// GET /api/settings
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

// PUT /api/settings
router.put('/', authorize('admin'), [
  body('company').optional().trim(),
  body('cn_warehouse').optional().trim(),
  body('az_warehouse').optional().trim(),
  body('currency').optional().trim().toUpperCase(),
  body('language').optional().isIn(['az', 'en', 'tr', 'ru', 'cn']),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

  const ALLOWED_KEYS = [
    'company', 'cn_warehouse', 'az_warehouse', 'currency', 'language',
    'ctHqAddress', 'ctHqPhone', 'ctHqEmail',
    'ctCnAddress', 'ctCnPhone', 'ctCnContact',
    'ctAzAddress', 'ctAzPhone', 'ctAzContact',
    'ctWebsite', 'ctWhatsapp', 'ctTelegram', 'ctInstagram',
    'cpAirRate', 'cpSeaRate', 'cpExpressRate', 'cpRailRate', 'cpLastmileRate',
    'cpVolDivisor', 'cpCustomsRate', 'cpInsuranceRate',
    'cpFuelSurcharge', 'cpHandlingFee',
    'cpFragileCoeff', 'cpDangerousCoeff', 'cpOversizedCoeff',
    'cpAirDays', 'cpSeaDays', 'cpExpressDays', 'cpRailDays', 'cpLastmileDays',
    'cpMinCharge'
  ];

  for (const key of ALLOWED_KEYS) {
    if (req.body[key] !== undefined) {
      upsert.run(key, String(req.body[key]).trim());
    }
  }

  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  audit.log({ user: req.user, action: 'UPDATE', entity: 'settings', details: req.body, ip: req.ip });
  res.json(settings);
});

// GET /api/settings/export — admin-only full DB export as JSON
router.get('/export', authorize('admin'), (req, res) => {
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  const dump = {};
  for (const t of tables) {
    dump[t.name] = db.prepare(`SELECT * FROM "${t.name}"`).all();
  }
  audit.log({ user: req.user, action: 'EXPORT', entity: 'database', details: { tables: Object.keys(dump) }, ip: req.ip });
  res.setHeader('Content-Disposition', 'attachment; filename=vsf-global-cargo-export.json');
  res.json(dump);
});

module.exports = router;
