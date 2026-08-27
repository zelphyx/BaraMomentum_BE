import { PrismaService } from '../prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService({
      datasources: {
        db: { url: 'mysql://test:test@localhost:3306/test' },
      },
    });
  });

  afterEach(async () => {
    await service.$disconnect();
  });

  it('extends PrismaClient', () => {
    expect(service).toBeDefined();
    expect(typeof service.$connect).toBe('function');
  });

  it('exposes onModuleInit lifecycle hook', () => {
    expect(typeof service.onModuleInit).toBe('function');
  });

  it('exposes onModuleDestroy lifecycle hook', () => {
    expect(typeof service.onModuleDestroy).toBe('function');
  });
});
