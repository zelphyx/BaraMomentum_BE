# BEM FSM UNDIP 2026 — Backend CMS

Backend API + CMS untuk website resmi **BEM FSM UNDIP 2026 — Kabinet Bara Momentum**.

Menggantikan data statis di [bemfsmundip2026_fe](https://example.com) dengan API dinamis (artikel, organisasi, Instagram, dashboard, dsb.), autentikasi admin, dan pipeline media.

---

## Tech Stack

| Layer        | Pilihan                                   |
| ------------ | ----------------------------------------- |
| Runtime      | Node.js 20.x LTS                          |
| Framework    | NestJS 10.x (modular monolith)            |
| Language     | TypeScript 5.x (strict, noUncheckedIndexedAccess) |
| ORM          | Prisma 5.x                                |
| Database     | MySQL 8 (CHAR(36) UUID v4)                |
| Auth         | JWT (access + refresh), Argon2id          |
| Storage      | S3-compatible (MinIO lokal, R2/S3 prod)   |
| Image        | Sharp                                     |
| Mail         | SMTP / Mailpit                            |
| Logger       | Pino (redacted)                           |
| Validation   | class-validator + class-transformer       |
| Throttle     | @nestjs/throttler                         |
| Docs         | Swagger / OpenAPI (`/api/v1/docs`)        |
| Tests        | Jest (unit + e2e)                         |

---

## Quick Start

### 1. Prasyarat

- Node.js ≥ 20
- Docker + Docker Compose

### 2. Salin env

```bash
cp .env.example .env
```

Generate secret minimal 32 char untuk JWT:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Isi ke `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PREVIEW_TOKEN_SECRET`, dan `BOOTSTRAP_SUPER_ADMIN_PASSWORD` (min 12 char).

### 3. Nyalakan dependency lokal

```bash
docker compose up -d mysql minio mailpit
```

(Tambah `redis` bila `REDIS_URL` diisi.)

### 4. Install & migrate

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 5. Seed Super Admin

```bash
npm run prisma:seed
```

Login awal:
- email: sesuai `BOOTSTRAP_SUPER_ADMIN_EMAIL`
- password: sesuai `BOOTSTRAP_SUPER_ADMIN_PASSWORD`
- sistem mewajibkan ganti password di login pertama (`passwordMustChange=true`).

### 6. Jalankan

```bash
npm run start:dev
```

Akses:
- API: <http://localhost:3001/api/v1>
- Swagger: <http://localhost:3001/api/v1/docs>
- Health: <http://localhost:3001/api/v1/health/live>

---

## Scripts

| Script                  | Fungsi                                  |
| ----------------------- | --------------------------------------- |
| `npm run start:dev`     | Nest dev mode (watch)                   |
| `npm run start:prod`    | Jalankan `dist/main.js`                 |
| `npm run build`         | Compile TypeScript                      |
| `npm run typecheck`     | `tsc --noEmit`                          |
| `npm run lint`          | ESLint (auto-fix)                       |
| `npm run format`        | Prettier                                |
| `npm test`              | Unit tests (Jest)                       |
| `npm run test:e2e`      | E2E tests (butuh MySQL hidup)           |
| `npm run prisma:migrate`| Buat & apply migrasi (dev)              |
| `npm run prisma:deploy` | Apply migrasi (prod/CI)                |
| `npm run prisma:seed`   | Jalankan seed bootstrap                 |
| `npm run prisma:studio` | Buka Prisma Studio                      |

---

## Arsitektur Singkat

```
src/
├── main.ts                 ← bootstrap (helmet, CORS, validation pipe, Swagger)
├── app.module.ts           ← root module
├── config/                 ← EnvConfig (class-validator), AuthMode/StorageProvider/NodeEnv
├── common/                 ← HttpExceptionFilter, RequestIdInterceptor, TransformInterceptor, AppError, pino logger
├── database/               ← PrismaService & PrismaModule
└── modules/
    └── health/             ← /health/live, /health/ready (cek DB)
```

Pattern per domain: `controller + service + repository + policy + dto`. Permission-based RBAC dengan scope per unit (`users.read.self`, `articles.publish.organization`, dsb.).

Detail lengkap ada di `docs/superpowers/specs/2026-08-27-backend-bem-fsm-design.md`.

---

## Response Envelope

Semua respons sukses dibungkus:

```json
{
  "data": { ... },
  "meta": {
    "requestId": "uuid-v4",
    "page": 1,
    "pageSize": 20,
    "total": 134
  }
}
```

Error respons:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Artikel tidak ditemukan",
    "details": [],
    "requestId": "uuid-v4"
  }
}
```

Header `X-Request-Id` selalu di-echo; buat sendiri jika ingin tracing dari client.

---

## Environment Variables

Lihat [`.env.example`](.env.example) untuk daftar lengkap. Wajib diisi untuk boot:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PREVIEW_TOKEN_SECRET` (semua ≥ 32 char)
- `BOOTSTRAP_SUPER_ADMIN_EMAIL`, `BOOTSTRAP_SUPER_ADMIN_PASSWORD`
- `S3_*`, `CDN_BASE_URL`
- `SMTP_*`, `MAIL_FROM`

---

## Roadmap Implementasi

Project ini dibagi per fase:

| Fase | Isi                                                                  |
| ---- | -------------------------------------------------------------------- |
| 0    | Foundation: env, logger, error, Prisma, health, bootstrap            |
| 1    | Identity: auth (JWT), users, sessions, RBAC, audit                  |
| 2    | Media: upload, Sharp pipeline, MinIO, galeri                        |
| 3    | Organization CMS: kabinet, departemen, program kerja                 |
| 4    | Article CMS: berita, pengumuman, kategori, tag                      |
| 5    | Instagram embed + Dashboard ringkasan                                |
| 6    | Hardening: rate limit lanjut, observability, perf audit             |

---

## Lisensi

UNLICENSED — internal BEM FSM UNDIP 2026.
