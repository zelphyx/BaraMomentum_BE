import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { UserRoleCode, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AppError, ErrorCode } from '../../../common/errors/app-error';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { MailService } from '../../../common/mail/mail.service';
import { RequestMetaInfo } from '../../../common/decorators/request-meta.decorator';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async create(
    email: string,
    roleCode: UserRoleCode,
    name: string,
    actorId: string,
    meta: RequestMetaInfo,
  ): Promise<{ id: string; expiresAt: Date }> {
    const exists = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) throw new AppError(ErrorCode.CONFLICT, 'Email sudah terdaftar', 409);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tempHash = await this.password.hash(crypto.randomBytes(18).toString('base64url'));
    const user = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        email: email.toLowerCase(),
        name,
        passwordHash: tempHash,
        roleCode,
        status: UserStatus.PENDING_INVITATION,
        passwordMustChange: true,
      },
    });
    const inv = await this.prisma.invitationToken.create({
      data: { id: uuidv4(), userId: user.id, tokenHash, expiresAt },
    });

    await this.audit.write({
      actorId,
      action: AUDIT_ACTIONS.INVITATION_CREATED,
      resourceType: 'invitation',
      resourceId: inv.id,
      afterJson: { email, roleCode },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.mail.send({
      to: email,
      subject: 'Undangan BEM FSM CMS',
      text: `Anda diundang sebagai ${roleCode} di CMS BEM FSM.\n\nToken undangan (berlaku 7 hari):\n\n${rawToken}\n\nGunakan endpoint POST /api/v1/invitations/accept dengan { token, password } untuk aktivasi.`,
    });

    return { id: inv.id, expiresAt };
  }

  async accept(
    rawToken: string,
    password: string,
    meta: RequestMetaInfo,
  ): Promise<{ id: string; email: string }> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const inv = await this.prisma.invitationToken.findUnique({ where: { tokenHash } });
    if (!inv || inv.consumedAt || inv.expiresAt < new Date()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Token undangan tidak valid', 400);
    }
    const hash = await this.password.hash(password);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: inv.userId },
        data: {
          passwordHash: hash,
          status: UserStatus.ACTIVE,
          invitationAcceptedAt: new Date(),
          passwordMustChange: false,
        },
      });
      await tx.invitationToken.update({
        where: { id: inv.id },
        data: { consumedAt: new Date() },
      });
      return updated;
    });

    await this.audit.write({
      actorId: user.id,
      action: AUDIT_ACTIONS.INVITATION_ACCEPTED,
      resourceType: 'invitation',
      resourceId: inv.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: user.id, email: user.email };
  }
}
