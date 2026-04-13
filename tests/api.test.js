const path = require('path');
process.env.DB_PATH = path.join(__dirname, 'test.db');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

const request = require('supertest');
const app = require('../server/index');
const { getDb, close } = require('../server/db');
const bcrypt = require('bcryptjs');

let token;
let adminId;

beforeAll(() => {
  const db = getDb();
  // Create test admin
  const hash = bcrypt.hashSync('test123', 10);
  const info = db.prepare(`
    INSERT OR REPLACE INTO users (username, email, password, role, full_name)
    VALUES ('testadmin', 'test@test.com', ?, 'admin', 'Test Admin')
  `).run(hash);
  adminId = info.lastInsertRowid || db.prepare("SELECT id FROM users WHERE username='testadmin'").get().id;
});

afterAll(() => {
  close();
});

describe('Auth', () => {
  test('POST /api/auth/login — success', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'test123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    token = res.body.token;
  });

  test('POST /api/auth/login — wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me — authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('testadmin');
  });

  test('GET /api/auth/me — no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/register — create operator', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'testop1', email: 'op1@test.com', password: 'op1234', role: 'operator' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('operator');
  });

  test('GET /api/auth/users — admin list users', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Products', () => {
  let productId;

  test('POST /api/products — create', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'TEST-001', name: 'Test Product', unit_cost: 5, unit_sell: 15 });
    expect(res.status).toBe(201);
    expect(res.body.sku).toBe('TEST-001');
    productId = res.body.id;
  });

  test('GET /api/products — list', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/products?q=TEST — search', async () => {
    const res = await request(app)
      .get('/api/products?q=TEST')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some(p => p.sku === 'TEST-001')).toBe(true);
  });

  test('PUT /api/products/:id — update', async () => {
    const res = await request(app)
      .put(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Product Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Product Updated');
  });

  test('POST /api/products — duplicate SKU', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'TEST-001', name: 'Duplicate' });
    expect(res.status).toBe(409);
  });
});

describe('Orders', () => {
  let orderId;

  test('POST /api/orders — create', async () => {
    const db = getDb();
    const product = db.prepare("SELECT id FROM products WHERE sku = 'TEST-001'").get();

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_name: 'Test Customer',
        phone: '+994501234567',
        items: [{ product_id: product.id, qty: 3 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.order_no).toMatch(/^ORD-/);
    expect(res.body.items.length).toBe(1);
    orderId = res.body.id;
  });

  test('GET /api/orders — list', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('PUT /api/orders/:id — update status', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'PAID' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');
  });
});

describe('Shipments', () => {
  let shipmentId;

  test('POST /api/shipments — create', async () => {
    const res = await request(app)
      .post('/api/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ route: 'CN→AZ Air Express', awb: 'TEST-AWB-123' });
    expect(res.status).toBe(201);
    expect(res.body.shipment_no).toMatch(/^SHP-/);
    shipmentId = res.body.id;
  });

  test('GET /api/shipments — list', async () => {
    const res = await request(app)
      .get('/api/shipments')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/tracking/:id/track — demo tracking', async () => {
    const res = await request(app)
      .post(`/api/tracking/${shipmentId}/track`)
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'demo' });
    expect(res.status).toBe(200);
    expect(res.body.added).toBeGreaterThanOrEqual(1);
  });

  test('POST /api/tracking/:id/event — manual event', async () => {
    const res = await request(app)
      .post(`/api/tracking/${shipmentId}/event`)
      .set('Authorization', `Bearer ${token}`)
      .send({ event: 'Test event', location: 'Baku' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/tracking/:id — get events', async () => {
    const res = await request(app)
      .get(`/api/tracking/${shipmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Inventory', () => {
  test('GET /api/inventory — list', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/inventory/adjust — add stock', async () => {
    const db = getDb();
    const product = db.prepare("SELECT id FROM products WHERE sku = 'TEST-001'").get();

    const res = await request(app)
      .post('/api/inventory/adjust')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: product.id, delta: 50, reason: 'Test restock' });
    expect(res.status).toBe(200);
    expect(res.body.on_hand).toBe(50);
  });
});

describe('Finance', () => {
  test('GET /api/finance — get P&L', async () => {
    const res = await request(app)
      .get('/api/finance')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('revenue');
    expect(res.body).toHaveProperty('costs');
    expect(res.body).toHaveProperty('profit');
  });
});

describe('Settings', () => {
  test('GET /api/settings — get settings', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currency');
  });

  test('PUT /api/settings — update settings', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ company: 'Test Cargo LLC', currency: 'AZN' });
    expect(res.status).toBe(200);
    expect(res.body.company).toBe('Test Cargo LLC');
    expect(res.body.currency).toBe('AZN');
  });
});

describe('RBAC', () => {
  let opToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testop1', password: 'op1234' });
    opToken = res.body.token;
  });

  test('Operator cannot delete products', async () => {
    const db = getDb();
    const product = db.prepare("SELECT id FROM products WHERE sku = 'TEST-001'").get();
    const res = await request(app)
      .delete(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);
  });

  test('Operator cannot access user management', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);
  });

  test('Operator can create products', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ sku: 'OP-TEST-001', name: 'Operator Product', unit_cost: 1, unit_sell: 5 });
    expect(res.status).toBe(201);
  });

  test('Operator cannot update settings', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ company: 'Hacked' });
    expect(res.status).toBe(403);
  });
});
