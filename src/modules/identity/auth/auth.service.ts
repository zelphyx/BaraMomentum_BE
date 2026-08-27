import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { AppError } from '../../../common/errors/app-error';
import { MailService } from '../../../common/mail/mail.service';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { LoginThrottleService } from './login-throttle.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';

export interface LoginInput {
  email: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    roleCode: string;
    passwordMustChange: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly token: TokenService,
    private readonly password: PasswordService,
    private readonly session: SessionService,
    private readonly throttle: LoginThrottleService,
    private readonly perms: PermissionsService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(input: LoginInput): Promise<TokenResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    const genericError = new AppError('UNAUTHENTICATED', 'Email atau password salah', 401);

    if (!user) {
      await this.audit.write({
        actorId: null,
        action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
        resourceType: 'user',
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { email: input.email },
      });
      throw genericError;
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('UNAUTHENTICATED', 'Akun belum aktif', 401);
    }

    if (await this.throttle.isLocked(user.id)) {
      throw new AppError('ACCOUNT_LOCKED', 'Akun terkunci sementara', 401);
    }

    const ok = await this.password.verify(user.passwordHash ?? '', input.password);
    if (!ok) {
      await this.throttle.recordFailure(user.id);
      await this.audit.write({
        actorId: user.id,
        action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
        resourceType: 'user',
        resourceId: user.id,
        ip: input.ip,
        userAgent: input.userAgent,
      });
      throw genericError;
    }

    await this.throttle.recordSuccess(user.id);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const perms = await this.perms.loadForUser(user.id);
    const accessToken = this.token.signAccess({
      sub: user.id,
      email: user.email,
      roleCode: user.roleCode,
      permissions: perms.permissions,
      unitScopes: perms.unitScopes,
      passwordMustChange: user.passwordMustChange,
    });
    const { token: refreshToken } = await this.session.create(user.id, {
      ip: input.ip ?? undefined,
      userAgent: input.userAgent ?? undefined,
    });

    await this.audit.write({
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      resourceType: 'user',
      resourceId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleCode: user.roleCode,
        passwordMustChange: user.passwordMustChange,
      },
    };
  }

  async refresh(
    rawToken: string,
    meta: { ip: string | null; userAgent: string | null },
  ): Promise<TokenResponse> {
    let rotated: { token: string; sessionId: string; userId: string };
    try {
      rotated = await this.session.rotate(rawToken);
    } catch (err) {
      await this.audit.write({
        actorId: null,
        action: AUDIT_ACTIONS.USER_REFRESH_REUSE,
        resourceType: 'session',
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw err;
    }

    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('UNAUTHENTICATED', 'Akun tidak aktif', 401);
    }

    const perms = await this.perms.loadForUser(user.id);
    const accessToken = this.token.signAccess({
      sub: user.id,
      email: user.email,
      roleCode: user.roleCode,
      permissions: perms.permissions,
      unitScopes: perms.unitScopes,
      passwordMustChange: user.passwordMustChange,
    });

    await this.audit.write({
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_REFRESH,
      resourceType: 'session',
      resourceId: rotated.sessionId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken: rotated.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleCode: user.roleCode,
        passwordMustChange: user.passwordMustChange,
      },
    };
  }

  async logout(
    rawToken: string,
    actorId: string | null,
    meta: { ip: string | null; userAgent: string | null },
  ): Promise<void> {
    if (rawToken) await this.session.revoke(rawToken);
    await this.audit.write({
      actorId,
      action: AUDIT_ACTIONS.USER_LOGOUT,
      resourceType: 'session',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('UNAUTHENTICATED', 'Tidak terautentikasi', 401);
    const perms = await this.perms.loadForUser(user.id);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roleCode: user.roleCode,
      permissions: perms.permissions,
      unitScopes: perms.unitScopes,
      passwordMustChange: user.passwordMustChange,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta: { ip: string | null; userAgent: string | null },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('UNAUTHENTICATED', 'Tidak terautentikasi', 401);

    const ok = await this.password.verify(user.passwordHash ?? '', currentPassword);
    if (!ok) throw new AppError('UNAUTHENTICATED', 'Password saat ini salah', 401);

    const newHash = await this.password.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, passwordMustChange: false },
    });
    await this.session.revokeAll(userId);

    await this.audit.write({
      actorId: userId,
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE,
      resourceType: 'user',
      resourceId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async forgotPassword(
    email: string,
    meta: { ip: string | null; userAgent: string | null },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await this.audit.write({
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET_REQUEST,
      resourceType: 'user',
      resourceId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await this.mail.send({
      to: user.email,
      subject: 'Reset password BEM FSM',
      text: `Gunakan token berikut untuk reset password (berlaku 1 jam):\n\n${rawToken}\n\nAbaikan jika Anda tidak meminta reset.`,
    });
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
    meta: { ip: string | null; userAgent: string | null },
  ): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw new AppError('VALIDATION_ERROR', 'Token tidak valid atau kadaluarsa', 400);
    }
    const newHash = await this.password.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newHash, passwordMustChange: false },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.write({
      actorId: record.userId,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      resourceType: 'user',
      resourceId: record.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}