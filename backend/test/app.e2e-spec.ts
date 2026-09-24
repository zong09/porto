import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string; isDemo: boolean };
}
interface PortfolioBody {
  id: string;
  name: string;
}
const ids = (body: unknown) => (body as PortfolioBody[]).map((p) => p.id);

// Boots the real AppModule against Postgres (see DATABASE_URL in CI) with the
// same setup as main.ts. Emails are unique per run so the suite can be re-run
// against a dev database without cleanup.
//
// One app for the whole file: the throttler keeps its counters in memory, and
// register is limited to 3/min — this suite registers 2 users.
describe('App (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;

  const run = randomUUID().slice(0, 8);
  const alice = {
    email: `alice-${run}@e2e.test`,
    name: 'Alice',
    pass: 'alice-password',
  };
  const bob = {
    email: `bob-${run}@e2e.test`,
    name: 'Bob',
    pass: 'bob-password',
  };
  let aliceToken: string;
  let bobToken: string;
  let alicePortfolioId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves the public auth config without a token', async () => {
    const res = await request(server).get('/api/auth/config').expect(200);
    const body = res.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['enableDemo', 'enableRegister']);
    expect(typeof body.enableDemo).toBe('boolean');
    expect(typeof body.enableRegister).toBe('boolean');
  });

  it('rejects protected routes without a token', async () => {
    await request(server).get('/api/portfolios').expect(401);
    await request(server).get('/api/auth/me').expect(401);
  });

  it('rejects a forged token', async () => {
    await request(server)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('validates request bodies', async () => {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', pass: 'whatever' })
      .expect(400);
    expect((res.body as { message: string[] }).message).toContain(
      'อีเมลไม่ถูกต้อง',
    );

    // forbidNonWhitelisted: unknown fields are rejected, not silently dropped
    await request(server)
      .post('/api/auth/login')
      .send({ email: alice.email, pass: alice.pass, isAdmin: true })
      .expect(400);
  });

  it('registers users and returns a token', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send(alice)
      .expect(201);
    const body = res.body as AuthResponse;
    expect(typeof body.token).toBe('string');
    expect(body.user).toMatchObject({
      email: alice.email,
      name: alice.name,
      isDemo: false,
    });
    expect(body.user).not.toHaveProperty('passwordHash');
    aliceToken = body.token;

    const resBob = await request(server)
      .post('/api/auth/register')
      .send(bob)
      .expect(201);
    bobToken = (resBob.body as AuthResponse).token;
  });

  it('logs in with the right password only', async () => {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: alice.email, pass: alice.pass })
      .expect(201);
    expect(typeof (res.body as AuthResponse).token).toBe('string');

    await request(server)
      .post('/api/auth/login')
      .send({ email: alice.email, pass: 'wrong-password' })
      .expect(401);
  });

  it('returns the current user for a valid token', async () => {
    const res = await request(server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(res.body).toMatchObject({ email: alice.email });
  });

  it('creates and lists portfolios for the owner', async () => {
    const created = await request(server)
      .post('/api/portfolios')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Alice main', color: 1 })
      .expect(201);
    alicePortfolioId = (created.body as PortfolioBody).id;

    const list = await request(server)
      .get('/api/portfolios')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(ids(list.body)).toContain(alicePortfolioId);
  });

  it("does not expose one user's portfolio to another", async () => {
    const list = await request(server)
      .get('/api/portfolios')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    expect(ids(list.body)).not.toContain(alicePortfolioId);

    await request(server)
      .get(`/api/portfolios/${alicePortfolioId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
    await request(server)
      .patch(`/api/portfolios/${alicePortfolioId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'hijacked' })
      .expect(404);
    await request(server)
      .delete(`/api/portfolios/${alicePortfolioId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);

    // Still intact for the owner
    const own = await request(server)
      .get(`/api/portfolios/${alicePortfolioId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect((own.body as PortfolioBody).name).toBe('Alice main');
  });
});
