# Design Document — Backend BEM FSM UNDIP 2026

| Atribut | Nilai |
|---|---|
| Tanggal | 2026-08-27 |
| Status | Approved oleh user |
| Scope | Phase 0–5 fungsional, Phase 6 hardening basic |
| Tech stack | NestJS + TypeScript + MySQL 8 + Prisma |
| Referensi | PRD `bemfsmundip2026_be/prd.md` |
| Frontend | Next.js 14 App Router di `bemfsmundip2026_fe` |

---

## 1. Tujuan & Scope

Membangun backend NestJS modular monolith yang menjadi sumber data tunggal untuk website BEM FSM UNDIP 2026. Menggantikan data statis di `src/data/organization.ts`, `src/data/site.ts`, dan tautan Instagram hardcoded di komponen FE.

**In scope (Phase 0–5)**:
- Identity & permission (users, roles, auth, sessions, invitation, reset)
- Organization unit CMS (unit + strategies + programs + members)
- Article CMS (kategori, artikel, sanitizer, scheduler, revisions, preview)
- Instagram CMS (URL parsing, placement, highlight, reorder)
- Media library (upload, transform, EXIF strip, orphan cleanup)
- Dashboard metrics + attention items
- Audit log append-only
- Site settings (typed config)
- Health checks
- Public API + caching + Next.js revalidation webhook
- Seed script untuk migrasi data statis FE

**Out of scope (Phase 6 deferred/basic)**:
- Sentry/error tracking penuh (noop jika `SENTRY_DSN` kosong)
- Backup automation (hanya dokumentasi runbook)
- Full E2E test coverage (cuma 5–6 flow kritis)
- Distributed scheduler lock (single-instance cukup untuk v1)
- Object storage versioning
- Multi-tenant

---

## 2. Arsitektur & Module Layout

### 2.1 Pola

Modular monolith di NestJS. Tiap domain berdiri sendiri dengan susunan tetap:

```
src/modules/<domain>/
  controller.ts        # HTTP boundary, no business logic
  service.ts           # use cases, orchestrate repository + policy
  dto/                 # request/response, class-validator
  repository.ts        # typed Prisma access
  policy.ts            # permission + unit-scope checks
  jobs/                # cron handler jika ada (opsional)
  module.ts            # wiring + DI
```

### 2.2 Cross-cutting (`src/common/`)

- `GlobalValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- `HttpExceptionFilter`: format error `{ error: { code, message, fields?, requestId } }`
- `RequestIdInterceptor`: inject `X-Request-Id` ke response + Pino log field
- `TransformInterceptor`: wrap payload `{ data, meta: { requestId, ...pagination } }`
- `AuditInterceptor`: catat mutation admin (lihat Section 7)
- Pino logger dengan redaction paths: `*.password`, `*.token`, `*.refreshToken`, `headers.authorization`, `headers.cookie`
- Swagger di `/api/docs` (env-gated)
- `@nestjs/throttler` dengan multi-tier guards

### 2.3 Struktur folder target

```
src/
  main.ts
  app.module.ts
  common/
    decorators/        # @CurrentUser, @Permissions, @UnitScope, @RequestId
    filters/           # HttpExceptionFilter
    guards/            # JwtGuard, PermissionsGuard, UnitScopeGuard, CsrfGuard
    interceptors/      # RequestId, Transform, Audit
    pipes/             # GlobalValidationPipe
    pagination/        # PagePagination, CursorPagination helpers
    errors/            # AppError, ConflictError, NotFoundError, dll
  config/              # env validation via class-validator
  database/            # PrismaService
  modules/
    auth/
    users/
    roles/
    organization-units/
    articles/
    categories/
    instagram/
    media/
    dashboard/
    audit/
    settings/
    health/
  jobs/
    article-publisher/
    media-cleanup/
    revision-pruner/
    session-cleanup/
prisma/
  schema.prisma
  migrations/
  seed.ts
  seed-static.ts       # migrasi dari FE static data
```

---

## 3. Data Model

### 3.1 Keputusan global

- UUID v4 untuk semua PK, disimpan sebagai `CHAR(36)` di MySQL
- Timestamp `created_at`, `updated_at` di semua tabel; `deleted_at` (soft delete) di tabel content/user
- Collations: `utf8mb4_0900_ai_ci`
- Naming: snake_case untuk kolom DB, camelCase di Prisma client
- Enum disimpan sebagai string (Prisma native enum)
- Semua FK punya index; kolom sering difilter juga index
- Audit field: `created_by`, `updated_by` (FK nullable ke `users.id`)
- Composite unique: `role_permissions(role_id, permission_id)`, `user_unit_assignments(user_id, organization_unit_id)`, `instagram_placements(instagram_post_id, placement)`, `unit_strategies(organization_unit_id, sort_order)`

### 3.2 Entity ringkas (mapping ke PRD section 7)

**Identity**: `users`, `roles`, `permissions`, `role_permissions`, `user_unit_assignments`, `refresh_sessions`, `password_reset_tokens`, `invitation_tokens`

**Organization**: `organization_units`, `unit_strategies`, `unit_programs`, `unit_members`

**Articles**: `article_categories`, `articles`, `article_revisions`

**Instagram**: `instagram_posts`, `instagram_placements`

**Media & Sistem**: `media_assets`, `audit_logs`, `site_settings`

### 3.3 Index penting

- `articles`: `(status, visibility, published_at)`, `(category_id, status, published_at)`, `is_featured`, full-text `(title, excerpt, search_text)`
- `organization_units`: `(status, sort_order)`, `slug`, `deleted_at`
- `instagram_placements`: `(placement, sort_order)`, unique `(instagram_post_id, placement)`
- `media_assets`: `(deleted_at)`, `uploaded_by`
- `audit_logs`: `(actor_id, created_at)`, `(resource_type, resource_id, created_at)`, `(action, created_at)`

### 3.4 Migration & seed

- Migrasi: `prisma migrate dev` (lokal) → `prisma migrate deploy` (prod)
- Seed default (`prisma/seed.ts`):
  - 3 roles + ~30 permissions + role_permission mapping
  - 5 kategori artikel
  - Settings default (nama organisasi, kabinet, kontak, instagram)
  - Super Admin dari env `BOOTSTRAP_SUPER_ADMIN_EMAIL` + `BOOTSTRAP_SUPER_ADMIN_PASSWORD`, dengan flag `passwordMustChange`
- Seed static (`prisma/seed-static.ts`, script terpisah `npm run seed:static`):
  - Baca `bemfsmundip2026_fe/src/data/organization.ts` → upsert 12 unit + strategies
  - Upload logo dari `bemfsmundip2026_fe/public/images/LOGO BIROBIDTIM/*` ke MinIO
  - Baca `bemfsmundip2026_fe/src/data/site.ts` → upsert 10 artikel + kategori mapping
  - Baca Instagram dari `InstagramSection` & `NewsInstagram` (inspeksi runtime)

---

## 4. Auth & Permission Model

### 4.1 Token strategy

- **Access token**: JWT HS256, TTL 15 menit (`JWT_ACCESS_TTL`), payload `{ sub, email, roleCode, permissions, unitScopes, passwordMustChange }`. Secret dari env `JWT_ACCESS_SECRET`.
- **Refresh token**: opaque random 32 byte → SHA-256 hex → simpan di `refresh_sessions.token_hash`. TTL 7 hari (`JWT_REFRESH_TTL`). Rotasi tiap pakai: insert new + update `replaced_by_session_id` + set `revoked_at` pada yang lama.
- **Reuse detection**: jika token yang sudah `revoked_at` dipakai → revoke seluruh chain via `replaced_by_session_id` linked list → audit log ALERT.
- **Cookie vs bearer**: configurable via `AUTH_MODE=cookie|bearer`. Default cookie untuk konsistensi dengan FE Next.js. Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, path `/api/v1/auth`.

### 4.2 Password

- Minimum 12 karakter (validation di DTO)
- Argon2id dengan parameter dari `argon2` package defaults (memoryCost 19MB, timeCost 2, parallelism 1) — tuned untuk ~50ms hash pada CPU modern. Konfigurasi dapat di-override via env `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM` untuk tuning security vs performance.
- Tidak boleh sama dengan email/nama
- Pesan login gagal generik ("Email atau password salah") — tidak bocorin apakah email terdaftar

### 4.3 Throttling

- Login: 5 percobaan/menit/IP, progressive lock per account (15 menit setelah 10 gagal berurutan)
- Forgot password: 3/menit/IP
- Admin mutation: 60/menit/user
- Public read: 300/menit/IP

### 4.4 Permission guard

Decorator `@Permissions('articles.publish', 'articles.delete')` di controller method. `PermissionsGuard` baca dari `request.user.permissions` (di-inject saat JWT verify). Tidak ada role-name check di controller.

### 4.5 Unit-scope guard

Decorator `@UnitScope('organizationUnitIds')` baca body field. `UnitScopeGuard` cross-check dengan `user_unit_assignments` user. Digunakan untuk endpoint `units.update`, `media.upload` (jika scoped), `media.delete`.

### 4.6 Last Super Admin protection

Sebelum update role/status/delete user dengan role `SUPER_ADMIN`: hitung jumlah Super Admin aktif lain. Jika 0 dan operasi akan meninggalkan 0 → `409 LAST_SUPER_ADMIN`.

### 4.7 Session revocation triggers

- User soft-deleted → semua session `revoked_at = now()`
- Role/status change pada user → revoke all session user tersebut
- Password change → revoke all session kecuali yang sedang dipakai
- "Logout all devices" → revoke all session

---

## 5. Storage & Media Pipeline

### 5.1 Adapter

```ts
abstract class StorageProvider {
  put(key: string, buffer: Buffer, mime: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<{ size: number; mime: string } | null>;
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
}
```

Implementasi:
- `S3StorageProvider`: pakai `@aws-sdk/client-s3`. MinIO dev kompatibel via `S3_ENDPOINT`. Prod R2/S3 pakai region & credential.
- `LocalStorageProvider`: fallback jika tidak ada S3 config — simpan di `./uploads/`, serve via `/uploads/` static (dev only).

Pilihan provider via env `STORAGE_PROVIDER=s3|local`.

### 5.2 Upload flow

1. Multer `MemoryStorage` terima `multipart/form-data` (max 10MB per PRD + buffer)
2. Validasi: magic bytes via `file-type`, MIME check, size check, dimension probe via `sharp().metadata()`
3. Tentukan variant dari context field (`cover` → 16:9 1600x900, `logo` → preserve, `photo` → 4:5 800x1000)
4. Sharp pipeline:
   - Rotate EXIF (`sharp().rotate()`)
   - Resize sesuai variant
   - Strip metadata (`withMetadata({})` atau `.keepExif()` false)
   - Encode WebP quality 82
   - Untuk logo: simpan PNG asli (preserve transparency) + WebP fallback
5. Generate UUID-based object key: `{type}/{yyyy}/{mm}/{uuid}.{ext}`
6. Upload ke storage → dapat URL
7. Insert `media_assets` row dengan `width`, `height`, `checksum` (SHA-256), `variants` JSON
8. Return `MediaResponseDTO`

### 5.3 Limits

| Tipe | Maks size | Format | Output |
|---|---|---|---|
| Cover | 8 MB | JPEG/PNG/WebP | 16:9 1600x900 WebP |
| Logo | 5 MB | JPEG/PNG/WebP | preserve PNG + WebP fallback |
| Foto anggota | 5 MB | JPEG/PNG/WebP | 4:5 800x1000 WebP |
| Inline image | 5 MB | JPEG/PNG/WebP | max-width 1200 WebP |
| Avatar | 2 MB | JPEG/PNG/WebP | 1:1 256x256 WebP |

SVG ditolak di v1 (security policy).

### 5.4 Delete policy

`DELETE /media/:id`:
1. Query reference count dari `articles`, `organization_units`, `unit_members`, `users`
2. Jika > 0 → `409 MEDIA_IN_USE`
3. Else → `deleted_at = now()`, hapus physical object setelah 7 hari via cleanup job

### 5.5 Orphan cleanup job

Cron harian (jalankan 02:00 WIB = 19:00 UTC previous day; `TZ=Asia/Jakarta` di container):
- Cari `media_assets` dengan `deleted_at < now() - 7 days` AND reference count = 0
- Hapus object dari storage
- Hard delete row
- Log ke Pino level info dengan count processed

### 5.6 Revisions pruning

Cron harian (03:00 WIB = 19:00 UTC previous day):
- Per artikel, jika revision count > 20, hapus yang paling lama (FIFO)
- Keep minimum 5 revision terakhir walau sudah lewat retensi

---

## 6. Article CMS

### 6.1 States & transitions

```
DRAFT ──publish──▶ PUBLISHED
  │                  │
  ├──schedule──▶ SCHEDULED ──(cron)──▶ PUBLISHED
  │                  │
  └──archive───▶ ARCHIVED ◀──unpublish── PUBLISHED
```

Validasi:
- DRAFT → SCHEDULED: `scheduled_at` wajib & > now
- DRAFT/SCHEDULED → PUBLISHED: `published_at` wajib, `cover_alt` wajib, `category_id` wajib, `author_id` wajib
- PUBLISHED → ARCHIVED: tidak perlu validasi tambahan
- ARCHIVED → DRAFT: `unarchive` operation
- Hanya `PUBLISHED + PUBLIC + deleted_at null` yang muncul di public API

### 6.2 Workflow implementation

- Setiap transition lewat `ArticleService.transition(article, target)` dengan guards sesuai target state
- Validasi di service layer, return error dengan kode spesifik (`MISSING_COVER_ALT`, `MISSING_CATEGORY`, `SCHEDULED_AT_INVALID`, `VERSION_CONFLICT`)
- Featured transaction: `prisma.$transaction([update target set is_featured=true], [update others is_featured=false where is_featured=true])`

### 6.3 Sanitizer

Allowlist tags: `p, br, h2, h3, strong, b, em, i, u, s, ul, ol, li, blockquote, a, img`
Allowlist attrs:
- `a`: `href` (protocol `https|http|mailto`), `target`, `rel`
- `img`: `src` (CDN domain check), `alt`, `width`, `height`

Strip:
- `script`, `style`, `iframe`, `object`, `embed`, `form`
- Semua event handler `on*`
- `style` attribute
- `javascript:` protocol
- Inline image dari domain di luar `INLINE_IMAGE_ALLOWED_DOMAINS` (env comma-separated, default = CDN base URL)

Transform:
- External `<a>` link → force `rel="noopener noreferrer"`, tambah `target="_blank"`
- Hitung `search_text` (plain text) via strip tags
- Hitung `word_count` dan `reading_time_minutes = max(1, ceil(words / 200))`

Library: `sanitize-html` (well-maintained, allowlist-driven).

### 6.4 Revisions

- Sebelum update artikel (termasuk status change): insert row `article_revisions` dengan full snapshot JSON `{ ...entity, beforeImage: '...' }`
- Retention: cron harian hapus revisions lama jika per-artikel count > 20 (keep newest 20)
- Restore: ambil revision, apply fields ke entity baru, simpan sebagai revision baru (tidak overwrite histori)
- Endpoint: `GET /admin/articles/:id/revisions` (list), `POST /admin/articles/:id/revisions/:revisionId/restore` (action)

### 6.5 Preview token

- `POST /admin/articles/:id/preview-token` → return `{ token, expiresAt }`
- Token = JWT scoped `{ articleId, scope: 'preview' }`, TTL 15 menit, secret `PREVIEW_TOKEN_SECRET` (terpisah dari access token)
- `GET /public/articles/preview?token=...` → lookup article, return same shape as detail (sanitized content)
- Tidak expose endpoint admin lain

### 6.6 Optimistic locking

- Field `version INT` di articles, default 1, increment tiap successful update
- PATCH **wajib** membawa header `If-Match: <version>` (jika tidak → `400 IF_MATCH_REQUIRED`)
- Backend compare dengan `current.version`:
  - Match → update dengan `version: current.version + 1`
  - Mismatch → `409 VERSION_CONFLICT` dengan body `{ currentVersion }` agar FE bisa refresh
- Endpoint tanpa header `If-Match` (backward compat) tidak diizinkan; DTO validation enforce presence

---

## 7. Public API & Frontend Integration

### 7.1 Endpoints (no auth)

| Method | Endpoint | Cache |
|---|---|---|
| GET | `/api/v1/public/bootstrap` | `s-maxage=600` |
| GET | `/api/v1/public/organization-units` | `s-maxage=300` |
| GET | `/api/v1/public/organization-units/:slug` | `s-maxage=600` |
| GET | `/api/v1/public/articles` | `s-maxage=120` |
| GET | `/api/v1/public/articles/featured` | `s-maxage=120` |
| GET | `/api/v1/public/articles/:slug` | `s-maxage=300` |
| GET | `/api/v1/public/article-categories` | `s-maxage=600` |
| GET | `/api/v1/public/instagram-posts` | `s-maxage=180` |
| GET | `/api/v1/public/settings` | `s-maxage=600` |

### 7.2 Headers

- `Cache-Control: public, max-age=<X>, s-maxage=<Y>` sesuai tabel
- `ETag`: hash dari response body (weak ETag OK)
- `Last-Modified`: dari `updated_at` entity
- `Vary: Accept-Encoding` selalu

### 7.3 Revalidation webhook

Trigger setelah mutation admin pada:
- Article publish/update/unpublish/archive/feature/delete
- Unit publish/update/archive/delete/reorder
- Instagram create/update/delete/highlight/reorder

Payload ke `NEXT_REVALIDATE_URL`:
```json
{
  "tags": ["articles", "article:peluncuran-program-strategis", "units", "instagram:HOME"],
  "timestamp": "2026-08-27T08:30:00.000Z"
}
```

Header `X-Webhook-Signature: sha256=<HMAC_SHA256(body, NEXT_REVALIDATE_SECRET)>`.

Retry: 3x exponential backoff (1s, 4s, 16s). Jika gagal semua → audit log + dead-letter di `failed_webhooks` table (opsional, minimal: log ke Pino level error).

### 7.4 CORS

- `origin`: whitelist dari env `FRONTEND_ORIGINS` (comma-separated)
- `credentials`: true hanya jika `AUTH_MODE=cookie`
- `allowedHeaders`: `Content-Type, Authorization, X-Request-Id, If-Match`
- `exposedHeaders`: `X-Request-Id, ETag`

### 7.5 Rate limit

| Bucket | Limit |
|---|---|
| Auth (login, refresh, forgot, reset) | 5/menit/IP |
| Admin mutation | 60/menit/user |
| Public read | 300/menit/IP |

Override per-route via decorator `@Throttle({ default: { limit: 10, ttl: 60000 } })`.

---

## 8. Security & Audit

### 8.1 Helmet

Default + `crossOriginResourcePolicy: 'cross-origin'` (untuk image CDN Next.js Image).
Disable `contentSecurityPolicy` (FE yang handle, bukan API).

### 8.2 CSRF

Double-submit cookie pattern — **hanya aktif jika `AUTH_MODE=cookie`** (no-op jika bearer):
- Login response set cookie `csrf_token` (SameSite=Strict, bukan HttpOnly)
- FE ambil dari cookie dan kirim sebagai header `X-CSRF-Token`
- Backend verify: cookie value === header value (constant-time compare)

### 8.3 Audit log

Setiap admin mutation (POST/PATCH/DELETE/PUT selain health/docs) → `AuditInterceptor` capture:
- `actor_id`, `actor_email_snapshot`
- `action`: `CREATE | UPDATE | DELETE | RESTORE | PUBLISH | UNPUBLISH | ARCHIVE | LOGIN | LOGOUT | ROLE_CHANGE | STATUS_CHANGE | LOGIN_FAILED`
- `resource_type`, `resource_id`
- `before_json`, `after_json` (redacted)
- `ip`, `user_agent`
- `request_id`
- `created_at`

Redaction config: paths `*.password`, `*.passwordHash`, `*.token`, `*.tokenHash`, `*.refreshToken`, `*.secret`, `headers.authorization`, `headers.cookie`. Sebelum simpan, JSON di-traverse dan field matching di-replace dengan `"[REDACTED]"`.

Append-only: tidak ada endpoint delete. Retention policy: keep 365 hari, lalu archive ke tabel `audit_logs_archive` (job bulanan).

### 8.4 Production error

`HttpExceptionFilter`:
- Jika `NODE_ENV=production` → return `{ code, message, requestId }` saja, tidak ada stack
- Jika development → return `{ code, message, stack, requestId }`

### 8.5 Sentry

Jika `SENTRY_DSN` set → register di `main.ts` dengan environment tag, release tag dari `package.json`. Jika tidak → noop.

---

## 9. Observability

### 9.1 Logging

- Pino logger JSON ke stdout
- Fields: `level, time, requestId, userId, method, url, status, latency, error?`
- Redaction: lihat 4.1 (token) dan 8.3 (password/secret)

### 9.2 Metrics (basic)

Tambah di Prometheus format jika `METRICS_ENABLED=true`:
- `http_requests_total{method,route,status}`
- `http_request_duration_seconds{method,route}`
- `login_failures_total`
- `upload_failures_total`
- `scheduled_publish_total{status}`

Endpoint `/metrics` (env-gated).

### 9.3 Health

- `/health/live`: return 200 jika process alive (selalu)
- `/health/ready`: cek DB ping (`SELECT 1`), storage ping (`storage.head(key probe)`), SMTP (jika dikonfigurasi), Redis (jika dikonfigurasi). Return 503 jika ada yang down.

---

## 10. Testing

### 10.1 Unit tests (target: 80% line untuk services)

Critical paths:
- `InstagramUrlParser.parse(url)` → shortcode + contentType
- `HtmlSanitizer.sanitize(html)` → expected output untuk XSS samples
- `ReadingTimeCalculator.compute(text)`
- `SlugGenerator.generate(title)` + reserved-slug check
- `HighlightLimitPolicy.canHighlight(currentHighlights, newPlacement)`
- `UnitScopePolicy.canAccess(userScopes, targetUnitId)`
- `SessionRotator.rotate(oldToken)` + reuse detection
- `FeaturedArticleService.setFeatured(articleId)` transaction logic

### 10.2 Integration tests

Test MySQL via docker-compose.test.yml. Suite:
- Repository query correctness
- Nested unit update transaction (atomicity)
- Article publish/schedule state transitions
- Unique constraint violations
- Soft delete visibility filter
- Role & unit assignment CRUD
- Media reference counting

### 10.3 E2E tests (minimal 6 flow)

1. Login → refresh → logout (rotasi + revocation)
2. Super Admin invite Editor → Editor accept invitation → login
3. Editor create draft → upload cover → publish
4. Scheduled article dipublish otomatis oleh cron (manual trigger di test)
5. Admin Bidang update unit assigned OK, unit lain → 403
6. Instagram highlight ke-5 → 409 HIGHLIGHT_LIMIT_EXCEEDED

Tambahan bonus (jika waktu memungkinkan): XSS injection di artikel body disanitasi, delete media referenced → 409.

### 10.4 Coverage target

- Business services: minimum 80% line
- Auth/policy/guards: minimum 90% branch
- Test bukan jaminan; flow E2E menutupi jalur utama

---

## 11. Deployment & Infrastructure

### 11.1 Docker Compose (dev)

Services:
- `mysql:8.0` (port 3306, volume)
- `minio` (ports 9000/9001, console di 9001)
- `mailpit` (ports 1025/8025)
- `redis` (opsional, profile `with-queue`)
- `backend` (NestJS dev server, depends_on semua)

### 11.2 Scripts (`package.json`)

```json
{
  "scripts": {
    "start:dev": "nest start --watch",
    "build": "nest build",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "format": "prettier --write \"{src,test}/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:seed": "prisma db seed",
    "seed:static": "ts-node prisma/seed-static.ts"
  }
}
```

### 11.3 CI (GitHub Actions atau local script)

Order:
1. `npm ci`
2. `npm run prisma:generate`
3. `npm run lint`
4. `npm run build` (typecheck via tsc)
5. `npm run test`
6. `docker compose -f docker-compose.test.yml up -d && npm run test:e2e`
7. `npm audit --omit=dev --audit-level=high`

### 11.4 Environment

`backend/.env.example`:
```env
NODE_ENV=development
PORT=3001
API_PREFIX=api/v1

# CORS
FRONTEND_ORIGINS=http://localhost:3000
AUTH_MODE=cookie
COOKIE_DOMAIN=localhost

# Database
DATABASE_URL=mysql://root:root@localhost:3306/bemfsm

# JWT
JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_TTL=7d
PREVIEW_TOKEN_SECRET=

# Storage
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=bemfsm-media
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
CDN_BASE_URL=http://localhost:9000/bemfsm-media

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
LOG_LEVEL=info
METRICS_ENABLED=false

# Bootstrap
BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@bemfsm.id
BOOTSTRAP_SUPER_ADMIN_PASSWORD=ChangeMe123!ChangeMe

TZ=Asia/Jakarta
```

### 11.5 Backup (out of code, runbook)

- MySQL: `mysqldump` harian via cron host, retensi 14 hari di filesystem + 30 hari di S3
- Object storage: versioning enabled di bucket prod
- Restore runbook: dokumentasikan step-by-step di `docs/runbooks/backup-restore.md`

---

## 12. Migration dari Data Statis FE

### 12.1 Tahap eksekusi (script `prisma/seed-static.ts`)

1. **Unit** — baca `bemfsmundip2026_fe/src/data/organization.ts`:
   - Untuk tiap entry: extract name, shortName, slug, type (mapping TEAM/BUREAU/DIVISION)
   - Upload logo dari `bemfsmundip2026_fe/public/images/LOGO BIROBIDTIM/{shortName}.{ext}` ke storage → set `logo_media_id`
   - Insert strategies sebagai nested array
   - status = `PUBLISHED`
2. **Artikel** — baca `bemfsmundip2026_fe/src/data/site.ts`:
   - Generate slug dari title
   - Excerpt: potong content plain text ke 260 char
   - Wrap content di `<p>{plainText}</p>`
   - Category: map via name heuristic (Kegiatan/Prestasi/Informasi/Beasiswa/Lomba)
   - Cover: upload jika local file di FE; jika external URL Unsplash → simpan sebagai external (TODO replacement)
3. **Instagram** — inspect runtime:
   - Cari `src/components/home/InstagramSection` & `src/components/informasi/NewsInstagram`
   - Extract URL Instagram, parse shortcode
   - Set placement sesuai penggunaan (HOME untuk home section, INFORMATION untuk news section)

### 12.2 Cutover (out of scope sesi ini)

FE ganti import → API client di session terpisah. Backend sediakan:
- Generated OpenAPI schema di `/api/docs-json`
- TypeScript types generator (FE side) dari OpenAPI
- Mapping table di PRD section 9.4

---

## 13. Keputusan Open Questions (PRD section 19)

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Domain production + cookie/CORS strategy | Configurable via env `COOKIE_DOMAIN`, `FRONTEND_ORIGINS`, `AUTH_MODE` |
| 2 | Storage provider | MinIO dev, S3-compatible prod (R2/S3 interchangeable via adapter) |
| 3 | Email provider | Mailpit dev, SMTP prod via `SMTP_*` env |
| 4 | Editor publish/delete permission | ON by default sesuai tabel PRD, configurable per-user |
| 5 | Internal articles v1 | Field `visibility` siap, full UI di v2 |
| 6 | Article URL | Slug, legacy redirect via mapping table `id→slug` |
| 7 | Revision retention | 20 snapshot per artikel, cron prune |
| 8 | Redis/BullMQ | Opsional, fallback single-instance scheduler |
| 9 | Unsplash migration | External URL disimpan, TODO replacement organization asset |
| 10 | Super Admin bootstrap | Env `BOOTSTRAP_SUPER_ADMIN_*`, wajib ganti password first login |

---

## 14. Definition of Done (per Phase)

**Phase 0 (Foundation)**:
- [ ] NestJS bootstrap, config validation, Pino logger
- [ ] Prisma schema + migration + seed dasar (roles, permissions, kategori, settings, super admin)
- [ ] Docker Compose jalan MySQL+MinIO+Mailpit
- [ ] Global pipes/filters/interceptors/guards skeleton
- [ ] Health check live + ready
- [ ] Swagger di /api/docs
- [ ] .env.example lengkap

**Phase 1 (Identity)**:
- [ ] Login/logout/refresh/me/forgot/reset/invite/accept
- [ ] User CRUD admin (list, create, update, delete, resend invite, revoke sessions)
- [ ] Role & permission seed, guard berfungsi
- [ ] Unit-scope guard untuk Super Admin (Admin Bidang di scope di Phase 3)
- [ ] Audit log infrastructure (interceptor + entity)
- [ ] Unit test core: session rotation, permission check

**Phase 2 (Media)**:
- [ ] Storage adapter (S3 + local fallback)
- [ ] Upload endpoint dengan magic byte + size + dimension validation
- [ ] Sharp pipeline: WebP variants, EXIF strip
- [ ] Media library list/get/patch/delete dengan reference check
- [ ] Orphan cleanup job

**Phase 3 (Organization CMS)**:
- [ ] Unit CRUD + nested (strategies/programs/members) atomik dalam transaction
- [ ] Bulk reorder
- [ ] Public endpoint `/organization-units` + `/organization-units/:slug`
- [ ] Admin Bidang scope enforcement
- [ ] Unit test: scope policy, transaction atomicity

**Phase 4 (Article CMS)**:
- [ ] Kategori CRUD
- [ ] Artikel CRUD + draft/publish/schedule/archive/unpublish/feature
- [ ] Sanitizer + reading time
- [ ] Scheduler cron publish due articles
- [ ] Featured transaction
- [ ] Revisions list + restore
- [ ] Preview token
- [ ] Public endpoint list/featured/detail
- [ ] Revalidation webhook trigger

**Phase 5 (Instagram + Dashboard + Audit UI)**:
- [ ] Instagram post CRUD + URL parser + placement/highlight/reorder
- [ ] Highlight limit enforcement (409)
- [ ] Public endpoint `/instagram-posts?placement=`
- [ ] Dashboard metrics endpoint
- [ ] Audit log list endpoint (filter + pagination)
- [ ] Site settings CRUD

**Phase 6 (Hardening basic)**:
- [ ] E2E test untuk 6 flow kritis
- [ ] Security checklist review
- [ ] Helmet + CORS + CSRF verified
- [ ] Backup runbook documented
- [ ] CI pipeline berjalan (lint + test + build)
- [ ] Seed static dari FE berfungsi end-to-end

---

## 15. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Scope terlalu besar untuk 1 sesi | Decomposisi per phase; Phase 6 (hardening) basic only; fokus ke functional core |
| Sharp pipeline komplex (variant generation) | Mulai dengan single variant per type, tambah variants di iterasi berikutnya |
| FE static data struktur mungkin berubah | Parser tolerant dengan default fallback untuk field missing |
| Sanitizer XSS regression | Test dengan OWASP XSS Cheat Sheet samples |
| Cron job double-fire di multi-instance | Single-instance deployment documented; distributed lock jadi Phase 6 advanced (deferred) |
| Storage failure saat upload | Try/catch, jangan save media_id jika upload gagal, return 503 |
| Email failure saat invite | User tetap `INVITED`, log ke audit, admin bisa resend |

---

## 16. Out of Scope Eksplisit

- Social media auto-posting ke Instagram (PRD 3.3)
- Scraping caption/gambar Instagram otomatis (PRD 3.3)
- Komentar publik artikel (PRD 3.3)
- Newsletter/mailling list (PRD 3.3)
- Multi-organisasi/multi-tenant (PRD 3.3)
- Aplikasi mobile native (PRD 3.3)
- Analytics skala besar / data warehouse (PRD 3.3)
- Page builder umum (PRD 3.3)
- Auto-post IG, scraping (PRD 3.3)
- Sentry/error tracking penuh (basic noop cukup untuk v1)
- Backup automation script (runbook manual)
- Distributed scheduler lock (single-instance)

---

**Status**: APPROVED. Lanjut ke writing-plans skill untuk implementasi.
