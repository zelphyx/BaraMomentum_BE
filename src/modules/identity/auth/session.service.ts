import { ForbiddenException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';

const REFRESH_TTL_DAYS = 7;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async create(
    userId: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<{ token: string; sessionId: string }> {
    const token = this.generateToken();
    const tokenHash = this.hash(token);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    const session = await this.prisma.refreshSession.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        tokenHash,
        expiresAt,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ip,
      },
    });
    return { token, sessionId: session.id };
  }

  async rotate(rawToken: string): Promise<{ token: string; sessionId: string; userId: string }> {
    const tokenHash = this.hash(rawToken);
    const existing = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });

    if (!existing) throw new ForbiddenException('Invalid refresh token');
    if (existing.revokedAt) {
      await this.revokeAll(existing.userId);
      throw new ForbiddenException('Refresh token reuse detected');
    }
    if (existing.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('Refresh token expired');
    }

    const newSession = await this.create(existing.userId);
    await this.prisma.refreshSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBySessionId: newSession.sessionId },
    });
    return { ...newSession, userId: existing.userId };
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
