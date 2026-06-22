# Porto — Gemini Developer Project Instructions

## Commands

```bash
# Development
docker compose up -d                    # Start local Postgres container on port 5435
npm run dev                             # Start NestJS backend (port 3002) & React frontend (port 5174) concurrently
npm run dev:fresh                       # Docker Compose up + concurrent backend & frontend servers

# Separate execution
cd backend && npm run start:dev         # Start NestJS backend on port 3002
cd frontend && npm run dev              # Start Vite development server on port 5174

# Compiling & Building
npm run build:all                       # Builds frontend → backend → copies frontend build to backend public

# Testing
cd backend && npm test                  # Run NestJS Unit tests
cd backend && npm run test:e2e          # Run NestJS End-to-End (e2e) tests
```

---

## Architecture Overview

Porto runs as a unified service in production (e.g. Railway):
- **Server**: NestJS serves statically built React SPA pages out of `backend/public/`.
- **API**: Exposed under the `/api` prefix.
- **Client**: Built with React 19 + Vite. In local development, the client connects to `http://localhost:3000/api` directly without Vite proxying.
- **Base Currency & Dual Currency**: Default base currency is USD. Application supports concurrent dual-currency display for both USD and THB.

---

## Backend Patterns

1. **TypeORM Configuration**:
   - `synchronize: true` is configured in both development and production for automatic migrations.
   - For monetary and asset metrics, use `NUMERIC(20,8)` columns with a `from: parseFloat` transformer. Do not store JavaScript floats directly.
2. **Authentication**:
   - `JwtAuthGuard` is enabled globally.
   - Exclude specific public routes (like login, register, config) using the `@Public()` custom decorator.
   - Extract user details inside controllers using `@CurrentUser()`.
3. **Avg-Cost Math Engine (Pure)**:
   - Position calculations are computed inside [position.service.ts](file:///Users/pchayphiphitthaphan/Gits/porto/backend/src/position/position.service.ts). This is a pure mathematics service; do not perform database queries or TypeORM operations inside this file.
4. **Third-Party Price Fetching**:
   - [prices.service.ts](file:///Users/pchayphiphitthaphan/Gits/porto/backend/src/prices/prices.service.ts) caches rates for 60 seconds (crypto) and 90 seconds (stocks).
   - Yahoo Finance calls retry with crumb validation (`query2.finance.yahoo.com/v1/test/getcrumb`) on 401 errors.
   - For Thai stock symbols, append `.BK` to the query.
   - Always request `bitcoin` to extract live THB/USD currency rates.

---

## Frontend Patterns

1. **Design Tokens & Fonts**:
   - The palette is configured in [tailwind.config.js](file:///Users/pchayphiphitthaphan/Gits/porto/frontend/tailwind.config.js): `surface (#FAF5EC)`, `dark (#3d3328)`, `terracotta (#b45a3c)`, `muted (#8a7d6c)`, `chipBg (#f0e7d8)`.
   - Typography uses the `Anuphan` font loaded from Google Fonts.
2. **State Management**:
   - Server-side data fetching uses TanStack Query.
   - Client-side states (modals, currency, user auth, page routes) use Zustand inside [useStore.ts](file:///Users/pchayphiphitthaphan/Gits/porto/frontend/src/store/useStore.ts).
3. **Currency Display Rules**:
   - Default base currency is USD.
   - Enforce USD values are formatted to exactly 2 decimal places.
   - Secondary currency (shown in parentheses, e.g. `(฿495)`) is formatted using `text-[0.72em] text-faint ml-1.5 font-semibold` to distinguish it visually from the primary currency.
   - **Per-asset native currency**: Each asset is denominated in its own native currency (`THB` or `USD`), chosen in `AssetModal` at creation (defaults: crypto/us = USD, th/fund/deposit = THB; th/us should match the Yahoo listing currency) and locked afterwards. Transactions (price/fee and deposit amounts) are stored in the asset's native currency; modals convert from the display currency on entry via `toNative`/`fromNative` helpers. The backend reads crypto prices in the asset's native currency (`val[currency]`) and aggregation converts native→THB base via `multiplier = asset.currency === 'USD' ? fx : 1`.
4. **SVG Visualizations (No D3/Libraries)**:
   - All charts are constructed manually with SVG primitives (e.g., SVG paths, linear gradients, and conic-gradients).
5. **Modals Size & Dimensions**:
   - Standard modals (Asset, Transaction, Portfolio, Liability, Price) use a max-width of `440px`, padding `py-[26px] px-[28px]`, and border-radius `rounded-[24px]`.
   - The Chart modal uses a max-width of `640px` with the same padding and border-radius.
   - Form fields use `gap-[14px]` layout spacing. Labels use `text-[12.5px] font-semibold text-muted mb-[6px]`. Inputs/selects use `py-[10px] px-[14px] rounded-[12px] text-[14px]`.
   - Segmented buttons use `py-[9px] rounded-[12px]`. Modal footer action buttons use Cancel (`py-[9px] px-[18px]`) and Save/Submit (`py-[9px] px-[22px]`) with `text-[13.5px] font-bold`.

---

## Environment Variables

### Backend Environment (`backend/.env` / `backend/.env.dev`)

```env
DB_HOST=localhost
DB_PORT=5435
DB_USERNAME=postgres
DB_PASSWORD=postgrespassword
DB_DATABASE=porto
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
PORT=3000
ENABLE_DEMO=false
ENABLE_REGISTER=true
```

- `ENABLE_DEMO`: Toggles the frontend "Try Demo" mode and blocks/allows the seeder backend endpoints.
- `ENABLE_REGISTER`: Toggles the frontend Signup/Registration page and controls user signups.

### Production Environment (e.g. Railway)

```
DATABASE_URL=<database-url>
JWT_SECRET=<jwt-secret-string>
JWT_EXPIRES_IN=7d
NODE_ENV=production
ENABLE_DEMO=false
ENABLE_REGISTER=true
```

---

## Key Project Files

| File | Purpose |
|------|---------|
| [app.module.ts](file:///Users/pchayphiphitthaphan/Gits/porto/backend/src/app.module.ts) | Backend routing configuration, ServeStatic, TypeORM integration |
| [main.ts](file:///Users/pchayphiphitthaphan/Gits/porto/backend/src/main.ts) | NestJS initialization, CORS, global validation pipes |
| [position.service.ts](file:///Users/pchayphiphitthaphan/Gits/porto/backend/src/position/position.service.ts) | Average cost computation math engine |
| [prices.service.ts](file:///Users/pchayphiphitthaphan/Gits/porto/backend/src/prices/prices.service.ts) | Crypto & Stock pricing proxy + cache layer |
| [useStore.ts](file:///Users/pchayphiphitthaphan/Gits/porto/frontend/src/store/useStore.ts) | Zustand frontend state store |
| [apiClient.ts](file:///Users/pchayphiphitthaphan/Gits/porto/frontend/src/api/apiClient.ts) | Axios client with dynamic base URL and auth headers |
| [tailwind.config.js](file:///Users/pchayphiphitthaphan/Gits/porto/frontend/tailwind.config.js) | Frontend styling design tokens |
| [package.json](file:///Users/pchayphiphitthaphan/Gits/porto/package.json) | Workspace runner script configurations |
