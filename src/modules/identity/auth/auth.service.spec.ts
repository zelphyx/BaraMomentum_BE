import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../../database/prisma.module';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { LoginThrottleService } from './login-throttle.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../../../common/mail/mail.service';
import { PrismaService } from '../../../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

describe('AuthService (integration)', () => {
  let auth: AuthService;
  let prisma: PrismaService;
  const userId = uuidv4();
  const email = `auth-${userId}@test.local`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PrismaModule,
        JwtModule.register({ secret: 'x'.repeat(32), signOptions: { expiresIn: '15m' } }),
      ],
      providers: [
        AuthService,
        TokenService,
        PasswordService,
        SessionService,
        LoginThrottleService,
        PermissionsService,
        AuditService,
        { provide: MailService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    auth = module.get(AuthService);
    prisma = module.get(PrismaService);
    // Ensure EDITOR role exists (seed may not have run).
    await prisma.role.upsert({
      where: { code: 'EDITOR' },
      update: {},
      create: { id: uuidv4(), code: 'EDITOR', name: 'Editor', description: 'Kelola artikel' },
    });
  });

  beforeEach(async () => {
    await prisma.refreshSession.deleteMany({ where: { userId } });
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: userId }, { resourceId: userId }] },
    });
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany({ where: { userId } });
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: userId }, { resourceId: userId }] },
    });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('login with correct credentials returns tokens', async () => {
    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: 'Auth',
        passwordHash: 'placeholder',
        roleCode: 'EDITOR',
        status: 'ACTIVE',
        invitationAcceptedAt: new Date(),
      },
    });
    // Manually set a known password hash via re-hashing
    const newHash = await new PasswordService().hash('Password123!Secret');
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    const result = await auth.login({
      email,
      password: 'Password123!Secret',
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.user.email).toBe(email);
  });

  it('login with wrong password throws UNAUTHENTICATED', async () => {
    const newHash = await new PasswordService().hash('Password123!Secret');
    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: 'Auth',
        passwordHash: newHash,
        roleCode: 'EDITOR',
        status: 'ACTIVE',
        invitationAcceptedAt: new Date(),
      },
    });
    await expect(
      auth.login({ email, password: 'wrong', ip: null, userAgent: null }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('login fails after 10 wrong attempts with ACCOUNT_LOCKED', async () => {
    const newHash = await new PasswordService().hash('Password123!Secret');
    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: 'Auth',
        passwordHash: newHash,
        roleCode: 'EDITOR',
        status: 'ACTIVE',
        invitationAcceptedAt: new Date(),
      },
    });
    for (let i = 0; i < 10; i++) {
      await auth
        .login({ email, password: 'wrong', ip: null, userAgent: null })
        .catch(() => undefined);
    }
    await expect(
      auth.login({ email, password: 'Password123!Secret', ip: null, userAgent: null }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
  });
});
