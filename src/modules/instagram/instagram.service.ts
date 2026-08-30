import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateInstagramPostDto,
  UpdateInstagramPostDto,
  ListInstagramPostsDto,
  ToggleHighlightDto,
  ReorderPostsDto,
  InstagramPostResponseDto,
  InstagramPostListItemDto,
  InstagramPostListResponseDto,
  InstagramPlacementResponseDto,
  InstagramPlacementType,
} from './dto/instagram-post.dto';
import {
  InstagramContentType,
  InstagramPostStatus,
  InstagramPost,
  InstagramPlacement,
} from '@prisma/client';

const MAX_HIGHLIGHTS = 4;

type PostWithPlacements = InstagramPost & {
  placements: InstagramPlacement[];
};

@Injectable()
export class InstagramService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // URL & Shortcode Helpers
  // ============================================================

  private parseShortcode(url: string): string {
    const u = new URL(url);
    if (u.hostname !== 'instagram.com' && u.hostname !== 'www.instagram.com') {
      throw new BadRequestException('URL must be from instagram.com or www.instagram.com');
    }
    const match = u.pathname.match(/^\/p\/([A-Za-z0-9_-]+)/);
    if (!match) {
      throw new BadRequestException('URL does not contain a valid Instagram post path (/p/...)');
    }
    return match[1]!;
  }

  private detectContentType(url: string): InstagramContentType {
    const u = new URL(url);
    if (u.pathname.includes('/reel/') || u.pathname.includes('/reels/')) {
      return InstagramContentType.REEL;
    }
    if (u.pathname.includes('/p/')) {
      // Carousel or regular post - we cannot determine definitively without the API
      // Default to UNKNOWN; caller can update via contentType field
      return InstagramContentType.UNKNOWN;
    }
    return InstagramContentType.UNKNOWN;
  }

  // ============================================================
  // Create
  // ============================================================

  async create(dto: CreateInstagramPostDto, actorId: string): Promise<InstagramPostResponseDto> {
    const shortcode = this.parseShortcode(dto.canonicalUrl);
    const contentType = this.detectContentType(dto.canonicalUrl);

    const existing = await this.prisma.instagramPost.findUnique({ where: { shortcode } });
    if (existing) {
      throw new ConflictException('Post with this shortcode already exists');
    }

    // Get the highest sortOrder for INFORMATION placement to append at the end
    const lastPlacement = await this.prisma.instagramPlacement.findFirst({
      where: { placement: 'INFORMATION' },
      orderBy: { sortOrder: 'desc' },
    });
    const informationSortOrder = (lastPlacement?.sortOrder ?? -1) + 1;
    const status = dto.status ?? InstagramPostStatus.DRAFT;
    const isHighlighted = status === InstagramPostStatus.PUBLISHED;

    const post = await this.prisma.$transaction(async (tx) => {
      const p = await tx.instagramPost.create({
        data: {
          id: uuidv4(),
          canonicalUrl: dto.canonicalUrl,
          shortcode,
          internalTitle: dto.title,
          contentType,
          status,
          createdById: actorId,
          updatedById: actorId,
        },
      });

      // Always create INFORMATION placement for admin list filtering.
      await tx.instagramPlacement.create({
        data: {
          id: uuidv4(),
          postId: p.id,
          placement: 'INFORMATION',
          sortOrder: informationSortOrder,
          isHighlighted: false,
        },
      });

      // Always create HOME placement so admin-created posts can appear on the public
      // home page. isHighlighted follows the post's published state — admin can still
      // override via the toggle endpoint.
      await tx.instagramPlacement.create({
        data: {
          id: uuidv4(),
          postId: p.id,
          placement: 'HOME',
          sortOrder: 0,
          isHighlighted,
        },
      });

      return p;
    });

    const full = await this.prisma.instagramPost.findUnique({
      where: { id: post.id },
      include: { placements: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toResponse(full!);
  }

  // ============================================================
  // List
  // ============================================================

  async list(dto: ListInstagramPostsDto): Promise<InstagramPostListResponseDto> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };
    if (dto.status) {
      where.status = dto.status;
    }
    if (dto.placement) {
      where.placements = { some: { placement: dto.placement } };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.instagramPost.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { placements: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.instagramPost.count({ where }),
    ]);

    return {
      data: data.map((p) => this.toListItem(p)),
      total,
      page,
      pageSize,
    };
  }

  // ============================================================
  // Get (detail)
  // ============================================================

  async get(id: string): Promise<InstagramPostResponseDto> {
    const post = await this.prisma.instagramPost.findUnique({
      where: { id },
      include: { placements: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Instagram post tidak ditemukan');
    }
    return this.toResponse(post);
  }

  // ============================================================
  // Update
  // ============================================================

  async update(id: string, dto: UpdateInstagramPostDto, actorId: string): Promise<InstagramPostResponseDto> {
    const existing = await this.prisma.instagramPost.findUnique({
      where: { id },
      include: { placements: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Instagram post tidak ditemukan');
    }

    const updateData: Record<string, unknown> = { updatedById: actorId };

    if (dto.title !== undefined) updateData.internalTitle = dto.title;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.internalNote !== undefined) updateData.internalNote = dto.internalNote ?? null;

    let shortcode = existing.shortcode;
    if (dto.canonicalUrl !== undefined && dto.canonicalUrl !== existing.canonicalUrl) {
      shortcode = this.parseShortcode(dto.canonicalUrl);
      const duplicate = await this.prisma.instagramPost.findUnique({ where: { shortcode } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Post with this shortcode already exists');
      }
      updateData.canonicalUrl = dto.canonicalUrl;
      updateData.shortcode = shortcode;
      updateData.contentType = this.detectContentType(dto.canonicalUrl);
    }

    const targetStatus = dto.status ?? existing.status;
    const homePlacement = existing.placements.find((p) => p.placement === 'HOME');
    const shouldHighlight = targetStatus === InstagramPostStatus.PUBLISHED;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.instagramPost.update({
        where: { id },
        data: updateData,
      });

      // Keep HOME placement in sync with the post's published state.
      // Auto-create if missing (backfill for posts created before the create() fix).
      if (homePlacement) {
        await tx.instagramPlacement.update({
          where: { id: homePlacement.id },
          data: { isHighlighted: shouldHighlight },
        });
      } else {
        await tx.instagramPlacement.create({
          data: {
            id: uuidv4(),
            postId: id,
            placement: 'HOME',
            sortOrder: 0,
            isHighlighted: shouldHighlight,
          },
        });
      }

      return tx.instagramPost.findUnique({
        where: { id },
        include: { placements: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return this.toResponse(updated!);
  }

  // ============================================================
  // Soft Delete
  // ============================================================

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.instagramPost.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Instagram post tidak ditemukan');
    }
    await this.prisma.instagramPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================================
  // Toggle Highlight
  // ============================================================

  async toggleHighlight(id: string, dto: ToggleHighlightDto, actorId: string): Promise<InstagramPostResponseDto> {
    const post = await this.prisma.instagramPost.findUnique({
      where: { id },
      include: { placements: true },
    });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Instagram post tidak ditemukan');
    }

    const placement = post.placements.find((p) => p.placement === dto.placement);
    if (!placement) {
      throw new NotFoundException(`Placement '${dto.placement}' tidak ditemukan untuk post ini`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (placement.isHighlighted) {
        // Un-highlight
        await tx.instagramPlacement.update({
          where: { id: placement.id },
          data: { isHighlighted: false },
        });
      } else {
        // Check highlight limit: max 4 highlighted per placement
        const highlightedCount = await tx.instagramPlacement.count({
          where: { placement: dto.placement, isHighlighted: true },
        });

        if (highlightedCount >= MAX_HIGHLIGHTS) {
          // Find the oldest highlighted placement and unhighlight it
          const oldestHighlighted = await tx.instagramPlacement.findFirst({
            where: { placement: dto.placement, isHighlighted: true },
            orderBy: { updatedAt: 'asc' },
          });
          if (oldestHighlighted) {
            await tx.instagramPlacement.update({
              where: { id: oldestHighlighted.id },
              data: { isHighlighted: false },
            });
          }
        }

        await tx.instagramPlacement.update({
          where: { id: placement.id },
          data: { isHighlighted: true },
        });
      }
    });

    const updated = await this.prisma.instagramPost.findUnique({
      where: { id },
      include: { placements: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toResponse(updated!);
  }

  // ============================================================
  // Bulk Reorder
  // ============================================================

  async reorder(dto: ReorderPostsDto): Promise<void> {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.instagramPlacement.updateMany({
          where: { postId: id, placement: dto.placement },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  // ============================================================
  // Public API
  // ============================================================

  async getPublic(placement: InstagramPlacementType): Promise<InstagramPostListItemDto[]> {
    const posts = await this.prisma.instagramPost.findMany({
      where: {
        status: InstagramPostStatus.PUBLISHED,
        deletedAt: null,
        placements: {
          some: { placement, isHighlighted: true },
        },
      },
      include: {
        placements: {
          where: { placement },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // For public: return highlighted posts first, then ordered by sortOrder
    const highlighted = posts
      .filter((p) => p.placements.some((pl) => pl.isHighlighted))
      .sort((a, b) => {
        const aPl = a.placements[0];
        const bPl = b.placements[0];
        return (aPl?.sortOrder ?? 0) - (bPl?.sortOrder ?? 0);
      });

    return highlighted.map((p) => this.toListItem(p));
  }

  /**
   * Legacy compatibility endpoint — returns a single InstagramProfileData-shaped object
   * built from the latest published highlighted post + settings-provided handle/bio.
   * Frontend expects this shape from `/public/instagram` and `/admin/instagram`.
   */
  async getLegacyProfile(placement: InstagramPlacementType = InstagramPlacementType.HOME) {
    const [latestPost, settings] = await Promise.all([
      this.prisma.instagramPost.findFirst({
        where: {
          status: InstagramPostStatus.PUBLISHED,
          deletedAt: null,
          placements: { some: { placement, isHighlighted: true } },
        },
        include: {
          placements: { where: { placement }, orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.setting.findMany({
        where: { key: { in: ['social.instagram', 'social.instagramUrl'] } },
      }),
    ]);

    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const rawHandle = settingsMap['social.instagram'] ?? 'bemfsmundip';
    // Strip URL prefix if present so handle is always a username (no leading @).
    const handle = rawHandle.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/^@/, '').replace(/\/$/, '') || 'bemfsmundip';
    const handleUrl = settingsMap['social.instagramUrl'] ?? `https://instagram.com/${handle}`;

    const postCount = await this.prisma.instagramPost.count({
      where: { deletedAt: null },
    });

    if (!latestPost) {
      return {
        id: 'bemfsm-instagram-profile',
        handle,
        bio: null,
        profilePictureUrl: null,
        profileMedia: null,
        followerCount: null,
        followingCount: null,
        postCount,
        latestPostUrl: handleUrl,
        latestPostImageUrl: null,
        latestPostCaption: null,
        latestPostDate: null,
        latestPostMedia: null,
        lastSyncedAt: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      id: latestPost.id,
      handle,
      bio: null,
      profilePictureUrl: null,
      profileMedia: null,
      followerCount: null,
      followingCount: null,
      postCount,
      latestPostUrl: latestPost.canonicalUrl,
      latestPostImageUrl: null,
      latestPostCaption: latestPost.internalTitle ?? null,
      latestPostDate: latestPost.updatedAt.toISOString(),
      latestPostMedia: null,
      lastSyncedAt: null,
      updatedAt: latestPost.updatedAt.toISOString(),
    };
  }

  // ============================================================
  // Mappers
  // ============================================================

  private toPlacementResponse(p: InstagramPlacement): InstagramPlacementResponseDto {
    return {
      id: p.id,
      placement: p.placement as InstagramPlacementType,
      isHighlighted: p.isHighlighted,
      sortOrder: p.sortOrder,
    };
  }

  private toResponse(p: PostWithPlacements): InstagramPostResponseDto {
    return {
      id: p.id,
      canonicalUrl: p.canonicalUrl,
      shortcode: p.shortcode,
      internalTitle: p.internalTitle,
      contentType: p.contentType as InstagramContentType,
      status: p.status as InstagramPostStatus,
      internalNote: p.internalNote,
      placements: p.placements.map((pl) => this.toPlacementResponse(pl)),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private toListItem(p: PostWithPlacements): InstagramPostListItemDto {
    return {
      id: p.id,
      canonicalUrl: p.canonicalUrl,
      shortcode: p.shortcode,
      internalTitle: p.internalTitle,
      contentType: p.contentType as InstagramContentType,
      status: p.status as InstagramPostStatus,
      placements: p.placements.map((pl) => this.toPlacementResponse(pl)),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
