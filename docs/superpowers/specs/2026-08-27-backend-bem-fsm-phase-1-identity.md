# Phase 1 — Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi authentication, user management, RBAC, invitations, dan audit logging untuk BEM FSM UNDIP 2026 backend.

**Architecture:** Modular monolith (NestJS) per-domain. Phase 1 menambah 5 module di bawah `src/modules/identity/`: `auth/`, `users/`, `rbac/`, `invitations/`, `audit/`. Setiap module berisi controller + service + repository + dto + policy. Guards (`PermissionsGuard`, `UnitScopeGuard`) adalah global di IdentityModule. Token strategy: JWT HS256 access + opaque rotating refresh. Failed-login lockout via kolom DB di tabel `users`.

**Tech Stack:** NestJS 10, Prisma 5, MySQL 8, JWT (`@nestjs/jwt`), Argon2 (`argon2`), `nodemailer`, `class-validator`, `class-transformer`, `bcrypt` (untuk invitation token hashing), `cookie-parser` (untuk auth cookie parsing).

## Global Constraints

- TypeScript strict, `noUncheckedIndexedAccess: true`
- UUID v4 CHAR(36) untuk semua PK
- snake_case kolom DB, camelCase di Prisma client
- Response envelope `{ data, meta }` via `TransformInterceptor` (sudah ada di Phase 0)
- Error envelope `{ error: { code, message, details, requestId } }` via `HttpExceptionFilter` + `AppError` (sudah ada di Phase 0)
- Permission-based, bukan role-name check di controller
- Soft delete (`deleted_at`) di tabel user
- Audit log ditulis SETIAP operasi state-changing (login/logout/refresh rotation, user CRUD, role change, invitation, password change)
- Rate limit per spec section 4.3 (5/menit login, 3/menit forgot, 60/menit admin mutation, 30/menit invitation, 10/menit change-password)
- TDD: failing test → implementation → passing test → commit per task
- Conventional commits: `feat(phase-1): ...`, `test(phase-1): ...`, `chore(phase-1): ...`
- Co-author trailer pada setiap commit

## File Structure

```
prisma/
└── schema.prisma                    ← tambah tabel roles, permissions, role_permissions, user_unit_assignments, audit_logs; extend users, refresh_sessions
└── migrations/<ts>_phase_1_identity/

src/modules/identity/
├── identity.module.ts
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.service.spec.ts
│   ├── token.service.ts
│   ├── token.service.spec.ts
│   ├── password.service.ts
│   ├── password.service.spec.ts
│   ├── session.service.ts
│   ├── session.service.spec.ts
│   ├── login-throttle.service.ts
│   ├── login-throttle.service.spec.ts
│   └── dto/
│       ├── login.dto.ts
│       ├── change-password.dto.ts
│       ├── forgot-password.dto.ts
│       ├── reset-password.dto.ts
│       └── refresh.dto.ts
├── users/
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.service.spec.ts
│   ├── users.repository.ts
│   ├── users.policy.ts
│   └── dto/
│       ├── create-user.dto.ts
│       ├── update-user.dto.ts
│       ├── list-users.dto.ts
│       └── user-response.dto.ts
├── rbac/
│   ├── permissions.guard.ts
│   ├── permissions.guard.spec.ts
│   ├── permissions.decorator.ts
│   ├── unit-scope.guard.ts
│   ├── unit-scope.guard.spec.ts
│   ├── unit-scope.decorator.ts
│   ├── permissions.service.ts
│   └── permissions.service.spec.ts
├── invitations/
│   ├── invitations.controller.ts
│   ├── invitations.service.ts
│   ├── invitations.service.spec.ts
│   ├── invitations.repository.ts
│   └── dto/
│       ├── create-invitation.dto.ts
│       └── accept-invitation.dto.ts
└── audit/
    ├── audit.service.ts
    ├── audit.service.spec.ts
    └── audit.constants.ts

src/common/decorators/
├── current-user.decorator.ts
├── request-meta.decorator.ts

src/common/mail/
├── mail.service.ts
├── mail.service.spec.ts
└── mail.module.ts

test/
└── auth.e2e-spec.ts
```

## Task Decomposition

Total 21 task, dijalankan berurutan. Tiap task = satu commit.

### Task 1: Migration — Identity schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_phase_1_identity/migration.sql` (auto-generated)

**Step 1:** Tambah ke `prisma/schema.prisma`:

```prisma
enum UserRoleCode {
  SUPER_ADMIN
  ADMIN
  EDITOR
  MEMBER
}

enum UserStatus {
  PENDING_INVITATION
  ACTIVE
  SUSPENDED
}

model Role {
  id          String   @id @db.Char(36)
  code        UserRoleCode @unique
  name        String
  description String?  @db.VarChar(255)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  users       User[]
  rolePermissions RolePermission[]
  userUnitAssignments UserUnitAssignment[]

  @@map("roles")
}

model Permission {
  id          String   @id @db.Char(36)
  code        String   @unique @db.VarChar(100)
  description String?  @db.VarChar(255)
  createdAt   DateTime @default(now()) @map("created_at")
  rolePermissions RolePermission[]

  @@map("permissions")
}

model RolePermission {
  roleId        String   @db.Char(36) @map("role_id")
  permissionId  String   @db.Char(36) @map("permission_id")
  createdAt     DateTime @default(now()) @map("created_at")
  role          Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission    Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserUnitAssignment {
  userId             String   @db.Char(36) @map("user_id")
  organizationUnitId String   @db.Char(36) @map("organization_unit_id")
  roleId             String   @db.Char(36) @map("role_id")
  createdAt          DateTime @default(now()) @map("created_at")
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role               Role     @relation(fields: [roleId], references: [id], onDelete: Restrict)

  @@id([userId, organizationUnitId])
  @@map("user_unit_assignments")
}

model AuditLog {
  id            String   @id @db.Char(36)
  actorId       String?  @db.Char(36) @map("actor_id")
  action        String   @db.VarChar(64)
  resourceType  String   @db.VarChar(64) @map("resource_type")
  resourceId    String?  @db.Char(36) @map("resource_id")
  beforeJson    Json?    @map("before_json")
  afterJson     Json?    @map("after_json")
  ip            String?  @db.VarChar(45)
  userAgent     String?  @db.Text @map("user_agent")
  requestId     String?  @db.Char(36) @map("request_id")
  metadata      Json?
  createdAt     DateTime @default(now()) @map("created_at")
  actor         User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([actorId, createdAt])
  @@index([resourceType, resourceId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

Modify existing `User`:
- tambah field `failedLoginCount Int @default(0) @map("failed_login_count")`
- tambah field `lockedUntil DateTime? @map("locked_until")`
- tambah field `lastLoginAt DateTime? @map("last_login_at")`
- tambah field `status UserStatus @default(PENDING_INVITATION)`
- tambah relation `unitAssignments UserUnitAssignment[]`
- tambah relation `auditLogs AuditLog[]`

Replace roleCode String → `roleCode UserRoleCode`.

**Step 2:** Jalankan `npm run prisma:migrate -- --name phase_1_identity` (non-interactive). Verify `prisma/migrations/<ts>_phase_1_identity/migration.sql` ter-create.

**Step 3:** Verify dengan `docker exec bemfsm-mysql mysql -ubemfsm -pbemfsm bemfsm -e "DESCRIBE users; DESCRIBE roles; DESCRIBE permissions;"` — semua kolom baru muncul.

**Step 4:** Commit: `feat(phase-1): add identity schema migration (roles, permissions, audit_logs)`.

---

### Task 2: Seed — Roles, Permissions, Role-Permissions

**Files:**
- Modify: `prisma/seed.ts`

**Step 1:** Tulis failing test inline di `prisma/__tests__/seed.test.ts` (skip; seed tidak di-test unit. Tulis assert di `npm run prisma:seed`).

**Step 2:** Update `prisma/seed.ts` sehingga setelah bootstrap Super Admin, seed:

```typescript
// Roles
const roles = [
  { code: UserRoleCode.SUPER_ADMIN, name: 'Super Admin', description: 'Akses penuh sistem' },
  { code: UserRoleCode.ADMIN, name: 'Admin', description: 'Kelola konten & user' },
  { code: UserRoleCode.EDITOR, name: 'Editor', description: 'Kelola artikel & media' },
];

// Permissions (~30 kode sesuai spec section PRD 8.4)
const permissions = [
  'users.read', 'users.create', 'users.update', 'users.delete', 'users.invite',
  'articles.read', 'articles.create', 'articles.update', 'articles.delete',
  'articles.publish', 'articles.unpublish', 'articles.archive',
  'organization.read', 'organization.create', 'organization.update', 'organization.delete',
  'media.read', 'media.upload', 'media.update', 'media.delete',
  'instagram.read', 'instagram.update',
  'audit.read',
  'settings.read', 'settings.update',
  'dashboard.read',
];

// Role-Permission mapping
const rolePerms: Record<UserRoleCode, string[]> = {
  SUPER_ADMIN: permissions, // all
  ADMIN: permissions.filter(p => !['users.delete', 'settings.update'].includes(p)),
  EDITOR: ['articles.read', 'articles.create', 'articles.update', 'articles.publish',
           'organization.read', 'media.read', 'media.upload', 'media.update',
           'instagram.read', 'dashboard.read'],
};
```

Use `prisma.$transaction([upsert roles, upsert permissions, upsert role_permissions])`. Idempotent (cek existing by code).

**Step 3:** Verify: `npm run prisma:seed` → no error, `docker exec bemfsm-mysql mysql -ubemfsm -pbemfsm bemfsm -e "SELECT COUNT(*) FROM roles; SELECT COUNT(*) FROM permissions; SELECT COUNT(*) FROM role_permissions;"` → 3, 25, ~70 rows.

**Step 4:** Commit: `feat(phase-1): seed roles, permissions, role_permissions`.

---

### Task 3: Token service (JWT sign/verify)

**Files:**
- Create: `src/modules/identity/auth/token.service.ts`
- Create: `src/modules/identity/auth/token.service.spec.ts`

**Step 1:** Tulis failing test `src/modules/identity/auth/token.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TokenService } from './token.service';
import { loadEnvConfig } from '../../../config/configuration';

describe('TokenService', () => {
  let service: TokenService;
  const env = loadEnvConfig();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: env.JWT_ACCESS_SECRET, signOptions: { expiresIn: env.JWT_ACCESS_TTL } })],
      providers: [TokenService],
    }).compile();
    service = module.get(TokenService);
  });

  const payload = { sub: 'u-1', email: 'a@b.c', roleCode: 'SUPER_ADMIN', permissions: ['users.read'], unitScopes: [], passwordMustChange: false };

  it('signAccess creates JWT', () => {
    const token = service.signAccess(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('verifyAccess returns payload', () => {
    const token = service.signAccess(payload);
    const verified = service.verifyAccess(token);
    expect(verified.sub).toBe(payload.sub);
    expect(verified.permissions).toEqual(payload.permissions);
  });

  it('verifyAccess throws on tampered token', () => {
    const token = service.signAccess(payload);
    expect(() => service.verifyAccess(token + 'x')).toThrow();
  });
});
```

**Step 2:** Run `npm test -- token.service` → FAIL.

**Step 3:** Implement `token.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { loadEnvConfig } from '../../../config/configuration';

const env = loadEnvConfig();

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roleCode: string;
  permissions: string[];
  unitScopes: string[];
  passwordMustChange: boolean;
}

export interface PreviewTokenPayload {
  articleId: string;
  scope: 'preview';
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccess(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL,
    });
  }

  verifyAccess(token: string): AccessTokenPayload {
    return this.jwt.verify(token, { secret: env.JWT_ACCESS_SECRET });
  }

  signPreview(payload: PreviewTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: env.PREVIEW_TOKEN_SECRET,
      expiresIn: '15m',
    });
  }

  verifyPreview(token: string): PreviewTokenPayload {
    return this.jwt.verify(token, { secret: env.PREVIEW_TOKEN_SECRET });
  }
}
```

**Step 4:** Run test → PASS (3 tests).

**Step 5:** Commit: `feat(phase-1): TokenService for JWT access + preview tokens`.

---

### Task 4: Password service (Argon2id)

**Files:**
- Create: `src/modules/identity/auth/password.service.ts`
- Create: `src/modules/identity/auth/password.service.spec.ts`

**Step 1:** Failing test:

```typescript
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hash returns argon2id hash', async () => {
    const hash = await service.hash('Password123!Secret');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Password123!Secret');
  });

  it('verify returns true for correct password', async () => {
    const hash = await service.hash('Password123!Secret');
    expect(await service.verify(hash, 'Password123!Secret')).toBe(true);
  });

  it('verify returns false for wrong password', async () => {
    const hash = await service.hash('Password123!Secret');
    expect(await service.verify(hash, 'wrong')).toBe(false);
  });

  it('two hashes of same password differ', async () => {
    const a = await service.hash('Password123!Secret');
    const b = await service.hash('Password123!Secret');
    expect(a).not.toBe(b);
  });
});
```

**Step 2:** Run → FAIL.

**Step 3:** Implement:

```typescript
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { loadEnvConfig } from '../../../config/configuration';

const env = loadEnvConfig();

@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: env.ARGON2_MEMORY_COST,
    timeCost: env.ARGON2_TIME_COST,
    parallelism: env.ARGON2_PARALLELISM,
  };

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false);
  }
}
```

**Step 4:** Run → PASS (4 tests).

**Step 5:** Commit: `feat(phase-1): PasswordService with Argon2id hashing`.

---

### Task 5: Login throttle service (failed-login lockout)

**Files:**
- Create: `src/modules/identity/auth/login-throttle.service.ts`
- Create: `src/modules/identity/auth/login-throttle.service.spec.ts`

**Step 1:** Failing test:

```typescript
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../../database/prisma.module';
import { LoginThrottleService } from './login-throttle.service';
import { PrismaService } from '../../../database/prisma.service';

describe('LoginThrottleService (integration with DB)', () => {
  let service: LoginThrottleService;
  let prisma: PrismaService;
  const email = 'throttle@test.local';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [LoginThrottleService],
    }).compile();
    service = module.get(LoginThrottleService);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.user.create({
      data: { id: 't-1', email, name: 'T', passwordHash: 'x', roleCode: 'EDITOR', status: 'ACTIVE', invitationAcceptedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('isLocked returns false initially', async () => {
    expect(await service.isLocked('t-1')).toBe(false);
  });

  it('records failure and locks after 10 failures', async () => {
    for (let i = 0; i < 10; i++) await service.recordFailure('t-1');
    expect(await service.isLocked('t-1')).toBe(true);
  });

  it('recordSuccess resets counter', async () => {
    for (let i = 0; i < 5; i++) await service.recordFailure('t-1');
    await service.recordSuccess('t-1');
    expect(await service.isLocked('t-1')).toBe(false);
  });
});
```

**Step 2:** Run → FAIL.

**Step 3:** Implement:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

const MAX_FAILURES = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000;

@Injectable()
export class LoginThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  async isLocked(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { lockedUntil: true } });
    if (!user?.lockedUntil) return false;
    return user.lockedUntil.getTime() > Date.now();
  }

  async recordFailure(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { failedLoginCount: true } });
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
```

**Step 4:** Run → PASS (3 tests).

**Step 5:** Commit: `feat(phase-1): LoginThrottleService with DB-backed lockout`.

---

### Task 6: Session service (refresh token rotation + reuse detection)

**Files:**
- Create: `src/modules/identity/auth/session.service.ts`
- Create: `src/modules/identity/auth/session.service.spec.ts`

**Step 1:** Failing test:

```typescript
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../../database/prisma.module';
import { SessionService } from './session.service';
import { PrismaService } from '../../../database/prisma.service';
import * as crypto from 'crypto';

describe('SessionService (integration with DB)', () => {
  let service: SessionService;
  let prisma: PrismaService;
  const userId = 's-user-1';

  beforeAll(async () => {
    const module = await Test.createModuleRef
      ? await Test.createModuleRef({ imports: [PrismaModule], providers: [SessionService] }).compile()
      : await Test.createTestingModule({ imports: [PrismaModule], providers: [SessionService] }).compile();
    service = module.get(SessionService);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.refreshSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.user.create({
      data: { id: userId, email: 's@test.local', name: 'S', passwordHash: 'x', roleCode: 'EDITOR', status: 'ACTIVE', invitationAcceptedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('create returns raw token and stores hash', async () => {
    const { token, sessionId } = await service.create(userId);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const stored = await prisma.refreshSession.findUnique({ where: { id: sessionId } });
    expect(stored?.tokenHash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(stored?.revokedAt).toBeNull();
  });

  it('rotate revokes old and creates new', async () => {
    const { token, sessionId } = await service.create(userId);
    const { token: newToken, sessionId: newSessionId } = await service.rotate(token);
    const oldSession = await prisma.refreshSession.findUnique({ where: { id: sessionId } });
    expect(oldSession?.revokedAt).not.toBeNull();
    expect(oldSession?.replacedBySessionId).toBe(newSessionId);
    expect(newToken).not.toBe(token);
  });

  it('rotate detects reuse and revokes chain', async () => {
    const { token } = await service.create(userId);
    await service.rotate(token);
    await expect(service.rotate(token)).rejects.toThrow(/reuse/i);
    const sessions = await prisma.refreshSession.findMany({ where: { userId } });
    expect(sessions.every(s => s.revokedAt !== null)).toBe(true);
  });

  it('revokeAll marks all sessions revoked', async () => {
    await service.create(userId);
    await service.create(userId);
    await service.revokeAll(userId);
    const sessions = await prisma.refreshSession.findMany({ where: { userId } });
    expect(sessions.every(s => s.revokedAt !== null)).toBe(true);
  });
});
```

**Step 2:** Run → FAIL.

**Step 3:** Implement:

```typescript
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

  async create(userId: string, meta?: { userAgent?: string; ip?: string }): Promise<{ token: string; sessionId: string }> {
    const token = this.generateToken();
    const tokenHash = this.hash(token);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    const session = await this.prisma.refreshSession.create({
      data: { id: crypto.randomUUID(), userId, tokenHash, expiresAt, userAgent: meta?.userAgent, ip: meta?.ip },
    });
    return { token, sessionId: session.id };
  }

  async rotate(rawToken: string): Promise<{ token: string; sessionId: string; userId: string }> {
    const tokenHash = this.hash(rawToken);
    const existing = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });

    if (!existing) throw new ForbiddenException('Invalid refresh token');
    if (existing.revokedAt) {
      await this.revokeChain(existing.userId, existing.id);
      throw new ForbiddenException('Refresh token reuse detected');
    }
    if (existing.expiresAt.getTime() < Date.now()) throw new ForbiddenException('Refresh token expired');

    const newSession = await this.create(existing.userId);
    await this.prisma.refreshSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBySessionId: newSession.sessionId },
    });
    return { ...newSession, userId: existing.userId };
  }

  private async revokeChain(userId: string, startId: string): Promise<void> {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null },
    });
    await this.prisma.refreshSession.updateMany({
      where: { id: { in: sessions.map(s => s.id) } },
      data: { revokedAt: new Date() },
    });
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
```

**Step 4:** Run → PASS (4 tests).

**Step 5:** Commit: `feat(phase-1): SessionService with rotation + reuse detection`.

---

### Task 7: Permissions service (load user perms + scopes)

**Files:**
- Create: `src/modules/identity/rbac/permissions.service.ts`
- Create: `src/modules/identity/rbac/permissions.service.spec.ts`

**Step 1:** Failing test:

```typescript
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../../database/prisma.module';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../../../database/prisma.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: PrismaService;
  let roleId: string;
  const userId = 'perm-user-1';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [PermissionsService],
    }).compile();
    service = module.get(PermissionsService);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.rolePermission.deleteMany({});
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.role.deleteMany({ where: { code: 'EDITOR' } });
    roleId = (await prisma.role.create({ data: { id: 'r-1', code: 'EDITOR', name: 'Editor' } })).id;
    const perm = await prisma.permission.create({ data: { id: 'p-1', code: 'articles.read' } });
    await prisma.rolePermission.create({ data: { roleId, permissionId: perm.id } });
    await prisma.user.create({
      data: { id: userId, email: 'p@test.local', name: 'P', passwordHash: 'x', roleCode: 'EDITOR', status: 'ACTIVE', invitationAcceptedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.rolePermission.deleteMany({});
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.role.deleteMany({ where: { id: roleId } });
    await prisma.permission.deleteMany({ where: { id: 'p-1' } });
    await prisma.$disconnect();
  });

  it('loadForUser returns permission codes', async () => {
    const result = await service.loadForUser(userId);
    expect(result.permissions).toEqual(['articles.read']);
    expect(result.roleCode).toBe('EDITOR');
  });

  it('loadForUser returns empty for unknown user', async () => {
    await expect(service.loadForUser('unknown')).rejects.toThrow();
  });
});
```

**Step 2:** Run → FAIL.

**Step 3:** Implement:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async loadForUser(userId: string): Promise<{ roleCode: string; permissions: string[]; unitScopes: string[]; passwordMustChange: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        unitAssignments: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      roleCode: user.role.code,
      permissions: user.role.rolePermissions.map(rp => rp.permission.code),
      unitScopes: user.unitAssignments.map(ua => ua.organizationUnitId),
      passwordMustChange: user.passwordMustChange,
    };
  }

  hasPermission(userPerms: string[], required: string): boolean {
    return userPerms.includes(required);
  }

  hasAnyPermission(userPerms: string[], required: string[]): boolean {
    return required.some(p => userPerms.includes(p));
  }
}
```

Note: User model perlu relation `role Role @relation(...)` setelah seed. Jika belum ada di schema.prisma, tambahkan.

**Step 4:** Run → PASS (2 tests).

**Step 5:** Commit: `feat(phase-1): PermissionsService to load role perms + unit scopes`.

---

### Task 8: Decorators & Guards (Permissions, UnitScope, CurrentUser)

**Files:**
- Create: `src/modules/identity/rbac/permissions.decorator.ts`
- Create: `src/modules/identity/rbac/permissions.guard.ts`
- Create: `src/modules/identity/rbac/permissions.guard.spec.ts`
- Create: `src/modules/identity/rbac/unit-scope.decorator.ts`
- Create: `src/modules/identity/rbac/unit-scope.guard.ts`
- Create: `src/modules/identity/rbac/unit-scope.guard.spec.ts`
- Create: `src/common/decorators/current-user.decorator.ts`
- Create: `src/common/decorators/request-meta.decorator.ts`

**Step 1:** Failing test untuk permissions.guard:

```typescript
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const makeContext = (user: any, required: string[] | null): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }), getResponse: () => ({}), getNext: () => () => {} }),
      getHandler: () => ({}),
      getClass: () => ({}),
      getArgs: () => [],
      getArgByIndex: () => undefined,
      switchToRpc: () => ({}),
      switchToWs: () => ({}),
      getType: () => 'http',
    }) as unknown as ExecutionContext;

  it('allows when no @Permissions decorator', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ permissions: [] }, null))).toBe(true);
  });

  it('allows when user has required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users.read']);
    expect(guard.canActivate(makeContext({ permissions: ['users.read'] }, ['users.read']))).toBe(true);
  });

  it('throws ForbiddenException when user lacks permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users.delete']);
    expect(() => guard.canActivate(makeContext({ permissions: ['users.read'] }, ['users.delete']))).toThrow(ForbiddenException);
  });
});
```

**Step 2:** Run → FAIL.

**Step 3:** Implement permissions.decorator.ts:

```typescript
import { SetMetadata } from '@nestjs/common';
export const PERMISSIONS_KEY = 'rbac.permissions';
export const Permissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);
```

Implement permissions.guard.ts:

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const userPerms: string[] = req.user?.permissions ?? [];
    const has = required.some(p => userPerms.includes(p));
    if (!has) throw new ForbiddenException(`Missing required permission: ${required.join(', ')}`);
    return true;
  }
}
```

**Step 4:** Run → PASS (3 tests).

**Step 5:** Implement unit-scope.decorator.ts:

```typescript
import { SetMetadata } from '@nestjs/common';
export const UNIT_SCOPE_KEY = 'rbac.unit_scope';
export const UnitScope = (bodyField: string) => SetMetadata(UNIT_SCOPE_KEY, bodyField);
```

Implement unit-scope.guard.ts:

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UNIT_SCOPE_KEY } from './unit-scope.decorator';

@Injectable()
export class UnitScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const bodyField = this.reflector.getAllAndOverride<string>(UNIT_SCOPE_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!bodyField) return true;

    const req = ctx.switchToHttp().getRequest();
    const userScopes: string[] = req.user?.unitScopes ?? [];
    const bodyUnitIds: string[] = req.body?.[bodyField] ?? [];
    if (!Array.isArray(bodyUnitIds) || bodyUnitIds.length === 0) return true; // nothing to scope

    const allInScope = bodyUnitIds.every((id: string) => userScopes.includes(id));
    if (!allInScope) throw new ForbiddenException('Unit scope violation');
    return true;
  }
}
```

**Step 6:** Failing test unit-scope.guard (mirroring permissions guard). Run → FAIL. Implement done above. Run → PASS.

**Step 7:** Implement current-user.decorator.ts:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});
```

Implement request-meta.decorator.ts:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const RequestMeta = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return {
    ip: req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
    userAgent: req.headers?.['user-agent'] ?? null,
    requestId: req.headers?.['x-request-id'] ?? null,
  };
});
```

**Step 8:** Commit: `feat(phase-1): RBAC guards + decorators (Permissions, UnitScope, CurrentUser)`.

---

### Task 9: Audit service (write to audit_logs)

**Files:**
- Create: `src/modules/identity/audit/audit.service.ts`
- Create: `src/modules/identity/audit/audit.service.spec.ts`
- Create: `src/modules/identity/audit/audit.constants.ts`

**Step 1:** Create audit.constants.ts:

```typescript
export const AUDIT_ACTIONS = {
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login.failed',
  USER_LOGOUT: 'user.logout',
  USER_REFRESH: 'user.refresh',
  USER_PASSWORD_CHANGE: 'user.password.change',
  USER_PASSWORD_RESET_REQUEST: 'user.password.reset.request',
  USER_PASSWORD_RESET: 'user.password.reset',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_REVOKE_SESSIONS: 'user.revoke_sessions',
  USER_REFRESH_REUSE: 'user.refresh.reuse',
  INVITATION_CREATED: 'invitation.created',
  INVITATION_ACCEPTED: 'invitation.accepted',
} as const;
```

**Step 2:** Failing test:

```typescript
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../../database/prisma.module';
import { AuditService } from './audit.service';
import { PrismaService } from '../../../database/prisma.service';
import { AUDIT_ACTIONS } from './audit.constants';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [AuditService],
    }).compile();
    service = module.get(AuditService);
    prisma = module.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('write inserts an audit log entry', async () => {
    await service.write({
      actorId: null,
      action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
      resourceType: 'user',
      resourceId: null,
      ip: '127.0.0.1',
      userAgent: 'jest',
      requestId: 'req-1',
      metadata: { email: 'x@y.z' },
    });
    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe(AUDIT_ACTIONS.USER_LOGIN_FAILED);
  });

  it('write supports before/after JSON', async () => {
    await service.write({
      actorId: 'a-1',
      action: AUDIT_ACTIONS.USER_UPDATED,
      resourceType: 'user',
      resourceId: 'u-1',
      beforeJson: { name: 'Old' },
      afterJson: { name: 'New' },
    });
    const logs = await prisma.auditLog.findMany();
    expect(logs[0].beforeJson).toEqual({ name: 'Old' });
    expect(logs[0].afterJson).toEqual({ name: 'New' });
  });
});
```

**Step 3:** Run → FAIL.

**Step 4:** Implement audit.service.ts:

```typescript
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
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
        beforeJson: entry.beforeJson as any,
        afterJson: entry.afterJson as any,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        requestId: entry.requestId ?? null,
        metadata: entry.metadata as any,
      },
    });
  }
}
```

**Step 5:** Run → PASS (2 tests).

**Step 6:** Commit: `feat(phase-1): AuditService for structured audit log writes`.

---

### Task 10: Mail service (nodemailer)

**Files:**
- Create: `src/common/mail/mail.module.ts`
- Create: `src/common/mail/mail.service.ts`
- Create: `src/common/mail/mail.service.spec.ts`

**Step 1:** Failing test:

```typescript
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;

  beforeEach(() => {
    service = new MailService({
      host: 'localhost',
      port: 1025,
      from: 'noreply@test.local',
    });
  });

  it('send queues an email', async () => {
    const spy = jest.spyOn((service as any).transporter, 'sendMail').mockResolvedValue({ messageId: '1' });
    await service.send({ to: 'a@b.c', subject: 'Hi', text: 'Hello' });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.c', from: 'noreply@test.local' }));
  });
});
```

**Step 2:** Run → FAIL.

**Step 3:** Implement mail.service.ts:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface MailConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: MailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    });
  }

  async send(msg: MailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
    } catch (err) {
      this.logger.error(`Mail send failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
```

**Step 4:** Run → PASS.

**Step 5:** Implement mail.module.ts:

```typescript
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { loadEnvConfig } from '../../config/configuration';

const env = loadEnvConfig();

@Global()
@Module({
  providers: [
    {
      provide: MailService,
      useValue: new MailService({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER || undefined,
        password: env.SMTP_PASSWORD || undefined,
        from: env.MAIL_FROM,
      }),
    },
  ],
  exports: [MailService],
})
export class MailModule {}
```

**Step 6:** Commit: `feat(phase-1): MailService via nodemailer SMTP (Mailpit dev)`.

---

### Task 11: Auth controller — login + refresh + logout + me

**Files:**
- Create: `src/modules/identity/auth/dto/login.dto.ts`
- Create: `src/modules/identity/auth/dto/refresh.dto.ts`
- Create: `src/modules/identity/auth/auth.controller.ts`
- Create: `src/modules/identity/auth/auth.service.ts`
- Create: `src/modules/identity/auth/auth.service.spec.ts`

**Step 1:** dto/login.dto.ts:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
```

dto/refresh.dto.ts:

```typescript
import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
```

**Step 2:** Failing auth.service.spec.ts:

```typescript
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../../database/prisma.module';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { LoginThrottleService } from './login-throttle.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../../../common/mail/mail.service';
import { PrismaService } from '../../../database/prisma.service';
import * as argon2 from 'argon2';

describe('AuthService (integration)', () => {
  let auth: AuthService;
  let prisma: PrismaService;
  let roleId: string;
  const userId = 'auth-u-1';
  const email = 'auth@test.local';

  beforeAll(async () => {
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '1025';
    process.env.MAIL_FROM = 'noreply@test.local';
    const module = await Test.createTestingModule({
      imports: [PrismaModule, JwtModule.register({ secret: 'x'.repeat(32), signOptions: { expiresIn: '15m' } })],
      providers: [
        AuthService, TokenService, PasswordService, SessionService, LoginThrottleService,
        PermissionsService, AuditService,
        { provide: MailService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    auth = module.get(AuthService);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.refreshSession.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.userUnitAssignment.deleteMany({});
    await prisma.rolePermission.deleteMany({});
    await prisma.user.deleteMany({ where: { email } });
    await prisma.role.deleteMany({ where: { code: 'EDITOR' } });
    await prisma.permission.deleteMany({});
    roleId = (await prisma.role.create({ data: { id: 'r-auth-1', code: 'EDITOR', name: 'Editor' } })).id;
    const hash = await argon2.hash('Password123!Secret', { type: argon2.argon2id });
    await prisma.user.create({
      data: { id: userId, email, name: 'Auth', passwordHash: hash, roleCode: 'EDITOR', status: 'ACTIVE', invitationAcceptedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.userUnitAssignment.deleteMany({});
    await prisma.rolePermission.deleteMany({});
    await prisma.user.deleteMany({ where: { email } });
    await prisma.role.deleteMany({ where: { id: roleId } });
    await prisma.permission.deleteMany({});
    await prisma.$disconnect();
  });

  it('login with correct credentials returns tokens', async () => {
    const result = await auth.login({ email, password: 'Password123!Secret', ip: '127.0.0.1', userAgent: 'jest' });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.user.email).toBe(email);
  });

  it('login with wrong password throws UNAUTHENTICATED', async () => {
    await expect(auth.login({ email, password: 'wrong', ip: null, userAgent: null })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('login fails after 10 wrong attempts with ACCOUNT_LOCKED', async () => {
    for (let i = 0; i < 10; i++) {
      await auth.login({ email, password: 'wrong', ip: null, userAgent: null }).catch(() => {});
    }
    await expect(auth.login({ email, password: 'Password123!Secret', ip: null, userAgent: null })).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
  });
});
```

**Step 3:** Run → FAIL.

**Step 4:** Implement auth.service.ts:

```typescript
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { LoginThrottleService } from './login-throttle.service';
import { PermissionsService } from '../rbac/permissions.service';
import { PrismaService } from '../../../database/prisma.service';
import { AppError } from '../../../common/errors/app-error';

export interface LoginInput {
  email: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; roleCode: string; passwordMustChange: boolean };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly token: TokenService,
    private readonly password: PasswordService,
    private readonly session: SessionService,
    private readonly throttle: LoginThrottleService,
    private readonly perms: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    const genericError = new AppError('UNAUTHENTICATED', 'Email atau password salah', 401);

    if (!user) {
      await this.audit.write({
        actorId: null, action: AUDIT_ACTIONS.USER_LOGIN_FAILED, resourceType: 'user',
        ip: input.ip, userAgent: input.userAgent, metadata: { email: input.email },
      });
      throw genericError;
    }

    if (user.status !== 'ACTIVE') throw new AppError('UNAUTHENTICATED', 'Akun belum aktif', 401);

    if (await this.throttle.isLocked(user.id)) {
      throw new AppError('ACCOUNT_LOCKED', 'Akun terkunci sementara', 401);
    }

    const ok = await this.password.verify(user.passwordHash, input.password);
    if (!ok) {
      await this.throttle.recordFailure(user.id);
      await this.audit.write({
        actorId: user.id, action: AUDIT_ACTIONS.USER_LOGIN_FAILED, resourceType: 'user',
        resourceId: user.id, ip: input.ip, userAgent: input.userAgent,
      });
      throw genericError;
    }

    await this.throttle.recordSuccess(user.id);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const perms = await this.perms.loadForUser(user.id);
    const accessToken = this.token.signAccess({
      sub: user.id, email: user.email, roleCode: user.roleCode,
      permissions: perms.permissions, unitScopes: perms.unitScopes, passwordMustChange: user.passwordMustChange,
    });
    const { token: refreshToken } = await this.session.create(user.id, { ip: input.ip ?? undefined, userAgent: input.userAgent ?? undefined });

    await this.audit.write({
      actorId: user.id, action: AUDIT_ACTIONS.USER_LOGIN, resourceType: 'user',
      resourceId: user.id, ip: input.ip, userAgent: input.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, roleCode: user.roleCode, passwordMustChange: user.passwordMustChange },
    };
  }

  async refresh(rawToken: string, meta: { ip: string | null; userAgent: string | null }): Promise<LoginResult> {
    const rotated = await this.session.rotate(rawToken).catch(async (err) => {
      await this.audit.write({
        actorId: null, action: AUDIT_ACTIONS.USER_REFRESH_REUSE, resourceType: 'session',
        ip: meta.ip, userAgent: meta.userAgent,
      });
      throw err;
    });
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || user.status !== 'ACTIVE') throw new AppError('UNAUTHENTICATED', 'Akun tidak aktif', 401);

    const perms = await this.perms.loadForUser(user.id);
    const accessToken = this.token.signAccess({
      sub: user.id, email: user.email, roleCode: user.roleCode,
      permissions: perms.permissions, unitScopes: perms.unitScopes, passwordMustChange: user.passwordMustChange,
    });

    await this.audit.write({
      actorId: user.id, action: AUDIT_ACTIONS.USER_REFRESH, resourceType: 'session',
      resourceId: rotated.sessionId, ip: meta.ip, userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken: rotated.token,
      user: { id: user.id, email: user.email, name: user.name, roleCode: user.roleCode, passwordMustChange: user.passwordMustChange },
    };
  }

  async logout(rawToken: string, actorId: string | null, meta: { ip: string | null; userAgent: string | null }): Promise<void> {
    await this.session.revoke(rawToken);
    await this.audit.write({
      actorId, action: AUDIT_ACTIONS.USER_LOGOUT, resourceType: 'session',
      ip: meta.ip, userAgent: meta.userAgent,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('UNAUTHENTICATED', 'Tidak terautentikasi', 401);
    const perms = await this.perms.loadForUser(user.id);
    return { id: user.id, email: user.email, name: user.name, roleCode: user.roleCode, permissions: perms.permissions, unitScopes: perms.unitScopes, passwordMustChange: user.passwordMustChange };
  }
}
```

**Step 5:** Run → PASS (3 tests).

**Step 6:** Implement auth.controller.ts:

```typescript
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequestMeta } from '../../../common/decorators/request-meta.decorator';
import { loadEnvConfig } from '../../../config/configuration';

const env = loadEnvConfig();
const REFRESH_COOKIE = 'refresh_token';

const readRefreshToken = (req: Request, body?: string): string => {
  if (env.AUTH_MODE === 'cookie') {
    const cookies = (req as any).cookies ?? {};
    return cookies[REFRESH_COOKIE] ?? '';
  }
  return body ?? '';
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response, @RequestMeta() meta: { ip: string | null; userAgent: string | null }) {
    const result = await this.auth.login({ email: dto.email, password: dto.password, ip: meta.ip, userAgent: meta.userAgent });
    if (env.AUTH_MODE === 'cookie') {
      res.cookie(REFRESH_COOKIE, result.refreshToken, {
        httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax',
        path: '/api/v1/auth', domain: env.COOKIE_DOMAIN || undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return { ...result.user, accessToken: result.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response, @RequestMeta() meta: { ip: string | null; userAgent: string | null }) {
    const token = readRefreshToken(req, dto.refreshToken);
    const result = await this.auth.refresh(token, meta);
    if (env.AUTH_MODE === 'cookie') {
      res.cookie(REFRESH_COOKIE, result.refreshToken, {
        httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax',
        path: '/api/v1/auth', domain: env.COOKIE_DOMAIN || undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return { ...result.user, accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser() user: { sub: string }, @RequestMeta() meta: { ip: string | null; userAgent: string | null }) {
    const token = readRefreshToken(req, dto.refreshToken);
    await this.auth.logout(token, user?.sub ?? null, meta);
    if (env.AUTH_MODE === 'cookie') {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth', domain: env.COOKIE_DOMAIN || undefined });
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@CurrentUser() user: { sub: string }) {
    return this.auth.me(user.sub);
  }
}
```

Note: `AuthGuard('jwt')` requires a Passport JWT strategy (Task 12).

**Step 7:** Commit: `feat(phase-1): AuthService + AuthController (login, refresh, logout, me)`.

---

### Task 12: JWT strategy (Passport) + JwtAuthGuard

**Files:**
- Create: `src/modules/identity/auth/jwt.strategy.ts`
- Create: `src/modules/identity/auth/jwt-auth.guard.ts`

**Step 1:** jwt.strategy.ts:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { loadEnvConfig } from '../../../config/configuration';
import { PrismaService } from '../../../database/prisma.service';

const env = loadEnvConfig();

export interface JwtPayload {
  sub: string;
  email: string;
  roleCode: string;
  permissions: string[];
  unitScopes: string[];
  passwordMustChange: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.passwordMustChange) {
      // allow but flag in req.user; force-change is enforced at controller level
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, status: true } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Akun tidak aktif');
    return payload;
  }
}
```

**Step 2:** jwt-auth.guard.ts:

```typescript
import { AuthGuard } from '@nestjs/passport';
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Step 3:** Commit: `feat(phase-1): JwtStrategy + JwtAuthGuard for Passport auth`.

---

### Task 13: IdentityModule wiring (controllers, providers, exports)

**Files:**
- Create: `src/modules/identity/identity.module.ts`

**Step 1:** Implement identity.module.ts:

```typescript
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../../database/prisma.module';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { TokenService } from './auth/token.service';
import { PasswordService } from './auth/password.service';
import { SessionService } from './auth/session.service';
import { LoginThrottleService } from './auth/login-throttle.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { PermissionsService } from './rbac/permissions.service';
import { PermissionsGuard } from './rbac/permissions.guard';
import { UnitScopeGuard } from './rbac/unit-scope.guard';
import { AuditService } from './audit/audit.service';
import { loadEnvConfig } from '../../config/configuration';

const env = loadEnvConfig();

@Global()
@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({ secret: env.JWT_ACCESS_SECRET, signOptions: { expiresIn: env.JWT_ACCESS_TTL } }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, TokenService, PasswordService, SessionService, LoginThrottleService,
    JwtStrategy, PermissionsService, PermissionsGuard, UnitScopeGuard, AuditService,
    { provide: APP_GUARD, useClass: JwtAuthGuard ?? PermissionsGuard },
  ],
  exports: [AuthService, TokenService, PasswordService, SessionService, PermissionsService, AuditService],
})
export class IdentityModule {}
```

Note: import `JwtAuthGuard` from `./auth/jwt-auth.guard`. The default global guard is JwtAuthGuard; controllers opt-out with `@Public()` if implemented) or use a separate guard for routes that need public access (login, refresh).

Untuk sekarang, `me` endpoint already has `@UseGuards(AuthGuard('jwt'))`. Untuk `login` & `refresh` (public), butuh mekanisme skip. Pakai `@Public()` decorator + custom guard yang skip jika endpoint decorated `@Public()`.

Refactor jwt-auth.guard.ts:

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const IS_PUBLIC_KEY = 'auth.public';
import { SetMetadata } from '@nestjs/common';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }
  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    return super.canActivate(ctx);
  }
}
```

Update auth.controller.ts: tambahkan `@Public()` di `login` dan `refresh`.

**Step 2:** Commit: `feat(phase-1): IdentityModule wiring with global JwtAuthGuard + @Public`.

---

### Task 14: Auth e2e test (login + refresh + logout + me)

**Files:**
- Create: `test/auth.e2e-spec.ts`

**Step 1:** e2e test:

```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@test.local`;
  const password = 'Password123!Secret';
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const hash = await argon2.hash(password, { type: argon2.argon2id });
    userId = uuidv4();
    await prisma.user.create({
      data: { id: userId, email, name: 'E2E', passwordHash: hash, roleCode: 'EDITOR', status: 'ACTIVE', invitationAcceptedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('POST /auth/login returns accessToken + refreshToken', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.data.email).toBe(email);
  });

  it('GET /auth/me requires access token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('GET /auth/me returns user info with bearer token', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const accessToken = login.body.data.accessToken;
    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(me.body.data.email).toBe(email);
  });

  it('POST /auth/refresh returns new tokens', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const refreshToken = login.body.data.refreshToken;
    const refreshed = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);
    expect(refreshed.body.data.accessToken).toBeDefined();
    expect(refreshed.body.data.refreshToken).not.toBe(refreshToken);
  });

  it('POST /auth/refresh detects reuse and revokes chain', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const refreshToken = login.body.data.refreshToken;
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  });
});
```

**Step 2:** Run `npm run test:e2e -- auth.e2e` → ALL PASS (5 tests).

**Step 3:** Commit: `test(phase-1): auth e2e flow (login, me, refresh, reuse detection)`.

---

### Task 15: Change-password + Forgot-password + Reset-password

**Files:**
- Create: `src/modules/identity/auth/dto/change-password.dto.ts`
- Create: `src/modules/identity/auth/dto/forgot-password.dto.ts`
- Create: `src/modules/identity/auth/dto/reset-password.dto.ts`
- Modify: `src/modules/identity/auth/auth.service.ts`
- Modify: `src/modules/identity/auth/auth.controller.ts`
- Create: `prisma/schema.prisma` (tambah `PasswordResetToken` sudah ada di Phase 0 migration? Cek. Jika belum, tambah)

**Step 1:** Cek apakah `password_reset_tokens` table sudah ada di migration Phase 0. Jika belum, buat migrasi Phase 1.5.

Verify: `docker exec bemfsm-mysql mysql -ubemfsm -pbemfsm bemfsm -e "DESCRIBE password_reset_tokens;"`. Jika tidak ada, tambah ke schema.prisma:

```prisma
model PasswordResetToken {
  id         String   @id @db.Char(36)
  userId     String   @db.Char(36) @map("user_id")
  tokenHash  String   @db.Char(64) @map("token_hash")
  expiresAt  DateTime @map("expires_at")
  usedAt     DateTime? @map("used_at")
  createdAt  DateTime @default(now()) @map("created_at")
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_tokens")
}
```

Generate migration: `npm run prisma:migrate -- --name phase_1_password_reset`.

**Step 2:** Implement DTOs:

```typescript
// change-password.dto.ts
import { IsString, MinLength } from 'class-validator';
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}

// forgot-password.dto.ts
import { IsEmail } from 'class-validator';
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

// reset-password.dto.ts
import { IsString, MinLength } from 'class-validator';
export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}
```

**Step 3:** Extend auth.service.ts dengan method:

```typescript
async changePassword(userId: string, currentPassword: string, newPassword: string, meta: { ip: string | null; userAgent: string | null }): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('UNAUTHENTICATED', 'Tidak terautentikasi', 401);
  const ok = await this.password.verify(user.passwordHash, currentPassword);
  if (!ok) throw new AppError('UNAUTHENTICATED', 'Password saat ini salah', 401);

  const newHash = await this.password.hash(newPassword);
  await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash, passwordMustChange: false } });
  await this.session.revokeAll(userId); // revoke all sessions except current — implemented below
  // We don't track current session ID here; in practice revoke all is acceptable per spec.

  await this.audit.write({
    actorId: userId, action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE, resourceType: 'user',
    resourceId: userId, ip: meta.ip, userAgent: meta.userAgent,
  });
}

async forgotPassword(email: string, meta: { ip: string | null; userAgent: string | null }): Promise<void> {
  // Always return success (prevent email enumeration)
  const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await this.prisma.passwordResetToken.create({
    data: { id: uuidv4(), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  await this.audit.write({
    actorId: user.id, action: AUDIT_ACTIONS.USER_PASSWORD_RESET_REQUEST, resourceType: 'user',
    resourceId: user.id, ip: meta.ip, userAgent: meta.userAgent,
  });
  // MailService integration di-bind di controller; service emit event atau return token. Untuk simplicity, inject MailService:
  await this.mail.send({
    to: user.email,
    subject: 'Reset password BEM FSM',
    text: `Gunakan token berikut untuk reset password (berlaku 1 jam):\n\n${rawToken}\n\nAbaikan jika Anda tidak meminta reset.`,
  });
}

async resetPassword(rawToken: string, newPassword: string, meta: { ip: string | null; userAgent: string | null }): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError('VALIDATION_ERROR', 'Token tidak valid atau kadaluarsa', 400);
  }
  const newHash = await this.password.hash(newPassword);
  await this.prisma.$transaction([
    this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash: newHash, passwordMustChange: false } }),
    this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    this.prisma.refreshSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await this.audit.write({
    actorId: record.userId, action: AUDIT_ACTIONS.USER_PASSWORD_RESET, resourceType: 'user',
    resourceId: record.userId, ip: meta.ip, userAgent: meta.userAgent,
  });
}
```

Inject `MailService` ke AuthService constructor.

**Step 4:** Tambah endpoint ke auth.controller.ts:

```typescript
@Post('change-password')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: { sub: string }, @RequestMeta() meta: ...) {
  await this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword, meta);
}

@Public()
@Post('forgot-password')
@HttpCode(HttpStatus.NO_CONTENT)
@Throttle({ default: { limit: 3, ttl: 60_000 } })
async forgotPassword(@Body() dto: ForgotPasswordDto, @RequestMeta() meta: ...) {
  await this.auth.forgotPassword(dto.email, meta);
}

@Public()
@Post('reset-password')
@HttpCode(HttpStatus.NO_CONTENT)
@Throttle({ default: { limit: 5, ttl: 60_000 } })
async resetPassword(@Body() dto: ResetPasswordDto, @RequestMeta() meta: ...) {
  await this.auth.resetPassword(dto.token, dto.newPassword, meta);
}
```

**Step 5:** Test baru di auth.service.spec.ts untuk forgot/reset flow. Run → PASS.

**Step 6:** Commit: `feat(phase-1): change-password, forgot-password, reset-password endpoints`.

---

### Task 16: Users module (CRUD + last-super-admin guard)

**Files:**
- Create: `src/modules/identity/users/dto/create-user.dto.ts`
- Create: `src/modules/identity/users/dto/update-user.dto.ts`
- Create: `src/modules/identity/users/dto/list-users.dto.ts`
- Create: `src/modules/identity/users/dto/user-response.dto.ts`
- Create: `src/modules/identity/users/users.repository.ts`
- Create: `src/modules/identity/users/users.service.ts`
- Create: `src/modules/identity/users/users.service.spec.ts`
- Create: `src/modules/identity/users/users.controller.ts`

**Step 1:** DTOs (ringkas):

```typescript
// create-user.dto.ts
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRoleCode, UserStatus } from '@prisma/client';
export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() name!: string;
  @IsEnum(UserRoleCode) roleCode!: UserRoleCode;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
}

// update-user.dto.ts
import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRoleCode, UserStatus } from '@prisma/client';
export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(UserRoleCode) roleCode?: UserRoleCode;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsBoolean() passwordMustChange?: boolean;
}

// list-users.dto.ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserRoleCode, UserStatus } from '@prisma/client';
export class ListUsersDto {
  @IsOptional() page?: number;
  @IsOptional() pageSize?: number;
  @IsOptional() @IsEnum(UserRoleCode) roleCode?: UserRoleCode;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
}
```

**Step 2:** Implement users.service.ts dengan CRUD + last-super-admin guard:

```typescript
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly session: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async create(input: CreateUserDto, actorId: string, meta: RequestMeta) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (exists) throw new AppError('CONFLICT', 'Email sudah digunakan', 409);
    const tempPassword = crypto.randomBytes(18).toString('base64url');
    const hash = await this.password.hash(tempPassword);
    const user = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: hash,
        roleCode: input.roleCode,
        status: input.status ?? 'PENDING_INVITATION',
        passwordMustChange: true,
      },
    });
    await this.audit.write({ actorId, action: AUDIT_ACTIONS.USER_CREATED, resourceType: 'user', resourceId: user.id, afterJson: { email: user.email, roleCode: user.roleCode }, ip: meta.ip, userAgent: meta.userAgent });
    return { user, tempPassword };
  }

  async update(id: string, dto: UpdateUserDto, actorId: string, meta: RequestMeta) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new AppError('NOT_FOUND', 'User tidak ditemukan', 404);

    if (before.roleCode === 'SUPER_ADMIN' && (dto.roleCode !== undefined && dto.roleCode !== 'SUPER_ADMIN' || dto.status !== undefined && dto.status !== 'ACTIVE')) {
      const activeSuperAdmins = await this.prisma.user.count({ where: { roleCode: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: id } } });
      if (activeSuperAdmins === 0) throw new AppError('LAST_SUPER_ADMIN', 'Tidak dapat mengubah Super Admin terakhir', 401);
    }

    const updated = await this.prisma.user.update({ where: { id }, data: dto });
    if (dto.roleCode !== undefined || dto.status !== undefined) {
      await this.session.revokeAll(id);
    }
    await this.audit.write({
      actorId, action: AUDIT_ACTIONS.USER_UPDATED, resourceType: 'user', resourceId: id,
      beforeJson: { roleCode: before.roleCode, status: before.status, name: before.name },
      afterJson: { roleCode: updated.roleCode, status: updated.status, name: updated.name },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    return updated;
  }

  async delete(id: string, actorId: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('NOT_FOUND', 'User tidak ditemukan', 404);
    if (user.roleCode === 'SUPER_ADMIN') {
      const activeSuperAdmins = await this.prisma.user.count({ where: { roleCode: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: id } } });
      if (activeSuperAdmins === 0) throw new AppError('LAST_SUPER_ADMIN', 'Tidak dapat menghapus Super Admin terakhir', 401);
    }
    await this.session.revokeAll(id);
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'SUSPENDED' } });
    await this.audit.write({ actorId, action: AUDIT_ACTIONS.USER_DELETED, resourceType: 'user', resourceId: id, ip: meta.ip, userAgent: meta.userAgent });
  }

  async list(query: ListUsersDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where = {
      ...(query.roleCode ? { roleCode: query.roleCode } : {}),
      ...(query.status ? { status: query.status } : {}),
      deletedAt: null,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async revokeSessions(id: string, actorId: string, meta: RequestMeta) {
    await this.session.revokeAll(id);
    await this.audit.write({ actorId, action: AUDIT_ACTIONS.USER_REVOKE_SESSIONS, resourceType: 'user', resourceId: id, ip: meta.ip, userAgent: meta.userAgent });
  }
}
```

**Step 3:** users.controller.ts dengan `@Permissions()` dan `@UseGuards(PermissionsGuard)`:

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('users.read')
  async list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }

  @Post()
  @Permissions('users.create')
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: any, @RequestMeta() meta: any) {
    const { user, tempPassword } = await this.users.create(dto, actor.sub, meta);
    return { user, tempPassword };
  }

  @Patch(':id')
  @Permissions('users.update')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: any, @RequestMeta() meta: any) {
    return this.users.update(id, dto, actor.sub, meta);
  }

  @Delete(':id')
  @Permissions('users.delete')
  async remove(@Param('id') id: string, @CurrentUser() actor: any, @RequestMeta() meta: any) {
    await this.users.delete(id, actor.sub, meta);
  }

  @Post(':id/revoke-sessions')
  @Permissions('users.update')
  async revokeSessions(@Param('id') id: string, @CurrentUser() actor: any, @RequestMeta() meta: any) {
    await this.users.revokeSessions(id, actor.sub, meta);
  }
}
```

**Step 4:** Failing test untuk last-super-admin guard. Run → FAIL. Implement done. Run → PASS.

**Step 5:** Commit: `feat(phase-1): Users module CRUD + last-super-admin guard + revoke sessions`.

---

### Task 17: Invitations module

- Create: `src/modules/identity/invitations/invitations.service.ts`
- Create: `src/modules/identity/invitations/invitations.controller.ts`
- Create: `src/modules/identity/invitations/dto/create-invitation.dto.ts`
- Create: `src/modules/identity/invitations/dto/accept-invitation.dto.ts`

**Step 1:** invitations.service.ts — admin create invitation (POST) dan accept (POST). Generate token random → hash SHA256, simpan di `invitation_tokens.token_hash`. TTL 7 hari. Saat accept: lookup hash, jika valid create user dengan password pilihan atau reset.

```typescript
@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService, private readonly password: PasswordService, private readonly audit: AuditService, private readonly mail: MailService) {}

  async create(email: string, roleCode: UserRoleCode, name: string, actorId: string, meta: RequestMeta) {
    const exists = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) throw new AppError('CONFLICT', 'Email sudah terdaftar', 409);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const inv = await this.prisma.invitationToken.create({
      data: { id: uuidv4(), email: email.toLowerCase(), tokenHash, roleCode, name, expiresAt, invitedBy: actorId },
    });
    await this.audit.write({
      actorId, action: AUDIT_ACTIONS.INVITATION_CREATED, resourceType: 'invitation',
      resourceId: inv.id, afterJson: { email, roleCode }, ip: meta.ip, userAgent: meta.userAgent,
    });
    await this.mail.send({
      to: email, subject: 'Undangan BEM FSM CMS',
      text: `Anda diundang menjadi ${roleCode}. Daftar di: <link>?token=${rawToken}`,
    });
    return { id: inv.id, expiresAt };
  }

  async accept(rawToken: string, password: string, meta: RequestMeta) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const inv = await this.prisma.invitationToken.findUnique({ where: { tokenHash } });
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) throw new AppError('VALIDATION_ERROR', 'Token undangan tidak valid', 400);
    const hash = await this.password.hash(password);
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { id: uuidv4(), email: inv.email, name: inv.name, passwordHash: hash, roleCode: inv.roleCode, status: 'ACTIVE', invitationAcceptedAt: new Date() },
      });
      await tx.invitationToken.update({ where: { id: inv.id }, data: { usedAt: new Date() } });
      return newUser;
    });
    await this.audit.write({
      actorId: user.id, action: AUDIT_ACTIONS.INVITATION_ACCEPTED, resourceType: 'invitation',
      resourceId: inv.id, ip: meta.ip, userAgent: meta.userAgent,
    });
    return user;
  }
}
```

**Step 2:** Controller:

```typescript
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('users.invite')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(@Body() dto: CreateInvitationDto, @CurrentUser() actor: any, @RequestMeta() meta: any) {
    return this.invitations.create(dto.email, dto.roleCode, dto.name, actor.sub, meta);
  }

  @Public()
  @Post('accept')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async accept(@Body() dto: AcceptInvitationDto, @RequestMeta() meta: any) {
    return this.invitations.accept(dto.token, dto.password, meta);
  }
}
```

**Step 3:** DTOs (mirroring user create). Test: PASS. Commit: `feat(phase-1): Invitations module (create + accept with email)`.

---

### Task 18: User invitation e2e test

Create `test/invitations.e2e-spec.ts`:

- Super Admin login → create invitation
- (extract token from mail OR mock mail)
- Accept invitation with password → user created
- Login with new user → force change password (mustChange=true) → change → passwordMustChange=false

**Step 1:** E2E test. Run → PASS. Commit: `test(phase-1): invitation e2e flow`.

---

### Task 19: Last-super-admin e2e test

Create `test/last-super-admin.e2e-spec.ts`:

- Seed only 1 Super Admin
- Try to update role to EDITOR → expect 401 LAST_SUPER_ADMIN
- Try to delete → expect 401 LAST_SUPER_ADMIN
- Seed 2nd Super Admin → update first → expect 200

**Step 1:** E2E test. Run → PASS. Commit: `test(phase-1): last-super-admin protection e2e`.

---

### Task 20: Coverage verification + cleanup

**Step 1:** Run `npm run test:cov` → verify services ≥80% line coverage (target). Jika kurang, tambah test.

**Step 2:** Run `npm run lint` → fix warnings.

**Step 3:** Run `npm run typecheck` → must be clean.

**Step 4:** Run `npm run build` → must produce `dist/main.js`.

**Step 5:** Run `npm run test:e2e` → all 8 e2e tests (2 health + 5 auth + 1 invitation OR last-super-admin) pass.

**Step 6:** Commit: `chore(phase-1): cleanup, lint, coverage verified`.

---

### Task 21: Final E2E verification with curl

Boot server, verify all endpoints with curl:

```bash
node dist/main.js &
APP_PID=$!
sleep 4

# Login
curl -sX POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@bemfsm.id","password":"ChangeMe123!ChangeMe"}'

# /me with token
ACCESS=$(...)
curl -s http://localhost:3001/api/v1/auth/me -H "Authorization: Bearer $ACCESS"

# List users
curl -s http://localhost:3001/api/v1/users -H "Authorization: Bearer $ACCESS"

# Forgot password
curl -sX POST http://localhost:3001/api/v1/auth/forgot-password -H "Content-Type: application/json" -d '{"email":"admin@bemfsm.id"}'

kill $APP_PID
```

Document hasil di commit message.

**Step 1:** Run all curls. Document.
**Step 2:** Commit: `docs(phase-1): verify Phase 1 endpoints with curl`.

---

## Definition of Done (Phase 1)

- [ ] Semua migration Phase 1 ter-apply
- [ ] Seed roles + permissions + role_permissions idempotent
- [ ] Login → refresh → logout → me e2e PASS
- [ ] Change password, forgot/reset password implemented + tested
- [ ] User CRUD dengan last-super-admin protection
- [ ] Invitation flow (create → email → accept)
- [ ] Audit log ditulis untuk semua state-changing ops
- [ ] PermissionsGuard + @Permissions decorator aktif
- [ ] Unit test ≥80% line coverage untuk services
- [ ] E2E test ≥8 flow PASS
- [ ] Typecheck, lint, build clean
- [ ] Curl smoke test verified