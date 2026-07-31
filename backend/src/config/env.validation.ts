/**
 * Boot-time environment validation.
 *
 * Previously a single unvalidated string, `NODE_ENV === 'production'`, gated
 * TypeORM's `synchronize`, whether migrations ran, and the CORS allowlist. A
 * missing or misspelled value (`Production`, `prod`, unset) silently flipped all
 * three the wrong way at once: auto-sync rewriting the live schema, migrations
 * never applying, and CORS falling back to allowing the local Vite origin.
 *
 * Rather than make every developer configure more, the fix pins down the one
 * condition that distinguishes a deployment from a laptop — a database that
 * isn't local — and refuses to boot if that doesn't line up with NODE_ENV. Local
 * defaults keep working untouched; a deployed box cannot come up mislabelled.
 *
 * Same spirit as the existing `JWT_SECRET` guard in `auth.module.ts`.
 */

export type NodeEnv = 'development' | 'test' | 'production';

const NODE_ENVS: NodeEnv[] = ['development', 'test', 'production'];

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'host.docker.internal',
  'postgres',
  'db',
]);

/**
 * True when the Postgres host is this machine (or a sibling container).
 *
 * Compares a parsed hostname rather than doing a substring match: the old
 * `url.includes('localhost')` check also matched hostile hostnames such as
 * `db.localhost.attacker.com`, which would have disabled TLS entirely.
 */
export function isLocalDatabaseUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // Unparseable URL — treat as remote so TLS stays on. The driver will
    // surface the real error.
    return false;
  }
  return LOCAL_HOSTNAMES.has(hostname);
}

function isLocalHostname(host: string): boolean {
  return LOCAL_HOSTNAMES.has(host.trim());
}

function fail(message: string): never {
  throw new Error(`Invalid environment configuration: ${message}`);
}

export function validateEnv(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const config = { ...raw };

  // --- NODE_ENV -------------------------------------------------------------
  const rawNodeEnv = config.NODE_ENV;
  if (rawNodeEnv === undefined || rawNodeEnv === '') {
    // Unset is normal for `npm run start:dev`, so default rather than throw.
    // The deployment guard below is what catches a server that forgot to set it.
    config.NODE_ENV = 'development';
  } else if (!NODE_ENVS.includes(rawNodeEnv as NodeEnv)) {
    fail(
      `NODE_ENV must be one of ${NODE_ENVS.join(', ')} (received "${String(rawNodeEnv)}"). ` +
        'Casing and abbreviations are rejected on purpose, because synchronize, ' +
        'migrationsRun and the CORS allowlist all depend on this value.',
    );
  }
  const nodeEnv = config.NODE_ENV as NodeEnv;
  const isProd = nodeEnv === 'production';

  // --- The deployment guard -------------------------------------------------
  // A deployment always talks to a non-local database. If that's the case but
  // NODE_ENV isn't 'production', the process would auto-sync the schema, skip
  // migrations, and widen CORS — so refuse to start instead.
  const databaseUrl = config.DATABASE_URL as string | undefined;
  const dbHost = config.DB_HOST as string | undefined;

  const remoteDatabase = databaseUrl
    ? !isLocalDatabaseUrl(databaseUrl)
    : dbHost
      ? !isLocalHostname(dbHost)
      : false;

  if (remoteDatabase && !isProd) {
    fail(
      `the database host is remote but NODE_ENV is "${nodeEnv}". ` +
        'Set NODE_ENV=production on deployed environments — otherwise TypeORM would ' +
        'auto-synchronize the live schema, committed migrations would not run, and CORS ' +
        'would allow http://localhost:5174.',
    );
  }

  // --- Production requirements ----------------------------------------------
  // Closes the committed-default-credentials path: without this, a production
  // box missing DATABASE_URL would silently fall back to the localhost DB_*
  // defaults in app.module.ts instead of failing to boot.
  if (isProd && !databaseUrl) {
    fail('DATABASE_URL is required when NODE_ENV=production');
  }

  // --- Optional explicit escape hatch ---------------------------------------
  // DB_SYNC lets a developer force schema auto-sync off (or a test harness force
  // it on) without lying about NODE_ENV. It can never enable it in production.
  const rawDbSync = config.DB_SYNC;
  if (rawDbSync !== undefined && rawDbSync !== '') {
    if (rawDbSync !== 'true' && rawDbSync !== 'false') {
      fail(`DB_SYNC must be "true" or "false" (received "${String(rawDbSync)}")`);
    }
    if (rawDbSync === 'true' && isProd) {
      fail(
        'DB_SYNC=true is refused when NODE_ENV=production — TypeORM would rewrite the ' +
          'live schema. Production applies committed migrations instead (migrationsRun).',
      );
    }
  }

  return config;
}

/**
 * Resolves whether TypeORM should auto-synchronize the schema.
 *
 * Never true in production: `validateEnv` rejects `DB_SYNC=true` there, and the
 * deployment guard means a remote database cannot be running as non-production.
 */
export function shouldSynchronize(
  nodeEnv: string | undefined,
  dbSync: string | undefined,
): boolean {
  if (nodeEnv === 'production') return false;
  if (dbSync === 'true') return true;
  if (dbSync === 'false') return false;
  return true; // dev and test default to auto-sync, as before
}
