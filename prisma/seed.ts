import { PrismaClient, UserRoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'users.invite',
  'articles.read',
  'articles.create',
  'articles.update',
  'articles.delete',
  'articles.publish',
  'articles.unpublish',
  'articles.archive',
  'organization.read',
  'organization.create',
  'organization.update',
  'organization.delete',
  'media.read',
  'media.upload',
  'media.update',
  'media.delete',
  'instagram.read',
  'instagram.update',
  'audit.read',
  'settings.read',
  'settings.update',
  'dashboard.read',
];

const ROLE_PERMISSIONS: Record<UserRoleCode, string[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: PERMISSIONS.filter((p) => !['users.delete', 'settings.update'].includes(p)),
  EDITOR: [
    'articles.read',
    'articles.create',
    'articles.update',
    'articles.publish',
    'articles.unpublish',
    'articles.archive',
    'organization.read',
    'media.read',
    'media.upload',
    'media.update',
    'instagram.read',
    'dashboard.read',
  ],
};

const ROLES: Array<{ code: UserRoleCode; name: string; description: string }> = [
  { code: UserRoleCode.SUPER_ADMIN, name: 'Super Admin', description: 'Akses penuh sistem' },
  { code: UserRoleCode.ADMIN, name: 'Admin', description: 'Kelola konten & user' },
  { code: UserRoleCode.EDITOR, name: 'Editor', description: 'Kelola artikel & media' },
];

async function main(): Promise<void> {
  const bootstrapEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
  const bootstrapPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
  const argonMemoryCost = Number(process.env.ARGON2_MEMORY_COST ?? 19456);
  const argonTimeCost = Number(process.env.ARGON2_TIME_COST ?? 2);
  const argonParallelism = Number(process.env.ARGON2_PARALLELISM ?? 1);

  if (!bootstrapEmail || !bootstrapPassword) {
    throw new Error(
      'BOOTSTRAP_SUPER_ADMIN_EMAIL dan BOOTSTRAP_SUPER_ADMIN_PASSWORD wajib di environment',
    );
  }

  console.log('[seed] Memulai seed…');

  // Roles
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: { id: uuidv4(), code: role.code, name: role.name, description: role.description, updatedAt: new Date() },
    });
  }
  console.log(`[seed] ${ROLES.length} roles ter-seed.`);

  // Permissions
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { id: uuidv4(), code },
    });
  }
  console.log(`[seed] ${PERMISSIONS.length} permissions ter-seed.`);

  // Role-Permissions
  const allRoles = await prisma.role.findMany();
  const allPerms = await prisma.permission.findMany();
  let rpCount = 0;
  for (const role of allRoles) {
    const desired = ROLE_PERMISSIONS[role.code];
    for (const permCode of desired) {
      const perm = allPerms.find((p) => p.code === permCode);
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
      rpCount++;
    }
  }
  console.log(`[seed] ${rpCount} role_permissions ter-seed.`);

  // Super Admin user
  const existing = await prisma.user.findFirst({
    where: { email: bootstrapEmail.toLowerCase() },
  });

  if (existing) {
    console.log(`[seed] Super Admin ${bootstrapEmail} sudah ada, skip.`);
  } else {
    const passwordHash = await argon2.hash(bootstrapPassword, {
      type: argon2.argon2id,
      memoryCost: argonMemoryCost,
      timeCost: argonTimeCost,
      parallelism: argonParallelism,
    });
    await prisma.user.create({
      data: {
        id: uuidv4(),
        name: 'Super Admin',
        email: bootstrapEmail.toLowerCase(),
        passwordHash,
        roleCode: UserRoleCode.SUPER_ADMIN,
        status: 'ACTIVE',
        invitationAcceptedAt: new Date(),
        passwordMustChange: true,
      },
    });
    console.log(`[seed] Super Admin ${bootstrapEmail} dibuat dengan passwordMustChange=true.`);
  }

  console.log('[seed] Selesai.');
}

main()
  .catch((err) => {
    console.error('[seed] Gagal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());