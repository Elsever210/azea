const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const config = require('../config');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const audit = require('../services/audit');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

// POST /api/auth/login
router.post('/login', [
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { username, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user);
  audit.log({ user: { id: user.id, username: user.username, role: user.role }, action: 'LOGIN', entity: 'user', entityId: user.id, ip: req.ip });
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role, full_name: user.full_name },
  });
});

// POST /api/auth/register (admin only can create users)
router.post('/register', authenticate, authorize('admin'), [
  body('username').trim().isLength({ min: 3, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'operator', 'customer']),
  body('full_name').optional().trim(),
  body('phone').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { username, email, password, role, full_name, phone } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) return res.status(409).json({ error: 'Username or email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (username, email, password, role, full_name, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username, email, hash, role, full_name || '', phone || '');

  audit.log({ user: req.user, action: 'CREATE', entity: 'user', entityId: info.lastInsertRowid, details: { username, role }, ip: req.ip });
  res.status(201).json({ id: info.lastInsertRowid, username, email, role });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/users (admin only)
router.get('/users', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, email, role, full_name, phone, is_active, created_at FROM users').all();
  res.json(users);
});

// PATCH /api/auth/users/:id (admin only)
router.patch('/users/:id', authenticate, authorize('admin'), [
  body('role').optional().isIn(['admin', 'operator', 'customer']),
  body('is_active').optional().isInt({ min: 0, max: 1 }),
  body('full_name').optional().trim(),
  body('phone').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const userId = parseInt(req.params.id, 10);
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const fields = [];
  const values = [];
  for (const key of ['role', 'is_active', 'full_name', 'phone']) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = datetime('now')");
  values.push(userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT id, username, email, role, full_name, phone, is_active FROM users WHERE id = ?').get(userId);
  audit.log({ user: req.user, action: 'UPDATE', entity: 'user', entityId: userId, details: req.body, ip: req.ip });
  res.json(updated);
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 6 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(req.body.current_password, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(req.body.new_password, 10);
  db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.user.id);
  audit.log({ user: req.user, action: 'CHANGE_PASSWORD', entity: 'user', entityId: req.user.id, ip: req.ip });
  res.json({ message: 'Password changed' });
});

module.exports = router;
