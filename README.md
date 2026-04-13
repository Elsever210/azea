# VSF Global Cargo v2.0

Full-stack ERP for express cargo operations (China → Azerbaijan). Node.js + Express backend with SQLite, vanilla JS modular frontend.

## Features

- **RBAC Auth** — JWT-based authentication with Admin / Operator / Customer roles
- **Products** — CRUD with SKU, cost/sell pricing, weight, HS codes
- **Orders** — Multi-item orders with status workflow, customer scoping
- **Shipments** — Route/AWB management with order linking
- **Tracking** — Real-time tracking via FedEx, UPS, DHL APIs + demo provider
- **Inventory** — Stock adjustments with audit log, auto-rebuild from orders
- **Finance** — Revenue/cost/profit P&L with period filtering
- **Reports** — File upload/download linked to shipments/orders
- **Notifications** — SMS (Twilio) + Email (SendGrid)
- **i18n** — Azerbaijani, English, Russian
- **PWA** — Installable, offline-capable

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 4 |
| Database | SQLite (better-sqlite3, WAL mode) |
| Auth | JWT + bcrypt + RBAC middleware |
| Security | Helmet, CORS, rate limiting, express-validator |
| Frontend | Vanilla JS (IIFE modules), CSS custom properties |
| Testing | Jest + Supertest (28 tests) |

## Quick Start

```bash
# Install dependencies
npm install

# Seed database (creates admin/operator users + sample products)
npm run seed

# Start server
npm start        # http://localhost:3000
npm run dev       # with --watch (auto-restart)
```

Default logins:
- Admin: `admin` / `admin123`
- Operator: `operator1` / `operator123`

## Configuration

Copy `.env.example` to `.env` and edit:

```env
PORT=3000
JWT_SECRET=your-secret-key
DB_PATH=./server/db/ops.db

# Optional: Tracking providers
FEDEX_API_KEY=
UPS_CLIENT_ID=
DHL_API_KEY=

# Optional: Notifications
TWILIO_ACCOUNT_SID=
SENDGRID_API_KEY=
```

## API Endpoints

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/auth/login` | POST | — | Login |
| `/api/auth/register` | POST | Admin | Create user |
| `/api/auth/me` | GET | Any | Current user |
| `/api/auth/users` | GET | Admin | List users |
| `/api/products` | GET, POST | Any / Auth | Products CRUD |
| `/api/products/:id` | GET, PUT, DELETE | Auth / Admin(del) | Product detail |
| `/api/orders` | GET, POST | Auth | Orders CRUD |
| `/api/orders/:id` | GET, PUT, DELETE | Auth | Order detail |
| `/api/shipments` | GET, POST | Auth | Shipments CRUD |
| `/api/shipments/:id` | GET, PUT, DELETE | Auth | Shipment detail |
| `/api/tracking/:id` | GET | Auth | Tracking events |
| `/api/tracking/:id/track` | POST | Auth | Fetch from provider |
| `/api/tracking/:id/event` | POST | Auth | Add manual event |
| `/api/inventory` | GET | Auth | Stock levels |
| `/api/inventory/adjust` | POST | Auth | Adjust stock |
| `/api/finance` | GET | Auth | P&L report |
| `/api/reports` | GET, POST | Auth | Reports CRUD |
| `/api/settings` | GET, PUT | Auth / Admin(put) | App settings |
| `/api/notifications/send` | POST | Auth | Send SMS/Email |

## Project Structure

```
├── server/
│   ├── index.js              # Express app + middleware
│   ├── config.js             # Environment config
│   ├── db/
│   │   ├── schema.sql        # SQLite schema (12 tables)
│   │   ├── index.js          # DB connection (lazy init)
│   │   └── seed.js           # Sample data seeder
│   ├── middleware/
│   │   └── auth.js           # JWT verify + RBAC
│   ├── routes/               # 10 route modules
│   └── services/
│       ├── tracking.js       # FedEx/UPS/DHL/Demo adapters
│       └── notifications.js  # Twilio SMS + SendGrid Email
├── public/
│   ├── index.html            # SPA shell
│   ├── styles.css            # Dark theme
│   ├── manifest.webmanifest  # PWA manifest
│   ├── sw.js                 # Service worker
│   ├── js/
│   │   ├── app.js            # Main orchestrator
│   │   ├── api.js            # HTTP client
│   │   ├── i18n.js           # Internationalization
│   │   ├── utils.js          # Helpers
│   │   └── components/       # 11 UI modules
│   └── lang/                 # az.json, en.json, ru.json
├── tests/
│   ├── api.test.js           # 28 integration tests
│   ├── setup.js              # Test DB setup
│   └── teardown.js           # Test DB cleanup
├── package.json
├── .env.example
└── .gitignore
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

28 tests covering: Auth, CRUD (products/orders/shipments), tracking, inventory, finance, settings, and RBAC enforcement.

## Mobile App (Capacitor)

Capacitor is already configured in this project with native folders:

- `android/`
- `ios/`

### 1) Build web assets + sync native projects

```bash
npm run cap:sync
```

### 2) Open native projects

```bash
npm run cap:android
npm run cap:ios
```

### 3) API base URL for mobile webview

The app uses runtime config from `public/js/config.js`.

Priority order:
1. `?apiBase=...` query string
2. `localStorage.apiBaseUrl`
3. `window.__API_BASE__`
4. default fallback

Default fallback is:
- Web: `/api`
- File protocol (mobile wrapper): `http://10.0.2.2:3000/api` (Android emulator)

To set a production API URL on device, run this in WebView console once:

```js
localStorage.setItem('apiBaseUrl', 'https://your-domain.com/api')
```

Then restart the app.
