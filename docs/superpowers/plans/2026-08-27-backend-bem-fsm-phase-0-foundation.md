# Backend BEM FSM UNDIP 2026 — Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun pondasi NestJS backend dengan Prisma, MySQL, Docker Compose, global pipes/filters, health check, logger, dan Swagger — siap untuk development Phase 1 (Identity) tanpa modifikasi pondasi.

**Architecture:** Modular monolith NestJS dengan Prisma ORM ke MySQL 8. Setiap domain berdiri sendiri (auth, users, organization-units, articles, dll) dengan controller/service/DTO/repository/policy pattern. Cross-cutting concerns (filter, interceptor, pipe, logger, error handling) di-extract ke `src/common/`. Database migrations via Prisma Migrate, storage adapter pattern untuk S3-compatible (MinIO dev), Argon2id untuk password, JWT untuk session.

**Tech Stack:** Node.js 22 LTS, NestJS 10.x, TypeScript 5.x strict, Prisma 5.x, MySQL 8.0+, Pino logger, class-validator, class-transformer, sanitize-html, argon2, jsonwebtoken, passport-jwt, @nestjs/swagger, helmet, @nestjs/throttler, jest, supertest, docker-compose.

**Note:** Ini Phase 0 (Foundation). Phase 1 (Identity), 2 (Media), 3 (Organization CMS), 4 (Article CMS), 5 (Instagram & Dashboard), 6 (Hardening) akan dibuat plan terpisah saat phase tersebut akan dieksekusi.

---

## Global Constraints

- **Node.js**: 22 LTS minimum
- **TypeScript**: 5.x, `strict: true`, `noUncheckedIndexedAccess: true`
- **NestJS**: 10.x stable
- **MySQL**: 8.0+ dengan charset `utf8mb4`, collation `utf8mb4_0900_ai_ci`
- **Prisma**: 5.x, format `CHAR(36)` untuk UUID via `@db.Char(36)`
- **Module structure**: `controller, service, dto/, repository.ts, policy.ts, module.ts` per domain
- **Naming convention**:
  - DB columns: snake_case (Prisma `@map`)
  - Prisma fields: camelCase
  - TypeScript classes: PascalCase
  - File names: kebab-case (`http-exception.filter.ts`)
- **API prefix**: `/api/v1`
- **JSON response shape**: `{ data: T, meta: { requestId, ...pagination } }` atau `{ error: { code, message, fields?, requestId } }`
- **Timezone**: container `TZ=Asia/Jakarta`, DB simpan UTC, response format ISO 8601 UTC
- **Testing**: Jest + Supertest, target 80% line coverage untuk services
- **Commit style**: Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`)

---

## File Structure (Phase 0 deliverable)

```
bemfsmundip2026_be/
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── .dockerignore
├── README.md
├── Dockerfile
├── docker-compose.yml
├── docker-compose.test.yml
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/                   # auto-generated
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── configuration.ts
│   ├── common/
│   │   ├── common.module.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── interceptors/
│   │   │   ├── request-id.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── errors/
│   │   │   └── app-error.ts
│   │   └── logger/
│   │       ├── pino.config.ts
│   │       └── logger.module.ts
│   ├── database/
│   │   ├── prisma.service.ts
│   │   ├── prisma.module.ts
│   │   └── __tests__/
│   │       └── prisma.service.spec.ts
│   ├── modules/
│   │   └── health/
│   │       ├── health.module.ts
│   │       ├── health.controller.ts
│   │       ├── health.service.ts
│   │       └── __tests__/
│   │           └── health.service.spec.ts
│   └── jobs/                          # placeholder kosong
├── test/
│   ├── jest-e2e.json
│   └── health.e2e-spec.ts
└── docs/
    ├── superpowers/
    │   ├── specs/2026-08-27-backend-bem-fsm-design.md   # approved spec
    │   └── plans/2026-08-27-backend-bem-fsm-phase-0.md  # this file
    └── runbooks/
        └── (kosong untuk Phase 6)
```

---

## Tasks

### Task 1: Initialize package.json dengan semua dependencies

**Files:**
- Create: `bemfsmundip2026_be/package.json`

- [ ] **Step 1: Buat file package.json**

```json
{
  "name": "bem-fsm-undip-2026-backend",
  "version": "0.1.0",
  "description": "Backend CMS untuk BEM FSM UNDIP 2026 — Kabinet Bara Momentum",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "prisma:seed": "ts-node --transpile-only prisma/seed.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.658.1",
    "@aws-sdk/s3-request-presigner": "^3.658.1",
    "@nestjs/common": "^10.4.4",
    "@nestjs/config": "^3.2.3",
    "@nestjs/core": "^10.4.4",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.4",
    "@nestjs/schedule": "^4.1.1",
    "@nestjs/swagger": "^7.4.2",
    "@nestjs/throttler": "^6.2.1",
    "@nestjs/terminus": "^10.2.3",
    "@prisma/client": "^5.20.0",
    "argon2": "^0.41.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "cookie-parser": "^1.4.7",
    "file-type": "^19.5.0",
    "helmet": "^7.1.0",
    "nestjs-pino": "^4.1.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pino-http": "^10.3.0",
    "pino-pretty": "^11.2.2",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "sanitize-html": "^2.13.0",
    "sharp": "^0.33.5",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@nestjs/schematics": "^10.1.4",
    "@nestjs/testing": "^10.4.4",
    "@types/cookie-parser": "^1.4.7",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.13",
    "@types/node": "^22.7.4",
    "@types/passport-jwt": "^4.0.1",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "@typescript-eslint/eslint-plugin": "^8.7.0",
    "@typescript-eslint/parser": "^8.7.0",
    "eslint": "^8.57.1",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.2.1",
    "jest": "^29.7.0",
    "prettier": "^3.3.3",
    "prisma": "^5.20.0",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.6.2"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
npm install
```

Expected: `node_modules/` terbuat, tidak ada error fatal. Sharp mungkin perlu build tools — jika gagal, install di sistem atau skip sementara (tidak blocking Phase 0 karena Sharp dipakai Phase 2).

- [ ] **Step 3: Commit (jika git sudah init) atau skip**

---

### Task 2: TypeScript configuration

**Files:**
- Create: `bemfsmundip2026_be/tsconfig.json`
- Create: `bemfsmundip2026_be/tsconfig.build.json`

- [ ] **Step 1: Buat `tsconfig.json` (base untuk editor + jest)**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["src/*"],
      "@common/*": ["src/common/*"],
      "@config/*": ["src/config/*"],
      "@database/*": ["src/database/*"],
      "@modules/*": ["src/modules/*"],
      "@jobs/*": ["src/jobs/*"]
    }
  },
  "include": ["src/**/*", "test/**/*", "prisma/seed.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Buat `tsconfig.build.json` (untuk nest build)**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

- [ ] **Step 3: Commit**

---

### Task 3: NestJS CLI configuration

**Files:**
- Create: `bemfsmundip2026_be/nest-cli.json`

- [ ] **Step 1: Buat `nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": ["@nestjs/swagger"]
  }
}
```

- [ ] **Step 2: Commit**

---

### Task 4: ESLint + Prettier configuration

**Files:**
- Create: `bemfsmundip2026_be/.eslintrc.cjs`
- Create: `bemfsmundip2026_be/.eslintignore`
- Create: `bemfsmundip2026_be/.prettierrc`
- Create: `bemfsmundip2026_be/.prettierignore`

- [ ] **Step 1: Buat `.eslintrc.cjs`**

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.cjs', 'dist', 'node_modules', 'coverage'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

- [ ] **Step 2: Buat `.eslintignore`**

```
dist
node_modules
coverage
*.js
```

- [ ] **Step 3: Buat `.prettierrc`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 4: Buat `.prettierignore`**

```
dist
node_modules
coverage
package-lock.json
prisma/migrations
```

- [ ] **Step 5: Verify ESLint**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
npm run lint
```

Expected: exit 0, "0 problems".

- [ ] **Step 6: Commit**

---

### Task 5: .gitignore

**Files:**
- Create: `bemfsmundip2026_be/.gitignore`

- [ ] **Step 1: Buat `.gitignore`**

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
build/
*.tsbuildinfo

# Coverage
coverage/
*.lcov
.nyc_output

# Environment
.env
.env.local
.env.*.local
!.env.example

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pino.log

# IDE
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Prisma
prisma/dev.db
prisma/dev.db-journal

# Uploads (local dev)
uploads/

# Testing
.jest-cache/
```

- [ ] **Step 2: Commit**

---

### Task 6: Docker Compose untuk local development

**Files:**
- Create: `bemfsmundip2026_be/docker-compose.yml`
- Create: `bemfsmundip2026_be/docker-compose.test.yml`

- [ ] **Step 1: Buat `docker-compose.yml`**

```yaml
version: '3.9'

services:
  mysql:
    image: mysql:8.0
    container_name: bemfsm-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: bemfsm
      MYSQL_USER: bemfsm
      MYSQL_PASSWORD: bemfsm
      TZ: Asia/Jakarta
    command: >
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_0900_ai_ci
      --default-time-zone=+07:00
    ports:
      - '3306:3306'
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost', '-uroot', '-proot']
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: bemfsm-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    ports:
      - '9000:9000'
      - '9001:9001'
    volumes:
      - minio_data:/data
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 30s
      timeout: 10s
      retries: 3

  mailpit:
    image: axllent/mailpit:latest
    container_name: bemfsm-mailpit
    restart: unless-stopped
    ports:
      - '1025:1025'
      - '8025:8025'
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1

  redis:
    image: redis:7-alpine
    container_name: bemfsm-redis
    restart: unless-stopped
    profiles: ['with-queue']
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  mysql_data:
  minio_data:
  redis_data:
```

- [ ] **Step 2: Buat `docker-compose.test.yml` (untuk integration test)**

```yaml
version: '3.9'

services:
  mysql-test:
    image: mysql:8.0
    container_name: bemfsm-mysql-test
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: bemfsm_test
      MYSQL_USER: bemfsm
      MYSQL_PASSWORD: bemfsm
      TZ: Asia/Jakarta
    command: >
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_0900_ai_ci
    ports:
      - '3307:3306'
    tmpfs:
      - /var/lib/mysql
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost', '-uroot', '-proot']
      interval: 5s
      timeout: 3s
      retries: 10
```

- [ ] **Step 3: Verify docker compose config valid**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
docker compose config --quiet
```

Expected: exit 0, no output.

- [ ] **Step 4: Commit**

---

### Task 7: Dockerfile untuk backend

**Files:**
- Create: `bemfsmundip2026_be/Dockerfile`
- Create: `bemfsmundip2026_be/.dockerignore`

- [ ] **Step 1: Buat `Dockerfile` (multi-stage build)**

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install OpenSSL untuk Prisma + build tools untuk Sharp
RUN apk add --no-cache openssl python3 make g++ libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build && npm prune --omit=dev

# Stage 2: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl tini tzdata && \
    cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime && \
    echo "Asia/Jakarta" > /etc/timezone

ENV NODE_ENV=production
ENV TZ=Asia/Jakarta
ENV PORT=3001

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

EXPOSE 3001

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
```

- [ ] **Step 2: Buat `.dockerignore`**

```
node_modules
dist
coverage
.env
.env.local
.git
.gitignore
.vscode
.idea
*.log
README.md
docs
test
```

- [ ] **Step 3: Commit**

---

### Task 8: Environment example

**Files:**
- Create: `bemfsmundip2026_be/.env.example`

- [ ] **Step 1: Buat `.env.example` (no secrets)**

```env
# Application
NODE_ENV=development
PORT=3001
API_PREFIX=api/v1
TZ=Asia/Jakarta
LOG_LEVEL=info

# CORS & Auth
FRONTEND_ORIGINS=http://localhost:3000
AUTH_MODE=cookie
COOKIE_DOMAIN=localhost

# Database
DATABASE_URL=mysql://bemfsm:bemfsm@localhost:3306/bemfsm

# JWT
JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-chars
JWT_REFRESH_TTL=7d
PREVIEW_TOKEN_SECRET=change-me-preview-secret-min-32-chars

# Storage
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=bemfsm-media
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
CDN_BASE_URL=http://localhost:9000/bemfsm-media
INLINE_IMAGE_ALLOWED_DOMAINS=localhost,cdn.example.com

# SMTP
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=noreply@bemfsm.id

# Redis (opsional)
REDIS_URL=

# Next.js revalidation
NEXT_REVALIDATE_URL=
NEXT_REVALIDATE_SECRET=

# Observability
SENTRY_DSN=
METRICS_ENABLED=false

# Bootstrap
BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@bemfsm.id
BOOTSTRAP_SUPER_ADMIN_PASSWORD=ChangeMe123!ChangeMe

# Argon2 tuning (opsional)
ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
```

- [ ] **Step 2: Commit**

---

### Task 9: Config module dengan env validation

**Files:**
- Create: `bemfsmundip2026_be/src/config/configuration.ts`
- Create: `bemfsmundip2026_be/src/config/config.module.ts`
- Create: `bemfsmundip2026_be/src/config/__tests__/configuration.spec.ts`

- [ ] **Step 1: Tulis failing test untuk env validation**

Create: `src/config/__tests__/configuration.spec.ts`

```ts
import { validateEnv, EnvConfig } from '../configuration';

describe('validateEnv', () => {
  const validEnv: EnvConfig = {
    NODE_ENV: 'development',
    PORT: 3001,
    API_PREFIX: 'api/v1',
    TZ: 'Asia/Jakarta',
    LOG_LEVEL: 'info',
    FRONTEND_ORIGINS: ['http://localhost:3000'],
    AUTH_MODE: 'cookie',
    COOKIE_DOMAIN: 'localhost',
    DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_REFRESH_TTL: '7d',
    PREVIEW_TOKEN_SECRET: 'c'.repeat(32),
    STORAGE_PROVIDER: 's3',
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
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => validateEnv({ ...validEnv, DATABASE_URL: '' })).toThrow();
  });

  it('rejects short JWT_ACCESS_SECRET', () => {
    expect(() => validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });

  it('rejects invalid AUTH_MODE', () => {
    expect(() => validateEnv({ ...validEnv, AUTH_MODE: 'basic' as any })).toThrow();
  });

  it('parses FRONTEND_ORIGINS comma-separated string', () => {
    const result = validateEnv({ ...validEnv, FRONTEND_ORIGINS: 'http://a.com,http://b.com' as any });
    expect(result.FRONTEND_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
  });
});
```

- [ ] **Step 2: Run test untuk verify fail**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
npm test -- --testPathPattern=configuration
```

Expected: FAIL — "Cannot find module '../configuration'".

- [ ] **Step 3: Implement configuration.ts**

Create: `src/config/configuration.ts`

```ts
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
    typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value,
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
    typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value,
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
```

- [ ] **Step 4: Run test untuk verify pass**

```bash
npm test -- --testPathPattern=configuration
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Buat config.module.ts**

Create: `src/config/config.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { loadEnvConfig } from './configuration';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: () => loadEnvConfig(),
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}
```

- [ ] **Step 6: Commit**

---

### Task 10: Prisma schema — Identity tables (Phase 0)

**Files:**
- Create: `bemfsmundip2026_be/prisma/schema.prisma`

Phase 0 hanya butuh Identity tables untuk support Phase 1 (auth + users). Tabel lain (units, articles, instagram, media, audit) dibuat di phase masing-masing.

- [ ] **Step 1: Buat `schema.prisma`**

```prisma
// Backend CMS BEM FSM UNDIP 2026
// Phase 0: Identity tables saja. Phase 1-5 tambahkan tabel di migration terpisah.

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ============================================================
// IDENTITY
// ============================================================

enum UserStatus {
  INVITED
  ACTIVE
  INACTIVE
}

enum UserRoleCode {
  SUPER_ADMIN
  CONTENT_EDITOR
  UNIT_ADMIN
}

model User {
  id                       String       @id @db.Char(36)
  name                     String       @db.VarChar(120)
  email                    String       @unique @db.VarChar(191)
  passwordHash             String?      @map("password_hash") @db.VarChar(255)
  avatarMediaId            String?      @map("avatar_media_id") @db.Char(36)
  roleCode                 UserRoleCode @map("role_code")
  status                   UserStatus   @default(INVITED)
  lastLoginAt              DateTime?    @map("last_login_at") @db.DateTime(3)
  invitedAt                DateTime?    @map("invited_at") @db.DateTime(3)
  invitationAcceptedAt     DateTime?    @map("invitation_accepted_at") @db.DateTime(3)
  passwordMustChange       Boolean      @default(false) @map("password_must_change")
  createdById              String?      @map("created_by_id") @db.Char(36)
  updatedById              String?      @map("updated_by_id") @db.Char(36)
  createdAt                DateTime     @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt                DateTime     @updatedAt @map("updated_at") @db.DateTime(3)
  deletedAt                DateTime?    @map("deleted_at") @db.DateTime(3)

  createdBy User?  @relation("UserCreatedBy", fields: [createdById], references: [id])
  updatedBy User?  @relation("UserUpdatedBy", fields: [updatedById], references: [id])
  created   User[] @relation("UserCreatedBy")
  updated   User[] @relation("UserUpdatedBy")

  refreshSessions     RefreshSession[]
  passwordResetTokens PasswordResetToken[]
  invitationTokens    InvitationToken[]

  @@index([roleCode, status, deletedAt])
  @@index([deletedAt])
  @@map("users")
}

model RefreshSession {
  id                    String    @id @db.Char(36)
  userId                String    @map("user_id") @db.Char(36)
  tokenHash             String    @unique @map("token_hash") @db.VarChar(255)
  userAgent             String?   @map("user_agent") @db.VarChar(500)
  ipAddress             String?   @map("ip_address") @db.VarChar(64)
  expiresAt             DateTime  @map("expires_at") @db.DateTime(3)
  lastUsedAt            DateTime? @map("last_used_at") @db.DateTime(3)
  revokedAt             DateTime? @map("revoked_at") @db.DateTime(3)
  replacedBySessionId   String?   @map("replaced_by_session_id") @db.Char(36)
  createdAt             DateTime  @default(now()) @map("created_at") @db.DateTime(3)

  user                User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  replacedBySession   RefreshSession?  @relation("RefreshSessionChain", fields: [replacedBySessionId], references: [id])
  replacedSessions    RefreshSession[] @relation("RefreshSessionChain")

  @@index([userId, revokedAt])
  @@index([expiresAt])
  @@map("refresh_sessions")
}

model PasswordResetToken {
  id          String    @id @db.Char(36)
  userId      String    @map("user_id") @db.Char(36)
  tokenHash   String    @unique @map("token_hash") @db.VarChar(255)
  expiresAt   DateTime  @map("expires_at") @db.DateTime(3)
  consumedAt  DateTime? @map("consumed_at") @db.DateTime(3)
  createdAt   DateTime  @default(now()) @map("created_at") @db.DateTime(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}

model InvitationToken {
  id          String    @id @db.Char(36)
  userId      String    @map("user_id") @db.Char(36)
  tokenHash   String    @unique @map("token_hash") @db.VarChar(255)
  expiresAt   DateTime  @map("expires_at") @db.DateTime(3)
  consumedAt  DateTime? @map("consumed_at") @db.DateTime(3)
  createdAt   DateTime  @default(now()) @map("created_at") @db.DateTime(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("invitation_tokens")
}
```

- [ ] **Step 2: Generate initial migration**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
docker compose up -d mysql
sleep 10
cp .env.example .env
npx prisma migrate dev --name init_identity
```

Expected: Migration dibuat di `prisma/migrations/<timestamp>_init_identity/`, Prisma client ter-generate.

- [ ] **Step 3: Verify schema applied**

```bash
docker container inspect bemfsm-mysql >/dev/null 2>&1 && \
  docker container run --rm --network host mysql:8.0 mysql -h127.0.0.1 -P3306 -ubemfsm -pbemfsm bemfsm -e "SHOW TABLES;" 2>/dev/null || \
  echo "(skip DB verify jika container tidak tersedia, akan di-verify saat e2e test)"
```

- [ ] **Step 4: Commit**

---

### Task 11: PrismaService + PrismaModule

**Files:**
- Create: `bemfsmundip2026_be/src/database/prisma.service.ts`
- Create: `bemfsmundip2026_be/src/database/prisma.module.ts`
- Create: `bemfsmundip2026_be/src/database/__tests__/prisma.service.spec.ts`

- [ ] **Step 1: Tulis failing test untuk PrismaService**

Create: `src/database/__tests__/prisma.service.spec.ts`

```ts
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
```

- [ ] **Step 2: Run test untuk verify fail**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
npm test -- --testPathPattern=prisma.service
```

Expected: FAIL — "Cannot find module '../prisma.service'".

- [ ] **Step 3: Implement PrismaService**

Create: `src/database/prisma.service.ts`

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Run test untuk verify pass**

```bash
npm test -- --testPathPattern=prisma.service
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Buat PrismaModule**

Create: `src/database/prisma.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 6: Commit**

---

### Task 12: Common module — AppError

**Files:**
- Create: `bemfsmundip2026_be/src/common/errors/app-error.ts`
- Create: `bemfsmundip2026_be/src/common/errors/__tests__/app-error.spec.ts`

- [ ] **Step 1: Tulis failing test**

Create: `src/common/errors/__tests__/app-error.spec.ts`

```ts
import { AppError, ErrorCode } from '../app-error';

describe('AppError', () => {
  it('extends Error', () => {
    const err = new AppError('VALIDATION_ERROR', 'Invalid input');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Invalid input');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(400);
    expect(err.fields).toBeUndefined();
  });

  it('accepts custom status code', () => {
    const err = new AppError('NOT_FOUND', 'Resource missing', 404);
    expect(err.status).toBe(404);
  });

  it('accepts field errors', () => {
    const err = new AppError('VALIDATION_ERROR', 'Invalid', 400, {
      title: ['title is required'],
    });
    expect(err.fields).toEqual({ title: ['title is required'] });
  });

  it('includes stack trace', () => {
    const err = new AppError('INTERNAL_ERROR', 'oops', 500);
    expect(err.stack).toBeDefined();
  });

  it('exports common error codes', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.UNAUTHENTICATED).toBe('UNAUTHENTICATED');
    expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCode.CONFLICT).toBe('CONFLICT');
    expect(ErrorCode.VERSION_CONFLICT).toBe('VERSION_CONFLICT');
    expect(ErrorCode.PAYLOAD_TOO_LARGE).toBe('PAYLOAD_TOO_LARGE');
    expect(ErrorCode.UNPROCESSABLE_ENTITY).toBe('UNPROCESSABLE_ENTITY');
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCode.HIGHLIGHT_LIMIT_EXCEEDED).toBe('HIGHLIGHT_LIMIT_EXCEEDED');
    expect(ErrorCode.MEDIA_IN_USE).toBe('MEDIA_IN_USE');
    expect(ErrorCode.LAST_SUPER_ADMIN).toBe('LAST_SUPER_ADMIN');
    expect(ErrorCode.IF_MATCH_REQUIRED).toBe('IF_MATCH_REQUIRED');
  });
});
```

- [ ] **Step 2: Run test untuk verify fail**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
npm test -- --testPathPattern=app-error
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement AppError**

Create: `src/common/errors/app-error.ts`

```ts
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  HIGHLIGHT_LIMIT_EXCEEDED: 'HIGHLIGHT_LIMIT_EXCEEDED',
  MEDIA_IN_USE: 'MEDIA_IN_USE',
  LAST_SUPER_ADMIN: 'LAST_SUPER_ADMIN',
  IF_MATCH_REQUIRED: 'IF_MATCH_REQUIRED',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly status: number;
  public readonly fields?: Record<string, string[]>;

  constructor(code: ErrorCodeType, message: string, status: number = 400, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    Object.setPrototypeOf(this, AppError.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
```

- [ ] **Step 4: Run test untuk verify pass**

```bash
npm test -- --testPathPattern=app-error
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

---

### Task 13: Common module — HttpExceptionFilter

**Files:**
- Create: `bemfsmundip2026_be/src/common/filters/http-exception.filter.ts`
- Create: `bemfsmundip2026_be/src/common/filters/__tests__/http-exception.filter.spec.ts`

- [ ] **Step 1: Tulis failing test**

Create: `src/common/filters/__tests__/http-exception.filter.spec.ts`

```ts
import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { AppError } from '../../errors/app-error';
import { HttpExceptionFilter } from '../http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = { requestId: 'req-123' };
    mockHost = {
      switchToHttp: () => ({ getResponse: () => mockResponse, getRequest: () => mockRequest }),
    } as any;
    process.env.NODE_ENV = 'test';
  });

  it('formats AppError with its code and status', () => {
    const err = new AppError('NOT_FOUND', 'Resource gone', 404);
    filter.catch(err, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource gone',
        requestId: 'req-123',
      },
    });
  });

  it('formats NestJS BadRequestException as VALIDATION_ERROR', () => {
    const err = new BadRequestException('bad');
    filter.catch(err, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'bad',
        requestId: 'req-123',
      },
    });
  });

  it('formats NestJS NotFoundException as NOT_FOUND', () => {
    const err = new NotFoundException('missing');
    filter.catch(err, mockHost);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'NOT_FOUND' }) }),
    );
  });

  it('hides stack trace in production', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('boom');
    filter.catch(err, mockHost);
    const call = mockResponse.json.mock.calls[0][0];
    expect(call.error.stack).toBeUndefined();
    expect(call.error.message).toBe('Internal server error');
    expect(call.error.code).toBe('INTERNAL_ERROR');
  });

  it('includes stack trace in development', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('boom');
    filter.catch(err, mockHost);
    const call = mockResponse.json.mock.calls[0][0];
    expect(call.error.stack).toBeDefined();
    expect(call.error.message).toBe('boom');
  });
});
```

- [ ] **Step 2: Run test untuk verify fail**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
npm test -- --testPathPattern=http-exception.filter
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement HttpExceptionFilter**

Create: `src/common/filters/http-exception.filter.ts`

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError, ErrorCode } from '../errors/app-error';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? null;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let fields: Record<string, string[]> | undefined;

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      fields = exception.fields;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? exception.message;
        if (Array.isArray(b.message)) {
          message = 'Validation failed';
          fields = this.extractValidationFields(b.message as string[]);
        }
      }
      code = this.mapHttpStatusToCode(status);
    } else if (exception instanceof Error) {
      message = process.env.NODE_ENV === 'production' ? 'Internal server error' : exception.message;
      this.logger.error(exception.stack ?? exception.message);
    } else {
      this.logger.error('Unknown exception', String(exception));
    }

    const errorBody: Record<string, unknown> = { code, message, requestId };
    if (fields) errorBody.fields = fields;
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      errorBody.stack = exception.stack;
    }

    response.status(status).json({ error: errorBody });
  }

  private mapHttpStatusToCode(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.VALIDATION_ERROR;
      case 401:
        return ErrorCode.UNAUTHENTICATED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 413:
        return ErrorCode.PAYLOAD_TOO_LARGE;
      case 422:
        return ErrorCode.UNPROCESSABLE_ENTITY;
      case 429:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }

  private extractValidationFields(messages: string[]): Record<string, string[]> {
    const fields: Record<string, string[]> = {};
    for (const msg of messages) {
      const match = /^([a-zA-Z0-9_]+)\s/.exec(msg);
      if (match) {
        const field = match[1];
        if (!fields[field]) fields[field] = [];
        fields[field].push(msg);
      } else {
        if (!fields._general) fields._general = [];
        fields._general.push(msg);
      }
    }
    return fields;
  }
}
```

- [ ] **Step 4: Run test untuk verify pass**

```bash
npm test -- --testPathPattern=http-exception.filter
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

---

### Task 14: Common module — RequestId + Transform interceptors

**Files:**
- Create: `bemfsmundip2026_be/src/common/interceptors/request-id.interceptor.ts`
- Create: `bemfsmundip2026_be/src/common/interceptors/transform.interceptor.ts`
- Create: `bemfsmundip2026_be/src/common/interceptors/__tests__/interceptors.spec.ts`

- [ ] **Step 1: Tulis failing test**

Create: `src/common/interceptors/__tests__/interceptors.spec.ts`

```ts
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { RequestIdInterceptor } from '../request-id.interceptor';
import { TransformInterceptor } from '../transform.interceptor';

describe('RequestIdInterceptor', () => {
  let interceptor: RequestIdInterceptor;

  beforeEach(() => {
    interceptor = new RequestIdInterceptor();
  });

  it('attaches a generated requestId to request if missing', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = { handle: () => of(null) };

    await lastValueFrom(interceptor.intercept(mockContext, handler));

    const req = mockContext.switchToHttp().getRequest() as any;
    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reuses incoming X-Request-Id header', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-request-id': 'incoming-id' } }),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = { handle: () => of(null) };

    await lastValueFrom(interceptor.intercept(mockContext, handler));

    const req = mockContext.switchToHttp().getRequest() as any;
    expect(req.requestId).toBe('incoming-id');
  });
});

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('wraps data into { data, meta: { requestId } }', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'r1' }),
      }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = { handle: () => of({ foo: 'bar' }) };

    const result = await lastValueFrom(interceptor.intercept(mockContext, handler));
    expect(result).toEqual({ data: { foo: 'bar' }, meta: { requestId: 'r1' } });
  });

  it('merges pagination meta if provided', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'r1' }),
      }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = {
      handle: () => of({ items: [], page: 1, limit: 10, totalItems: 0, totalPages: 0 }),
    };

    const result = await lastValueFrom(interceptor.intercept(mockContext, handler));
    expect(result).toEqual({
      data: { items: [] },
      meta: { requestId: 'r1', page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
  });
});
```

- [ ] **Step 2: Run test untuk verify fail**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
npm test -- --testPathPattern=interceptors
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement RequestIdInterceptor**

Create: `src/common/interceptors/request-id.interceptor.ts`

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { requestId?: string }>();
    const res = http.getResponse<Response>();

    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : uuidv4();
    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    return next.handle();
  }
}
```

- [ ] **Step 4: Implement TransformInterceptor**

Create: `src/common/interceptors/transform.interceptor.ts`

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface PaginationMeta {
  page?: number;
  limit?: number;
  totalItems?: number;
  totalPages?: number;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<{ data: unknown; meta: Record<string, unknown> }> {
    const req = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId ?? null;

    return next.handle().pipe(
      map((value: unknown) => {
        if (value === null || value === undefined) {
          return { data: null, meta: { requestId } };
        }

        if (
          typeof value === 'object' &&
          value !== null &&
          'items' in value &&
          Array.isArray((value as { items: unknown[] }).items)
        ) {
          const v = value as { items: unknown[] } & PaginationMeta;
          const { items, ...rest } = v;
          return { data: { items }, meta: { requestId, ...rest } };
        }

        return { data: value, meta: { requestId } };
      }),
    );
  }
}
```

- [ ] **Step 5: Run test untuk verify pass**

```bash
npm test -- --testPathPattern=interceptors
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

---

### Task 15: Common module — wiring (CommonModule)

**Files:**
- Create: `bemfsmundip2026_be/src/common/common.module.ts`

- [ ] **Step 1: Buat CommonModule**

```ts
import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { RequestIdInterceptor } from './interceptors/request-id.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';

@Global()
@Module({
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class CommonModule {}
```

- [ ] **Step 2: Commit**

---

### Task 16: Logger module — Pino configuration

**Files:**
- Create: `bemfsmundip2026_be/src/common/logger/pino.config.ts`
- Create: `bemfsmundip2026_be/src/common/logger/logger.module.ts`

- [ ] **Step 1: Buat pino.config.ts**

Create: `src/common/logger/pino.config.ts`

```ts
import { Params } from 'nestjs-pino';

export const pinoConfig = (): Params => ({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'res.headers["set-cookie"]',
        'req.body.password',
        'req.body.passwordHash',
        'req.body.token',
        'req.body.refreshToken',
        'req.body.secret',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.tokenHash',
        '*.refreshToken',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customProps: (req) => ({
      requestId: (req as { requestId?: string }).requestId,
    }),
  },
});
```

- [ ] **Step 2: Buat LoggerModule**

Create: `src/common/logger/logger.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { pinoConfig } from './pino.config';

@Global()
@Module({
  imports: [PinoLoggerModule.forRoot(pinoConfig())],
  exports: [PinoLoggerModule],
})
export class AppLoggerModule {}
```

- [ ] **Step 3: Commit**

---

### Task 17: Health module

**Files:**
- Create: `bemfsmundip2026_be/src/modules/health/health.controller.ts`
- Create: `bemfsmundip2026_be/src/modules/health/health.service.ts`
- Create: `bemfsmundip2026_be/src/modules/health/health.module.ts`
- Create: `bemfsmundip2026_be/src/modules/health/__tests__/health.service.spec.ts`

- [ ] **Step 1: Tulis failing test untuk HealthService**

Create: `src/modules/health/__tests__/health.service.spec.ts`

```ts
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
```

- [ ] **Step 2: Run test untuk verify fail**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
npm test -- --testPathPattern=health.service
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement HealthService**

Create: `src/modules/health/health.service.ts`

```ts
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
```

- [ ] **Step 4: Implement HealthController**

Create: `src/modules/health/health.controller.ts`

```ts
import { Controller, Get, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { HealthCheckResult, HealthReadyResult, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): HealthCheckResult {
    return this.healthService.live();
  }

  @Get('ready')
  async ready(): Promise<HealthReadyResult> {
    const result = await this.healthService.ready();
    if (result.status === 'error') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
```

- [ ] **Step 5: Implement HealthModule**

Create: `src/modules/health/health.module.ts`

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

- [ ] **Step 6: Run test untuk verify pass**

```bash
npm test -- --testPathPattern=health.service
```

Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

---

### Task 18: Seed script — super admin bootstrap

**Files:**
- Create: `bemfsmundip2026_be/prisma/seed.ts`

- [ ] **Step 1: Buat `prisma/seed.ts`**

```ts
import { PrismaClient, UserRoleCode, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const bootstrapEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
  const bootstrapPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
  const argonMemoryCost = Number(process.env.ARGON2_MEMORY_COST ?? 19456);
  const argonTimeCost = Number(process.env.ARGON2_TIME_COST ?? 2);
  const argonParallelism = Number(process.env.ARGON2_PARALLELISM ?? 1);

  if (!bootstrapEmail || !bootstrapPassword) {
    throw new Error(
      'BOOTSTRAP_SUPER_ADMIN_EMAIL dan BOOTSTRAP_SUPER_ADMIN_PASSWORD wajib di environment',
    );
  }

  console.log('[seed] Memulai seed…');

  const existing = await prisma.user.findFirst({
    where: { email: bootstrapEmail.toLowerCase() },
  });

  if (existing) {
    console.log(`[seed] Super Admin ${bootstrapEmail} sudah ada, skip.`);
  } else {
    const passwordHash = await argon2.hash(bootstrapPassword, {
      type: argon2.argon2id,
      memoryCost: argonMemoryCost,
      timeCost: argonTimeCost,
      parallelism: argonParallelism,
    });
    await prisma.user.create({
      data: {
        id: uuidv4(),
        name: 'Super Admin',
        email: bootstrapEmail.toLowerCase(),
        passwordHash,
        roleCode: UserRoleCode.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        invitationAcceptedAt: new Date(),
        passwordMustChange: true,
      },
    });
    console.log(`[seed] Super Admin ${bootstrapEmail} dibuat dengan passwordMustChange=true.`);
  }

  console.log('[seed] Selesai.');
}

main()
  .catch((err) => {
    console.error('[seed] Gagal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Verify seed dapat berjalan**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
set -a && source .env && set +a
npx ts-node --transpile-only prisma/seed.ts
```

Expected: log "Super Admin ... dibuat" atau "... sudah ada, skip". Tidak ada error.

- [ ] **Step 3: Commit**

---

### Task 19: Main.ts — bootstrap NestJS app

**Files:**
- Create: `bemfsmundip2026_be/src/main.ts`

- [ ] **Step 1: Buat `src/main.ts`**

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  app.use(helmet());

  app.enableCors({
    origin: (process.env.FRONTEND_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    credentials: process.env.AUTH_MODE === 'cookie',
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'If-Match', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id', 'ETag', 'Last-Modified'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BEM FSM UNDIP 2026 Backend API')
      .setDescription('Backend CMS untuk BEM FSM UNDIP 2026 — Kabinet Bara Momentum')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addCookieAuth('access_token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`[bootstrap] Backend listening on http://localhost:${port}/${apiPrefix}`);
}

bootstrap().catch((err) => {
  console.error('[bootstrap] Failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

---

### Task 20: AppModule — wire everything

**Files:**
- Create: `bemfsmundip2026_be/src/app.module.ts`

- [ ] **Step 1: Buat `src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { CommonModule } from './common/common.module';
import { AppLoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    PrismaModule,
    CommonModule,
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 5 },
      { name: 'medium', ttl: 60_000, limit: 60 },
      { name: 'long', ttl: 60_000, limit: 300 },
    ]),
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 2: Commit**

---

### Task 21: E2E test untuk health endpoint

**Files:**
- Create: `bemfsmundip2026_be/test/jest-e2e.json`
- Create: `bemfsmundip2026_be/test/health.e2e-spec.ts`

- [ ] **Step 1: Buat `test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/../src/$1"
  }
}
```

- [ ] **Step 2: Buat `test/health.e2e-spec.ts`**

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';

describe('Health endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.API_PREFIX = 'api/v1';
    process.env.LOG_LEVEL = 'silent';
    process.env.PORT = '3002';
    process.env.AUTH_MODE = 'cookie';
    process.env.FRONTEND_ORIGINS = 'http://localhost:3000';
    process.env.COOKIE_DOMAIN = 'localhost';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'mysql://bemfsm:bemfsm@localhost:3306/bemfsm_test';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.PREVIEW_TOKEN_SECRET = 'c'.repeat(32);
    process.env.STORAGE_PROVIDER = 'local';
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_BUCKET = 'bemfsm-media-test';
    process.env.S3_ACCESS_KEY_ID = 'minioadmin';
    process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
    process.env.CDN_BASE_URL = 'http://localhost:9000/bemfsm-media-test';
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '1025';
    process.env.MAIL_FROM = 'test@bemfsm.id';
    process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = 'admin@bemfsm.id';
    process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD = 'ChangeMe123!ChangeMe';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(process.env.API_PREFIX);
    app.use(helmet());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    expect(res.body).toMatchObject({
      data: { status: 'ok' },
      meta: { requestId: expect.any(String) },
    });
  });

  it('GET /api/v1/health/ready returns ok with database check', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(res.body).toMatchObject({
      data: {
        status: 'ok',
        checks: { database: { status: 'ok' } },
      },
      meta: { requestId: expect.any(String) },
    });
  });

  it('every response includes X-Request-Id header', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 3: Run e2e test (perlu MySQL test container running)**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
docker compose -f docker-compose.test.yml up -d
sleep 8
DATABASE_URL='mysql://bemfsm:bemfsm@localhost:3307/bemfsm_test' npx prisma migrate deploy
DATABASE_URL='mysql://bemfsm:bemfsm@localhost:3307/bemfsm_test' npm run test:e2e
```

Expected: 3 tests PASS.

- [ ] **Step 4: Cleanup test container**

```bash
docker compose -f docker-compose.test.yml down -v
```

- [ ] **Step 5: Commit**

---

### Task 22: TypeScript build verification

**Files:** none (verification step)

- [ ] **Step 1: Run typecheck**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
npm run typecheck
```

Expected: exit 0, no TypeScript errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exit 0, no errors.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: `dist/main.js` terbuat, exit 0.

- [ ] **Step 5: Fix issues jika ada, lalu commit final**

---

### Task 23: README.md

**Files:**
- Create: `bemfsmundip2026_be/README.md`

- [ ] **Step 1: Buat README**

```markdown
# Backend CMS BEM FSM UNDIP 2026

Backend NestJS modular monolith untuk website BEM FSM UNDIP 2026 — Kabinet Bara Momentum.

**Status:** Phase 0 (Foundation) — siap untuk development Phase 1 (Identity & Users).

## Tech Stack

- Node.js 22 LTS
- NestJS 10 + TypeScript 5 (strict mode)
- MySQL 8 (utf8mb4)
- Prisma 5 ORM + Prisma Migrate
- Pino structured logger
- Argon2id password hashing
- JWT auth (cookie + bearer modes)
- Swagger / OpenAPI 3 di `/api/docs`
- Jest + Supertest testing

## Quick Start

### Prerequisites

- Node.js 22+
- Docker + Docker Compose
- npm 10+

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env
# Edit .env: set JWT secrets (min 32 chars random), bootstrap password

# 3. Start services (MySQL, MinIO, Mailpit)
docker compose up -d mysql minio mailpit

# 4. Run database migrations
npm run prisma:migrate

# 5. Seed bootstrap data (Super Admin)
npm run prisma:seed

# 6. Start dev server
npm run start:dev
```

Backend akan listen di `http://localhost:3001`.

- Swagger UI: `http://localhost:3001/api/v1/docs`
- Health: `http://localhost:3001/api/v1/health/live`
- MinIO console: `http://localhost:9001` (minioadmin/minioadmin)
- Mailpit UI: `http://localhost:8025`

## Project Structure

```
src/
  config/         # Environment validation + NestJS ConfigModule
  common/         # Cross-cutting: filters, interceptors, errors, logger
  database/       # PrismaService + PrismaModule
  modules/
    health/       # /health/live + /health/ready
  jobs/           # (Phase 1+ — article publisher, media cleanup)
  main.ts
  app.module.ts
prisma/
  schema.prisma   # Identity tables (Phase 0); tambah di Phase 1-5
  seed.ts         # Roles, super admin bootstrap
```

## Scripts

| Script | Fungsi |
|---|---|
| `npm run start:dev` | Dev server dengan watch mode |
| `npm run build` | Production build ke `dist/` |
| `npm run start:prod` | Run production build |
| `npm run lint` | ESLint + auto-fix |
| `npm run format` | Prettier |
| `npm test` | Unit tests |
| `npm run test:e2e` | E2E tests (perlu MySQL test container) |
| `npm run test:cov` | Coverage report |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Create + apply migration (dev) |
| `npm run prisma:deploy` | Apply migrations (prod) |
| `npm run prisma:seed` | Seed bootstrap data |
| `npm run typecheck` | TypeScript typecheck tanpa emit |

## Environment Variables

Lihat `.env.example` untuk semua variabel yang dibutuhkan. Yang **wajib** untuk development:

- `DATABASE_URL` — MySQL connection string
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PREVIEW_TOKEN_SECRET` — minimal 32 char random
- `BOOTSTRAP_SUPER_ADMIN_EMAIL`, `BOOTSTRAP_SUPER_ADMIN_PASSWORD` — seed membuat user ini

## Testing

Unit test:
```bash
npm test
```

E2E test (perlu docker compose up test container dulu):
```bash
docker compose -f docker-compose.test.yml up -d
DATABASE_URL='mysql://bemfsm:bemfsm@localhost:3307/bemfsm_test' npx prisma migrate deploy
npm run test:e2e
```

## Roadmap

- **Phase 0** (current) — Foundation
- **Phase 1** — Identity: login/logout/refresh, users CRUD, RBAC, audit log
- **Phase 2** — Media: upload, Sharp pipeline, MinIO storage
- **Phase 3** — Organization CMS: Biro/Bidang/Tim + nested strategies/programs/members
- **Phase 4** — Article CMS: kategori, artikel, sanitizer, scheduler, revisions, preview
- **Phase 5** — Instagram + Dashboard + Audit UI + Settings
- **Phase 6** — Hardening: E2E penuh, perf tuning, observability penuh

Lihat `docs/superpowers/specs/2026-08-27-backend-bem-fsm-design.md` untuk design lengkap.
```

- [ ] **Step 2: Commit**

---

### Task 24: Final verification — full system check

**Files:** none (verification step)

- [ ] **Step 1: Stop dan restart semua service**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_be"
docker compose down
docker compose up -d mysql minio mailpit
sleep 10
```

- [ ] **Step 2: Re-run migrations + seed fresh**

```bash
docker container inspect bemfsm-mysql >/dev/null 2>&1 && \
  docker container run --rm --network host mysql:8.0 mysql -h127.0.0.1 -P3306 -uroot -proot \
    -e "DROP DATABASE IF EXISTS bemfsm; CREATE DATABASE bemfsm CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" 2>/dev/null || true

set -a && source .env && set +a
npx prisma migrate deploy
npm run prisma:seed
```

Expected: migration applied, super admin created.

- [ ] **Step 3: Start backend dev server (background)**

```bash
npm run start:dev > /tmp/backend.log 2>&1 &
sleep 8
```

- [ ] **Step 4: Test endpoints**

```bash
# Health live
curl -s http://localhost:3001/api/v1/health/live | jq

# Health ready
curl -s http://localhost:3001/api/v1/health/ready | jq

# Swagger
curl -sI http://localhost:3001/api/v1/docs | head -5

# X-Request-Id custom header preserved
curl -s -H "X-Request-Id: test-12345" http://localhost:3001/api/v1/health/live -D - | grep -i x-request-id
```

Expected: semua return ok dengan X-Request-Id header.

- [ ] **Step 5: Stop dev server**

```bash
pkill -f "nest start" || true
```

- [ ] **Step 6: Run full test suite sekali lagi**

```bash
npm test
docker compose -f docker-compose.test.yml up -d
sleep 5
DATABASE_URL='mysql://bemfsm:bemfsm@localhost:3307/bemfsm_test' npx prisma migrate deploy
DATABASE_URL='mysql://bemfsm:bemfsm@localhost:3307/bemfsm_test' npm run test:e2e
docker compose -f docker-compose.test.yml down -v
```

Expected: semua tests pass.

- [ ] **Step 7: Final commit jika ada perubahan**

```bash
git status
git diff
# Jika ada perubahan dari formatting atau fix:
git add .
git commit -m "chore: phase 0 foundation complete and verified"
```

---

## Phase 0 Definition of Done — Checklist

- [ ] `npm install` clean (no errors)
- [ ] `docker compose config --quiet` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` semua PASS
- [ ] `npm run build` exit 0, `dist/main.js` ada
- [ ] `docker compose up -d mysql minio mailpit` berjalan
- [ ] `npm run prisma:migrate` membuat migration & apply ke MySQL
- [ ] `npm run prisma:seed` membuat Super Admin di DB
- [ ] `npm run start:dev` jalan tanpa error
- [ ] `GET /api/v1/health/live` returns 200 dengan `{ data: { status: 'ok' } }`
- [ ] `GET /api/v1/health/ready` returns 200 dengan database ok
- [ ] `GET /api/v1/docs` returns Swagger UI HTML
- [ ] Response selalu include `X-Request-Id` header
- [ ] JWT secret < 32 char ditolak saat startup
- [ ] E2E tests pass

Setelah semua ✅, Phase 0 selesai. Lanjut ke Phase 1 plan (akan dibuat setelah Phase 0 selesai dan verified).

---

## Catatan untuk Eksekusi

- Setiap task adalah atomic — bisa di-review dan di-commit terpisah
- Test-first: setiap unit logic punya failing test dulu, lalu implementation, lalu pass
- Jika ada task gagal, fix dan re-run — jangan skip
- Commit message menggunakan Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`, `fix:`)
- Folder `bemfsmundip2026_be` belum punya git repo. Jika Anda ingin inisialisasi git sebelum eksekusi, beri tahu — saya akan jalankan `git init` + initial commit sebelum Task 1

**Estimasi eksekusi**: 4-6 jam focused work untuk developer yang sudah familiar dengan NestJS.