import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const posts = await p.instagramPost.findMany({
    where: { deletedAt: null },
    include: { placements: true },
  });
  console.log('Posts:', posts.length);
  for (const post of posts) {
    console.log({
      id: post.id,
      title: post.internalTitle,
      status: post.status,
      placements: post.placements.map(pl => ({ placement: pl.placement, isHighlighted: pl.isHighlighted, sortOrder: pl.sortOrder })),
    });
  }
}
main().finally(() => p.$disconnect());
