import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../../database/prisma.module';
import { AuditService } from './audit.service';
import { PrismaService } from '../../../database/prisma.service';
import { AUDIT_ACTIONS } from './audit.constants';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;
  let actorId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [AuditService],
    }).compile();
    service = module.get(AuditService);
    prisma = module.get(PrismaService);

    const existing = await prisma.user.findFirst({ where: { roleCode: 'SUPER_ADMIN' } });
    actorId = existing?.id ?? '00000000-0000-0000-0000-000000000000';
    if (!existing) {
      actorId = (
        await prisma.user.create({
          data: {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'audit-test@test.local',
            name: 'AT',
            passwordHash: 'x',
            roleCode: 'SUPER_ADMIN',
            status: 'ACTIVE',
            invitationAcceptedAt: new Date(),
          },
        })
      ).id;
    }
  });

  afterEach(async () => {
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: '00000000-0000-0000-0000-000000000000' } });
    await prisma.$disconnect();
  });

  it('write inserts an audit log entry', async () => {
    await service.write({
      actorId: null,
      action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
      resourceType: 'user',
      resourceId: null,
      ip: '127.0.0.1',
      userAgent: 'jest',
      requestId: 'req-1',
      metadata: { email: 'x@y.z' },
    });
    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe(AUDIT_ACTIONS.USER_LOGIN_FAILED);
    expect(logs[0]?.metadata).toEqual({ email: 'x@y.z' });
  });

  it('write supports before/after JSON', async () => {
    await service.write({
      actorId: actorId,
      action: AUDIT_ACTIONS.USER_UPDATED,
      resourceType: 'user',
      resourceId: actorId,
      beforeJson: { name: 'Old' },
      afterJson: { name: 'New' },
    });
    const logs = await prisma.auditLog.findMany();
    expect(logs[0]?.beforeJson).toEqual({ name: 'Old' });
    expect(logs[0]?.afterJson).toEqual({ name: 'New' });
  });
});