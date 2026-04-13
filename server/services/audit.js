/**
 * Audit log service — records user actions for accountability
 */
const { getDb } = require('../db');

const INSERT_SQL = `
  INSERT INTO audit_logs (user_id, username, role, action, entity, entity_id, details, ip)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

/**
 * Log an audit event
 * @param {object} opts
 * @param {object} opts.user    - { id, username, role }
 * @param {string} opts.action  - LOGIN, LOGOUT, CREATE, UPDATE, DELETE, etc.
 * @param {string} opts.entity  - user, product, order, shipment, etc.
 * @param {number} [opts.entityId] - ID of the affected entity
 * @param {string} [opts.details]  - Additional details (JSON or text)
 * @param {string} [opts.ip]       - Client IP address
 */
function log({ user, action, entity, entityId, details, ip }) {
  try {
    const db = getDb();
    db.prepare(INSERT_SQL).run(
      user?.id || null,
      user?.username || 'system',
      user?.role || '',
      action,
      entity || '',
      entityId || null,
      typeof details === 'object' ? JSON.stringify(details) : (details || ''),
      ip || ''
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

/**
 * Express middleware that auto-logs after response is sent
 */
function auditMiddleware(action, entity, opts = {}) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      // Only log successful operations (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = opts.getEntityId
          ? opts.getEntityId(req, data)
          : (data?.id || req.params?.id || null);
        const details = opts.getDetails
          ? opts.getDetails(req, data)
          : undefined;
        log({
          user: req.user,
          action,
          entity,
          entityId: entityId ? parseInt(entityId, 10) : null,
          details,
          ip: req.ip,
        });
      }
      return originalJson(data);
    };
    next();
  };
}

module.exports = { log, auditMiddleware };
