import {
  Controller,
  Get,
  Post as HttpPost,
  Patch,
  Delete as HttpDelete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InstagramService } from './instagram.service';
import {
  CreateInstagramPostDto,
  UpdateInstagramPostDto,
  ListInstagramPostsDto,
  ToggleHighlightDto,
  ReorderPostsDto,
  InstagramPlacementType,
} from './dto/instagram-post.dto';
import { JwtAuthGuard, Public } from '../identity/auth/jwt-auth.guard';
import { PermissionsGuard } from '../identity/rbac/permissions.guard';
import { Permissions } from '../identity/rbac/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class InstagramController {
  constructor(private readonly instagram: InstagramService) {}

  // ============================================================
  // Admin — Posts
  // ============================================================

  @Get('admin/instagram-posts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('instagram.read')
  async list(@Query() dto: ListInstagramPostsDto) {
    return this.instagram.list(dto);
  }

  @HttpPost('admin/instagram-posts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('instagram.create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateInstagramPostDto, @CurrentUser() user: AuthenticatedUser) {
    return this.instagram.create(dto, user.sub);
  }

  @Get('admin/instagram-posts/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('instagram.read')
  async get(@Param('id') id: string) {
    return this.instagram.get(id);
  }

  @Patch('admin/instagram-posts/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('instagram.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInstagramPostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.instagram.update(id, dto, user.sub);
  }

  @HttpDelete('admin/instagram-posts/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('instagram.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.instagram.delete(id);
  }

  @Patch('admin/instagram-posts/:id/highlight')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('instagram.update')
  async toggleHighlight(
    @Param('id') id: string,
    @Body() dto: ToggleHighlightDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.instagram.toggleHighlight(id, dto, user.sub);
  }

  @Patch('admin/instagram-posts/reorder')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('instagram.update')
  @HttpCode(HttpStatus.OK)
  async reorder(@Body() dto: ReorderPostsDto) {
    await this.instagram.reorder(dto);
  }

  // ============================================================
  // Public
  // ============================================================

  @Get('public/instagram-posts')
  @Public()
  async getPublic(@Query('placement') placement: string) {
    const p = (placement as InstagramPlacementType) ?? InstagramPlacementType.HOME;
    return this.instagram.getPublic(p);
  }

  // ============================================================
  // Legacy compatibility — shape returned matches InstagramProfileData
  // used by older frontend callers. Returns single profile object built
  // from latest highlighted published post + settings (handle).
  // ============================================================

  @Get('public/instagram')
  @Public()
  async getLegacyPublic(@Query('placement') placement?: string) {
    const p = (placement as InstagramPlacementType) ?? InstagramPlacementType.HOME;
    return this.instagram.getLegacyProfile(p);
  }

  @Get('admin/instagram')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('instagram.read')
  async getLegacyAdmin(@Query('placement') placement?: string) {
    const p = (placement as InstagramPlacementType) ?? InstagramPlacementType.HOME;
    return this.instagram.getLegacyProfile(p);
  }
}
