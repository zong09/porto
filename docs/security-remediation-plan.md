# Porto — Security Audit & Remediation Plan

Audit date: 2026-07-08 · Scope: `backend/` (NestJS) + `frontend/` (React/Vite) · Branch: `develop`

## Summary

Authorization scoping is solid — every controller/service (portfolios, assets, transactions, liabilities, backup) filters by `userId` from the JWT, and the global `ValidationPipe` runs with `whitelist` + `forbidNonWhitelisted`. Backup encryption is done correctly (scrypt + AES-256-GCM with random salt/IV/auth tag). No hardcoded API keys, no `dangerouslySetInnerHTML`, frontend `npm audit` is clean.

The real risks are configuration-level: a committed JWT secret fallback, wide-open CORS with credentials, zero rate limiting on public auth endpoints, and 6 high-severity backend dependency advisories.

---

## Findings

### 🔴 Critical

**C1. Hardcoded JWT_SECRET fallback committed to git**
`backend/src/auth/auth.module.ts:22`
```ts
secret: config.get<string>('JWT_SECRET', 'this-is-a-super-secret-key-for-porto-app'),
```
The fallback string is public in the repository. If `JWT_SECRET` is ever missing in production (typo, new environment, Railway misconfig), anyone can forge a valid token for **any userId** and read/modify all data. Silent failure mode — the app boots fine.

**Fix:** fail fast instead of falling back:
```ts
useFactory: (config: ConfigService) => {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set (>= 32 chars)');
  }
  return { secret, signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') } };
},
```
Also rotate the production `JWT_SECRET` on Railway, since the fallback value may have been live at some point.

### 🟠 High

**H1. CORS `origin: '*'` with `credentials: true`**
`backend/src/main.ts:25-29`. Wildcard origin in production; the comment even says "refine this". With Bearer-token auth the practical risk is any website being able to call the API if it obtains a token, plus it masks misconfiguration.

**Fix:** allowlist by env:
```ts
app.enableCors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.APP_ORIGIN].filter(Boolean)
    : ['http://localhost:5174'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
});
```
(Prod serves the SPA same-origin from `backend/public`, so prod CORS can be near-closed. Drop `credentials: true` — auth is header-based, not cookie-based.)

**H2. No rate limiting — brute force + demo-seed abuse**
No `@nestjs/throttler` anywhere. Public endpoints:
- `POST /api/auth/login` — unlimited password brute force (compounded by M3's 4-char minimum).
- `POST /api/auth/demo` — every call creates a user **and seeds a full demo dataset**. A trivial loop fills the Postgres instance (DoS + storage cost on Railway).
- `POST /api/auth/register` — mass account creation.

**Fix:** add `@nestjs/throttler` with a global default (e.g. 100/min/IP) and strict overrides: login 5/min, register 3/min, demo 2/hour per IP. Additionally add a scheduled cleanup deleting `is_demo=true` users older than 48h (cascade removes their data).

**H3. Backend dependency vulnerabilities — 6 high, 1 moderate**
`npm audit` in `backend/`: high advisories through `@nestjs/core` / `@nestjs/platform-express` (multer chain) affecting core, serve-static, testing, typeorm; moderate `js-yaml` DoS. Frontend is clean.

**Fix:** upgrade `@nestjs/*` to the current patched line (`npm audit fix`, and where it requires a major bump, upgrade Nest 10→11 packages together), then re-run `npm audit` and the e2e suite.

### 🟡 Medium

**M1. TypeORM `synchronize: true` in production**
`backend/src/app.module.ts:49` (documented in CLAUDE.md as intentional). Any entity refactor (rename/narrow a column) can silently drop or mangle production data on deploy.

**Fix (when convenient):** `synchronize: config.get('NODE_ENV') !== 'production'` + TypeORM migrations for prod. Interim mitigation: enable automated Postgres backups on Railway.

**M2. DB TLS `rejectUnauthorized: false`**
`backend/src/app.module.ts:53`. Encrypts the connection but accepts any certificate → MITM-able. Common Railway pattern, but if Railway offers a CA bundle, verify it; otherwise document as accepted risk.

**M3. Password minimum length = 4**
`backend/src/auth/auth.controller.ts:14,22` (`@MinLength(4)`). Combined with no rate limiting this makes online brute force realistic.

**Fix:** `@MinLength(8)` (backup controller already requires 8 — align). Apply to register only; keep login validation loose so existing users can still sign in.

**M4. JWT in localStorage (`porto-token-v1`)**
Documented pattern in `frontend/src`. Any XSS = token theft. No CSP headers to reduce XSS surface, no `helmet`.

**Fix (pragmatic for this app):** keep localStorage but (a) add `helmet` + a CSP allowing only self/Google Fonts, (b) keep token expiry at 7d or lower. Full fix (httpOnly cookie + CSRF) is a larger refactor — schedule only if the app becomes multi-user/public.

**M5. Unvalidated symbol interpolation into upstream price URLs**
`backend/src/prices/prices.service.ts:52,76,169` — Binance URLs interpolate `symbol`/`ids` without encoding (Yahoo path at `:343` does use `encodeURIComponent`). Host is fixed so no SSRF, but query-param injection can distort requests and poison the cache. Endpoints are authenticated, so severity is medium-low.

**Fix:** validate with `/^[A-Za-z0-9.\-]{1,15}$/` in `prices.controller.ts` before calling the service, and `encodeURIComponent` in every URL.

### 🟢 Low

- **L1. User enumeration on register** — `ConflictException('อีเมลนี้ถูกใช้งานแล้ว')` (`auth.service.ts:46`) reveals whether an email exists. Login is uniform (good). Acceptable for a personal app; note only.
- **L2. Emails in logs** — login/register logs include full email (`auth.service.ts:40,63`). PII in Railway logs; mask if logs are shared.
- **L3. Shared demo password** — all demo users get `'demo-password'` (`auth.service.ts:98`) with guessable `demo-xxxxxx@porto.app` emails (6-char base36 space, brute-forceable via login). Demo data is throwaway, but H2's cleanup + login throttle covers it.

### ✅ Checked, no issue

- Ownership/authZ: all of assets, transactions, portfolios, liabilities, backup scope every query by `userId` (join through portfolio where needed).
- SQL injection: TypeORM query builder with bound parameters throughout; no raw string SQL.
- Input validation: global `ValidationPipe { whitelist, transform, forbidNonWhitelisted }` + class-validator DTOs.
- Backup crypto: scrypt KDF, AES-256-GCM, random 32B salt + 12B IV + auth tag.
- Secrets: `.env` git-ignored; tracked `backend/.env.dev` is an empty template; no hardcoded keys in source; frontend bundle has no secrets.
- `ENABLE_DEMO` / `ENABLE_REGISTER` enforced server-side (`auth.service.ts:41,90`), not just frontend.
- Frontend: no `dangerouslySetInnerHTML` / `innerHTML`; `npm audit` clean.

---

## Remediation plan

### Phase 1 — ✅ done 2026-07-08
1. ✅ **C1**: JWT_SECRET fallback removed; boot now throws unless secret is set and ≥32 chars (`auth.module.ts`). **Still to do manually: rotate `JWT_SECRET` on Railway.**
2. ✅ **H2**: `@nestjs/throttler` added — global 100/min, login 5/min, register 3/min, demo 2/hour. `trust proxy` enabled in `main.ts` so limits key on the real client IP behind Railway. Verified live: 6th rapid login attempt returns 429.
3. ✅ **H1**: CORS now env-based — prod uses `CORS_ORIGINS` (comma-separated, empty = closed, fine since the SPA is served same-origin), dev allows `http://localhost:5174`; `credentials: true` dropped.
4. ✅ **M3**: register password `@MinLength(8)` (login still accepts 4+ so existing users can sign in).
5. ✅ **M5**: symbol/range regex validation in `prices.controller.ts`, `days` bounds check, `encodeURIComponent` on Binance URLs.

### Phase 2 — this week (~half day)
6. **H3**: upgrade `@nestjs/*` packages, clear `npm audit`, run unit + e2e tests.
7. **M4**: add `helmet` with CSP (self + fonts.googleapis.com/fonts.gstatic.com).
8. **H2b**: cron/scheduled job deleting demo users older than 48h.

### Phase 3 — scheduled (larger changes)
9. **M1**: disable `synchronize` in prod, adopt TypeORM migrations; enable Railway Postgres backups first.
10. **M2**: verify Railway DB certificate if a CA bundle is available.
11. (Only if going public/multi-user) httpOnly-cookie auth + CSRF to replace localStorage tokens.
