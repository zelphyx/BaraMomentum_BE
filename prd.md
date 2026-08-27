# Product Requirements Document — Backend BEM FSM UNDIP 2026

| Atribut | Nilai |
|---|---|
| Produk | Backend CMS Website BEM FSM UNDIP 2026 — Kabinet Bara Momentum |
| Pasangan frontend | Next.js 14 App Router (`bem_fsm-undip-2026`) |
| Tech stack wajib | NestJS, TypeScript, MySQL 8 |
| Dokumen | PRD Backend v1.0 |
| Status | Siap masuk technical design dan implementasi |
| Bahasa API | English untuk identifier; Bahasa Indonesia untuk pesan UI bila relevan |
| Zona waktu bisnis | `Asia/Jakarta` |

---

## 1. Ringkasan Produk

Backend ini menjadi sumber data tunggal untuk website publik dan admin dashboard BEM FSM UNDIP 2026. Backend menggantikan data statis pada `src/data/organization.ts`, artikel pada `src/data/site.ts`, serta daftar tautan Instagram yang saat ini ditulis langsung di komponen frontend.

Sistem harus menyediakan:

1. Autentikasi admin aman.
2. Manajemen akun dan hak akses.
3. CRUD konten Instagram beserta highlight dan penempatan.
4. CRUD Biro, Bidang, dan Tim, termasuk strategi, program kerja, dan fungsionaris.
5. CMS informasi/berita lengkap dengan rich content, kategori, workflow publikasi, SEO, dan berita utama.
6. Upload dan pengelolaan media.
7. API publik cepat untuk halaman Next.js.
8. Audit trail seluruh perubahan administratif.
9. Dashboard metrics dan aktivitas terbaru.
10. Fondasi deployment, observability, backup, keamanan, dan testing.

Backend dirancang sebagai **modular monolith**. Bentuk ini cukup sederhana untuk tim kecil, tetapi domain tetap terpisah sehingga dapat dikembangkan dan diuji tanpa menjadi satu modul besar.

---

## 2. Latar Belakang dan Masalah

Frontend saat ini memiliki admin dashboard berbasis UI dan state lokal. Data publik masih statis:

- Unit organisasi berada di `src/data/organization.ts`.
- Artikel dan kategori berada di `src/data/site.ts`.
- Tautan Instagram berada di komponen `InstagramSection` dan `NewsInstagram`.
- Upload gambar hanya menghasilkan preview browser melalui `URL.createObjectURL`.
- Tombol simpan, hapus, pencarian, filter, highlight, dan status belum terhubung ke penyimpanan permanen.
- Tidak ada login, otorisasi, audit, versioning, scheduler, atau API publik.

Dampak kondisi tersebut:

- Perubahan konten membutuhkan edit kode dan deployment.
- Tidak ada pembagian tanggung jawab admin.
- Risiko perubahan atau penghapusan konten tidak dapat ditelusuri.
- Upload media tidak permanen.
- Status draf/terjadwal tidak berfungsi.
- Public page tidak otomatis mengikuti perubahan admin.

---

## 3. Tujuan

### 3.1 Tujuan produk

- Admin nonteknis mampu memperbarui konten tanpa mengubah kode.
- Perubahan yang dipublikasikan tampil di website publik secara konsisten.
- Super Admin mampu mengendalikan akun dan akses.
- Editor Konten mampu mengelola berita serta Instagram.
- Admin Bidang hanya mampu mengelola unit yang ditugaskan kepadanya.
- Semua perubahan penting tercatat dan dapat diaudit.
- API publik memiliki performa baik untuk pengguna mobile.

### 3.2 Sasaran terukur

- Respons API publik cached: p95 < 300 ms dari region deployment utama.
- Respons API admin non-upload: p95 < 500 ms pada beban normal.
- Availability target awal: 99,5% per bulan.
- Tidak ada endpoint admin yang dapat diakses tanpa autentikasi.
- Tidak ada konten rich text mentah yang dikirim ke publik tanpa sanitasi.
- 100% operasi create/update/delete administratif menghasilkan audit log.
- Backup MySQL otomatis harian dengan retensi minimal 14 hari.
- Restore drill berhasil dilakukan sebelum production launch.

### 3.3 Non-goals versi 1

- Social media auto-posting ke Instagram.
- Scraping caption atau gambar Instagram secara otomatis.
- Komentar publik pada artikel.
- Newsletter dan mailing list publik.
- Multi-organisasi atau multi-tenant.
- Aplikasi mobile native.
- Analytics skala besar atau data warehouse.
- Page builder umum untuk seluruh halaman website.

---

## 4. Persona dan Hak Akses

### 4.1 Super Admin

Kebutuhan:

- Mengelola semua pengguna.
- Mengakses semua modul.
- Menetapkan role dan unit scope.
- Mengaktifkan/nonaktifkan akun.
- Mengelola seluruh unit, artikel, kategori, Instagram, media, dan pengaturan.
- Melihat seluruh audit log.

### 4.2 Editor Konten

Kebutuhan:

- Membuat dan mengedit artikel.
- Mengelola kategori artikel.
- Mengelola konten Instagram.
- Mengunggah media terkait konten.
- Mengatur draf, jadwal, publikasi, dan highlight sesuai permission.
- Tidak dapat mengelola akun Super Admin.

### 4.3 Admin Bidang

Kebutuhan:

- Melihat daftar unit yang ditugaskan.
- Mengubah profil, strategi, program kerja, dan fungsionaris unit tersebut.
- Mengunggah logo/foto unit terkait.
- Tidak dapat mengubah unit lain, pengguna, atau pengaturan global.

### 4.4 Matriks permission

Gunakan permission granular, bukan pemeriksaan nama role langsung di controller.

| Permission | Super Admin | Editor Konten | Admin Bidang |
|---|:---:|:---:|:---:|
| `users.read` | Ya | Tidak | Tidak |
| `users.create` | Ya | Tidak | Tidak |
| `users.update` | Ya | Tidak | Tidak |
| `users.delete` | Ya | Tidak | Tidak |
| `articles.read` | Ya | Ya | Opsional |
| `articles.create` | Ya | Ya | Tidak |
| `articles.update` | Ya | Ya | Tidak |
| `articles.publish` | Ya | Ya* | Tidak |
| `articles.delete` | Ya | Ya* | Tidak |
| `categories.manage` | Ya | Ya* | Tidak |
| `instagram.manage` | Ya | Ya | Tidak |
| `units.read` | Ya | Ya | Scoped |
| `units.create` | Ya | Tidak | Tidak |
| `units.update` | Ya | Tidak | Scoped |
| `units.delete` | Ya | Tidak | Tidak |
| `media.upload` | Ya | Ya | Scoped |
| `media.delete` | Ya | Ya* | Scoped |
| `audit.read` | Ya | Tidak | Tidak |
| `settings.manage` | Ya | Tidak | Tidak |

`*` Dapat dipersempit lewat configuration/permission assignment. Admin Bidang harus diperiksa menggunakan assignment pada unit, bukan hanya role.

---

## 5. Ruang Lingkup Fungsional

## 5.1 Autentikasi dan sesi

### Fitur wajib

- Login menggunakan email dan password.
- Access token berumur pendek, rekomendasi 15 menit.
- Refresh token berumur maksimum 7 hari dan dirotasi setiap pemakaian.
- Refresh token disimpan sebagai hash di database.
- Logout sesi saat ini.
- Logout seluruh perangkat.
- Endpoint profil pengguna aktif (`me`).
- Lupa password melalui token sekali pakai.
- Reset password.
- Aktivasi akun/invitation untuk admin baru.
- Perubahan password oleh pengguna aktif.
- Pencatatan login berhasil/gagal dan `lastLoginAt`.
- Akun nonaktif langsung kehilangan akses dan seluruh refresh session dicabut.

### Strategi token frontend

Rekomendasi production:

- Access token dikirim melalui cookie `HttpOnly`, `Secure`, `SameSite=Lax` atau `Strict` bila frontend dan API berada pada parent domain yang sama.
- Refresh token berada pada cookie terpisah dengan path terbatas ke endpoint refresh.
- Jangan menyimpan refresh token di `localStorage`.
- Terapkan CSRF protection bila autentikasi menggunakan cookie lintas request mutasi.
- Alternatif bearer token hanya diterima bila deployment frontend/backend tidak memungkinkan cookie domain aman; keputusan harus didokumentasikan pada technical design.

### Aturan keamanan login

- Password minimum 12 karakter.
- Hash menggunakan Argon2id.
- Rate limit login: contoh 5 percobaan/menit/IP dan progressive lock per account.
- Pesan login gagal tidak boleh mengungkap apakah email terdaftar.
- Reset token disimpan dalam bentuk hash, sekali pakai, kedaluwarsa 30 menit.

---

## 5.2 Manajemen Pengguna

### Data pengguna

- Nama lengkap.
- Email unik dan case-insensitive.
- Password hash.
- Avatar opsional.
- Role.
- Status `ACTIVE`, `INACTIVE`, atau `INVITED`.
- Unit assignments untuk Admin Bidang.
- Waktu login terakhir.
- Waktu undangan dikirim/diterima.
- Creator dan updater.
- Timestamp create/update/delete.

### Operasi admin

- List dengan search, role filter, status filter, pagination, dan sorting.
- Detail pengguna.
- Buat pengguna dan kirim invitation.
- Ubah nama, role, status, avatar, serta unit assignments.
- Kirim ulang invitation.
- Nonaktifkan akun.
- Soft delete akun.
- Cabut semua session pengguna.

### Business rules

- Email harus unik.
- Super Admin tidak dapat menghapus atau menonaktifkan dirinya sendiri bila ia satu-satunya Super Admin aktif.
- Sistem wajib menyisakan minimal satu Super Admin aktif.
- Perubahan role dan status mencabut refresh sessions pengguna terdampak.
- Penghapusan pengguna tidak menghapus artikel/unit; relasi author tetap menggunakan nullable FK atau snapshot nama.

---

## 5.3 Manajemen Instagram

Backend tidak wajib memanggil Instagram Graph API pada v1. Konten berasal dari URL post/reel yang dimasukkan admin.

### Data

- Judul internal.
- URL Instagram canonical.
- Shortcode hasil parsing URL.
- Tipe konten opsional: `POST`, `REEL`, `CAROUSEL`, `UNKNOWN`.
- Status `DRAFT` atau `PUBLISHED`.
- Placement: `HOME`, `INFORMATION`, atau keduanya.
- Highlight per placement.
- Sort order per placement.
- Tanggal publikasi internal.
- Creator/updater dan timestamps.

### Parsing URL

Backend menerima pola resmi:

- `https://www.instagram.com/p/{shortcode}/`
- `https://www.instagram.com/reel/{shortcode}/`
- `https://instagram.com/p/{shortcode}`

Backend harus:

- Menolak hostname selain `instagram.com` atau `www.instagram.com`.
- Mengambil shortcode secara server-side.
- Menyimpan URL canonical.
- Menolak shortcode duplikat.
- Tidak mengambil HTML atau URL arbitrer dari server untuk mencegah SSRF.

### Business rules

- Maksimal 4 highlight aktif per placement.
- Toggle highlight kelima menghasilkan `409 CONFLICT` dengan kode `HIGHLIGHT_LIMIT_EXCEEDED`.
- Konten draf tidak boleh muncul pada public API.
- Sorting highlight dapat diubah bulk secara transaksional.
- Menghapus konten menggunakan soft delete.

---

## 5.4 Manajemen Biro, Bidang, dan Tim

### Data unit utama

- `slug` unik.
- `name`.
- `shortName`.
- `type`: `TEAM`, `BUREAU`, `DIVISION`.
- Logo media.
- Summary untuk kartu pada halaman `/bidang`.
- Description untuk bagian “Tentang unit / Peran dalam kabinet”.
- Status `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- Sort order untuk grid public.
- SEO title dan meta description opsional.
- Creator/updater dan timestamps.

### Arah strategis

- Satu unit memiliki banyak strategy items.
- Masing-masing berisi teks dan sort order.
- Create/update/delete/reorder harus dapat dikirim dalam satu update unit atau endpoint child khusus.

### Program kerja

Setiap program memiliki:

- Nama.
- Deskripsi.
- Jadwal atau schedule label opsional.
- Link eksternal opsional.
- Status opsional (`PLANNED`, `ACTIVE`, `COMPLETED`).
- Sort order.

### Fungsionaris

Setiap anggota memiliki:

- Nama lengkap.
- Jabatan/role display.
- Foto potret media.
- Alt text.
- Sort order.
- Opsional Instagram/LinkedIn URL bila dibutuhkan kemudian.
- Status aktif untuk memungkinkan hide tanpa delete.

### Operasi

- List/search/filter type/status/pagination.
- Detail berdasarkan UUID untuk admin.
- Public detail berdasarkan slug.
- Create/update/publish/archive/soft delete.
- Bulk reorder unit.
- CRUD/reorder strategies.
- CRUD/reorder programs.
- CRUD/reorder functionaries.
- Assign Admin Bidang ke satu atau beberapa unit.

### Business rules

- Slug lowercase kebab-case dan unik.
- Slug tidak boleh memakai reserved route: `admin`, `api`, `informasi`, `tentang`.
- Unit `PUBLISHED` wajib memiliki nama, short name, type, slug, logo, summary, dan description.
- Admin Bidang hanya dapat mengubah unit pada tabel assignment.
- Update nested children dilakukan dalam transaction agar urutan tidak setengah tersimpan.
- Media lama tidak langsung dihapus bila masih digunakan entity lain.

---

## 5.5 Manajemen Informasi dan Berita

### Kecocokan dengan frontend publik

Public page saat ini membutuhkan:

- Daftar kategori untuk filter.
- Artikel utama/pinned untuk banner besar.
- Tiga artikel terbaru selain berita utama.
- Grid artikel terbit dengan pagination.
- Detail artikel berdasarkan ID/slug.
- Judul, kategori, tanggal, gambar, excerpt, body, dan reading time.
- Artikel terkait berdasarkan kategori.
- Navigasi artikel sebelumnya/berikutnya.

Backend harus menyediakan semua data tersebut tanpa frontend menyusun dari data statis.

### Data artikel

- UUID internal.
- Slug unik dan stabil untuk URL public.
- Judul.
- Author FK dan `authorDisplayName` snapshot.
- Category FK.
- Excerpt maksimum 260 karakter.
- Cover media FK.
- Cover alt text wajib sebelum publish.
- Rich HTML body.
- Sanitized HTML body.
- Plain-text body atau search text untuk pencarian dan reading time.
- Meta title opsional.
- Meta description maksimum 160 karakter.
- Status `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`.
- Visibility `PUBLIC` atau `INTERNAL`.
- `isFeatured` untuk berita utama.
- `publishedAt`.
- `scheduledAt`.
- `readingTimeMinutes`.
- Creator/updater dan timestamps.
- Soft delete timestamp.
- Optional optimistic-lock `version` integer.

### Rich content

Editor frontend mendukung:

- Paragraph.
- H2/H3.
- Bold, italic, underline, strikethrough.
- Ordered dan unordered list.
- Blockquote.
- Alignment.
- Link.
- Inline image.

Backend wajib:

- Menerima HTML terbatas.
- Melakukan sanitasi menggunakan allowlist server-side.
- Menghapus `script`, inline event handler, iframe, object/embed, style berbahaya, dan URL protocol tidak aman.
- Mengizinkan tag minimum: `p`, `br`, `h2`, `h3`, `strong`, `b`, `em`, `i`, `u`, `s`, `ul`, `ol`, `li`, `blockquote`, `a`, `img`.
- Mengizinkan `href`, `target`, `rel` pada link dengan validasi protocol `https/http/mailto` sesuai kebutuhan.
- Menambahkan `rel="noopener noreferrer"` pada external link.
- Gambar inline sebaiknya berasal dari media endpoint sendiri; external image URL dapat ditolak pada production.
- Menghitung plain text, word count, dan reading time server-side. Rumus awal: `ceil(words / 200)`, minimum 1 menit.

### Kategori

Kategori seed awal:

- Kegiatan
- Prestasi
- Informasi
- Beasiswa
- Lomba

Data kategori:

- UUID.
- Nama unik.
- Slug unik.
- Color key atau visual token opsional.
- Sort order.
- Status aktif.

Aturan:

- Kategori yang masih dipakai artikel tidak dapat hard delete.
- Kategori dapat dinonaktifkan tetapi artikel lama tetap dapat dibaca.

### Workflow publikasi

- `DRAFT`: hanya API admin.
- `SCHEDULED`: wajib memiliki `scheduledAt` di masa depan.
- `PUBLISHED`: wajib lolos validasi publish dan memiliki `publishedAt`.
- `ARCHIVED`: tidak masuk list public, tetapi kebijakan detail URL dapat 404 atau redirect; pilih 404 pada v1.
- Scheduler mempublikasikan artikel due setiap menit menggunakan job idempotent.
- Menetapkan satu artikel sebagai featured otomatis menonaktifkan featured artikel lain dalam transaction.
- Hanya artikel `PUBLISHED`, `PUBLIC`, dan tidak dihapus yang muncul di public API.

### Preview draf

- Admin dapat meminta signed preview token berumur 15 menit.
- Frontend preview memakai endpoint khusus dengan token tersebut.
- Preview token hanya untuk satu artikel dan tidak membuka endpoint admin lain.

### Revision history

Direkomendasikan sebagai requirement v1 karena konten organisasi perlu pemulihan:

- Simpan snapshot sebelum update artikel published atau perubahan status.
- Admin dapat melihat revision list dan detail diff/snapshot.
- Restore membuat revision baru, bukan menghapus histori.
- Minimal simpan 20 revision terakhir per artikel atau tanpa batas dengan retention policy.

---

## 5.6 Media Library dan Upload

MySQL hanya menyimpan metadata; binary media disimpan di object storage.

### Provider

Gunakan adapter storage agar provider dapat diganti:

- Production: Cloudflare R2, AWS S3, atau S3-compatible storage.
- Development: MinIO melalui Docker Compose.

### Jenis media

- Logo unit.
- Foto fungsionaris.
- Cover artikel.
- Inline image artikel.
- Avatar admin.

### Alur upload

Pilihan sederhana v1:

1. Frontend mengirim `multipart/form-data` ke backend.
2. Backend validasi MIME, ukuran, dan signature/magic bytes.
3. Backend melakukan transformasi gambar.
4. Backend upload hasil ke object storage.
5. Metadata media disimpan di MySQL.
6. Backend mengembalikan object media.

Bila trafik meningkat, pindah ke presigned direct upload tanpa mengubah contract entity utama.

### Validasi

- Format: JPEG, PNG, WebP.
- Tolak SVG pada v1 untuk mencegah script injection.
- Cover artikel maksimum 8 MB sebelum transformasi.
- Logo/foto maksimum 5 MB.
- Generate WebP/AVIF bila pipeline dan CDN mendukung.
- Strip EXIF dan metadata lokasi.
- Cover target rasio 16:9; simpan original plus variant.
- Foto fungsionaris target 4:5.
- Logo mempertahankan transparansi dan aspect ratio.
- Gunakan UUID pada object key; jangan percaya nama file user.

### Media entity

- ID.
- Storage provider.
- Bucket.
- Object key.
- Original filename.
- MIME type.
- Byte size.
- Width/height.
- Checksum.
- Public URL atau CDN URL.
- Alt text opsional.
- Uploaded by.
- Created/deleted timestamps.

### Delete policy

- Entity delete hanya melepas relasi.
- Media yang masih direferensikan tidak dapat dihapus.
- Orphan cleanup job menghapus object tanpa referensi setelah grace period 7 hari.

---

## 5.7 Dashboard dan Aktivitas

Endpoint dashboard admin menyediakan:

- Jumlah konten published/draft/scheduled.
- Jumlah unit aktif.
- Jumlah admin aktif/nonaktif.
- Jumlah konten Instagram dan highlight.
- Aktivitas terbaru.
- Item perlu perhatian: scheduled gagal, draft lama, akun invited kedaluwarsa, media orphan, atau konten tanpa alt text.

Data harus dihitung dari database, bukan nilai hardcoded.

---

## 5.8 Audit Log

Semua mutasi admin dicatat:

- Actor user ID dan snapshot email/nama.
- Action: create, update, delete, restore, publish, unpublish, login, logout, role change.
- Resource type dan ID.
- Before/after JSON yang sudah membuang password, token, dan secret.
- IP address dan user agent.
- Correlation/request ID.
- Timestamp.

Audit log:

- Append-only dari aplikasi.
- Tidak memiliki endpoint delete umum.
- Hanya Super Admin dapat membaca.
- Mendukung filter actor, action, resource, dan rentang tanggal.

---

## 5.9 Pengaturan Situs

Scope minimum:

- Nama organisasi.
- Nama kabinet.
- Tagline.
- Email.
- Website URL.
- Instagram handle dan URL.
- YouTube URL.
- Maksimum highlight per placement, default 4.
- Default SEO title/description.

Gunakan typed setting atau tabel setting dengan schema validation. Secret tidak boleh disimpan melalui modul ini.

---

## 6. Arsitektur Teknis

## 6.1 Stack rekomendasi

- Node.js 22 LTS.
- NestJS versi stabil terbaru yang kompatibel saat implementasi.
- TypeScript strict mode.
- MySQL 8.0+ dengan `utf8mb4`.
- Prisma ORM dan Prisma Migrate.
- Swagger/OpenAPI melalui `@nestjs/swagger`.
- Validation menggunakan `class-validator` dan `class-transformer`.
- Auth menggunakan Passport JWT dan Argon2.
- Scheduler menggunakan `@nestjs/schedule` untuk deployment single instance.
- Queue menggunakan BullMQ + Redis direkomendasikan bila email, image processing, atau multi-instance diaktifkan.
- Logger structured menggunakan Pino.
- Image processing menggunakan Sharp.
- Sanitasi HTML menggunakan library server-side yang aktif dipelihara dan allowlist eksplisit.
- Testing menggunakan Jest, Supertest, dan test database MySQL.

### Keputusan ORM

PRD merekomendasikan **Prisma** karena:

- Schema dan migration jelas.
- Type-safe client cocok dengan NestJS/TypeScript.
- Transaction API cukup untuk nested CMS writes.
- Seed dan local development mudah.

TypeORM boleh dipilih hanya bila tim memiliki pengalaman lebih kuat dan keputusan dicatat dalam Architecture Decision Record.

## 6.2 Bentuk aplikasi

```text
src/
  main.ts
  app.module.ts
  common/
    decorators/
    filters/
    guards/
    interceptors/
    pipes/
    pagination/
    errors/
  config/
  database/
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
prisma/
  schema.prisma
  migrations/
  seed.ts
```

Setiap module minimal memiliki controller, service/use cases, DTO, repository/data access, policy/authorization, dan test. Controller tidak boleh berisi business logic.

## 6.3 API conventions

- Base URL: `/api/v1`.
- JSON menggunakan camelCase.
- Timestamp menggunakan ISO 8601 UTC, contoh `2026-08-27T06:30:00.000Z`.
- Backend menyimpan UTC; input/display menggunakan `Asia/Jakarta` pada business layer/frontend.
- ID menggunakan UUID v4 atau UUID v7. Pilih satu dan konsisten; UUID v7 direkomendasikan bila library stabil.
- Pagination admin: page-based.
- Public feed boleh page-based untuk kompatibilitas frontend saat ini.
- Sorting eksplisit melalui `sortBy` dan `sortOrder` allowlist.
- Unknown DTO property ditolak melalui global validation pipe (`whitelist: true`, `forbidNonWhitelisted: true`).
- API versioning melalui URI.

## 6.4 Format response

Single resource:

```json
{
  "data": {
    "id": "uuid",
    "title": "Judul"
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

Collection:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 42,
    "totalPages": 5,
    "requestId": "uuid"
  }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data tidak valid.",
    "fields": {
      "title": ["title should not be empty"]
    },
    "requestId": "uuid"
  }
}
```

Status code:

- `200` read/update/action berhasil.
- `201` create berhasil.
- `204` delete/logout tanpa body.
- `400` input/business state invalid.
- `401` unauthenticated.
- `403` authenticated tetapi tidak berhak.
- `404` resource tidak ada/tidak terlihat.
- `409` unique conflict, version conflict, highlight limit.
- `413` upload terlalu besar.
- `422` data syntactically benar tetapi gagal publish validation.
- `429` rate limit.

---

## 7. Model Data MySQL

Semua tabel memakai `id CHAR(36)` atau tipe UUID strategy yang dipilih, `created_at`, `updated_at`, dan bila relevan `deleted_at`. Gunakan FK, index, dan transaction. Nama berikut bersifat logical; final DDL di technical design.

## 7.1 Identity

### `users`

- `id` PK.
- `name VARCHAR(120)`.
- `email VARCHAR(191)` unique.
- `password_hash VARCHAR(255)` nullable saat invited.
- `avatar_media_id` nullable FK.
- `role_id` FK.
- `status ENUM('INVITED','ACTIVE','INACTIVE')`.
- `last_login_at DATETIME(3)` nullable.
- `invited_at`, `invitation_accepted_at` nullable.
- `created_by`, `updated_by` nullable FK user.
- timestamps dan soft delete.

Indexes: unique normalized email, role/status, deleted_at.

### `roles`

- `id`, `code` unique, `name`, `description`, `is_system`.

Seed: `SUPER_ADMIN`, `CONTENT_EDITOR`, `UNIT_ADMIN`.

### `permissions`

- `id`, `code` unique, `description`.

### `role_permissions`

- Composite unique `role_id`, `permission_id`.

### `user_unit_assignments`

- `user_id`, `organization_unit_id`.
- Composite unique.

### `refresh_sessions`

- `id`, `user_id`, `token_hash`.
- `user_agent`, `ip_address`.
- `expires_at`, `revoked_at`, `last_used_at`.
- `replaced_by_session_id` nullable.

### `password_reset_tokens` / `invitation_tokens`

- Token hash, user ID, expiry, consumed timestamp.

## 7.2 Organization

### `organization_units`

- `id`, `slug` unique, `name`, `short_name`.
- `type ENUM('TEAM','BUREAU','DIVISION')`.
- `logo_media_id` FK.
- `summary VARCHAR(500)`.
- `description TEXT`.
- `status ENUM('DRAFT','PUBLISHED','ARCHIVED')`.
- `sort_order INT`.
- SEO fields.
- audit timestamps/users dan soft delete.

### `unit_strategies`

- `id`, `organization_unit_id`, `content TEXT`, `sort_order INT`.
- Unique `(organization_unit_id, sort_order)` atau reorder transaction yang aman.

### `unit_programs`

- `id`, `organization_unit_id`, `name`, `description`, `schedule_label`, `external_url`, `status`, `sort_order`.

### `unit_members`

- `id`, `organization_unit_id`, `name`, `role`, `photo_media_id`, `photo_alt`, `sort_order`, `is_active`.

## 7.3 Articles

### `article_categories`

- `id`, `name`, `slug`, `color_key`, `sort_order`, `is_active`.

### `articles`

- Fields sesuai bagian 5.5.
- Unique slug.
- FK category, author, cover media.
- Index `(status, visibility, published_at)`.
- Index `(category_id, status, published_at)`.
- Index `is_featured`.
- Full-text index pada title/excerpt/search_text bila MySQL setup mendukung dan diperlukan.

### `article_revisions`

- `id`, `article_id`, `version`, `snapshot_json JSON`, `created_by`, `created_at`, `restore_source_id` nullable.
- Unique `(article_id, version)`.

## 7.4 Instagram

### `instagram_posts`

- `id`, `title`, `canonical_url`, `shortcode`, `content_type`, `status`, timestamps/users, soft delete.
- Unique shortcode.

### `instagram_placements`

- `id`, `instagram_post_id`.
- `placement ENUM('HOME','INFORMATION')`.
- `is_highlighted BOOLEAN`.
- `sort_order INT`.
- Unique `(instagram_post_id, placement)`.

## 7.5 Media dan sistem

### `media_assets`

Fields sesuai bagian 5.6.

### `audit_logs`

Fields sesuai bagian 5.8. Index actor/date, resource/date, action/date.

### `site_settings`

- `key` unique.
- `value_json JSON`.
- `type`.
- `updated_by`, timestamps.

### `scheduled_jobs` opsional

Hanya diperlukan bila job state tidak ditangani queue provider.

---

## 8. API Contract

Daftar endpoint berikut menjadi baseline. Semua endpoint admin membutuhkan autentikasi dan permission yang sesuai.

## 8.1 Auth

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Rotasi access/refresh token |
| POST | `/api/v1/auth/logout` | Cabut sesi saat ini |
| POST | `/api/v1/auth/logout-all` | Cabut semua sesi user |
| GET | `/api/v1/auth/me` | Profil, role, permissions, unit scopes |
| POST | `/api/v1/auth/forgot-password` | Kirim reset email |
| POST | `/api/v1/auth/reset-password` | Reset menggunakan token |
| POST | `/api/v1/auth/accept-invitation` | Aktifkan akun dan set password |
| PATCH | `/api/v1/auth/password` | Ubah password pengguna aktif |

## 8.2 Users

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v1/admin/users` | Search/filter/sort/pagination |
| POST | `/api/v1/admin/users` | Buat/invite admin |
| GET | `/api/v1/admin/users/:id` | Detail |
| PATCH | `/api/v1/admin/users/:id` | Ubah profil/role/status/scope |
| DELETE | `/api/v1/admin/users/:id` | Soft delete |
| POST | `/api/v1/admin/users/:id/resend-invitation` | Kirim ulang undangan |
| POST | `/api/v1/admin/users/:id/revoke-sessions` | Logout semua perangkat target |

Contoh create:

```json
{
  "name": "Nadia Putri",
  "email": "nadia@bemfsm.id",
  "roleCode": "CONTENT_EDITOR",
  "status": "INVITED",
  "organizationUnitIds": []
}
```

## 8.3 Organization units

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v1/admin/organization-units` | Admin list |
| POST | `/api/v1/admin/organization-units` | Create |
| GET | `/api/v1/admin/organization-units/:id` | Detail lengkap |
| PATCH | `/api/v1/admin/organization-units/:id` | Update utama/nested |
| DELETE | `/api/v1/admin/organization-units/:id` | Soft delete |
| POST | `/api/v1/admin/organization-units/:id/publish` | Publish |
| POST | `/api/v1/admin/organization-units/:id/archive` | Archive |
| PATCH | `/api/v1/admin/organization-units/reorder` | Bulk reorder |
| PUT | `/api/v1/admin/organization-units/:id/strategies` | Replace/reorder strategies |
| POST/PATCH/DELETE | `/api/v1/admin/organization-units/:id/programs[...]` | Program CRUD |
| POST/PATCH/DELETE | `/api/v1/admin/organization-units/:id/members[...]` | Member CRUD |

Payload create/update dapat menggunakan nested arrays agar form drawer menyimpan atomik:

```json
{
  "name": "Biro Kantor Media Informasi",
  "shortName": "KMI",
  "slug": "kmi",
  "type": "BUREAU",
  "logoMediaId": "uuid",
  "summary": "Pusat publikasi...",
  "description": "Biro KMI mengelola...",
  "status": "PUBLISHED",
  "strategies": [
    { "id": null, "content": "Mengelola media sosial...", "sortOrder": 0 }
  ],
  "programs": [
    { "name": "Nama Program", "description": "...", "scheduleLabel": "Maret–Juni", "sortOrder": 0 }
  ],
  "members": [
    { "name": "Nama", "role": "Kepala Biro", "photoMediaId": "uuid", "photoAlt": "...", "sortOrder": 0 }
  ]
}
```

## 8.4 Articles and categories

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v1/admin/articles` | Admin list/filter |
| POST | `/api/v1/admin/articles` | Create draft/article |
| GET | `/api/v1/admin/articles/:id` | Detail editor |
| PATCH | `/api/v1/admin/articles/:id` | Update |
| DELETE | `/api/v1/admin/articles/:id` | Soft delete |
| POST | `/api/v1/admin/articles/:id/publish` | Publish now |
| POST | `/api/v1/admin/articles/:id/schedule` | Schedule |
| POST | `/api/v1/admin/articles/:id/unpublish` | Kembali ke draft |
| POST | `/api/v1/admin/articles/:id/archive` | Archive |
| POST | `/api/v1/admin/articles/:id/feature` | Jadikan berita utama |
| GET | `/api/v1/admin/articles/:id/revisions` | List revisions |
| POST | `/api/v1/admin/articles/:id/revisions/:revisionId/restore` | Restore |
| POST | `/api/v1/admin/articles/:id/preview-token` | Signed preview |
| GET/POST/PATCH/DELETE | `/api/v1/admin/article-categories[...]` | Category CRUD |

Payload:

```json
{
  "title": "Peluncuran Program Strategis",
  "slug": "peluncuran-program-strategis",
  "authorDisplayName": "BEM FSM UNDIP",
  "categoryId": "uuid",
  "excerpt": "Ringkasan artikel...",
  "coverMediaId": "uuid",
  "coverAlt": "Peluncuran program strategis Kabinet Bara Momentum",
  "contentHtml": "<p>...</p><h2>...</h2>",
  "metaTitle": "Peluncuran Program Strategis | BEM FSM",
  "metaDescription": "...",
  "status": "DRAFT",
  "visibility": "PUBLIC",
  "isFeatured": false,
  "scheduledAt": null,
  "version": 1
}
```

## 8.5 Instagram

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v1/admin/instagram-posts` | List/filter |
| POST | `/api/v1/admin/instagram-posts` | Parse URL dan create |
| GET | `/api/v1/admin/instagram-posts/:id` | Detail |
| PATCH | `/api/v1/admin/instagram-posts/:id` | Update |
| DELETE | `/api/v1/admin/instagram-posts/:id` | Soft delete |
| PATCH | `/api/v1/admin/instagram-posts/:id/highlight` | Toggle highlight placement |
| PATCH | `/api/v1/admin/instagram-posts/reorder` | Bulk reorder |

## 8.6 Media

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/v1/admin/media` | Multipart upload |
| GET | `/api/v1/admin/media` | Media library |
| GET | `/api/v1/admin/media/:id` | Metadata |
| PATCH | `/api/v1/admin/media/:id` | Ubah alt text/metadata aman |
| DELETE | `/api/v1/admin/media/:id` | Delete jika tidak direferensikan |

Upload mengembalikan:

```json
{
  "data": {
    "id": "uuid",
    "url": "https://cdn.example.com/...webp",
    "mimeType": "image/webp",
    "width": 1600,
    "height": 900,
    "size": 182340,
    "variants": {
      "thumbnail": "https://cdn.example.com/...-thumb.webp"
    }
  }
}
```

## 8.7 Public API

Tidak membutuhkan auth. Terapkan rate limit, cache, dan hanya expose field yang diperlukan.

| Method | Endpoint | Kebutuhan frontend |
|---|---|---|
| GET | `/api/v1/public/bootstrap` | Settings ringkas, categories, optional homepage aggregates |
| GET | `/api/v1/public/organization-units` | Grid `/bidang` |
| GET | `/api/v1/public/organization-units/:slug` | Detail unit lengkap |
| GET | `/api/v1/public/articles` | Filter `category`, `page`, `limit`, search |
| GET | `/api/v1/public/articles/featured` | Banner utama + 3 recent |
| GET | `/api/v1/public/articles/:slug` | Detail + related + prev/next |
| GET | `/api/v1/public/article-categories` | Filter pills |
| GET | `/api/v1/public/instagram-posts` | Query `placement=HOME|INFORMATION`, highlight/order |
| GET | `/api/v1/public/settings` | Public site settings |

Contoh detail artikel:

```json
{
  "data": {
    "id": "uuid",
    "slug": "peluncuran-program-strategis",
    "title": "Peluncuran Program Strategis",
    "category": { "name": "Kegiatan", "slug": "kegiatan", "colorKey": "orange" },
    "publishedAt": "2026-06-28T03:00:00.000Z",
    "cover": { "url": "https://cdn...", "alt": "..." },
    "excerpt": "...",
    "contentHtml": "<p>...</p>",
    "readingTimeMinutes": 4,
    "author": { "name": "BEM FSM UNDIP" },
    "isFeatured": true,
    "related": [],
    "previous": null,
    "next": { "slug": "...", "title": "..." },
    "seo": { "title": "...", "description": "..." }
  }
}
```

## 8.8 Dashboard, audit, settings, health

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v1/admin/dashboard` | Metrics dan attention items |
| GET | `/api/v1/admin/audit-logs` | Filtered audit list |
| GET | `/api/v1/admin/settings` | Settings admin |
| PATCH | `/api/v1/admin/settings` | Update settings |
| GET | `/health/live` | Process alive |
| GET | `/health/ready` | DB/storage/required dependency ready |

---

## 9. Integrasi Frontend Next.js

## 9.1 Environment variables frontend

```text
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1
API_INTERNAL_BASE_URL=http://backend:3001/api/v1
NEXT_PUBLIC_MEDIA_BASE_URL=https://cdn.example.com
```

Secret tidak memakai prefix `NEXT_PUBLIC_`.

## 9.2 Data fetching public

- Gunakan server components/fetch server-side bila memungkinkan.
- List public dapat memakai Next.js revalidation.
- Backend mengembalikan `Cache-Control`, `ETag`, atau `Last-Modified`.
- Setelah admin publish/update, backend memanggil signed Next.js revalidation webhook atau frontend memakai short TTL.
- Rekomendasi: webhook revalidation per tag (`articles`, `article:{slug}`, `units`, `unit:{slug}`, `instagram:{placement}`).

## 9.3 Data fetching admin

- Ganti `initialUsers`, `initialPosts`, `ORGANIZATION_UNITS`, dan `ARTICLES` pada dashboard dengan API client.
- Gunakan TanStack Query atau SWR untuk cache, mutation, loading, retry, invalidation, dan optimistic UI.
- Form sebaiknya memakai React Hook Form + Zod.
- Rich-text editor production sebaiknya memakai TipTap/Lexical, bukan `document.execCommand` yang deprecated.
- Upload media dilakukan sebelum entity save; simpan `mediaId` pada payload.
- Hapus menampilkan confirmation dialog dan menangani `409` dependency conflict.
- Filter/search menggunakan query parameter dan debounce 300–500 ms.

## 9.4 Mapping data statis

| Frontend saat ini | Sumber baru |
|---|---|
| `ORGANIZATION_UNITS` | `/public/organization-units` |
| `ORGANIZATION_UNITS.find(slug)` | `/public/organization-units/:slug` |
| `ARTICLES` | `/public/articles` |
| `ARTICLES.find(id)` | `/public/articles/:slug` |
| `INFO_CATEGORIES` | `/public/article-categories` |
| `INSTAGRAM_POSTS` | `/public/instagram-posts?placement=...` |
| Admin arrays/state lokal | `/admin/*` endpoints |

## 9.5 Next Image

Tambahkan hostname CDN/object storage ke `next.config.js` `images.remotePatterns`. Backend harus mengembalikan URL HTTPS canonical.

---

## 10. Security Requirements

Wajib sebelum production:

1. TLS/HTTPS pada frontend, API, dan CDN.
2. CORS allowlist exact origin; jangan `*` untuk credentialed requests.
3. Helmet security headers.
4. Global validation pipe dengan unknown field rejection.
5. Argon2id password hashing.
6. JWT key/secret kuat dan rotatable.
7. Refresh token rotation dan reuse detection.
8. RBAC guard dan resource-scope policy.
9. Rate limiting berbeda untuk auth, public read, dan admin mutation.
10. CSRF protection bila memakai cookie auth.
11. HTML sanitization server-side.
12. File signature, MIME, extension, size, dan dimension validation.
13. Tolak SVG dan executable upload pada v1.
14. SQL injection dicegah via ORM parameterization; raw query harus direview.
15. SSRF dicegah pada Instagram URL dan external media retrieval.
16. Secrets hanya melalui environment/secret manager.
17. Log tidak boleh berisi password, token, cookie, reset token, atau raw authorization header.
18. Error production tidak mengekspos stack trace.
19. Soft delete dan confirmation pada destructive action.
20. Audit perubahan akses dan publikasi.
21. Dependency scanning dan lockfile committed.
22. Database user production memakai least privilege.
23. Object storage bucket tidak mengizinkan listing publik.
24. Backup terenkripsi dan akses backup dibatasi.

### Threat cases utama

- Admin Bidang mencoba update unit lain: `403`.
- Editor mencoba membuat Super Admin: `403`.
- User nonaktif memakai refresh token lama: `401`, sessions revoked.
- Rich text berisi `<script>` atau `onerror`: dibuang oleh sanitizer.
- Upload file `.jpg` berisi executable: ditolak berdasarkan magic bytes.
- URL Instagram menuju internal network/host palsu: ditolak sebelum network call; backend tidak fetch URL.
- Dua admin edit artikel bersamaan: version conflict `409`.

---

## 11. Performance, Caching, dan Reliability

### Public API

- Cache response list/detail published selama 60–300 detik pada CDN/reverse proxy.
- Gunakan ETag.
- Purge/invalidate saat publish, update, archive, delete, feature, atau reorder.
- Select field secukupnya; jangan mengirim audit/nested admin metadata.
- Hindari N+1 pada list unit/article.
- Pagination wajib pada list admin dan artikel publik.

### Database

- Index sesuai query filter dan sorting.
- Jalankan `EXPLAIN` pada query public feed/detail sebelum launch.
- Gunakan transaction untuk:
  - Set featured article.
  - Nested unit update.
  - Instagram highlight enforcement dan reorder.
  - Role/status update + session revoke.
- Connection pool dibatasi sesuai kapasitas MySQL dan deployment.

### Jobs

- Scheduled article publisher idempotent.
- Lock diperlukan pada multi-instance agar artikel tidak diproses ganda.
- Retry dengan exponential backoff untuk email/storage operation.
- Dead-letter handling bila memakai queue.

### Graceful behavior

- Storage gagal: entity tidak menyimpan media ID palsu.
- Email invitation gagal: user tetap `INVITED`, status pengiriman tercatat dan dapat resend.
- Cache/revalidation gagal: database commit tetap benar; retry asynchronous.

---

## 12. Observability

- Structured JSON logs.
- Request/correlation ID dari ingress atau dibuat backend.
- Log level configurable.
- Metrics minimum:
  - Request count/latency/error rate per route.
  - DB query latency/pool saturation.
  - Login failure count.
  - Upload failure count.
  - Scheduled publish success/failure.
  - Cache hit ratio bila tersedia.
- Error tracking: Sentry atau provider setara.
- Uptime check pada `/health/ready`.
- Alert bila 5xx meningkat, DB unavailable, storage unavailable, atau scheduled publish gagal berulang.

---

## 13. Testing Strategy

## 13.1 Unit tests

Wajib untuk:

- URL/shortcode Instagram parser.
- Article publish validator.
- HTML sanitizer policy.
- Reading time calculator.
- Slug generator/reserved slug validator.
- Highlight limit policy.
- Unit scope authorization.
- Session rotation/reuse detection.
- Featured article transaction logic.

## 13.2 Integration tests

Gunakan MySQL test database nyata atau container:

- Repository queries dan indexes.
- Nested unit transaction.
- Article publish/schedule transitions.
- Unique constraints.
- Soft delete visibility.
- Role and unit assignment.
- Media reference checking.

## 13.3 E2E tests

Minimal flows:

1. Login, refresh, logout.
2. Super Admin mengundang Editor.
3. Akun nonaktif ditolak.
4. Editor membuat draf, upload cover, publish artikel.
5. Artikel published muncul di public endpoint; draft tidak muncul.
6. Scheduled article muncul setelah due job.
7. Artikel featured lama otomatis unfeatured.
8. Admin Bidang mengubah unit assigned dan ditolak pada unit lain.
9. Tambah anggota beserta foto dan urutan.
10. Highlight Instagram kelima ditolak.
11. Rich text XSS dibersihkan.
12. Delete media referenced ditolak.

## 13.4 Contract tests

- OpenAPI schema menjadi contract backend/frontend.
- Generate TypeScript API types/client untuk frontend.
- CI gagal bila breaking change tidak disengaja.

### Coverage target

- Business/domain services: minimum 80% line coverage.
- Authorization dan security-critical code: 90%+ branch coverage.
- Coverage bukan pengganti flow E2E.

---

## 14. Development dan Deployment

## 14.1 Local development

Sediakan `docker-compose.yml` untuk:

- MySQL 8.
- MinIO.
- Mailpit.
- Redis bila queue dipakai.

Scripts minimum:

```text
start:dev
build
start:prod
lint
format
test
test:e2e
test:cov
prisma:generate
prisma:migrate
prisma:seed
```

## 14.2 Environment backend

```text
NODE_ENV=
PORT=3001
API_PREFIX=api/v1
FRONTEND_ORIGINS=
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_TTL=7d
COOKIE_DOMAIN=
STORAGE_PROVIDER=s3
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
CDN_BASE_URL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
REDIS_URL=
NEXT_REVALIDATE_URL=
NEXT_REVALIDATE_SECRET=
SENTRY_DSN=
TZ=Asia/Jakarta
```

Sediakan `.env.example` tanpa nilai secret.

## 14.3 CI pipeline

Urutan minimum:

1. Install dependency via lockfile.
2. Generate Prisma client.
3. Lint.
4. Type check.
5. Unit tests.
6. Integration/E2E tests dengan service MySQL.
7. Build.
8. Dependency/security audit.
9. Build container image.
10. Migration dry-run atau validation.

## 14.4 Production deployment

- Backend berjalan sebagai container atau managed Node runtime yang mendukung long-running NestJS process.
- MySQL menggunakan managed service bila anggaran memungkinkan.
- Object storage external dengan CDN.
- Migration dijalankan sebagai release job satu kali sebelum app rollout.
- Jangan menjalankan destructive schema sync otomatis.
- Gunakan rolling deployment dengan readiness check.
- Jika scheduler berjalan pada lebih dari satu instance, gunakan distributed lock atau queue worker terpisah.

## 14.5 Backup dan recovery

- Automated full backup harian.
- Point-in-time recovery bila provider mendukung.
- Retensi minimal 14 hari; rekomendasi 30 hari.
- Object storage versioning/lifecycle sesuai anggaran.
- Dokumentasikan restore runbook.
- Target awal RPO 24 jam, RTO 4 jam; tingkatkan bila kebutuhan organisasi berubah.

---

## 15. Migrasi dari Data Statis

### Tahap 1 — Seed struktur

- Import 12 unit dari `src/data/organization.ts`.
- Copy logo dari `public/images/LOGO BIROBIDTIM` ke object storage.
- Import strategies dengan urutan array.
- Program dan member kosong tetap valid sebagai draft content child.

### Tahap 2 — Seed artikel

- Import kategori awal.
- Import 10 artikel dari `src/data/site.ts`.
- Generate slug dari judul; simpan redirect mapping dari `/informasi/{id}` ke `/informasi/{slug}` atau pertahankan legacy ID lookup sementara.
- Migrasikan image eksternal ke object storage bila lisensi/penggunaan memungkinkan; jika tidak, simpan external URL hanya sebagai tahap transisi.
- Konversi plain paragraph content menjadi sanitized HTML `<p>`.
- Pertahankan pinned article sebagai featured.

### Tahap 3 — Seed Instagram

- Gabungkan dan deduplicate shortcode dari `InstagramSection` dan `NewsInstagram`.
- Buat placement HOME/INFORMATION sesuai penggunaan saat ini.
- Pertahankan urutan empat post.

### Tahap 4 — Cutover frontend

1. Tambahkan API client dan generated types.
2. Integrasikan admin auth.
3. Integrasikan media upload.
4. Ganti admin local state per modul.
5. Ganti public article feed/detail.
6. Ganti public organization grid/detail.
7. Ganti Instagram arrays.
8. Jalankan parallel comparison dengan data statis.
9. Aktifkan backend source melalui feature flag.
10. Hapus static source setelah masa stabilisasi.

### Rollback

- Pertahankan data statis satu release sebagai fallback read-only.
- Feature flag dapat mengembalikan public read ke static data bila API gagal saat cutover.
- Admin mutation tidak boleh berjalan ke dua source sekaligus.

---

## 16. Acceptance Criteria per Epic

## Epic A — Auth dan Users

- [ ] Admin dapat login dan logout.
- [ ] Refresh token berotasi dan token lama tidak dapat dipakai ulang.
- [ ] Super Admin dapat create, edit, nonaktifkan, dan soft delete admin.
- [ ] Invitation dan reset password memiliki expiry dan single use.
- [ ] Sistem tidak dapat kehilangan Super Admin aktif terakhir.
- [ ] Role/status change mencabut session.
- [ ] Admin tanpa permission menerima 403.

## Epic B — Organization Units

- [ ] Admin dapat CRUD unit dengan logo.
- [ ] Strategies, programs, dan members dapat tambah, edit, hapus, serta reorder.
- [ ] Setiap member dapat upload foto, nama, jabatan, alt text.
- [ ] Save nested form bersifat atomik.
- [ ] Public list/detail hanya menampilkan unit published.
- [ ] Design public tidak perlu berubah; shape API mencukupi data existing UI.
- [ ] Admin Bidang dibatasi ke assigned unit.

## Epic C — Articles

- [ ] Editor dapat membuat draf dengan seluruh field UI.
- [ ] Cover dan inline media dapat diunggah.
- [ ] HTML disanitasi dan XSS test lulus.
- [ ] Artikel dapat publish now, scheduled, unpublish, archive.
- [ ] Hanya satu berita utama aktif.
- [ ] Public API mendukung banner, list, filter kategori, pagination, detail, related, prev/next.
- [ ] Reading time dihitung server-side.
- [ ] Revision dapat dilihat dan dipulihkan.
- [ ] Draft preview memakai token terbatas.

## Epic D — Instagram

- [ ] URL valid menghasilkan shortcode canonical.
- [ ] URL non-Instagram ditolak.
- [ ] Placement HOME dan INFORMATION dapat diatur independen.
- [ ] Maksimum empat highlight per placement diterapkan server-side.
- [ ] Reorder tersimpan.
- [ ] Draf tidak muncul pada public API.

## Epic E — Media

- [ ] Upload memvalidasi signature, MIME, size, dan dimension.
- [ ] Gambar ditransformasi dan EXIF dibuang.
- [ ] Metadata tersimpan di MySQL dan file di object storage.
- [ ] Referenced media tidak dapat dihapus.
- [ ] CDN URL kompatibel dengan Next Image.

## Epic F — Operations

- [ ] Dashboard metrics berasal dari database.
- [ ] Semua mutasi penting menghasilkan audit log.
- [ ] Health checks digunakan oleh deployment.
- [ ] Backup dan restore test selesai.
- [ ] Build, migration, test, dan deploy berjalan melalui CI.

---

## 17. Delivery Plan

### Fase 0 — Foundation (2–3 hari)

- NestJS project, config validation, Prisma, MySQL, Docker Compose.
- Common response/error, request ID, logging, Swagger, health.
- CI baseline.

### Fase 1 — Identity (4–6 hari)

- Users, roles, permissions, auth, invitation/reset, session rotation.
- Guards, decorators, audit foundation.
- Frontend login/session integration.

### Fase 2 — Media (3–5 hari)

- Storage adapter, multipart upload, Sharp pipeline, media library.
- MinIO local dan S3-compatible production.

### Fase 3 — Organization CMS (5–7 hari)

- Unit CRUD dan nested child entities.
- Scope authorization.
- Public endpoints dan static seed.
- Frontend admin/public integration.

### Fase 4 — Article CMS (7–10 hari)

- Categories, articles, sanitizer, publishing workflow, scheduler.
- Featured, revision, preview, public feed/detail.
- Rich editor integration dan static migration.

### Fase 5 — Instagram dan Dashboard (3–5 hari)

- URL parsing, placement, highlight/reorder.
- Dashboard metrics dan attention items.
- Frontend integration.

### Fase 6 — Hardening dan Launch (4–7 hari)

- E2E/security/performance tests.
- Cache/revalidation.
- Observability, backups, runbooks.
- Staging UAT, migration rehearsal, production cutover.

Estimasi kasar satu backend engineer berpengalaman: **28–43 hari kerja**, bergantung pada kualitas infrastructure, email/storage provider, dan tingkat integrasi frontend. Estimasi bukan komitmen kontraktual; pecah lagi menjadi sprint setelah technical design.

---

## 18. Definition of Done

Sebuah story dianggap selesai bila:

- Requirement dan business rules terpenuhi.
- DTO validation dan authorization diterapkan.
- Unit/integration/E2E test relevan lulus.
- OpenAPI diperbarui.
- Migration dan rollback consideration tersedia.
- Audit log diterapkan untuk mutation.
- Error state frontend dapat ditangani melalui stable error code.
- Tidak ada secret atau sensitive data dalam log/repository.
- Code review selesai.
- Staging verification selesai.

Backend keseluruhan siap production bila seluruh acceptance criteria wajib terpenuhi, migration rehearsal berhasil, security checklist lulus, backup dapat dipulihkan, serta frontend admin dan public tidak lagi bergantung pada data statis untuk domain yang sudah dimigrasikan.

---

## 19. Open Questions Sebelum Implementasi

Keputusan berikut harus ditutup pada technical kickoff:

1. Domain production frontend dan API untuk strategi cookie/CORS.
2. Provider object storage: R2, S3, atau lainnya.
3. Provider email invitation/reset.
4. Apakah Editor Konten boleh publish/delete atau hanya submit draft.
5. Apakah artikel internal dibutuhkan pada v1 atau field visibility cukup disiapkan.
6. URL artikel final memakai slug atau mempertahankan ID. Rekomendasi: slug dengan legacy redirect.
7. Apakah revision history wajib tanpa batas atau retention 20 snapshot.
8. Apakah Redis/BullMQ tersedia. Bila tidak, scheduler hanya single instance pada v1.
9. Apakah gambar Unsplash awal boleh dimigrasikan atau harus diganti asset milik organisasi.
10. Siapa pemilik akun Super Admin bootstrap dan bagaimana secret awal diserahkan dengan aman.

---

## 20. Rekomendasi Keputusan Final

Untuk pasangan frontend ini, baseline paling tepat:

- NestJS modular monolith.
- Prisma + MySQL 8.
- REST API versioned `/api/v1` dengan OpenAPI-generated frontend types.
- Cookie-based JWT access + rotating refresh session.
- Argon2id.
- Permission-based RBAC plus per-unit scope.
- Cloudflare R2/S3-compatible media storage, MinIO lokal.
- Sanitized rich HTML untuk artikel.
- Scheduler idempotent untuk scheduled publish.
- Audit log append-only.
- Soft delete untuk content dan users.
- Next.js tag revalidation setelah mutation publik.
- TanStack Query + React Hook Form + Zod + TipTap/Lexical pada admin frontend saat integrasi backend dimulai.

Pilihan ini menjaga backend sederhana untuk operasional BEM, tetapi cukup aman, teruji, dan berkembang tanpa memaksa microservices yang tidak diperlukan.
