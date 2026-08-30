import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard, Public } from '../identity/auth/jwt-auth.guard';
import { PermissionsGuard } from '../identity/rbac/permissions.guard';
import { Permissions } from '../identity/rbac/permissions.decorator';

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('admin/dashboard')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('dashboard.read')
  async getAdmin() {
    return this.dashboard.getAdminMetrics();
  }

  @Get('public/dashboard')
  @Public()
  async getPublic() {
    return this.dashboard.getPublicMetrics();
  }
}
