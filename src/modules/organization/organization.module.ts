import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { UnitRepository } from './unit.repository';
import { UnitScopeGuard } from './unit-scope.guard';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, UnitRepository, UnitScopeGuard],
  exports: [OrganizationService],
})
export class OrganizationModule {}
