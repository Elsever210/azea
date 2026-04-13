const path = require('path');

module.exports = async function () {
  // Use a separate test database
  process.env.DB_PATH = path.join(__dirname, 'test.db');
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';

  // Clean up any leftover test DB
  const fs = require('fs');
  const dbPath = process.env.DB_PATH;
  for (const ext of ['', '-wal', '-shm']) {
    const f = dbPath + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
};
