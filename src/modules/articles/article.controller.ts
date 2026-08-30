import {
  Controller, Get, Post as HttpPost, Put, Delete as HttpDelete, Delete,
  Param, Query, Body, Headers, UseGuards,
  HttpCode, HttpStatus, NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArticleService } from './article.service';
import { TokenService } from '../identity/auth/token.service';
import {
  CreateArticleDto, UpdateArticleDto, ListArticlesDto,
} from './dto/article.dto';
import {
  CreateCategoryDto, UpdateCategoryDto,
} from './dto/category.dto';
import { JwtAuthGuard, Public } from '../identity/auth/jwt-auth.guard';
import { PermissionsGuard } from '../identity/rbac/permissions.guard';
import { Permissions } from '../identity/rbac/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class ArticleController {
  constructor(
    private readonly articles: ArticleService,
    private readonly tokens: TokenService,
  ) {}

  // === Admin articles ===
  @Get('admin/articles')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.read')
  async list(@Query() query: ListArticlesDto) {
    return this.articles.list(query);
  }

  @HttpPost('admin/articles')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.create')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(@Body() dto: CreateArticleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.create(dto, user.sub);
  }

  @Get('admin/articles/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.read')
  async get(@Param('id') id: string) {
    return this.articles.get(id);
  }

  @Put('admin/articles/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    const version = ifMatch ? parseInt(ifMatch.replace(/"/g, ''), 10) : undefined;
    return this.articles.update(id, dto, user.sub, version);
  }

  @HttpPost('admin/articles/:id/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.publish(id, user.sub);
  }

  @HttpPost('admin/articles/:id/schedule')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.update')
  @HttpCode(HttpStatus.OK)
  async schedule(
    @Param('id') id: string,
    @Body() body: { scheduledAt: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.schedule(id, new Date(body.scheduledAt), user.sub);
  }

  @HttpPost('admin/articles/:id/unpublish')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.publish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.unpublish(id, user.sub);
  }

  @HttpPost('admin/articles/:id/archive')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.archive(id, user.sub);
  }

  @HttpPost('admin/articles/:id/unarchive')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.update')
  @HttpCode(HttpStatus.OK)
  async unarchive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.unarchive(id, user.sub);
  }

  @HttpPost('admin/articles/:id/featured')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.update')
  @HttpCode(HttpStatus.OK)
  async setFeatured(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articles.setFeatured(id, user.sub);
  }

  @HttpPost('admin/articles/:id/preview-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.read')
  async generatePreviewToken(@Param('id') id: string) {
    const article = await this.articles.get(id);
    if (!article) throw new NotFoundException('Artikel tidak ditemukan');
    const token = this.tokens.signPreview({ articleId: id, scope: 'preview' });
    return { token, expiresIn: '15m' };
  }

  @HttpDelete('admin/articles/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.articles.delete(id);
  }

  @Get('admin/articles/:id/revisions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.read')
  async listRevisions(@Param('id') id: string) {
    return this.articles.listRevisions(id);
  }

  @HttpPost('admin/articles/:id/revisions/:revisionId/restore')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.update')
  @HttpCode(HttpStatus.OK)
  async restoreRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.restoreRevision(id, revisionId, user.sub);
  }

  // === Public articles ===
  @Get('public/articles')
  @Public()
  async listPublic(@Query() query: ListArticlesDto) {
    return this.articles.listPublished(query);
  }

  @Get('public/articles/featured')
  @Public()
  async getFeatured() {
    const featured = await this.articles.getFeatured();
    if (!featured) throw new NotFoundException();
    return featured;
  }

  @Get('preview/:token')
  @Public()
  async getPreview(@Param('token') token: string) {
    const payload = this.tokens.verifyPreview(token);
    if (payload.scope !== 'preview') throw new NotFoundException();
    // articles.get() throws NotFoundException if article not found or deleted
    return this.articles.get(payload.articleId);
  }

  @Get('public/articles/:slug')
  @Public()
  async getPublic(@Param('slug') slug: string) {
    return this.articles.getPublic(slug);
  }

  // === Categories ===
  @Get('public/article-categories')
  @Public()
  async listCategories() {
    return this.articles.listCategories();
  }

  @Get('admin/article-categories')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.read')
  async adminListCategories() {
    return this.articles.listCategories();
  }

  @HttpPost('admin/article-categories')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.create')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.articles.createCategory(dto);
  }

  @Put('admin/article-categories/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.update')
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.articles.updateCategory(id, dto);
  }

  @HttpDelete('admin/article-categories/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('articles.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id') id: string) {
    await this.articles.deleteCategory(id);
  }
}
