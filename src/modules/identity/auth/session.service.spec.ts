import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../../database/prisma.module';
import { SessionService } from './session.service';
import { PrismaService } from '../../../database/prisma.service';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

describe('SessionService (integration with DB)', () => {
  let service: SessionService;
  let prisma: PrismaService;
  const userId = uuidv4();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [SessionService],
    }).compile();
    service = module.get(SessionService);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.refreshSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.user.create({
      data: {
        id: userId,
        email: `s-${userId}@test.local`,
        name: 'S',
        passwordHash: 'x',
        roleCode: 'EDITOR',
        status: 'ACTIVE',
        invitationAcceptedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('create returns raw token and stores hash', async () => {
    const { token, sessionId } = await service.create(userId);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const stored = await prisma.refreshSession.findUnique({ where: { id: sessionId } });
    expect(stored?.tokenHash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(stored?.revokedAt).toBeNull();
  });

  it('rotate revokes old and creates new', async () => {
    const { token, sessionId } = await service.create(userId);
    const { token: newToken, sessionId: newSessionId } = await service.rotate(token);
    const oldSession = await prisma.refreshSession.findUnique({ where: { id: sessionId } });
    expect(oldSession?.revokedAt).not.toBeNull();
    expect(oldSession?.replacedBySessionId).toBe(newSessionId);
    expect(newToken).not.toBe(token);
  });

  it('rotate detects reuse and revokes chain', async () => {
    const { token } = await service.create(userId);
    await service.rotate(token);
    await expect(service.rotate(token)).rejects.toThrow(/reuse/i);
    const sessions = await prisma.refreshSession.findMany({ where: { userId } });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it('revokeAll marks all sessions revoked', async () => {
    await service.create(userId);
    await service.create(userId);
    await service.revokeAll(userId);
    const sessions = await prisma.refreshSession.findMany({ where: { userId } });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });
});