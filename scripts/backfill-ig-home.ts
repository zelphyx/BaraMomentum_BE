/**
 * One-off backfill: ensure every InstagramPost has a HOME placement so the
 * public home page (`GET /public/instagram-posts?placement=HOME`) can render it.
 *
 * Before this fix, `create()` only created an INFORMATION placement, so admin
 * posts never appeared on home even when published. This script backfills the
 * HOME placement for existing rows and sets `isHighlighted = (status === PUBLISHED)`.
 *
 * Safe to run multiple times — uses upsert.
 *
 * Usage: npx tsx scripts/backfill-ig-home.ts
 */

import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, InstagramPostStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.instagramPost.findMany({
    where: { deletedAt: null },
    include: { placements: true },
  });

  console.log(`Found ${posts.length} posts to inspect.`);
  let created = 0;
  let updated = 0;

  for (const post of posts) {
    const existingHome = post.placements.find((p) => p.placement === 'HOME');
    const desiredHighlight = post.status === InstagramPostStatus.PUBLISHED;

    if (!existingHome) {
      await prisma.instagramPlacement.create({
        data: {
          id: uuidv4(),
          postId: post.id,
          placement: 'HOME',
          sortOrder: 0,
          isHighlighted: desiredHighlight,
        },
      });
      created += 1;
      console.log(
        `+ HOME placement for "${post.internalTitle ?? post.shortcode}" ` +
          `(status=${post.status}, isHighlighted=${desiredHighlight})`,
      );
    } else if (existingHome.isHighlighted !== desiredHighlight) {
      await prisma.instagramPlacement.update({
        where: { id: existingHome.id },
        data: { isHighlighted: desiredHighlight },
      });
      updated += 1;
      console.log(
        `~ HOME highlight for "${post.internalTitle ?? post.shortcode}" ` +
          `${existingHome.isHighlighted} -> ${desiredHighlight}`,
      );
    }
  }

  console.log(`\nDone. Created ${created} HOME placements, updated ${updated} highlights.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
