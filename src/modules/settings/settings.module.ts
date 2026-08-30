import { Module } from '@nestjs/common';
import { SettingsController, PublicSettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
