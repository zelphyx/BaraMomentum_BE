import { PrismaClient, UserRoleCode, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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
        status: UserStatus.ACTIVE,
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