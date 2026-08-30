import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { OrganizationModule } from '../organization/organization.module';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule, OrganizationModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
