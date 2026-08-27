import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { loadEnvConfig } from './config/configuration';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';

const env = loadEnvConfig();

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        ttl: env.THROTTLE_TTL_MS,
        limit: env.THROTTLE_LIMIT,
      },
    ]),
    HealthModule,
    IdentityModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
