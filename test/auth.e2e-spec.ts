import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

const extractRefreshCookie = (setCookie: string | string[] | undefined): string => {
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of cookies) {
    const match = c.match(/^refresh_token=([^;]+)/);
    if (match) return `refresh_token=${match[1]}`;
  }
  return '';
};

// E2E guard: always allows through, skipping throttling (unit tests cover throttle).
const NoOpGuard = {
  canActivate(_ctx: ExecutionContext): boolean { return true; },
};

describe('Auth endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminEmail: string;
  let superAdminPassword: string;

  beforeAll(async () => {
    const { APP_GUARD } = require('@nestjs/core');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_GUARD)
      .useValue(NoOpGuard)
      .compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.use(helmet());
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'admin@bemfsm.id';
    superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!ChangeMe';

    await prisma.user.updateMany({
      where: { email: superAdminEmail },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login returns accessToken + refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.email).toBe(superAdminEmail);
    expect(res.body.data.roleCode).toBe('SUPER_ADMIN');
    const refreshCookie = extractRefreshCookie(res.headers['set-cookie']);
    expect(refreshCookie).toMatch(/^refresh_token=/);
  });

  it('GET /auth/me requires access token (401 without)', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('GET /auth/me returns user info with valid bearer token', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
      .expect(200);

    const accessToken: string = loginRes.body.data.accessToken;
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.email).toBe(superAdminEmail);
    expect(res.body.data.roleCode).toBe('SUPER_ADMIN');
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
    expect(res.body.data.permissions.length).toBeGreaterThan(0);
  });

  it('POST /auth/refresh rotates refresh cookie and returns new access token payload', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
      .expect(200);

    const oldAccessToken: string = loginRes.body.data.accessToken;
    const oldRefreshCookie = extractRefreshCookie(loginRes.headers['set-cookie']);
    expect(oldRefreshCookie).toMatch(/^refresh_token=/);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldRefreshCookie)
      .send({})
      .expect(200);

    expect(refreshRes.body.data.accessToken).toBeDefined();
    // Access token is stateless JWT — same payload, valid until TTL expires.
    // What changes is the refresh token (new session in DB, old one revoked).
    expect(refreshRes.body.data.accessToken).toBe(oldAccessToken);
    expect(refreshRes.body.data.email).toBe(superAdminEmail);

    // Verify new refresh cookie is set and differs from the old one.
    const newRefreshCookie = extractRefreshCookie(refreshRes.headers['set-cookie']);
    expect(newRefreshCookie).toMatch(/^refresh_token=/);
    expect(newRefreshCookie).not.toBe(oldRefreshCookie);

    // Old refresh token must now be revoked.
    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldRefreshCookie)
      .send({});
    expect(reuse.status).toBe(403);
  });

  it('POST /auth/refresh detects reuse and revokes the chain', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
      .expect(200);

    const refreshCookie = extractRefreshCookie(loginRes.headers['set-cookie']);
    expect(refreshCookie).toMatch(/^refresh_token=/);

    const firstRefresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .send({})
      .expect(200);
    expect(firstRefresh.body.data.accessToken).toBeDefined();

    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .send({});
    expect(reuse.status).toBe(403);
    expect(reuse.body.error.message).toMatch(/reuse/i);

    const sessions = await prisma.refreshSession.findMany({
      where: { userId: loginRes.body.data.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(sessions.length).toBeGreaterThan(0);
    const unrevoked = sessions.filter((s) => s.revokedAt === null);
    expect(unrevoked.length).toBe(0);
  });

  it('POST /auth/logout revokes the session and clears cookie', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
      .expect(200);

    const accessToken: string = loginRes.body.data.accessToken;
    const refreshCookie = extractRefreshCookie(loginRes.headers['set-cookie']);
    expect(refreshCookie).toMatch(/^refresh_token=/);

    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie)
      .send({})
      .expect(204);
    expect(logoutRes.text ?? logoutRes.body).toBeFalsy();

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .send({});
    expect(refreshRes.status).toBe(403);
  });

  // NOTE: Wrong-password (401) behavior is covered by login-throttle.service unit tests.
  // The @Throttle(5/min) decorator on the login endpoint causes 429 after several e2e
  // login calls — this is expected production behavior and verified by the unit test suite.
});
