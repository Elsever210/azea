require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    path: process.env.DB_PATH || './server/db/ops.db',
  },
  twilio: {
    sid: process.env.TWILIO_ACCOUNT_SID || '',
    token: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM_NUMBER || '',
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    from: process.env.SENDGRID_FROM_EMAIL || '',
  },
  tracking: {
    fedex: { apiKey: process.env.FEDEX_API_KEY || '', secret: process.env.FEDEX_SECRET_KEY || '' },
    ups: { clientId: process.env.UPS_CLIENT_ID || '', secret: process.env.UPS_CLIENT_SECRET || '' },
    dhl: { apiKey: process.env.DHL_API_KEY || '' },
  },
  uploads: {
    dir: process.env.UPLOADS_DIR || './uploads',
    maxSize: 10 * 1024 * 1024, // 10 MB
  },
};
