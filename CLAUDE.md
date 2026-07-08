# Porto — Claude Code Project Instructions

## Commands

```bash
# Dev
docker compose up -d                    # start local Postgres (port 5435)
npm run dev                             # BE (port 3002) + FE (port 5174) concurrently
npm run dev:fresh                       # docker up + BE + FE (first run / after docker restart)

# Or run separately:
cd backend && npm run start:dev         # NestJS dev server (port 3002)
cd frontend && npm run dev              # Vite dev server (port 5174)

# Build
npm run build:all                       # frontend → backend → copy dist → backend/public/

# Test
cd backend && npm test                  # Jest unit tests
cd backend && npm run test:e2e          # e2e tests
```

## Architecture

Single Railway service: NestJS serves the React SPA from `backend/public/` and exposes all API under `/api`. In dev, frontend hits `http://localhost:3002/api` directly (no Vite proxy). Base currency defaults to USD, with concurrent dual-currency display support for both USD and THB.

## Backend Patterns

**TypeORM** — `synchronize: true` in dev only; prod applies committed migrations on boot (`migrationsRun`). After changing an entity, generate a migration against a scratch DB (`npm run migration:generate -- src/migrations/Name` with `DB_DATABASE=<scratch>`; see "Workflow note" in `docs/security-remediation-plan.md`) and commit it — prod schema will not update otherwise. Entity list lives in `src/entities.ts` (shared by `app.module.ts` and the CLI `src/data-source.ts`). Numeric columns use `NUMERIC(20,8)` with a `from: parseFloat` transformer — never store JS floats directly.

**JWT Auth** — `JwtAuthGuard` is global; routes opt out with `@Public()`. The `@CurrentUser()` decorator extracts `{ userId, email }` from the token. Boot throws unless `JWT_SECRET` is set and ≥32 chars (no fallback). Register requires `@MinLength(8)` passwords (login stays at 4 for legacy users).

**Rate limiting & headers** — `@nestjs/throttler` global 100/min with overrides: login 5/min, register 3/min, demo 2/hour (`trust proxy` set in `main.ts` for Railway). `helmet` adds a CSP allowing only self + Google Fonts; styles keep `'unsafe-inline'` for the SPA's inline style props.

**Position Service** (`src/position/position.service.ts`) — pure math, no DB. Takes `Transaction[]` sorted oldest→newest, returns `{ quantity, avgCost, totalCost, realizedPnl }`. Used by net-worth and assets services. Do not add DB calls here.

**Prices Service** (`src/prices/prices.service.ts`) — in-process `Map<string, { data, expiresAt }>` cache (60s crypto, 90s stocks). Yahoo Finance requires crumb auth: try direct → if 401, fetch crumb from `query2.finance.yahoo.com/v1/test/getcrumb` → retry. Thai stocks append `.BK` to symbol. Crypto prices come from Binance (batch first, falling back to per-symbol requests then Yahoo for unsupported symbols); THB/USD FX is derived from Yahoo `THB=X` (60s cache). Symbols are regex-validated in `prices.controller.ts` and `encodeURIComponent`-ed into upstream URLs.

**Demo Seed** — `POST /api/auth/demo` creates an isolated `is_demo=true` user then calls `SeedService.seedDemoUser(userId)`. Each demo call creates a brand-new user (no shared demo account). `DemoCleanupService` (`src/seed/demo-cleanup.service.ts`) deletes demo users older than 48h via an hourly cron; FK cascades remove their data.

## Frontend Patterns

**Tailwind tokens** are in `frontend/tailwind.config.js`. Custom colors: `surface (#FAF5EC)`, `dark (#3d3328)`, `primary (#b45a3c)`, `muted (#8a7d6c)`, `positive`/`negative` with text+bg variants. Font is `Anuphan` loaded from Google Fonts.

**Currency Display** — Default base currency is USD. All USD numbers are strictly formatted to 2 decimal places. Dual-currency display shows both USD and THB inline/stacked, with the secondary currency (in parentheses) styled smaller (`text-[0.72em]`) for hierarchical clarity.

**Per-Asset Native Currency** — Each asset is denominated in its own native currency (`THB` or `USD`), chosen in `AssetModal` at creation (defaults: crypto/us = USD, th/fund/deposit = THB; th/us should match the Yahoo listing currency). Currency is locked after creation. Transactions (price/fee, and deposit amounts) are stored in the asset's native currency; modals convert from the display currency on entry via `toNative`/`fromNative` helpers. The backend fetches crypto prices in the asset's native currency (`val[currency]`), and aggregation converts native→THB base via `multiplier = asset.currency === 'USD' ? fx : 1`.

**Modal Layout** — Modals (Asset, Transaction, Portfolio, Liability, Price) use `max-w-[440px]`, `py-[26px] px-[28px]`, and `rounded-[24px]`. The Chart modal uses `max-w-[640px]`. Forms use `gap-[14px]`. Labels use `text-[12.5px] font-semibold text-muted mb-[6px]`. Inputs/selects use `py-[10px] px-[14px] rounded-[12px] text-[14px]`. Segmented toggles use `py-[9px] rounded-[12px]`. Cancel/Save footer buttons use `py-[9px] px-[18px]` / `py-[9px] px-[22px]` with `text-[13.5px]`.

**State split** — TanStack Query for all server state (portfolios, assets, transactions, prices). Zustand (`src/store/useStore.ts`) for: `user`, `token`, `page`, `currency` (THB|USD), and modal open/close state. After price refetch, call `POST /api/net-worth/snapshot` to record history.

**Charts** — custom SVG only, no chart library. Area chart `viewBox="0 0 1100 170"` with `linearGradient`. Donut uses CSS `conic-gradient`. Bar chart uses SVG `<rect>` elements.

**Auth persistence** — token stored in `localStorage` as `porto-token-v1`, user as `porto-user-v1`. The Axios interceptor auto-clears both and reloads on 401.

**API client** — `src/api/apiClient.ts` uses `import.meta.env.DEV` to switch baseURL between `http://localhost:3002/api` (dev) and `/api` (prod).

## Environment

Local Postgres runs on **port 5435** (not 5432) — `docker-compose.yml` maps `5435:5432`. The backend `.env` already reflects this.

Toggles:
- `ENABLE_DEMO`: Toggles the frontend "Try Demo" mode and seeder endpoints (default: `false`).
- `ENABLE_REGISTER`: Toggles the signup flow frontend and signup backend endpoint (default: `true`).

Production env vars required on Railway: `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `JWT_EXPIRES_IN`, `NODE_ENV=production`, `ENABLE_DEMO`, `ENABLE_REGISTER`. Optional: `CORS_ORIGINS` (comma-separated; empty = closed, fine since the SPA is same-origin). SSL is auto-enabled for non-localhost `DATABASE_URL`.

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/app.module.ts` | TypeORM config, module wiring, ServeStatic setup |
| `backend/src/main.ts` | Global prefix `/api`, ValidationPipe, CORS, helmet CSP |
| `backend/src/entities.ts` | Shared entity list (app + migration CLI) |
| `backend/src/data-source.ts` | TypeORM CLI DataSource for `migration:*` scripts |
| `backend/src/position/position.service.ts` | Avg-cost engine — keep pure |
| `backend/src/prices/prices.service.ts` | Price proxy + cache |
| `backend/src/seed/seed.service.ts` | Demo data generator |
| `frontend/src/store/useStore.ts` | All client state |
| `frontend/src/api/apiClient.ts` | Axios instance + interceptors |
| `frontend/tailwind.config.js` | Design tokens |
| `package.json` (root) | `build:all` script for Railway |
