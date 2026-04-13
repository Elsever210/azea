const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');

/**
 * Verify JWT token and attach user to req
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  let token;

  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const db = getDb();
    const user = db.prepare('SELECT id, username, email, role, full_name, is_active FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * RBAC: require one of the specified roles
 * Usage: authorize('admin', 'operator')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
