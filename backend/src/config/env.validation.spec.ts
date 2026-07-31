import {
  validateEnv,
  isLocalDatabaseUrl,
  shouldSynchronize,
} from './env.validation';

const REMOTE_URL = 'postgres://user:pw@containers-us-west-1.railway.app:6543/railway';
const LOCAL_URL = 'postgres://porto:porto@localhost:5435/porto';

describe('isLocalDatabaseUrl', () => {
  it.each([
    LOCAL_URL,
    'postgres://u:p@127.0.0.1:5432/db',
    'postgres://u:p@host.docker.internal:5432/db',
  ])('treats %s as local', (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it('treats a remote host as remote', () => {
    expect(isLocalDatabaseUrl(REMOTE_URL)).toBe(false);
  });

  it('is not fooled by a hostname that merely contains "localhost"', () => {
    // The previous substring check (url.includes('localhost')) matched this and
    // disabled TLS entirely.
    expect(isLocalDatabaseUrl('postgres://u:p@db.localhost.attacker.com:5432/db')).toBe(
      false,
    );
    expect(isLocalDatabaseUrl('postgres://u:p@127.0.0.1.evil.com:5432/db')).toBe(false);
  });

  it('treats an unparseable URL as remote, so TLS stays on', () => {
    expect(isLocalDatabaseUrl('not a url')).toBe(false);
  });
});

describe('validateEnv', () => {
  it('defaults an unset NODE_ENV to development', () => {
    expect(validateEnv({}).NODE_ENV).toBe('development');
  });

  it.each(['development', 'test', 'production'])('accepts NODE_ENV=%s', (value) => {
    const env: Record<string, unknown> = { NODE_ENV: value };
    if (value === 'production') env.DATABASE_URL = REMOTE_URL;
    expect(validateEnv(env).NODE_ENV).toBe(value);
  });

  it.each(['Production', 'prod', 'PRODUCTION', 'staging'])(
    'rejects the misspelled NODE_ENV=%s instead of silently treating it as dev',
    (value) => {
      expect(() => validateEnv({ NODE_ENV: value })).toThrow(/NODE_ENV must be one of/);
    },
  );

  describe('deployment guard', () => {
    it('refuses to boot when DATABASE_URL is remote but NODE_ENV is not production', () => {
      expect(() => validateEnv({ DATABASE_URL: REMOTE_URL })).toThrow(
        /database host is remote but NODE_ENV is "development"/,
      );
    });

    it('refuses to boot when DB_HOST is remote but NODE_ENV is not production', () => {
      expect(() => validateEnv({ DB_HOST: 'db.example.com' })).toThrow(
        /database host is remote/,
      );
    });

    it('allows a remote database in production', () => {
      expect(() =>
        validateEnv({ NODE_ENV: 'production', DATABASE_URL: REMOTE_URL }),
      ).not.toThrow();
    });

    it('leaves the normal local dev setup alone', () => {
      // No .env file locally: DB_* are unset and app.module falls back to the
      // dev container defaults. That must keep working.
      expect(() => validateEnv({})).not.toThrow();
      expect(() => validateEnv({ DATABASE_URL: LOCAL_URL })).not.toThrow();
      expect(() => validateEnv({ DB_HOST: 'localhost', DB_PORT: '5435' })).not.toThrow();
    });
  });

  describe('production requirements', () => {
    it('requires DATABASE_URL in production, so it cannot fall back to the committed dev credentials', () => {
      expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
        /DATABASE_URL is required when NODE_ENV=production/,
      );
    });
  });

  describe('DB_SYNC', () => {
    it('rejects a non-boolean value', () => {
      expect(() => validateEnv({ DB_SYNC: 'yes' })).toThrow(/DB_SYNC must be/);
    });

    it('refuses DB_SYNC=true in production', () => {
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: REMOTE_URL,
          DB_SYNC: 'true',
        }),
      ).toThrow(/DB_SYNC=true is refused when NODE_ENV=production/);
    });

    it('accepts an explicit false anywhere', () => {
      expect(() => validateEnv({ DB_SYNC: 'false' })).not.toThrow();
    });
  });
});

describe('shouldSynchronize', () => {
  it('is never true in production, whatever DB_SYNC says', () => {
    expect(shouldSynchronize('production', undefined)).toBe(false);
    expect(shouldSynchronize('production', 'true')).toBe(false);
  });

  it('defaults to true in dev and test, preserving the existing workflow', () => {
    expect(shouldSynchronize('development', undefined)).toBe(true);
    expect(shouldSynchronize('test', undefined)).toBe(true);
    expect(shouldSynchronize(undefined, undefined)).toBe(true);
  });

  it('honours an explicit opt-out in dev', () => {
    expect(shouldSynchronize('development', 'false')).toBe(false);
  });
});
