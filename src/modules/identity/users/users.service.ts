import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { UserRoleCode, UserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AppError, ErrorCode } from '../../../common/errors/app-error';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { MailService } from '../../../common/mail/mail.service';
import { RequestMetaInfo } from '../../../common/decorators/request-meta.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly session: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async create(
    input: CreateUserDto,
    actorId: string,
    meta: RequestMetaInfo,
  ): Promise<{
    user: { id: string; email: string; name: string; roleCode: string };
    tempPassword: string;
  }> {
    const exists = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (exists) throw new AppError(ErrorCode.CONFLICT, 'Email sudah digunakan', 409);

    const tempPassword = crypto.randomBytes(18).toString('base64url');
    const hash = await this.password.hash(tempPassword);
    const user = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: hash,
        roleCode: input.roleCode,
        status: input.status ?? UserStatus.PENDING_INVITATION,
        passwordMustChange: true,
      },
    });

    await this.audit.write({
      actorId,
      action: AUDIT_ACTIONS.USER_CREATED,
      resourceType: 'user',
      resourceId: user.id,
      afterJson: { email: user.email, roleCode: user.roleCode },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleCode: user.roleCode,
      },
      tempPassword,
    };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
    meta: RequestMetaInfo,
  ): Promise<{ id: string; email: string; name: string; roleCode: string; status: string }> {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new AppError(ErrorCode.NOT_FOUND, 'User tidak ditemukan', 404);

    if (
      before.roleCode === UserRoleCode.SUPER_ADMIN &&
      ((dto.roleCode !== undefined && dto.roleCode !== UserRoleCode.SUPER_ADMIN) ||
        (dto.status !== undefined && dto.status !== UserStatus.ACTIVE))
    ) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: {
          roleCode: UserRoleCode.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          id: { not: id },
        },
      });
      if (activeSuperAdmins === 0) {
        throw new AppError(
          ErrorCode.LAST_SUPER_ADMIN,
          'Tidak dapat mengubah Super Admin terakhir',
          403,
        );
      }
    }

    const updated = await this.prisma.user.update({ where: { id }, data: dto });

    if (dto.roleCode !== undefined || dto.status !== undefined) {
      await this.session.revokeAll(id);
    }

    await this.audit.write({
      actorId,
      action: AUDIT_ACTIONS.USER_UPDATED,
      resourceType: 'user',
      resourceId: id,
      beforeJson: { roleCode: before.roleCode, status: before.status, name: before.name },
      afterJson: { roleCode: updated.roleCode, status: updated.status, name: updated.name },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      roleCode: updated.roleCode,
      status: updated.status,
    };
  }

  async delete(id: string, actorId: string, meta: RequestMetaInfo): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User tidak ditemukan', 404);
    if (user.roleCode === UserRoleCode.SUPER_ADMIN) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: {
          roleCode: UserRoleCode.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          id: { not: id },
        },
      });
      if (activeSuperAdmins === 0) {
        throw new AppError(
          ErrorCode.LAST_SUPER_ADMIN,
          'Tidak dapat menghapus Super Admin terakhir',
          403,
        );
      }
    }
    await this.session.revokeAll(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.SUSPENDED },
    });
    await this.audit.write({
      actorId,
      action: AUDIT_ACTIONS.USER_DELETED,
      resourceType: 'user',
      resourceId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async get(id: string): Promise<{
    id: string; email: string; name: string; roleCode: string;
    status: string; avatarMediaId: string | null; lastLoginAt: Date | null;
    createdAt: Date; updatedAt: Date;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true, email: true, name: true, roleCode: true, status: true,
        avatarMediaId: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      },
    });
    return user;
  }

  async list(query: ListUsersDto): Promise<{
    data: Array<{ id: string; email: string; name: string; roleCode: string; status: string }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.UserWhereInput = {
      ...(query.roleCode ? { roleCode: query.roleCode } : {}),
      ...(query.status ? { status: query.status } : {}),
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { email: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, roleCode: true, status: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async revokeSessions(id: string, actorId: string, meta: RequestMetaInfo): Promise<void> {
    await this.session.revokeAll(id);
    await this.audit.write({
      actorId,
      action: AUDIT_ACTIONS.USER_REVOKE_SESSIONS,
      resourceType: 'user',
      resourceId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async resendInvitation(id: string, actorId: string, meta: RequestMetaInfo): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User tidak ditemukan', 404);
    if (user.status !== UserStatus.PENDING_INVITATION) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'User bukan dalam status undangan',
        400,
      );
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.invitationToken.create({
      data: { id: uuidv4(), userId: id, tokenHash, expiresAt },
    });

    await this.audit.write({
      actorId,
      action: 'invitation.resent',
      resourceType: 'invitation',
      resourceId: id,
      afterJson: { email: user.email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.mail.send({
      to: user.email,
      subject: 'Undangan BEM FSM CMS —dikirim ulang',
      text: `Anda diundang sebagai ${user.roleCode} di CMS BEM FSM.\n\nToken undangan (berlaku 7 hari):\n\n${rawToken}\n\nGunakan endpoint POST /api/v1/invitations/accept dengan { token, password } untuk aktivasi.`,
    });
  }
}
