import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../../database/prisma.module';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../../../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: PrismaService;
  let roleId: string;
  const userId = uuidv4();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [PermissionsService],
    }).compile();
    service = module.get(PermissionsService);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.rolePermission.deleteMany({});
    await prisma.userUnitAssignment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.role.deleteMany({ where: { code: 'EDITOR' } });
    await prisma.permission.deleteMany({});
    roleId = (
      await prisma.role.create({
        data: { id: uuidv4(), code: 'EDITOR', name: 'Editor' },
      })
    ).id;
    const perm = await prisma.permission.create({
      data: { id: uuidv4(), code: 'articles.read' },
    });
    await prisma.rolePermission.create({ data: { roleId, permissionId: perm.id } });
    await prisma.user.create({
      data: {
        id: userId,
        email: `p-${userId}@test.local`,
        name: 'P',
        passwordHash: 'x',
        roleCode: 'EDITOR',
        status: 'ACTIVE',
        invitationAcceptedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.rolePermission.deleteMany({});
    await prisma.userUnitAssignment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.role.deleteMany({ where: { id: roleId } });
    await prisma.permission.deleteMany({});
    await prisma.$disconnect();
  });

  it('loadForUser returns permission codes', async () => {
    const result = await service.loadForUser(userId);
    expect(result.permissions).toEqual(['articles.read']);
    expect(result.roleCode).toBe('EDITOR');
  });

  it('loadForUser throws for unknown user', async () => {
    await expect(service.loadForUser('unknown')).rejects.toThrow();
  });
});
