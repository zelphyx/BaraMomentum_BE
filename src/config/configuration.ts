import { plainToInstance, Transform as ClassTransform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum AuthMode {
  COOKIE = 'cookie',
  BEARER = 'bearer',
}

export enum StorageProvider {
  S3 = 's3',
  LOCAL = 'local',
}

export enum NodeEnv {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export class EnvConfig {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsInt()
  @Min(1)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  API_PREFIX!: string;

  @IsString()
  @IsNotEmpty()
  TZ!: string;

  @IsString()
  LOG_LEVEL!: string;

  @ClassTransform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  FRONTEND_ORIGINS!: string[];

  @IsEnum(AuthMode)
  AUTH_MODE!: AuthMode;

  @IsString()
  COOKIE_DOMAIN!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_TTL!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_TTL!: string;

  @IsString()
  @MinLength(32)
  PREVIEW_TOKEN_SECRET!: string;

  @IsEnum(StorageProvider)
  STORAGE_PROVIDER!: StorageProvider;

  @IsString()
  @IsNotEmpty()
  S3_ENDPOINT!: string;

  @IsString()
  @IsNotEmpty()
  S3_REGION!: string;

  @IsString()
  @IsNotEmpty()
  S3_BUCKET!: string;

  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY_ID!: string;

  @IsString()
  @IsNotEmpty()
  S3_SECRET_ACCESS_KEY!: string;

  @IsUrl({ require_tld: false })
  CDN_BASE_URL!: string;

  @ClassTransform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  INLINE_IMAGE_ALLOWED_DOMAINS!: string[];

  @IsString()
  @IsNotEmpty()
  SMTP_HOST!: string;

  @IsInt()
  SMTP_PORT!: number;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASSWORD?: string;

  @IsEmail()
  MAIL_FROM!: string;

  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  @IsOptional()
  NEXT_REVALIDATE_URL?: string;

  @IsString()
  @IsOptional()
  NEXT_REVALIDATE_SECRET?: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  @ClassTransform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  METRICS_ENABLED!: boolean;

  @IsEmail()
  BOOTSTRAP_SUPER_ADMIN_EMAIL!: string;

  @IsString()
  @MinLength(12)
  BOOTSTRAP_SUPER_ADMIN_PASSWORD!: string;

  @IsInt()
  @Min(1024)
  ARGON2_MEMORY_COST!: number;

  @IsInt()
  @Min(1)
  ARGON2_TIME_COST!: number;

  @IsInt()
  @Min(1)
  ARGON2_PARALLELISM!: number;

  @IsInt()
  @Min(1000)
  THROTTLE_TTL_MS!: number;

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT!: number;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`Cannot parse number: ${value}`);
    return n;
  }
  throw new Error(`Cannot convert to number: ${String(value)}`);
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return value === 'true';
}

export function loadEnvConfig(): EnvConfig {
  const raw = {
    ...process.env,
    PORT: toNumber(process.env.PORT ?? 3001),
    SMTP_PORT: toNumber(process.env.SMTP_PORT ?? 1025),
    ARGON2_MEMORY_COST: toNumber(process.env.ARGON2_MEMORY_COST ?? 19456),
    ARGON2_TIME_COST: toNumber(process.env.ARGON2_TIME_COST ?? 2),
    ARGON2_PARALLELISM: toNumber(process.env.ARGON2_PARALLELISM ?? 1),
    METRICS_ENABLED: toBool(process.env.METRICS_ENABLED ?? false),
    THROTTLE_TTL_MS: toNumber(process.env.THROTTLE_TTL_MS ?? 60000),
    THROTTLE_LIMIT: toNumber(process.env.THROTTLE_LIMIT ?? 100),
  };
  const validated = plainToInstance(EnvConfig, raw, { enableImplicitConversion: false });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${messages}`);
  }
  return validated;
}

export function validateEnv(env: Record<string, unknown>): EnvConfig {
  const transformed = {
    ...env,
    PORT: toNumber(env.PORT),
    SMTP_PORT: toNumber(env.SMTP_PORT),
    ARGON2_MEMORY_COST: toNumber(env.ARGON2_MEMORY_COST),
    ARGON2_TIME_COST: toNumber(env.ARGON2_TIME_COST),
    ARGON2_PARALLELISM: toNumber(env.ARGON2_PARALLELISM),
    METRICS_ENABLED: toBool(env.METRICS_ENABLED),
    THROTTLE_TTL_MS: toNumber(env.THROTTLE_TTL_MS),
    THROTTLE_LIMIT: toNumber(env.THROTTLE_LIMIT),
  };
  const validated = plainToInstance(EnvConfig, transformed, { enableImplicitConversion: false });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${messages}`);
  }
  return validated;
}
