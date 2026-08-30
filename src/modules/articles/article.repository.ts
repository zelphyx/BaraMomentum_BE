import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Article, ArticleRevision, ArticleCategory, Prisma, ArticleStatus } from '@prisma/client';

@Injectable()
export class ArticleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // === Articles ===
  async create(data: Prisma.ArticleUncheckedCreateInput): Promise<Article> {
    return this.prisma.article.create({ data });
  }

  async findById(id: string): Promise<Article | null> {
    return this.prisma.article.findUnique({
      where: { id },
      include: {
        coverMedia: { select: { id: true, url: true, width: true, height: true } },
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findBySlug(slug: string): Promise<Article | null> {
    return this.prisma.article.findUnique({ where: { slug } });
  }

  async findMany(params: {
    status?: ArticleStatus;
    categoryId?: string;
    authorId?: string;
    featured?: boolean;
    search?: string;
    page: number;
    pageSize: number;
    includeDeleted?: boolean;
  }): Promise<{ data: Article[]; total: number }> {
    const { status, categoryId, authorId, featured, search, page, pageSize, includeDeleted } = params;
    const where: Prisma.ArticleWhereInput = {
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(authorId ? { authorId } : {}),
      ...(featured !== undefined ? { isFeatured: featured } : {}),
      ...(search ? { searchText: { contains: search } } : {}),
      ...(includeDeleted ? {} : { deletedAt: null }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { publishedAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true } },
        },
      }),
      this.prisma.article.count({ where }),
    ]);
    return { data, total };
  }

  async findPublished(params: {
    categoryId?: string;
    featured?: boolean;
    page: number;
    pageSize: number;
  }): Promise<{ data: Article[]; total: number }> {
    const { categoryId, featured, page, pageSize } = params;
    const where: Prisma.ArticleWhereInput = {
      status: ArticleStatus.PUBLISHED,
      visibility: 'PUBLIC',
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(featured !== undefined ? { isFeatured: featured } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { publishedAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true } },
          coverMedia: { select: { id: true, url: true, width: true, height: true } },
        },
      }),
      this.prisma.article.count({ where }),
    ]);
    return { data, total };
  }

  async findFeatured(): Promise<Article | null> {
    return this.prisma.article.findFirst({
      where: { status: ArticleStatus.PUBLISHED, visibility: 'PUBLIC', isFeatured: true, deletedAt: null },
      orderBy: { publishedAt: 'desc' },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, name: true } },
        coverMedia: { select: { id: true, url: true, width: true, height: true } },
      },
    });
  }

  async update(id: string, data: Prisma.ArticleUpdateInput): Promise<Article> {
    return this.prisma.article.update({ where: { id }, data });
  }

  async updateWithVersion(id: string, data: Prisma.ArticleUpdateInput, expectedVersion: number): Promise<Article> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.article.findUnique({ where: { id } });
      if (!current) throw new Error('Article not found');
      if (current.version !== expectedVersion) {
        const err = new Error('Version conflict') as Error & { code: string; currentVersion: number };
        err.code = 'VERSION_CONFLICT';
        err.currentVersion = current.version;
        throw err;
      }
      return tx.article.update({
        where: { id },
        data: { ...data, version: current.version + 1 },
      });
    }) as unknown as Article;
  }

  async softDelete(id: string): Promise<Article> {
    return this.prisma.article.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async clearFeatured(): Promise<void> {
    await this.prisma.article.updateMany({
      where: { isFeatured: true },
      data: { isFeatured: false },
    });
  }

  async setFeatured(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.article.updateMany({ where: { isFeatured: true }, data: { isFeatured: false } }),
      this.prisma.article.update({ where: { id }, data: { isFeatured: true } }),
    ]);
  }

  async findScheduledDue(before: Date): Promise<Article[]> {
    return this.prisma.article.findMany({
      where: { status: ArticleStatus.SCHEDULED, scheduledAt: { lte: before }, deletedAt: null },
    });
  }

  // === Revisions ===
  async createRevision(data: Prisma.ArticleRevisionUncheckedCreateInput): Promise<ArticleRevision> {
    return this.prisma.articleRevision.create({ data });
  }

  async findRevisions(articleId: string): Promise<ArticleRevision[]> {
    return this.prisma.articleRevision.findMany({
      where: { articleId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async pruneRevisions(articleId: string, keepMin = 5): Promise<number> {
    const all = await this.prisma.articleRevision.findMany({
      where: { articleId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (all.length <= 20) return 0;
    const toDelete = all.slice(keepMin).map((r) => r.id);
    await this.prisma.articleRevision.deleteMany({ where: { id: { in: toDelete } } });
    return toDelete.length;
  }

  // === Categories ===
  async createCategory(data: Prisma.ArticleCategoryUncheckedCreateInput): Promise<ArticleCategory> {
    return this.prisma.articleCategory.create({ data });
  }

  async findCategoryById(id: string): Promise<ArticleCategory | null> {
    return this.prisma.articleCategory.findUnique({ where: { id } });
  }

  async findCategoryBySlug(slug: string): Promise<ArticleCategory | null> {
    return this.prisma.articleCategory.findUnique({ where: { slug } });
  }

  async findAllCategories(): Promise<ArticleCategory[]> {
    return this.prisma.articleCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async updateCategory(id: string, data: Prisma.ArticleCategoryUpdateInput): Promise<ArticleCategory> {
    return this.prisma.articleCategory.update({ where: { id }, data });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.prisma.articleCategory.delete({ where: { id } });
  }
}
