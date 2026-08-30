import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from './common/common.module';
import { loadEnvConfig } from './config/configuration';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { MediaModule } from './modules/media/media.module';
import { ArticleModule } from './modules/articles/article.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { InstagramModule } from './modules/instagram/instagram.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SettingsModule } from './modules/settings/settings.module';

const env = loadEnvConfig();

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: env.THROTTLE_TTL_MS,
        limit: env.THROTTLE_LIMIT,
      },
    ]),
    HealthModule,
    IdentityModule,
    MediaModule,
    ArticleModule,
    OrganizationModule,
    InstagramModule,
    DashboardModule,
    SettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
