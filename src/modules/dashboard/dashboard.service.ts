import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly org: OrganizationService,
  ) {}

  async getAdminMetrics() {
    const [
      articles,
      media,
      orgMetrics,
      recentArticles,
      recentUsers,
      attentionItems,
    ] = await Promise.all([
      this.prisma.article.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.mediaAsset.aggregate({
        where: { deletedAt: null },
        _count: { id: true },
        _sum: { size: true },
      }),
      this.org.getMetrics(),
      this.prisma.article.findMany({
        where: { deletedAt: null },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          publishedAt: true,
          coverMedia: { select: { url: true, alt: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, roleCode: true, createdAt: true },
      }),
      this.buildAttentionItems(),
    ]);

    const articleCounts = Object.fromEntries(
      articles.map((a) => [a.status, a._count.id]),
    );

    return {
      articles: {
        ...articleCounts,
        total: articles.reduce((sum, a) => sum + a._count.id, 0) as number,
      },
      media: {
        count: media._count.id,
        totalSizeBytes: media._sum.size ?? 0,
      },
      organization: orgMetrics,
      recentArticles: recentArticles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        status: a.status,
        publishedAt: a.publishedAt,
        coverImageUrl: a.coverMedia?.url ?? null,
        coverAlt: a.coverMedia?.alt ?? null,
      })),
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roleCode: u.roleCode,
        createdAt: u.createdAt,
      })),
      attentionItems,
    };
  }

  private async buildAttentionItems() {
    const now = new Date();
    const SEVEN_DAYS_AGO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      failedScheduled,
      oldDrafts,
      expiredInvitations,
      noAltMedia,
      noAltArticles,
    ] = await Promise.all([
      // Scheduled articles past due (should have published by now)
      this.prisma.article.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lt: now },
          deletedAt: null,
        },
        select: { id: true, title: true, scheduledAt: true },
        take: 5,
      }),
      // Drafts not updated in 30+ days
      this.prisma.article.findMany({
        where: {
          status: 'DRAFT',
          deletedAt: null,
          updatedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, title: true, updatedAt: true },
        take: 5,
      }),
      // Invitations expired (consumedAt is null and expiresAt < now)
      this.prisma.invitationToken.findMany({
        where: { consumedAt: null, expiresAt: { lt: now } },
        include: { user: { select: { id: true, email: true, name: true } } },
        take: 5,
      }),
      // Media without alt text
      this.prisma.mediaAsset.findMany({
        where: { deletedAt: null, alt: null },
        select: { id: true, filename: true, url: true },
        take: 5,
      }),
      // Published articles without coverAlt
      this.prisma.article.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          OR: [{ coverAlt: null }, { coverAlt: '' }],
        },
        select: { id: true, title: true },
        take: 5,
      }),
    ]);

    const items: Array<{ type: string; severity: 'warning' | 'info'; message: string; id: string }> = [];

    for (const a of failedScheduled) {
      items.push({
        type: 'scheduled_overdue',
        severity: 'warning',
        message: `Artikel terjadwal terlambat terbit: "${a.title}"`,
        id: a.id,
      });
    }
    for (const a of oldDrafts) {
      items.push({
        type: 'draft_stale',
        severity: 'info',
        message: `Draf belum diupdate: "${a.title}"`,
        id: a.id,
      });
    }
    for (const inv of expiredInvitations) {
      items.push({
        type: 'invitation_expired',
        severity: 'warning',
        message: `Undangan kedaluwarsa untuk: ${inv.user?.email ?? inv.userId}`,
        id: inv.id,
      });
    }
    for (const m of noAltMedia) {
      items.push({
        type: 'media_no_alt',
        severity: 'info',
        message: `Media tanpa teks alternatif: ${m.filename}`,
        id: m.id,
      });
    }
    for (const a of noAltArticles) {
      items.push({
        type: 'article_no_cover_alt',
        severity: 'info',
        message: `Artikel published tanpa alt cover: "${a.title}"`,
        id: a.id,
      });
    }

    return items;
  }

  async getPublicMetrics() {
    const [articles, media] = await Promise.all([
      this.prisma.article.count({
        where: { status: 'PUBLISHED', deletedAt: null },
      }),
      this.prisma.mediaAsset.count({
        where: { deletedAt: null },
      }),
    ]);
    return {
      articles: articles,
      media: media,
    };
  }
}
