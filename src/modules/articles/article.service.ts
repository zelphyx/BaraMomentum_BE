import { BadRequestException, ConflictException, Injectable, NotFoundException, PreconditionFailedException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { ArticleRepository } from './article.repository';
import { ArticleSanitizerService } from './article-sanitizer.service';
import { Prisma } from '@prisma/client';
import {
  CreateArticleDto, UpdateArticleDto, ListArticlesDto,
  ArticleResponseDto, ArticleStatus, ArticleVisibility,
} from './dto/article.dto';
import {
  CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto,
} from './dto/category.dto';

const RESERVED_SLUGS = ['new', 'create', 'edit', 'admin', 'api', 'auth', 'login', 'sitemap'];

@Injectable()
export class ArticleService {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly sanitizer: ArticleSanitizerService,
  ) {}

  async create(dto: CreateArticleDto, actorId: string): Promise<ArticleResponseDto> {
    const slug = this.generateSlug(dto.title);
    const sanitized = this.sanitizer.sanitize(dto.content);
    const plainText = this.sanitizer.extractPlainText(sanitized);
    const wordCount = this.sanitizer.computeWordCount(plainText);
    const article = await this.repo.create({
      id: uuidv4(),
      title: dto.title,
      slug,
      excerpt: dto.excerpt ?? null,
      content: sanitized,
      coverMediaId: dto.coverMediaId ?? null,
      categoryId: dto.categoryId ?? null,
      authorId: dto.authorId ?? null,
      visibility: (dto.visibility ?? ArticleVisibility.PUBLIC) as Prisma.EnumArticleVisibilityFieldUpdateOperationsInput['set'],
      coverAlt: dto.coverAlt ?? null,
      searchText: plainText,
      wordCount,
      readingMinutes: this.sanitizer.computeReadingMinutes(wordCount),
      createdById: actorId,
      updatedById: actorId,
    } as unknown as Prisma.ArticleUncheckedCreateInput);
    return this.toResponse(article);
  }

  async list(dto: ListArticlesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const { data, total } = await this.repo.findMany({ ...dto, page, pageSize });
    return { data: data.map((a) => this.toResponse(a)), total, page, pageSize };
  }

  async get(id: string): Promise<ArticleResponseDto> {
    const article = await this.repo.findById(id);
    if (!article || article.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');
    return this.toResponse(article);
  }

  async getPublic(slug: string): Promise<ArticleResponseDto> {
    const article = await this.repo.findBySlug(slug);
    if (!article || article.deletedAt || article.status !== 'PUBLISHED' || article.visibility !== 'PUBLIC') {
      throw new NotFoundException('Artikel tidak ditemukan');
    }
    return this.toResponse(article);
  }

  async listPublished(dto: ListArticlesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const { data, total } = await this.repo.findPublished({ ...dto, page, pageSize });
    return { data: data.map((a) => this.toResponse(a)), total, page, pageSize };
  }

  async getFeatured(): Promise<ArticleResponseDto | null> {
    const article = await this.repo.findFeatured();
    return article ? this.toResponse(article) : null;
  }

  async update(id: string, dto: UpdateArticleDto, actorId: string, expectedVersion?: number): Promise<ArticleResponseDto> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');

    const updateData: Record<string, unknown> = { updatedById: actorId };

    if (dto.title !== undefined) {
      updateData.title = dto.title;
      updateData.slug = this.generateSlug(dto.title, existing.id);
    }
    if (dto.content !== undefined) {
      const sanitized = this.sanitizer.sanitize(dto.content);
      const plainText = this.sanitizer.extractPlainText(sanitized);
      updateData.content = sanitized;
      updateData.searchText = plainText;
      const wc = this.sanitizer.computeWordCount(plainText);
      updateData.wordCount = wc;
      updateData.readingMinutes = this.sanitizer.computeReadingMinutes(wc);
    }
    if (dto.excerpt !== undefined) updateData.excerpt = dto.excerpt;
    if (dto.coverMediaId !== undefined) updateData.coverMediaId = dto.coverMediaId;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.visibility !== undefined) updateData.visibility = dto.visibility;
    if (dto.coverAlt !== undefined) updateData.coverAlt = dto.coverAlt;
    if (dto.scheduledAt !== undefined) updateData.scheduledAt = new Date(dto.scheduledAt);

    await this.repo.createRevision({
      id: uuidv4(),
      articleId: id,
      beforeJson: existing as unknown as Prisma.InputJsonValue,
      createdById: actorId,
    });

    let article: Awaited<ReturnType<typeof this.repo.update>>;
    if (expectedVersion !== undefined) {
      try {
        article = await this.repo.updateWithVersion(id, updateData as Prisma.ArticleUpdateInput, expectedVersion);
      } catch (err: unknown) {
        const e = err as Error & { code?: string; currentVersion?: number };
        if (e.code === 'VERSION_CONFLICT') {
          throw new ConflictException({ code: 'VERSION_CONFLICT', currentVersion: e.currentVersion, message: 'Artikel sudah diubah. Silakan refresh dan coba lagi.' });
        }
        throw err;
      }
    } else {
      article = await this.repo.update(id, updateData as Prisma.ArticleUpdateInput);
    }

    await this.repo.pruneRevisions(id);
    return this.toResponse(article);
  }

  async publish(id: string, actorId: string): Promise<ArticleResponseDto> {
    const article = await this.repo.findById(id);
    if (!article || article.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');
    if (article.status === 'PUBLISHED') throw new BadRequestException('Artikel sudah dipublikasikan');
    if (article.status === 'ARCHIVED') throw new BadRequestException('Tidak dapat memublikasikan artikel yang diarsipkan');
    this.validatePublishRequirements(article);
    const updated = await this.repo.update(id, {
      status: { set: 'PUBLISHED' as Prisma.EnumArticleStatusFieldUpdateOperationsInput['set'] },
      publishedAt: new Date(),
      scheduledAt: null,
      updatedById: actorId,
    } as unknown as Prisma.ArticleUpdateInput);
    return this.toResponse(updated);
  }

  async schedule(id: string, scheduledAt: Date, actorId: string): Promise<ArticleResponseDto> {
    if (scheduledAt <= new Date()) throw new BadRequestException('Tanggal jadwal harus di masa depan');
    const article = await this.repo.findById(id);
    if (!article || article.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');
    if (article.status !== 'DRAFT') throw new BadRequestException('Hanya artikel DRAFT yang bisa dijadwalkan');
    const updated = await this.repo.update(id, {
      status: { set: 'SCHEDULED' as Prisma.EnumArticleStatusFieldUpdateOperationsInput['set'] },
      scheduledAt,
      updatedById: actorId,
    } as unknown as Prisma.ArticleUpdateInput);
    return this.toResponse(updated);
  }

  async unpublish(id: string, actorId: string): Promise<ArticleResponseDto> {
    const article = await this.repo.findById(id);
    if (!article || article.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');
    if (article.status !== 'PUBLISHED') throw new BadRequestException('Hanya artikel PUBLISHED yang bisa di-unpublish');
    const updated = await this.repo.update(id, {
      status: { set: 'DRAFT' as Prisma.EnumArticleStatusFieldUpdateOperationsInput['set'] },
      publishedAt: null,
      updatedById: actorId,
    } as unknown as Prisma.ArticleUpdateInput);
    return this.toResponse(updated);
  }

  async archive(id: string, actorId: string): Promise<ArticleResponseDto> {
    const article = await this.repo.findById(id);
    if (!article || article.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');
    if (article.status === 'ARCHIVED') throw new BadRequestException('Artikel sudah diarsipkan');
    const updated = await this.repo.update(id, {
      status: { set: 'ARCHIVED' as Prisma.EnumArticleStatusFieldUpdateOperationsInput['set'] },
      isFeatured: false,
      updatedById: actorId,
    } as unknown as Prisma.ArticleUpdateInput);
    return this.toResponse(updated);
  }

  async unarchive(id: string, actorId: string): Promise<ArticleResponseDto> {
    const article = await this.repo.findById(id);
    if (!article || article.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');
    if (article.status !== 'ARCHIVED') throw new BadRequestException('Hanya artikel ARCHIVED yang bisa di-unarchive');
    const updated = await this.repo.update(id, {
      status: { set: 'DRAFT' as Prisma.EnumArticleStatusFieldUpdateOperationsInput['set'] },
      updatedById: actorId,
    } as unknown as Prisma.ArticleUpdateInput);
    return this.toResponse(updated);
  }

  async setFeatured(id: string, _actorId: string): Promise<ArticleResponseDto> {
    const article = await this.repo.findById(id);
    if (!article || article.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');
    if (article.status !== 'PUBLISHED') throw new BadRequestException('Hanya artikel PUBLISHED yang bisa di-featured');
    await this.repo.setFeatured(id);
    const updated = await this.repo.findById(id);
    return this.toResponse(updated!);
  }

  async delete(id: string): Promise<void> {
    const article = await this.repo.findById(id);
    if (!article || article.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');
    await this.repo.softDelete(id);
  }

  async listRevisions(articleId: string) {
    return this.repo.findRevisions(articleId);
  }

  async restoreRevision(articleId: string, revisionId: string, actorId: string): Promise<ArticleResponseDto> {
    const article = await this.repo.findById(articleId);
    if (!article || article.deletedAt) throw new NotFoundException('Artikel tidak ditemukan');
    const revisions = await this.repo.findRevisions(articleId);
    const revision = revisions.find((r) => r.id === revisionId);
    if (!revision) throw new NotFoundException('Revisi tidak ditemukan');

    const before = revision.beforeJson as Record<string, unknown>;
    const updateData = {
      title: { set: before['title'] as string },
      excerpt: before['excerpt'] ? { set: before['excerpt'] as string } : undefined,
      content: { set: before['content'] as string },
      coverMediaId: before['coverMediaId'] ? { set: before['coverMediaId'] as string } : undefined,
      categoryId: before['categoryId'] ? { set: before['categoryId'] as string } : undefined,
      visibility: { set: before['visibility'] as string },
      coverAlt: before['coverAlt'] ? { set: before['coverAlt'] as string } : undefined,
      searchText: { set: before['searchText'] as string },
      wordCount: { set: before['wordCount'] as number },
      readingMinutes: { set: before['readingMinutes'] as number },
      updatedById: actorId,
    } as unknown as Prisma.ArticleUpdateInput;

    await this.repo.createRevision({
      id: uuidv4(),
      articleId,
      beforeJson: article as unknown as Prisma.InputJsonValue,
      afterJson: updateData as unknown as Prisma.InputJsonValue,
      reason: `Restore to revision ${revisionId}`,
      createdById: actorId,
    });

    const updated = await this.repo.update(articleId, updateData);
    return this.toResponse(updated);
  }

  async listCategories() {
    const cats = await this.repo.findAllCategories();
    return cats.map((c) => this.toCategoryResponse(c));
  }

  async createCategory(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const existing = await this.repo.findCategoryBySlug(dto.slug);
    if (existing) throw new ConflictException('Slug kategori sudah ada');
    const cat = await this.repo.createCategory({ id: uuidv4(), ...dto } as unknown as Prisma.ArticleCategoryUncheckedCreateInput);
    return this.toCategoryResponse(cat);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const existing = await this.repo.findCategoryById(id);
    if (!existing) throw new NotFoundException('Kategori tidak ditemukan');
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.repo.findCategoryBySlug(dto.slug);
      if (slugExists) throw new ConflictException('Slug kategori sudah ada');
    }
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    const cat = await this.repo.updateCategory(id, updateData as unknown as Prisma.ArticleCategoryUpdateInput);
    return this.toCategoryResponse(cat);
  }

  async deleteCategory(id: string): Promise<void> {
    const existing = await this.repo.findCategoryById(id);
    if (!existing) throw new NotFoundException('Kategori tidak ditemukan');
    await this.repo.deleteCategory(id);
  }

  async publishScheduled(): Promise<number> {
    const due = await this.repo.findScheduledDue(new Date());
    for (const article of due) {
      await this.repo.update(article.id, {
        status: { set: 'PUBLISHED' as Prisma.EnumArticleStatusFieldUpdateOperationsInput['set'] },
        publishedAt: new Date(),
        scheduledAt: null,
      } as unknown as Prisma.ArticleUpdateInput);
    }
    return due.length;
  }

  private validatePublishRequirements(article: { title: string | null; content: string | null; categoryId: string | null; coverAlt: string | null }): void {
    const errors: string[] = [];
    if (!article.title?.trim()) errors.push('title');
    if (!article.content?.trim()) errors.push('content');
    if (!article.categoryId) errors.push('categoryId');
    if (!article.coverAlt?.trim()) errors.push('coverAlt');
    if (errors.length > 0) {
      throw new PreconditionFailedException({
        code: 'MISSING_PUBLISH_REQUIREMENTS',
        message: `Field wajib belum diisi: ${errors.join(', ')}`,
        fields: errors,
      });
    }
  }

  private generateSlug(title: string, excludeId?: string): string {
    let slug = slugify(title, { lower: true, strict: true, trim: true });
    if (RESERVED_SLUGS.includes(slug)) slug = `${slug}-artikel`;
    if (excludeId) slug = `${slug}-${excludeId.slice(0, 8)}`;
    return slug;
  }

  private toResponse(a: {
    id: string; title: string; slug: string; excerpt: string | null; content: string;
    coverMediaId: string | null; categoryId: string | null; authorId: string | null;
    status: string; visibility: string;
    isFeatured: boolean; coverAlt: string | null; wordCount: number; readingMinutes: number;
    publishedAt: Date | null; scheduledAt: Date | null; version: number; createdAt: Date; updatedAt: Date;
  }): ArticleResponseDto {
    return {
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      content: a.content,
      coverMediaId: a.coverMediaId,
      categoryId: a.categoryId,
      authorId: a.authorId,
      status: a.status as ArticleStatus,
      visibility: a.visibility as ArticleVisibility,
      isFeatured: a.isFeatured,
      coverAlt: a.coverAlt,
      wordCount: a.wordCount,
      readingMinutes: a.readingMinutes,
      publishedAt: a.publishedAt,
      scheduledAt: a.scheduledAt,
      version: a.version,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  private toCategoryResponse(c: { id: string; name: string; slug: string; description: string | null; sortOrder: number; createdAt: Date }): CategoryResponseDto {
    return { id: c.id, name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder, createdAt: c.createdAt };
  }
}
