import { HealthService } from '../health.service';
import { PrismaService } from '../../../database/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?': 1 }]) };
    service = new HealthService(prisma as unknown as PrismaService);
  });

  describe('live', () => {
    it('returns status ok', () => {
      expect(service.live()).toEqual({ status: 'ok', timestamp: expect.any(String) });
    });
  });

  describe('ready', () => {
    it('returns ok when DB responds', async () => {
      const result = await service.ready();
      expect(result).toEqual({
        status: 'ok',
        checks: { database: { status: 'ok' } },
        timestamp: expect.any(String),
      });
    });

    it('returns error when DB throws', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      const result = await service.ready();
      expect(result).toEqual({
        status: 'error',
        checks: { database: { status: 'error', message: 'connection refused' } },
        timestamp: expect.any(String),
      });
    });
  });
});