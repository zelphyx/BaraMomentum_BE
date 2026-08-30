import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const units = await p.organizationUnit.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, status: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('Units:', units.length);
  for (const u of units) {
    console.log(`  [${u.status}] ${u.name} (slug=${u.slug}, order=${u.sortOrder})`);
  }
}
main().finally(() => p.$disconnect());
