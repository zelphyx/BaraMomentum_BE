import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../../database/prisma.module';
import { LoginThrottleService } from './login-throttle.service';
import { PrismaService } from '../../../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

describe('LoginThrottleService (integration with DB)', () => {
  let service: LoginThrottleService;
  let prisma: PrismaService;
  const userId = uuidv4();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [LoginThrottleService],
    }).compile();
    service = module.get(LoginThrottleService);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.user.create({
      data: {
        id: userId,
        email: `throttle-${userId}@test.local`,
        name: 'T',
        passwordHash: 'x',
        roleCode: 'EDITOR',
        status: 'ACTIVE',
        invitationAcceptedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('isLocked returns false initially', async () => {
    expect(await service.isLocked(userId)).toBe(false);
  });

  it('records failure and locks after 10 failures', async () => {
    for (let i = 0; i < 10; i++) await service.recordFailure(userId);
    expect(await service.isLocked(userId)).toBe(true);
  });

  it('recordSuccess resets counter', async () => {
    for (let i = 0; i < 5; i++) await service.recordFailure(userId);
    await service.recordSuccess(userId);
    expect(await service.isLocked(userId)).toBe(false);
  });
});