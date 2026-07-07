# Porto — Personal Net Worth & Investment Tracker

A full-stack web application for tracking personal net worth across crypto, Thai/US stocks, mutual funds, deposits, and liabilities. Default base currency is USD, with concurrent dual-currency display support for both USD and THB. Each asset is denominated in its own native currency (THB or USD), set at creation. Live prices via CoinGecko + Yahoo Finance. Deployable as a single service on Railway.

**Current version:** `1.0.7`

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 · Vite · TypeScript · Tailwind CSS |
| State | TanStack Query (server) · Zustand (client) |
| Backend | NestJS 11 · TypeORM · PostgreSQL |
| Auth | JWT (bcrypt passwords) |
| Prices | CoinGecko API · Yahoo Finance API |
| Deploy | Railway (single service — NestJS serves React build) |

## Local Development

The fastest way to start the application is using the root workspace scripts:

### Quick Start

```bash
# 1. Install root dependencies (which installs concurrently)
npm install

# 2. Start PostgreSQL + backend + frontend in one command
npm run dev:fresh
```

### Alternatively, run components separately:

#### 1. Start PostgreSQL

```bash
docker compose up -d
```

PostgreSQL runs on **port 5435** (mapped from container 5432) to avoid conflicts with local Postgres installs.

#### 2. Start Backend & Frontend Concurrently

```bash
npm run dev
```

#### Or Run Individually

**Backend:**
```bash
cd backend
npm install
npm run start:dev
```
Backend runs at `http://localhost:3002`. API prefix: `/api`.

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5174`. In dev mode, API calls go directly to `http://localhost:3002/api`.

## Environment Variables

### Backend (`backend/.env`)

```env
DB_HOST=localhost
DB_PORT=5435
DB_USERNAME=postgres
DB_PASSWORD=postgrespassword
DB_DATABASE=porto
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
PORT=3002
ENABLE_DEMO=false
ENABLE_REGISTER=true
```

- `ENABLE_DEMO`: Enables or disables the "Try Demo" button on the login screen and blocks/allows the backend seeder endpoint (default: `false`).
- `ENABLE_REGISTER`: Enables or disables user registration frontend tab and blocks/allows backend signups (default: `true`).

### Railway (production)

Set these in the Railway service dashboard:

```
DATABASE_URL=<provided by Railway Postgres plugin>
JWT_SECRET=<strong random string>
JWT_EXPIRES_IN=7d
NODE_ENV=production
ENABLE_DEMO=false
ENABLE_REGISTER=true
```

When `DATABASE_URL` is set it takes precedence over individual `DB_*` vars. SSL is enabled automatically for non-localhost URLs.

## Project Structure

```
porto/
├── frontend/               # React 19 + Vite + TypeScript
│   └── src/
│       ├── api/            # Axios client with JWT interceptor
│       ├── components/     # TopNav, LiveTicker, SankeyCard, 6 modals
│       ├── hooks/          # useApi.ts (TanStack Query wrappers)
│       ├── pages/          # Login, Overview, Portfolios, Transactions,
│       │                   # Liabilities, Settings
│       └── store/          # Zustand store (auth, page, modals, currency)
├── backend/                # NestJS 11 + TypeORM
│   └── src/
│       ├── auth/           # JWT register / login / demo
│       ├── portfolios/     # Portfolio CRUD
│       ├── assets/         # Asset CRUD (crypto|th|us|fund|deposit)
│       ├── transactions/   # Transaction CRUD (with createdAt timestamp)
│       ├── liabilities/    # Liability CRUD + liability transactions
│       ├── net-worth/      # Summary, history, snapshot
│       ├── prices/         # CoinGecko + Yahoo Finance proxy with in-process cache
│       ├── position/       # Pure avg-cost math engine (no DB)
│       ├── backup/         # Encrypted export & import (AES-256-GCM)
│       ├── logger/         # Custom logging service
│       └── seed/           # Demo data seeder
├── docker-compose.yml      # Local Postgres on port 5435
└── package.json            # Root workspace scripts
```

## API Routes

All routes are prefixed with `/api` and require JWT except auth endpoints.

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/demo          # creates isolated demo user with seed data
GET    /api/auth/me
POST   /api/auth/clear         # wipe all user data

GET/POST/PATCH/DELETE  /api/portfolios/:id?
GET/POST/PATCH/DELETE  /api/assets/:id?
GET/POST/DELETE        /api/transactions/:id?
GET/POST/PATCH/DELETE  /api/liabilities/:id?

GET   /api/net-worth/summary
GET   /api/net-worth/history?days=365
POST  /api/net-worth/snapshot

POST  /api/backup/export
POST  /api/backup/import

GET   /api/prices/crypto?ids=bitcoin,ethereum&vs_currencies=thb,usd
GET   /api/prices/crypto/:coinId/history?days=30
GET   /api/prices/stock/:symbol
GET   /api/prices/stock/:symbol/history?range=1M
GET   /api/prices/fx
```

## Build & Deploy (Railway)

### Build all

```bash
npm run build:all
```

Runs: `frontend build → backend build → copy frontend dist → backend/public/`

NestJS serves the React SPA from `backend/public/` and falls back to `index.html` for non-`/api` routes.

### Railway setup

1. Create a Railway project → add a **Postgres** plugin
2. Add a service pointing to this repo
3. Set env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV=production`
4. Railway runs `npm run build:all` then `node dist/main`

## Demo Mode

`POST /api/auth/demo` creates a fresh isolated user (`is_demo=true`) with seed data: 3 portfolios, 10 assets, 15 transactions, 3 liabilities, 12 months of net-worth history. The Login page has a **Try Demo** button.

## Data Backup

Users can export and import their entire dataset securely. 
- **Encryption**: Uses **AES-256-GCM** (Node.js built-in `crypto`) to encrypt the JSON payload.
- **Key Derivation**: The password provided by the user is passed through `scrypt` to generate a 256-bit encryption key.
- **Payload**: Includes Portfolios, Assets, Transactions, Liabilities, and Net Worth History.
- **Restore**: Replaces all existing user data with the decrypted payload within a database transaction.

## Design

Design spec in `design_handoff_portfolio_tracker/`. Key tokens:

- Font: Anuphan (Google Fonts)
- Primary: `#b45a3c` · Surface: `#FAF5EC` · Dark: `#3d3328`
- Charts: custom SVG — no chart library dependency

### Visualisations

- **Treemap** — net-worth breakdown on the Overview page; uses min-area redistribution for legibility
- **Sankey diagram** — fund-flow visualisation showing portfolio allocations
- **Line / area charts** — price history rendered with raw SVG paths and linear gradients

All charts are built with vanilla SVG primitives (no D3 or external chart libraries).
