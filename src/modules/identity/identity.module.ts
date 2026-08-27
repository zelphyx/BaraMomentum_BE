import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../../database/prisma.module';
import { MailModule } from '../../common/mail/mail.module';
import { loadEnvConfig } from '../../config/configuration';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { TokenService } from './auth/token.service';
import { PasswordService } from './auth/password.service';
import { SessionService } from './auth/session.service';
import { LoginThrottleService } from './auth/login-throttle.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsService } from './rbac/permissions.service';
import { PermissionsGuard } from './rbac/permissions.guard';
import { UnitScopeGuard } from './rbac/unit-scope.guard';
import { AuditService } from './audit/audit.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { InvitationsController } from './invitations/invitations.controller';
import { InvitationsService } from './invitations/invitations.service';

const env = loadEnvConfig();

@Global()
@Module({
  imports: [
    PrismaModule,
    MailModule,
    PassportModule,
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: env.JWT_ACCESS_TTL },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: env.THROTTLE_TTL_MS,
        limit: env.THROTTLE_LIMIT,
      },
    ]),
  ],
  controllers: [AuthController, UsersController, InvitationsController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    SessionService,
    LoginThrottleService,
    JwtStrategy,
    JwtAuthGuard,
    PermissionsService,
    PermissionsGuard,
    UnitScopeGuard,
    AuditService,
    UsersService,
    InvitationsService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [
    AuthService,
    TokenService,
    PasswordService,
    SessionService,
    PermissionsService,
    AuditService,
    UsersService,
    InvitationsService,
  ],
})
export class IdentityModule {}
