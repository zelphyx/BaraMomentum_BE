import { validateEnv, EnvConfig, AuthMode, StorageProvider, NodeEnv } from '../configuration';

describe('validateEnv', () => {
  const validEnv: EnvConfig = {
    NODE_ENV: NodeEnv.DEVELOPMENT,
    PORT: 3001,
    API_PREFIX: 'api/v1',
    TZ: 'Asia/Jakarta',
    LOG_LEVEL: 'info',
    FRONTEND_ORIGINS: ['http://localhost:3000'],
    AUTH_MODE: AuthMode.COOKIE,
    COOKIE_DOMAIN: 'localhost',
    DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_REFRESH_TTL: '7d',
    PREVIEW_TOKEN_SECRET: 'c'.repeat(32),
    STORAGE_PROVIDER: StorageProvider.S3,
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'bemfsm-media',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    CDN_BASE_URL: 'http://localhost:9000/bemfsm-media',
    INLINE_IMAGE_ALLOWED_DOMAINS: ['localhost'],
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    MAIL_FROM: 'noreply@bemfsm.id',
    REDIS_URL: '',
    NEXT_REVALIDATE_URL: '',
    NEXT_REVALIDATE_SECRET: '',
    SENTRY_DSN: '',
    METRICS_ENABLED: false,
    BOOTSTRAP_SUPER_ADMIN_EMAIL: 'admin@bemfsm.id',
    BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'ChangeMe123!ChangeMe',
    ARGON2_MEMORY_COST: 19456,
    ARGON2_TIME_COST: 2,
    ARGON2_PARALLELISM: 1,
  };

  it('accepts a complete valid env', () => {
    expect(() => validateEnv(validEnv as unknown as Record<string, unknown>)).not.toThrow();
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() =>
      validateEnv({ ...validEnv, DATABASE_URL: '' } as unknown as Record<string, unknown>),
    ).toThrow();
  });

  it('rejects short JWT_ACCESS_SECRET', () => {
    expect(() =>
      validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' } as unknown as Record<string, unknown>),
    ).toThrow();
  });

  it('rejects invalid AUTH_MODE', () => {
    expect(() =>
      validateEnv({ ...validEnv, AUTH_MODE: 'basic' } as unknown as Record<string, unknown>),
    ).toThrow();
  });

  it('parses FRONTEND_ORIGINS comma-separated string', () => {
    const result = validateEnv({
      ...validEnv,
      FRONTEND_ORIGINS: 'http://a.com,http://b.com',
    } as unknown as Record<string, unknown>);
    expect(result.FRONTEND_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
  });
});