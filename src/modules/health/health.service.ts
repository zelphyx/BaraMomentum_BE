import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface HealthCheckResult {
  status: 'ok';
  timestamp: string;
}

export interface HealthReadyResult {
  status: 'ok' | 'error';
  checks: {
    database: { status: 'ok' | 'error'; message?: string };
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  live(): HealthCheckResult {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  async ready(): Promise<HealthReadyResult> {
    const timestamp = new Date().toISOString();
    let dbCheck: { status: 'ok' | 'error'; message?: string } = { status: 'ok' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      dbCheck = {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
    }
    return {
      status: dbCheck.status === 'ok' ? 'ok' : 'error',
      checks: { database: dbCheck },
      timestamp,
    };
  }
}