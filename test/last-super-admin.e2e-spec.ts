import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

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

const SECOND_ADMIN_HASH = '$argon2id$v=19$m=65536,t=3,p=4$J7848qn0n9n7cYuFg3Sjnw$fEem6TTG+68eEN3mTEPYTbQImEh8TX73Da7CR5TonHA';

describe('Last-super-admin protection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminEmail: string;
  let superAdminPassword: string;
  let adminAccessToken: string;
  let testUserId: string;

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

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword })
      .expect(200);
    adminAccessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    await app.close();
  });

  it('cannot demote the last SUPER_ADMIN to EDITOR', async () => {
    const me = await prisma.user.findUnique({ where: { email: superAdminEmail } });
    expect(me!.roleCode).toBe('SUPER_ADMIN');

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${me!.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ roleCode: 'EDITOR' })
      .expect(403);
    expect(res.body.error.code).toBe('LAST_SUPER_ADMIN');
    expect(res.body.error.message).toMatch(/super.?admin/i);
  });

  it('cannot delete the last SUPER_ADMIN', async () => {
    const me = await prisma.user.findUnique({ where: { email: superAdminEmail } });
    expect(me!.roleCode).toBe('SUPER_ADMIN');

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/users/${me!.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe('LAST_SUPER_ADMIN');
    expect(res.body.error.message).toMatch(/super.?admin/i);
  });

  it('can demote a second SUPER_ADMIN when another exists', async () => {
    const { v4: uuidv4 } = require('uuid');

    const second = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `second-admin-${Date.now()}@bemfsm.id`,
        name: 'Second Admin',
        roleCode: 'SUPER_ADMIN',
        status: 'ACTIVE',
        passwordHash: SECOND_ADMIN_HASH,
      },
    });
    testUserId = second.id;

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${second.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ roleCode: 'EDITOR' })
      .expect(200);
    expect(res.body.data.roleCode).toBe('EDITOR');
  });
});
