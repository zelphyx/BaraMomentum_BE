import {
  Controller, Get, Post as HttpPost, Patch, Delete as HttpDelete,
  Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import {
  CreateUnitDto, UpdateUnitDto, ListUnitsDto, ReorderUnitsDto,
} from './dto/unit.dto';
import { JwtAuthGuard, Public } from '../identity/auth/jwt-auth.guard';
import { PermissionsGuard } from '../identity/rbac/permissions.guard';
import { Permissions } from '../identity/rbac/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UnitScopeGuard, UNIT_SCOPE_KEY } from './unit-scope.guard';
import { SetMetadata } from '@nestjs/common';

export const RequireUnitScope = () => SetMetadata(UNIT_SCOPE_KEY, 'unitId');

@Controller()
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}

  // === Admin ===
  // NOTE: Static routes (metrics, reorder) must be declared BEFORE /:id parameter routes

  @Get('admin/organization-units')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('organization.read')
  async list(@Query() dto: ListUnitsDto) {
    return this.org.list(dto);
  }

  @Get('admin/organization-units/metrics')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('organization.read')
  async metrics() {
    return this.org.getMetrics();
  }

  @HttpPost('admin/organization-units')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('organization.create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUnitDto, @CurrentUser() user: AuthenticatedUser) {
    return this.org.create(dto, user.sub);
  }

  @Patch('admin/organization-units/reorder')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('organization.update')
  @HttpCode(HttpStatus.OK)
  async reorder(@Body() dto: ReorderUnitsDto) {
    await this.org.reorder(dto);
  }

  // NOTE: /:id and /:id/* routes must come AFTER static routes
  @Get('admin/organization-units/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, UnitScopeGuard)
  @Permissions('organization.read')
  @RequireUnitScope()
  async get(@Param('id') id: string) {
    return this.org.get(id);
  }

  @Patch('admin/organization-units/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, UnitScopeGuard)
  @Permissions('organization.update')
  @RequireUnitScope()
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.org.update(id, dto, user.sub);
  }

  @HttpDelete('admin/organization-units/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, UnitScopeGuard)
  @Permissions('organization.delete')
  @RequireUnitScope()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.org.delete(id);
  }

  @HttpPost('admin/organization-units/:id/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard, UnitScopeGuard)
  @Permissions('organization.update')
  @RequireUnitScope()
  @HttpCode(HttpStatus.OK)
  async publish(@Param('id') id: string) {
    return this.org.publish(id);
  }

  @HttpPost('admin/organization-units/:id/archive')
  @UseGuards(JwtAuthGuard, PermissionsGuard, UnitScopeGuard)
  @Permissions('organization.update')
  @RequireUnitScope()
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id') id: string) {
    return this.org.archive(id);
  }

  // === Public ===
  @Get('public/organization-units')
  @Public()
  async listPublic() {
    return this.org.listPublic();
  }

  @Get('public/organization-units/:slug')
  @Public()
  async getPublic(@Param('slug') slug: string) {
    return this.org.getBySlug(slug);
  }
}
