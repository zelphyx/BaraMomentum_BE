import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

const MAX_FAILURES = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000;

@Injectable()
export class LoginThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  async isLocked(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lockedUntil: true },
    });
    if (!user?.lockedUntil) return false;
    return user.lockedUntil.getTime() > Date.now();
  }

  async recordFailure(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginCount: true },
    });
    if (!user) return;
    const count = user.failedLoginCount + 1;
    const shouldLock = count >= MAX_FAILURES;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: shouldLock ? 0 : count,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    });
  }

  async recordSuccess(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }
}