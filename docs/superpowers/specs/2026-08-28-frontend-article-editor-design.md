# Frontend Article Editor Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan after the user approves this spec.

**Goal:** Replace the "Coming Soon" placeholder drawer for article editing in `/admin` with a full rich-text article editor that authors, schedules, features, archives, and restores revisions through the real backend API.

**Architecture:** A Tiptap-based rich-text editor inside the existing `EditorDrawer` shell for `kind: "news"`. All editor work runs client-side as a `"use client"` component; data fetched with SWR via the existing `apiFetch` client; mutations via `useSWRMutation`. Backend endpoints (per `prd.md` section 8.4) are the source of truth — no new backend code in this scope.

**Tech Stack:**
- Next.js 14.2.5 App Router (existing)
- React 18.3.1 (existing)
- Tiptap 3.30.5 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`)
- SWR 2.5.1 with `useSWRMutation` (already installed)
- `isomorphic-dompurify` for preview rendering (already installed)
- Existing `lib/api.ts`, `lib/hooks.ts`, `lib/types.ts`, `lib/placeholder.ts`
- Tailwind 3.4 (existing)

## Global Constraints (from PRD `prd.md`)

These constraints apply to every task below — values copied verbatim from the PRD:

- **Article states:** `DRAFT | SCHEDULED | PUBLISHED | ARCHIVED` (PRD line 374)
- **Visibility:** `PUBLIC | INTERNAL` (PRD line 377)
- **Excerpt max length:** 260 characters (PRD line 365)
- **Cover alt text wajib sebelum publish** (PRD line 371) — frontend must block publish button if empty
- **SCHEDULED** wajib `scheduledAt` di masa depan (PRD line 438); frontend must validate `scheduledAt > now`
- **PUBLISHED** wajib lolos validasi publish dan memiliki `publishedAt` (PRD line 439); frontend must validate before clicking publish
- **Allowed HTML tags** (PRD line 397–398): `p, br, h2, h3, strong, b, em, i, u, s, ul, ol, li, blockquote, a, img` with `href/target/rel` for links (https/http/mailto) and `rel="noopener noreferrer"` injected on external links
- **Inline image** sebaiknya berasal dari media endpoint sendiri (PRD line 405); external image URL can be rejected in production, so editor only inserts images after `/media` upload
- **Reading time** calculated server-side; frontend displays but does not compute
- **Slug** derived by backend from title; frontend displays read-only after first save
- **Featured toggle** is single-active (PRD line 442): backend transaction auto-unfeatures other articles — frontend just calls `POST /admin/articles/:id/feature` and refreshes
- **Optimistic-lock `version` integer** (PRD line 385) — frontend sends current version in `If-Match` header on `PATCH`; on `409` response show conflict toast
- **Revisions** are v1 requirement (PRD line 454–458), not optional — list and restore are in this scope
- **Soft delete** (PRD line 386): backend handles, frontend just calls `DELETE` and confirms
- **Audit log action vocabulary** (PRD line 551): `create, update, delete, restore, publish, unpublish, archive, feature, schedule` — UI exposes these in the editor

## What is Explicitly Out of Scope

- **Signed preview token UI** (PRD line 447): backend `POST /admin/articles/:id/preview-token` and a public preview route do not exist yet. Token signing helper (`token.service.ts:18`) exists but no route. **Deferred to a follow-up spec that adds backend route + frontend.**
- Real-time collaboration
- Autosave
- i18n of editor UI strings
- Organization unit editor (separate scope)
- User management module (separate scope)

## File Structure

### New files (5)

| File | Lines (est.) | Responsibility |
|---|---|---|
| `src/components/admin/ArticleEditor.tsx` | ~420 | Top-level editor for `kind: "news"` drawer: tab routing (Edit/Preview/Revisions), form state, footer actions, version-conflict handling |
| `src/components/admin/ArticleEditorToolbar.tsx` | ~140 | Tiptap toolbar: paragraph, H2/H3, bold/italic/underline/strikethrough, ordered/unordered list, blockquote, alignment, link, image-inserter |
| `src/components/admin/CoverImageField.tsx` | ~90 | File picker → POST `/media` with `variant=cover` → preview thumbnail + remove button. Used by ArticleEditor and reused later for units |
| `src/components/admin/ScheduleDialog.tsx` | ~90 | Modal for picking `scheduledAt` (must be future). Confirms with the time shown. Calls `POST /admin/articles/:id/schedule` |
| `src/components/admin/InlineImageDialog.tsx` | ~110 | File picker → POST `/media` with `variant=inline` → returns mediaId → inserts Tiptap Image node with that URL |

### Modified files (3)

| File | Change |
|---|---|
| `src/components/admin/AdminDashboard.tsx` | Replace `kind: "news"` branch of `EditorDrawer` with `<ArticleEditor>`; remove `ComingSoonNotice` for that path; add `feature` toggle handler; pass article id not name into drawer (`editing` is currently a string) |
| `src/lib/hooks.ts` | Add `useAdminArticle(id)`, `useAdminArticleRevisions(id)`, `useAdminArticleMutations()` |
| `src/lib/types.ts` | Add `ArticleRevision`, `ArticleCategory`, `Media` if not there |

### Dependencies (3 new)

```
@tiptap/react@^3.30.5
@tiptap/starter-kit@^3.30.5
@tiptap/extension-link@^3.30.5
```

Note: `@tiptap/extension-image` may be bundled inside `@tiptap/starter-kit` in v3 — verify with `npm ls @tiptap/extension-image` after install. If not bundled, add `@tiptap/extension-image` separately.

## Interfaces

### Component Props

```ts
// src/components/admin/ArticleEditor.tsx
type ArticleEditorProps = {
  articleId: string | null;   // null = new article (create flow)
  onClose: () => void;
  onSaved: (article: Article) => void;
};

// src/components/admin/CoverImageField.tsx
type CoverImageFieldProps = {
  value: { mediaId: string; url: string; alt: string | null } | null;
  onChange: (v: { mediaId: string; url: string; alt: string | null } | null) => void;
};

// src/components/admin/ScheduleDialog.tsx
type ScheduleDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (scheduledAt: Date) => void;
};

// src/components/admin/InlineImageDialog.tsx
type InlineImageDialogProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (media: { id: string; url: string; alt: string | null }) => void;
};
```

### Hook Signatures

```ts
// src/lib/hooks.ts (additions)
export function useAdminArticle(id: string | null): {
  article: Article | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
};

export function useAdminArticleRevisions(id: string | null): {
  revisions: ArticleRevision[];
  isLoading: boolean;
  error: Error | null;
};

export function useAdminArticleMutations(): {
  create: (input: CreateArticleInput) => Promise<Article>;
  update: (id: string, input: UpdateArticleInput, version: number) => Promise<Article>;
  publish: (id: string) => Promise<Article>;
  unpublish: (id: string) => Promise<Article>;
  schedule: (id: string, at: Date) => Promise<Article>;
  archive: (id: string) => Promise<Article>;
  unarchive: (id: string) => Promise<Article>;
  feature: (id: string) => Promise<Article>;
  remove: (id: string) => Promise<void>;
  restoreRevision: (articleId: string, revisionId: string) => Promise<Article>;
  uploadMedia: (file: File, variant: "cover" | "inline") => Promise<Media>;
};
```

### Type Additions (`src/lib/types.ts`)

```ts
export type ArticleCategory = {
  id: ID;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export type ArticleRevision = {
  id: ID;
  articleId: ID;
  version: number;
  createdAt: string;
  createdBy: { id: ID; name: string; email: string } | null;
  restoreSourceId: string | null;
};

export type Media = {
  id: ID;
  url: string;
  alt: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  variant: "cover" | "inline" | "avatar" | "gallery";
  createdAt: string;
};

export type CreateArticleInput = {
  title: string;
  excerpt?: string;
  content: string;
  coverMediaId?: string;
  categoryId?: string;
  visibility?: "PUBLIC" | "INTERNAL";
  coverAlt?: string;
};

export type UpdateArticleInput = Partial<CreateArticleInput> & {
  scheduledAt?: string;
};
```

## Data Flow

### Open editor

1. User clicks row in `NewsModule` → calls `onEdit(articleId)` → `AdminDashboard.openDrawer("news", articleId)`
2. `ArticleEditor` mounts with `articleId` prop
3. If `articleId === null` → empty form, "Tambah baru" header
4. If `articleId !== null` → `useAdminArticle(articleId)` fetches → form populates with `article.*` fields → header shows status badge + "Edit" label

### Save Draft

1. User edits any field
2. Local `form` state updates (no API call yet)
3. User clicks "Simpan Draft" button in footer
4. If `articleId === null` → `create()` mutation → on success: `onSaved(newArticle)` + `onClose()`
5. If `articleId !== null` → `update(id, form, article.version)` mutation
   - Success: SWR `mutate()` refreshes list + detail, toast "Disimpan", increment local version
   - `ApiClientError(409, ...)` → toast "Artikel diubah orang lain, silakan muat ulang" + close drawer
   - Other errors → inline error display

### Promote menu

Single split-button in footer: "Promosikan" with caret opens dropdown:
- **Publish Now** → `publish(id)` → toast "Dipublikasikan" → mutate list → badge updates to PUBLISHED
- **Jadwalkan** → opens `ScheduleDialog` → on confirm `schedule(id, at)` → toast "Dijadwalkan untuk <local date>" → badge → SCHEDULED
- **Kembalikan ke Draft** (visible only if status is PUBLISHED or SCHEDULED) → `unpublish(id)` → toast → DRAFT
- **Arsipkan** (visible only if status is PUBLISHED) → `archive(id)` → toast "Diarsipkan" → ARCHIVED
- **Pulihkan dari Arsip** (visible only if status is ARCHIVED) → `unarchive(id)` → toast → DRAFT

### Featured toggle

Header right-side button "Jadikan Berita Utama" / "Lepas dari Berita Utama" — visible at all times.
- Calls `feature(id)` → toast "Ditandai sebagai berita utama" / "Dihapus dari berita utama"
- Backend transaction handles unfeaturing other articles
- SWR `mutate()` refreshes list and detail

### Set Featured on Create

Newly created article cannot be featured in the same request (backend requires the article to exist first). After successful create, the featured toggle becomes available. No separate flow needed.

### Revisions tab

1. User clicks "Revisi" tab in `ArticleEditor`
2. `useAdminArticleRevisions(id)` fetches `GET /admin/articles/:id/revisions`
3. List shows: version number, datetime, author name (or "—"), restore-source indicator if any
4. Click "Pulihkan" on a row → confirmation modal → `restoreRevision(id, revisionId)` → toast "Revisi dipulihkan" → mutate detail + revisions

### Cover image inline upload

1. User clicks cover area → file picker (accepts image/*)
2. On file select: show local preview + spinner
3. `uploadMedia(file, "cover")` → returns `{ id, url, alt, ... }`
4. Form state: `coverMediaId = id`, `coverUrl = url` (display only)
5. User can edit coverAlt text inline below preview
6. User clicks "Ganti" → resets to step 1
7. User clicks "Hapus" → sets cover to `null`

### Inline image in Tiptap

1. User clicks image button in toolbar → `InlineImageDialog` opens
2. File picker → `uploadMedia(file, "inline")` → returns media
3. `editor.chain().focus().setImage({ src: media.url, alt: media.alt ?? "" }).run()`
4. Dialog closes

### Validation rules enforced client-side

| Action | Pre-conditions (block button + show reason) |
|---|---|
| Save Draft | `title.length >= 1` |
| Publish Now | `title.length >= 1` AND `content.length > 0` (after stripping HTML tags) AND `coverAlt.trim().length > 0` (PRD line 371) AND `excerpt.length <= 260` |
| Schedule | All Publish Now conditions AND `scheduledAt > now` |
| Feature | Always allowed (no preconditions) |
| Archive / Unarchive / Unpublish | Always allowed |

Validation messages in Indonesian (matching existing UI strings).

### Preview tab

Renders form state (not saved article) through `SafeHtml`:
- Title as `<h1>`
- Excerpt as `<p class="lead">`
- Cover image (if set)
- Cover alt
- Body sanitized through DOMPurify allowlist (same as `SafeHtml` component on the public article detail page)
- Reading time not shown in preview (server-computed on actual publish)

This is "what you'll see" preview, not the public route. Real signed preview token is out of scope per user decision.

## Error Handling

- **Network error**: button spinner clears, toast "Gagal menyimpan. Periksa koneksi Anda.", form state preserved
- **409 version conflict**: toast "Artikel diubah orang lain. Memuat ulang..." + auto-`mutate()` to fetch latest, close drawer
- **422 validation error** (publish without coverAlt, etc.): show inline error above footer with backend's `details` array if provided
- **401 unauthenticated**: redirect to `/admin/login` (existing behavior — drawer closes first)

## Testing

### Build verification

- `npm run build` exits 0 with zero TypeScript errors
- Bundle size delta acceptable (Tiptap ~200KB minified — verify with `npm run build` output)

### Functional smoke (manual via dev server)

Backend running on `localhost:3001`, frontend on `localhost:3000`. Log in to admin, navigate to Informasi module.

1. **Create**: Click "Tambah baru" → fill title "Test 1" → Simpan Draft → row appears in list with status DRAFT
2. **Edit**: Click "Test 1" row → drawer opens with form populated → add content "Hello world" → Simpan Draft → drawer stays open, no errors
3. **Publish validation**: Click "Promosikan → Publish Now" → blocked with message "Teks alternatif cover wajib diisi" (coverAlt empty)
4. **Cover upload**: Set cover image → coverAlt field appears → fill "Batu bata merah" → Publish Now → toast success, status badge → PUBLISHED
5. **Public appearance**: `curl -sI http://localhost:3000/informasi` → article slug listed in HTML
6. **Schedule**: Edit another article → Promote → Jadwalkan → pick tomorrow 09:00 → submit → status → SCHEDULED
7. **Schedule validation**: pick today's 09:00 (past) → button disabled with "Waktu harus di masa depan"
8. **Feature**: Click "Jadikan Berita Utama" on Test 1 → toast → row shows featured badge → previously featured article loses its badge (backend transaction)
9. **Archive**: Publish Test 1 → Promote → Arsipkan → status → ARCHIVED → row hidden from list (or shown with archived styling — match existing NewsModule behavior)
10. **Revisions**: With at least one published article having 2+ revisions → Revisions tab → list shows versions → click Pulihkan on old version → confirmation → toast → content reverts, version increments
11. **Conflict**: Open same article in two browser tabs → edit in tab A → save → edit in tab B → save → toast "Artikel diubah orang lain, silakan muat ulang"
12. **Excerpt length**: Type 270 chars in excerpt → publish blocked with "Maks 260 karakter"
13. **Tiptap inline image**: Insert image via toolbar → file upload → image renders in editor → switch to Preview tab → image renders there too

### Coverage matrix

| Endpoint | Frontend coverage |
|---|---|
| POST /admin/articles | ✓ Save Draft (create) |
| PATCH /admin/articles/:id | ✓ Save Draft (update) with If-Match |
| POST /admin/articles/:id/publish | ✓ Promote → Publish Now |
| POST /admin/articles/:id/unpublish | ✓ Promote → Kembalikan ke Draft |
| POST /admin/articles/:id/schedule | ✓ Promote → Jadwalkan |
| POST /admin/articles/:id/archive | ✓ Promote → Arsipkan |
| POST /admin/articles/:id/unarchive | ✓ Promote → Pulihkan dari Arsip |
| POST /admin/articles/:id/feature | ✓ Header featured toggle |
| DELETE /admin/articles/:id | ✓ Drawer "Hapus" button (existing) |
| GET /admin/articles/:id/revisions | ✓ Revisions tab |
| POST /admin/articles/:id/revisions/:id/restore | ✓ Revisions tab restore |
| POST /media (upload) | ✓ CoverImageField + InlineImageDialog |
| GET /public/article-categories | ✓ Category select options |

## Risks & Tradeoffs

- **Tiptap bundle size** ~200KB minified. Mitigation: lazy-load via `dynamic(() => import(...), { ssr: false })` if it bloats the main admin chunk. Decide after first build measurement.
- **Next.js + Tiptap SSR warning**: Tiptap cannot render in RSC. Confined to `"use client"` components. No regression risk since `EditorDrawer` is already client.
- **`@tiptap/extension-image` bundling**: v3 may bundle Image into StarterKit — verify before adding as separate dep.
- **Form state size**: large articles with many revisions may grow state. Not an issue at this scale (10s of articles), no optimization planned.
- **No optimistic UI**: explicit save matches user's mental model better for content authoring. Trade-off accepted.
- **Revisions UI minimal**: version number + datetime + restore button only. No diff view. Acceptable per PRD "v1 recommended" tier.

## Self-Review

- **Spec coverage**: PRD article CMS section lines 350–460 mapped to specific endpoints (see coverage matrix above).
- **Placeholder scan**: No "TBD" / "TODO" / "implement later" in the body — deferred items are explicitly listed in "Out of Scope".
- **Type consistency**: `CreateArticleInput` matches backend `CreateArticleDto` (title, excerpt, content, coverMediaId, categoryId, visibility, coverAlt). `UpdateArticleInput` extends with `scheduledAt`. `ArticleRevision` matches backend response shape (id, articleId, version, createdAt, createdBy, restoreSourceId).
- **Internal consistency**: Tiptap allowed features listed in toolbar match PRD allowlist. Validation rules cite PRD line numbers.
- **Scope check**: Single subsystem (article editor), single frontend app, testable in isolation. Appropriate for one implementation plan.
- **Ambiguity check**: "Cover alt wajib sebelum publish" interpreted as block-the-button-not-submit-validation, not as 422 from backend — matches PRD intent. Schedule "di masa depan" interpreted as `scheduledAt > Date.now() + 60s` (small buffer to avoid timezone edge cases).