const fs = require('fs');
const path = require('path');

module.exports = async function () {
  const dbPath = path.join(__dirname, 'test.db');
  for (const ext of ['', '-wal', '-shm']) {
    const f = dbPath + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
};
