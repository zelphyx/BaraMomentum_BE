import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: unknown;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: uuidv4(),
        actorId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        beforeJson: (entry.beforeJson ?? null) as Prisma.InputJsonValue,
        afterJson: (entry.afterJson ?? null) as Prisma.InputJsonValue,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        requestId: entry.requestId ?? null,
        metadata: (entry.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  }
}
