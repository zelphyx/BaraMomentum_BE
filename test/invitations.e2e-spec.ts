import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { UserStatus } from '@prisma/client';

const NoOpGuard = {
  canActivate(_ctx: ExecutionContext): boolean { return true; },
};

const extractRefreshCookie = (setCookie: string | string[] | undefined): string => {
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of cookies) {
    const match = c.match(/^refresh_token=([^;]+)/);
    if (match) return `refresh_token=${match[1]}`;
  }
  return '';
};

describe('Invitations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminEmail: string;
  let superAdminPassword: string;
  let adminAccessToken: string;
  let adminRefreshCookie: string;

  const testUserEmail = `invite-test-${Date.now()}@bemfsm.id`;
  const testUserName = 'Invitation Test User';
  const testUserPassword = 'SecureTestPass123!';

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

    // Admin login for authenticated endpoints.
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
      .expect(200);
    adminAccessToken = loginRes.body.data.accessToken;
    adminRefreshCookie = extractRefreshCookie(loginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    // Cleanup: delete test user.
    await prisma.user.deleteMany({ where: { email: testUserEmail } });
    await app.close();
  });

  it('POST /invitations creates a pending user and returns invitation metadata', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ email: testUserEmail, name: testUserName, roleCode: 'EDITOR' })
      .expect(201);

    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.expiresAt).toBeDefined();
    const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
    expect(user).not.toBeNull();
    expect(user!.status).toBe(UserStatus.PENDING_INVITATION);
    expect(user!.name).toBe(testUserName);
    expect(user!.roleCode).toBe('EDITOR');
    expect(user!.passwordMustChange).toBe(true);
  });

  it('POST /invitations/accept activates user and sets password', async () => {
    // Look up the invitation token hash from DB.
    const inv = await prisma.invitationToken.findFirst({
      where: { user: { email: testUserEmail }, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(inv).not.toBeNull();

    // Find the raw token by hashing candidates (we know the format: 64 hex chars).
    // Since we can't reverse the hash, we create a fresh invitation and accept it
    // by finding the token hash + looking up the raw token from DB logs.
    // For a cleaner approach: use a test-specific raw token stored in the invitation
    // record, then accept with that.
    // Actually, we need to create the invitation with a known token. Let us the
    // PrismaService to manually create the invitation with a known token.
    const rawToken = (Math.random().toString(36) + Date.now().toString(36)).repeat(4);
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const { v4: uuidv4 } = require('uuid');
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `accept-test-${Date.now()}@bemfsm.id`,
        name: 'Accept Test',
        roleCode: 'EDITOR',
        status: UserStatus.PENDING_INVITATION,
        passwordMustChange: true,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
      },
    });
    const inv2 = await prisma.invitationToken.create({
      data: { id: uuidv4(), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 86400000) },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: rawToken, password: testUserPassword })
      .expect(200);

    expect(res.body.data.email).toBe(user.email);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser!.status).toBe(UserStatus.ACTIVE);
    expect(updatedUser!.passwordMustChange).toBe(false);

    const consumedToken = await prisma.invitationToken.findUnique({ where: { id: inv2.id } });
    expect(consumedToken!.consumedAt).not.toBeNull();

    // Cleanup.
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('POST /invitations/accept rejects an invalid token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: 'not-a-valid-token-at-all', password: testUserPassword })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Newly activated user must change password on first login', async () => {
    // Create invitation with a known token.
    const rawToken = `known-token-${Date.now()}`;
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const { v4: uuidv4 } = require('uuid');
    const email = `pw-change-test-${Date.now()}@bemfsm.id`;

    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        email,
        name: 'Password Change Test',
        roleCode: 'EDITOR',
        status: UserStatus.PENDING_INVITATION,
        passwordMustChange: true,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
      },
    });
    await prisma.invitationToken.create({
      data: { id: uuidv4(), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 86400000) },
    });

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: rawToken, password: testUserPassword })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email, password: testUserPassword })
      .expect(200);
    expect(loginRes.body.data.passwordMustChange).toBe(false);

    // Change password.
    const accessToken = loginRes.body.data.accessToken;
    const refreshCookie = extractRefreshCookie(loginRes.headers['set-cookie']);
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie)
      .send({ currentPassword: testUserPassword, newPassword: 'NewSecurePass456!' })
      .expect(204);

    // Old password no longer works.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email, password: testUserPassword })
      .expect(401);

    // New password works.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email, password: 'NewSecurePass456!' })
      .expect(200);

    await prisma.user.delete({ where: { id: user.id } });
  });
});
