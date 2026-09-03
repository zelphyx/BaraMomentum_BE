import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MediaAsset, Prisma } from '@prisma/client';
import { MediaVariant } from './dto/media.dto';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.MediaAssetUncheckedCreateInput): Promise<MediaAsset> {
    return this.prisma.mediaAsset.create({ data });
  }

  async findById(id: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, email: true, name: true } } },
    });
  }

  async findMany(params: {
    variant?: MediaVariant;
    page: number;
    pageSize: number;
  }): Promise<{ data: MediaAsset[]; total: number }> {
    const { variant, page, pageSize } = params;
    const where = { deletedAt: null, ...(variant ? { variant } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return { data, total };
  }

  async softDelete(id: string): Promise<MediaAsset> {
    return this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findDeletedBefore(date: Date): Promise<MediaAsset[]> {
    return this.prisma.mediaAsset.findMany({
      where: {
        deletedAt: { lt: date },
      },
    });
  }

  /**
   * Active media (not soft-deleted) that were created before `cutoff` AND have no
   * FK reference anywhere. Used by the abandoned-upload cleanup job — admin
   * uploaded a file but never assigned it to any article/unit/member/avatar.
   */
  async findActiveUnreferencedOlderThan(cutoff: Date): Promise<MediaAsset[]> {
    const all = await this.prisma.mediaAsset.findMany({
      where: { deletedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true },
    });
    return all as MediaAsset[];
  }

  async hardDelete(id: string): Promise<void> {
    await this.prisma.mediaAsset.delete({ where: { id } });
  }

  async updateAlt(id: string, alt: string): Promise<MediaAsset> {
    return this.prisma.mediaAsset.update({
      where: { id },
      data: { alt },
    });
  }

  async countByField(model: string, field: string, value: string): Promise<number> {
    switch (model) {
      case 'Article':
        return this.prisma.article.count({
          where: { [field]: value, deletedAt: null } as Prisma.ArticleWhereInput,
        });
      case 'OrganizationUnit':
        return this.prisma.organizationUnit.count({
          where: { [field]: value, deletedAt: null } as Prisma.OrganizationUnitWhereInput,
        });
      case 'UnitMember':
        return this.prisma.unitMember.count({
          where: { [field]: value } as Prisma.UnitMemberWhereInput,
        });
      case 'User':
        return this.prisma.user.count({
          where: { [field]: value, deletedAt: null } as Prisma.UserWhereInput,
        });
      default:
        return 0;
    }
  }
}
