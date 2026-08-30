/**
 * One-off publish: flip any DRAFT OrganizationUnit to PUBLISHED so the public
 * /bidang page can list it. Leaves ARCHIVED alone — that's an explicit user choice.
 *
 * Usage: npx tsx scripts/publish-draft-units.ts
 */

import { PrismaClient, UnitStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const drafts = await prisma.organizationUnit.findMany({
    where: { status: UnitStatus.DRAFT, deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
  if (drafts.length === 0) {
    console.log('No DRAFT units to publish.');
    return;
  }
  const result = await prisma.organizationUnit.updateMany({
    where: { id: { in: drafts.map((u) => u.id) } },
    data: { status: UnitStatus.PUBLISHED },
  });
  console.log(`Published ${result.count} DRAFT unit(s):`);
  for (const u of drafts) console.log(`  - ${u.name} (slug=${u.slug})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
