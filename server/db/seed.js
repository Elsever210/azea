/**
 * Seed script — creates default admin user and sample data
 * Run: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb, close } = require('./index');

const db = getDb();

// Create admin user
const adminPass = bcrypt.hashSync('admin123', 10);
const operatorPass = bcrypt.hashSync('operator123', 10);

db.prepare(`
  INSERT OR IGNORE INTO users (username, email, password, role, full_name)
  VALUES (?, ?, ?, ?, ?)
`).run('admin', 'admin@vsfglobal.az', adminPass, 'admin', 'System Admin');

db.prepare(`
  INSERT OR IGNORE INTO users (username, email, password, role, full_name)
  VALUES (?, ?, ?, ?, ?)
`).run('operator1', 'operator@expresscargo.az', operatorPass, 'operator', 'Operator 1');

// Sample products
const products = [
  ['AZ-TEA-001', 'Premium Green Tea 500g', '0902.10', 0, 2.50, 8.99, 'Keep cool, vacuum sealed'],
  ['AZ-ELEC-002', 'Wireless Earbuds Pro', '8518.40', 1, 12.00, 39.99, 'Antistatic packaging'],
  ['AZ-HOME-003', 'Ceramic Vase Set', '6913.90', 1, 5.00, 24.99, 'Bubble wrap required'],
  ['AZ-CLOTH-004', 'Silk Scarf Collection', '6214.10', 0, 3.00, 18.50, ''],
  ['AZ-TOOL-005', 'Multi-tool Kit 15-in-1', '8205.70', 0, 4.50, 15.99, ''],
];

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (sku, name, hs_code, fragile, unit_cost, unit_sell, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertInventory = db.prepare(`
  INSERT OR IGNORE INTO inventory (product_id, on_hand)
  VALUES (?, ?)
`);

for (const p of products) {
  const info = insertProduct.run(...p);
  if (info.changes > 0) {
    insertInventory.run(info.lastInsertRowid, Math.floor(Math.random() * 100) + 10);
  }
}

console.log('Seed completed: admin/admin123, operator1/operator123, 5 sample products');
close();
