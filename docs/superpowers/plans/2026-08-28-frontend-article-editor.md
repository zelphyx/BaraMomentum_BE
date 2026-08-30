# Frontend Article Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Coming Soon" placeholder drawer for article editing in `/admin` with a full rich-text article editor that authors, schedules, features, archives, and restores revisions through the real backend API.

**Architecture:** Tiptap-based rich-text editor inside the existing `EditorDrawer` shell for `kind: "news"`. All editor work runs client-side; data fetched with SWR via the existing `apiFetch` client; mutations via `useSWRMutation`. Backend endpoints (per `prd.md` section 8.4) are the source of truth — no new backend code in this scope.

**Tech Stack:**
- Next.js 14.2.5 App Router
- React 18.3.1
- Tiptap 3.30.5 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, possibly `@tiptap/extension-image`)
- SWR 2.5.1 with `useSWRMutation`
- `isomorphic-dompurify` for preview rendering

**Backend live state (verified):**
- Auth: `POST /auth/login` with `{ email, password }` returns `{ data: { accessToken, ...user }, meta }`. Admin creds in `bemfsmundip2026_be/.env`: `admin@bemfsm.id` / `ChangeMe123!ChangeMe!`
- Articles: `GET /admin/articles?page=1&pageSize=N` with `Authorization: Bearer <token>` returns `{ data: { data: Article[], total, page, pageSize }, meta }` (nested double `data`)
- Revisions: `GET /admin/articles/:id/revisions` returns `{ data: ArticleRevision[] }` (array directly)
- Categories: `GET /public/article-categories` (no auth) returns `{ data: ArticleCategory[] }`
- Media upload: `POST /media` with `multipart/form-data` field `file` and text field `variant` (e.g. `cover` or `inline`)

**Reference spec:** `bemfsmundip2026_be/docs/superpowers/specs/2026-08-28-frontend-article-editor-design.md`

---

## Task 1: Install Tiptap dependencies and verify

**Files:**
- Modify: `bemfsmundip2026_fe/package.json`
- Modify: `bemfsmundip2026_fe/src/lib/api.ts` (no — leave alone)

- [ ] **Step 1: Stop the dev server** (if running)

```bash
pkill -f "next dev" || true
```

- [ ] **Step 2: Install Tiptap dependencies**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npm install @tiptap/react@^3.30.5 @tiptap/starter-kit@^3.30.5 @tiptap/extension-link@^3.30.5
```

Expected: `package.json` updated, `node_modules/@tiptap/*` present.

- [ ] **Step 3: Check if @tiptap/extension-image is bundled in starter-kit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npm ls @tiptap/extension-image 2>&1 | head -10
node -e "const sk=require('@tiptap/starter-kit'); console.log('StarterKit has Image:', !!sk.Image || !!sk.image);" 2>&1
```

- If the second command prints `StarterKit has Image: true`, no extra package needed.
- If `StarterKit has Image: false` (or the require fails), install it:

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npm install @tiptap/extension-image@^3.30.5
```

- [ ] **Step 4: Verify versions**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
node -e "console.log('react:', require('@tiptap/react/package.json').version); console.log('starter-kit:', require('@tiptap/starter-kit/package.json').version); console.log('link:', require('@tiptap/extension-link/package.json').version);"
```

Expected: all three print `3.30.x` or `3.x.x`.

- [ ] **Step 5: Confirm dev server still starts**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
PORT=3000 NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1 npm run dev > /tmp/fe-dev.log 2>&1 &
sleep 6
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
git add package.json package-lock.json
git commit -m "chore: add tiptap dependencies for article editor"
```

---

## Task 2: Add editor-related types to `lib/types.ts`

**Files:**
- Modify: `bemfsmundip2026_fe/src/lib/types.ts`

**Interfaces:**
- Consumes: existing `Article`, `ID` from same file
- Produces: `ArticleCategory`, `ArticleRevision`, `Media`, `CreateArticleInput`, `UpdateArticleInput`, `MediaVariant`

- [ ] **Step 1: Read current types.ts to find insertion point**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
grep -n "^export\|^// =====" src/lib/types.ts
```

Identify the line where `Article` ends and where new editor types should go (suggest: just after the `Article` type, before `PaginatedArticles`).

- [ ] **Step 2: Add new types**

In `bemfsmundip2026_fe/src/lib/types.ts`, insert after the closing `}` of the `Article` type (around line 51, after `updatedAt: string;`):

```ts
// Editor support types — mirror backend response shapes.

export type ArticleCategory = {
  id: ID;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
};

export type ArticleRevision = {
  id: ID;
  articleId: ID;
  version: number;
  createdAt: string;
  createdBy: { id: ID; name: string; email: string } | null;
  restoreSourceId: string | null;
};

export type MediaVariant = "cover" | "inline" | "avatar" | "gallery";

export type Media = {
  id: ID;
  url: string;
  alt: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  variant: MediaVariant;
  createdAt: string;
};

export type CreateArticleInput = {
  title: string;
  excerpt?: string;
  content: string;
  coverMediaId?: string;
  categoryId?: string;
  visibility?: ArticleVisibility;
  coverAlt?: string;
};

export type UpdateArticleInput = Partial<CreateArticleInput> & {
  scheduledAt?: string;
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npx tsc --noEmit
```

Expected: exit code 0, no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
git add src/lib/types.ts
git commit -m "feat(types): add article editor domain types"
```

---

## Task 3: Add admin hooks to `lib/hooks.ts`

**Files:**
- Modify: `bemfsmundip2026_fe/src/lib/hooks.ts`

**Interfaces:**
- Consumes: existing `apiFetch`, `useSWR`, `useSWRMutation` from same file; `Article`, `ArticleRevision`, `ArticleCategory`, `Media`, `CreateArticleInput`, `UpdateArticleInput`, `MediaVariant` from `./types`
- Produces: `useAdminArticles`, `useAdminArticle`, `useAdminArticleRevisions`, `usePublicArticleCategories`, `useAdminArticleMutations`

- [ ] **Step 1: Update imports at the top of `lib/hooks.ts`**

Replace the existing imports:

```ts
import useSWR, { type SWRConfiguration } from "swr";
import useSWRMutation from "swr/mutation";
import { apiFetch } from "./api";
import type {
  AdminDashboard,
  Article,
  ArticleCategory,
  ArticleRevision,
  CreateArticleInput,
  InstagramProfileData,
  Media,
  MediaVariant,
  PaginatedArticles,
  PublicDashboard,
  UnitDetail,
  UnitListItem,
  UpdateArticleInput,
} from "./types";
```

- [ ] **Step 2: Add `useAdminArticles` after `useArticleBySlug` (around line 58)**

```ts
export function useAdminArticles(
  params?: ListParams,
  config?: SWRConfiguration<PaginatedArticles>,
) {
  return useSWR<PaginatedArticles>(
    ["admin-articles", params ?? null] as const,
    async ([, q]) =>
      apiFetch<PaginatedArticles>("admin/articles", {
        query: q as Record<string, string | number | undefined>,
        withCredentials: true,
      }),
    { ...defaults, ...config },
  );
}
```

- [ ] **Step 3: Add `useAdminArticle`**

```ts
export function useAdminArticle(id: string | null, config?: SWRConfiguration<Article>) {
  return useSWR<Article | null>(
    id ? ["admin-article", id] as const : null,
    async ([, aid]) =>
      apiFetch<Article>(`admin/articles/${aid}`, { withCredentials: true }),
    { ...defaults, ...config },
  );
}
```

- [ ] **Step 4: Add `useAdminArticleRevisions`**

```ts
export function useAdminArticleRevisions(id: string | null) {
  return useSWR<ArticleRevision[]>(
    id ? ["admin-article-revisions", id] as const : null,
    async ([, aid]) => {
      const wrapped = await apiFetch<{ data: ArticleRevision[] }>(
        `admin/articles/${aid}/revisions`,
        { withCredentials: true },
      );
      return wrapped.data;
    },
    { ...defaults },
  );
}
```

- [ ] **Step 5: Add `usePublicArticleCategories`**

```ts
export function usePublicArticleCategories(
  config?: SWRConfiguration<ArticleCategory[]>,
) {
  return useSWR<ArticleCategory[]>(
    "public-article-categories",
    async () => {
      const wrapped = await apiFetch<{ data: ArticleCategory[] }>(
        "public/article-categories",
      );
      return wrapped.data;
    },
    { ...defaults, ...config },
  );
}
```

- [ ] **Step 6: Add `useAdminArticleMutations` (large block)**

```ts
type AdminArticleMutations = {
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
  uploadMedia: (file: File, variant: MediaVariant) => Promise<Media>;
};

export function useAdminArticleMutations(): AdminArticleMutations {
  return {
    create: (input) =>
      apiFetch<Article>("admin/articles", {
        method: "POST",
        body: input,
        withCredentials: true,
      }),
    update: (id, input, version) =>
      apiFetch<Article>(`admin/articles/${id}`, {
        method: "PATCH",
        body: input,
        withCredentials: true,
        headers: { "If-Match": `"${version}"` },
      }),
    publish: (id) =>
      apiFetch<Article>(`admin/articles/${id}/publish`, {
        method: "POST",
        withCredentials: true,
      }),
    unpublish: (id) =>
      apiFetch<Article>(`admin/articles/${id}/unpublish`, {
        method: "POST",
        withCredentials: true,
      }),
    schedule: (id, at) =>
      apiFetch<Article>(`admin/articles/${id}/schedule`, {
        method: "POST",
        body: { scheduledAt: at.toISOString() },
        withCredentials: true,
      }),
    archive: (id) =>
      apiFetch<Article>(`admin/articles/${id}/archive`, {
        method: "POST",
        withCredentials: true,
      }),
    unarchive: (id) =>
      apiFetch<Article>(`admin/articles/${id}/unarchive`, {
        method: "POST",
        withCredentials: true,
      }),
    feature: (id) =>
      apiFetch<Article>(`admin/articles/${id}/feature`, {
        method: "POST",
        withCredentials: true,
      }),
    remove: (id) =>
      apiFetch<void>(`admin/articles/${id}`, {
        method: "DELETE",
        withCredentials: true,
      }),
    restoreRevision: (articleId, revisionId) =>
      apiFetch<Article>(
        `admin/articles/${articleId}/revisions/${revisionId}/restore`,
        { method: "POST", withCredentials: true },
      ),
    uploadMedia: async (file, variant) => {
      const form = new FormData();
      form.append("file", file);
      form.append("variant", variant);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1"}/media`,
        {
          method: "POST",
          body: form,
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Media upload failed (${res.status})`);
      }
      const json = (await res.json()) as { data: Media };
      return json.data;
    },
  };
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npx tsc --noEmit
```

Expected: exit code 0, no errors.

- [ ] **Step 8: Commit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
git add src/lib/hooks.ts
git commit -m "feat(hooks): add admin article editor hooks"
```

---

## Task 4: Build `CoverImageField` component

**Files:**
- Create: `bemfsmundip2026_fe/src/components/admin/CoverImageField.tsx`

**Interfaces:**
- Consumes: existing admin button/input CSS classes; `useAdminArticleMutations` from `@/lib/hooks`
- Produces: `<CoverImageField>` component

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload, Loader2 } from "lucide-react";
import Image from "next/image";
import { useAdminArticleMutations } from "@/lib/hooks";

export type CoverImageValue = {
  mediaId: string;
  url: string;
  alt: string | null;
} | null;

export type CoverImageFieldProps = {
  value: CoverImageValue;
  onChange: (v: CoverImageValue) => void;
};

export default function CoverImageField({ value, onChange }: CoverImageFieldProps) {
  const { uploadMedia } = useAdminArticleMutations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const media = await uploadMedia(file, "cover");
      onChange({ mediaId: media.id, url: media.url, alt: media.alt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah gambar");
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
        <Loader2 className="h-5 w-5 animate-spin text-bara-orange" />
        <span className="ml-2 text-xs text-white/55">Mengunggah...</span>
      </div>
    );
  }

  if (!value) {
    return (
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-xs text-white/55 transition-colors hover:border-bara-orange/40 hover:bg-bara-orange/[0.04] hover:text-white"
        >
          <ImagePlus className="h-5 w-5" />
          Unggah gambar cover
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {error && <p className="mt-2 text-[10px] text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#1a1614]">
        <Image src={value.url} alt={value.alt ?? "Cover"} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="admin-secondary-button"
        >
          <Upload className="h-3.5 w-3.5" /> Ganti
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="admin-secondary-button"
        >
          <Trash2 className="h-3.5 w-3.5" /> Hapus
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
git add src/components/admin/CoverImageField.tsx
git commit -m "feat(admin): add CoverImageField for inline media upload"
```

---

## Task 5: Build `InlineImageDialog` component

**Files:**
- Create: `bemfsmundip2026_fe/src/components/admin/InlineImageDialog.tsx`

**Interfaces:**
- Consumes: `useAdminArticleMutations` from `@/lib/hooks`
- Produces: `<InlineImageDialog>` component

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useAdminArticleMutations } from "@/lib/hooks";

export type InlineImageDialogProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (media: { id: string; url: string; alt: string | null }) => void;
};

export default function InlineImageDialog({ open, onClose, onInsert }: InlineImageDialogProps) {
  const { uploadMedia } = useAdminArticleMutations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const media = await uploadMedia(file, "inline");
      onInsert({ id: media.id, url: media.url, alt: media.alt });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah gambar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#12100e] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-bara-orange">Sisipkan Gambar</p>
            <h3 className="mt-2 font-display text-xl">Unggah gambar inline</h3>
            <p className="mt-1 text-xs text-white/40">
              Gambar akan diunggah ke /media dan disisipkan ke konten artikel.
            </p>
          </div>
          <button onClick={onClose} className="admin-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-6 flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-xs text-white/55 transition-colors hover:border-bara-orange/40 hover:text-white disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-bara-orange" />
              <span>Mengunggah...</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              Pilih gambar
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {error && <p className="mt-3 text-[10px] text-red-300">{error}</p>}

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="admin-secondary-button">
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
git add src/components/admin/InlineImageDialog.tsx
git commit -m "feat(admin): add InlineImageDialog for Tiptap image node"
```

---

## Task 6: Build `ScheduleDialog` component

**Files:**
- Create: `bemfsmundip2026_fe/src/components/admin/ScheduleDialog.tsx`

**Interfaces:**
- Consumes: none external
- Produces: `<ScheduleDialog>` component

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Calendar, X } from "lucide-react";

export type ScheduleDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (scheduledAt: Date) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

function toLocalInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduleDialog({ open, onClose, onConfirm }: ScheduleDialogProps) {
  // Default: tomorrow 09:00 local
  const defaultValue = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalInputValue(d);
  }, []);

  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = () => {
    const date = new Date(value);
    const nowPlusBuffer = Date.now() + 60_000;
    if (Number.isNaN(date.getTime()) || date.getTime() < nowPlusBuffer) {
      setError("Waktu harus di masa depan (minimal 1 menit dari sekarang).");
      return;
    }
    setError(null);
    onConfirm(date);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#12100e] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-bara-orange">Jadwalkan</p>
            <h3 className="mt-2 font-display text-xl">Pilih waktu publikasi</h3>
            <p className="mt-1 text-xs text-white/40">
              Artikel akan berstatus SCHEDULED dan dipublikasikan otomatis oleh scheduler backend.
            </p>
          </div>
          <button onClick={onClose} className="admin-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-6 block">
          <span className="mb-2 block text-[11px] font-semibold text-white/55">Waktu publik</span>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="admin-input pl-10"
            />
          </div>
        </label>

        {error && <p className="mt-3 text-[10px] text-red-300">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="admin-secondary-button">
            Batal
          </button>
          <button onClick={handleConfirm} className="admin-primary-button">
            Jadwalkan
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
git add src/components/admin/ScheduleDialog.tsx
git commit -m "feat(admin): add ScheduleDialog for future publish"
```

---

## Task 7: Build `ArticleEditorToolbar` component

**Files:**
- Create: `bemfsmundip2026_fe/src/components/admin/ArticleEditorToolbar.tsx`

**Interfaces:**
- Consumes: Tiptap `Editor` from `@tiptap/react`; Lucide icons
- Produces: `<ArticleEditorToolbar>` component

- [ ] **Step 1: Create the file**

```tsx
"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, ImagePlus,
} from "lucide-react";
import { useState } from "react";

export type ArticleEditorToolbarProps = {
  editor: Editor | null;
  onInsertImage: () => void;
};

const tbBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white";
const tbBtnActive = "bg-bara-orange/15 text-bara-orange hover:bg-bara-orange/25";

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${tbBtn} ${active ? tbBtnActive : ""} disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

export default function ArticleEditorToolbar({ editor, onInsertImage }: ArticleEditorToolbarProps) {
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  if (!editor) return <div className="h-10" />;

  const setLink = () => {
    if (!linkUrl) {
      editor.chain().focus().unsetLink().run();
    } else {
      const safe = linkUrl.match(/^(https?:|mailto:)/i) ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: safe, target: "_blank", rel: "noopener noreferrer" }).run();
    }
    setShowLink(false);
    setLinkUrl("");
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-t-2xl border border-b-0 border-white/[0.07] bg-[#16130f] px-3 py-2">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <Underline className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-white/10" />

      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-white/10" />

      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-white/10" />

      <ToolbarButton
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        title="Align left"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        title="Align center"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        title="Align right"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-white/10" />

      <div className="relative">
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={() => {
            const existing = editor.getAttributes("link").href as string | undefined;
            setLinkUrl(existing ?? "");
            setShowLink(true);
          }}
          title="Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        {showLink && (
          <div className="absolute left-0 top-full z-20 mt-2 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#1a1614] p-2 shadow-xl">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="admin-input h-8 w-56 text-xs"
              autoFocus
            />
            <button onClick={setLink} className="admin-primary-button h-8 px-3 text-xs">
              Terapkan
            </button>
            <button
              onClick={() => {
                setShowLink(false);
                setLinkUrl("");
              }}
              className="admin-secondary-button h-8 px-3 text-xs"
            >
              Batal
            </button>
          </div>
        )}
      </div>

      <ToolbarButton onClick={onInsertImage} title="Sisipkan gambar">
        <ImagePlus className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
git add src/components/admin/ArticleEditorToolbar.tsx
git commit -m "feat(admin): add Tiptap toolbar with PRD allowlist features"
```

---

## Task 8: Build `ArticleEditor` (the main editor body)

**Files:**
- Create: `bemfsmundip2026_fe/src/components/admin/ArticleEditor.tsx`

**Interfaces:**
- Consumes: `useAdminArticle`, `useAdminArticleRevisions`, `useAdminArticleMutations`, `usePublicArticleCategories` from `@/lib/hooks`; `Article`, `CreateArticleInput`, `UpdateArticleInput` from `@/lib/types`; `SafeHtml` from `@/components/ui/SafeHtml` (assumed existing — verify in step 1); Tiptap `useEditor`, `EditorContent`; child components `ArticleEditorToolbar`, `CoverImageField`, `InlineImageDialog`, `ScheduleDialog`; `apiFetch` and `ApiClientError`
- Produces: `<ArticleEditor>` component

- [ ] **Step 1: Confirm SafeHtml component exists**

```bash
ls "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe/src/components/ui/SafeHtml.tsx"
```

If missing, this task will fail — surface to user. (It was added in the previous session.)

- [ ] **Step 2: Create the file (long, ~420 lines — broken into steps 2a–2d)**

- [ ] **Step 2a: Imports + types + state hooks**

Open `bemfsmundip2026_fe/src/components/admin/ArticleEditor.tsx` and start with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Eye, History, Pencil, Star, Trash2, ChevronDown, ChevronUp, RotateCcw, Loader2, X, Check,
} from "lucide-react";
import {
  useAdminArticle,
  useAdminArticleMutations,
  useAdminArticleRevisions,
  usePublicArticleCategories,
} from "@/lib/hooks";
import { ApiClientError } from "@/lib/api";
import type { Article, ArticleRevision } from "@/lib/types";
import SafeHtml from "@/components/ui/SafeHtml";
import ArticleEditorToolbar from "./ArticleEditorToolbar";
import CoverImageField, { type CoverImageValue } from "./CoverImageField";
import InlineImageDialog from "./InlineImageDialog";
import ScheduleDialog from "./ScheduleDialog";

export type ArticleEditorProps = {
  articleId: string | null;
  onClose: () => void;
  onSaved: (article: Article) => void;
  notify: (message: string) => void;
};

type FormState = {
  title: string;
  excerpt: string;
  content: string;
  cover: CoverImageValue;
  coverAlt: string;
  categoryId: string;
  visibility: "PUBLIC" | "INTERNAL";
};

const EXCERPT_MAX = 260;

const EMPTY_FORM: FormState = {
  title: "",
  excerpt: "",
  content: "<p></p>",
  cover: null,
  coverAlt: "",
  categoryId: "",
  visibility: "PUBLIC",
};

type Tab = "edit" | "preview" | "revisions";

function articleToForm(a: Article): FormState {
  return {
    title: a.title,
    excerpt: a.excerpt ?? "",
    content: a.content,
    cover: a.coverMediaId
      ? { mediaId: a.coverMediaId, url: a.cover?.url ?? "", alt: a.coverAlt }
      : null,
    coverAlt: a.coverAlt ?? "",
    categoryId: a.categoryId ?? "",
    visibility: a.visibility,
  };
}

function htmlTextLength(html: string): number {
  return html.replace(/<[^>]+>/g, "").trim().length;
}

function validateForPublish(form: FormState): string | null {
  if (form.title.trim().length < 1) return "Judul wajib diisi.";
  if (htmlTextLength(form.content) < 1) return "Konten tidak boleh kosong.";
  if (!form.cover) return "Cover wajib diunggah sebelum publish.";
  if (form.coverAlt.trim().length < 1) return "Teks alternatif cover wajib diisi sebelum publish.";
  if (form.excerpt.length > EXCERPT_MAX) return `Excerpt maksimum ${EXCERPT_MAX} karakter.`;
  return null;
}
```

- [ ] **Step 2b: Editor instance + data hooks + body**

Continue in the same file:

```tsx
export default function ArticleEditor({ articleId, onClose, onSaved, notify }: ArticleEditorProps) {
  const isNew = articleId === null;
  const { article, isLoading: articleLoading, mutate: refreshArticle } = useAdminArticle(articleId);
  const { revisions, isLoading: revisionsLoading, mutate: refreshRevisions } = useAdminArticleRevisions(articleId);
  const { data: categories = [] } = usePublicArticleCategories();
  const m = useAdminArticleMutations();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tab, setTab] = useState<Tab>("edit");
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<ArticleRevision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: form.content,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none min-h-[280px] focus:outline-none px-4 py-4",
      },
    },
    onUpdate: ({ editor }) => {
      setForm((f) => ({ ...f, content: editor.getHTML() }));
    },
    immediatelyRender: false,
  });

  // Load article into form when fetched
  useEffect(() => {
    if (article) setForm(articleToForm(article));
  }, [article]);

  // Push form.content into editor when editor first mounts
  useEffect(() => {
    if (editor && article && form.content !== editor.getHTML()) {
      editor.commands.setContent(article.content, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, article?.id]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const saveDraft = async () => {
    if (form.title.trim().length < 1) {
      setError("Judul wajib diisi.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const input: CreateArticleInput | UpdateArticleInput = {
        title: form.title,
        excerpt: form.excerpt || undefined,
        content: form.content,
        coverMediaId: form.cover?.mediaId,
        coverAlt: form.coverAlt || undefined,
        categoryId: form.categoryId || undefined,
        visibility: form.visibility,
      };
      const saved = isNew
        ? await m.create(input as CreateArticleInput)
        : await m.update(articleId!, input as UpdateArticleInput, article!.version);
      notify(isNew ? "Draft dibuat." : "Perubahan disimpan.");
      onSaved(saved);
      await refreshArticle();
      await refreshRevisions();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409) {
        notify("Artikel diubah orang lain. Memuat ulang...");
        await refreshArticle();
        onClose();
      } else {
        setError(e instanceof Error ? e.message : "Gagal menyimpan.");
      }
    } finally {
      setSaving(false);
    }
  };

  const runPromote = async (key: string, fn: () => Promise<Article>) => {
    setPromoting(key);
    setError(null);
    try {
      await fn();
      notify("Berhasil.");
      await refreshArticle();
      await refreshRevisions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setPromoting(null);
    }
  };

  const restoreRev = async (rev: ArticleRevision) => {
    setRestoreConfirm(null);
    setPromoting(`restore-${rev.id}`);
    setError(null);
    try {
      await m.restoreRevision(articleId!, rev.id);
      notify("Revisi dipulihkan.");
      await refreshArticle();
      await refreshRevisions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memulihkan.");
    } finally {
      setPromoting(null);
    }
  };

  const removeArticle = async () => {
    if (!window.confirm("Hapus artikel ini secara permanen?")) return;
    setPromoting("delete");
    setError(null);
    try {
      await m.remove(articleId!);
      notify("Artikel dihapus.");
      onSaved(article!);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setPromoting(null);
    }
  };

  const publishBlock = validateForPublish(form);
  const canSaveDraft = form.title.trim().length >= 1 && !saving;
  const canPublish = publishBlock === null && !promoting && !saving;
```

- [ ] **Step 2c: Render — header, tabs, edit form, preview, revisions**

Continue in the same file:

```tsx
  return (
    <div className="fixed inset-0 z-[180] bg-black/65 backdrop-blur-sm" onMouseDown={onClose}>
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[760px] flex-col border-l border-white/[0.08] bg-[#12100e] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.07] bg-[#12100e] px-6 py-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-bara-orange">
              {isNew ? "Tambah baru" : "Edit"}
            </p>
            <h2 className="mt-2 font-display text-2xl">Artikel Informasi</h2>
            <p className="mt-1 text-xs text-white/35">
              {isNew
                ? "Buat draf artikel untuk portal informasi."
                : `Status: ${article?.status ?? "..."}${article?.isFeatured ? " · Unggulan" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && article && (
              <button
                type="button"
                onClick={() =>
                  runPromote("feature", () => m.feature(articleId!))
                }
                disabled={!!promoting}
                className={`admin-secondary-button ${
                  article.isFeatured ? "border-bara-gold/40 text-bara-gold" : ""
                }`}
              >
                <Star className="h-3.5 w-3.5" />
                {article.isFeatured ? "Lepas Unggulan" : "Jadikan Unggulan"}
              </button>
            )}
            <button onClick={onClose} className="admin-icon-button">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.07] bg-[#12100e] px-6">
          <TabButton active={tab === "edit"} onClick={() => setTab("edit")}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </TabButton>
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
            <Eye className="h-3.5 w-3.5" /> Pratinjau
          </TabButton>
          {!isNew && (
            <TabButton active={tab === "revisions"} onClick={() => setTab("revisions")}>
              <History className="h-3.5 w-3.5" /> Revisi ({revisions.length})
            </TabButton>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {articleLoading && !isNew ? (
            <div className="grid h-40 place-items-center text-xs text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : tab === "edit" ? (
            <EditTab
              form={form}
              updateField={updateField}
              editor={editor}
              onInsertImage={() => setImageDialogOpen(true)}
              categories={categories}
            />
          ) : tab === "preview" ? (
            <PreviewTab form={form} />
          ) : (
            <RevisionsTab
              revisions={revisions}
              isLoading={revisionsLoading}
              onRestore={(r) => setRestoreConfirm(r)}
              promoting={promoting}
            />
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="border-t border-red-500/20 bg-red-500/[0.06] px-6 py-3 text-[11px] text-red-200">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] bg-[#12100e] px-6 py-4">
          <div className="text-[10px] text-white/30">
            {publishBlock ? (
              <span className="text-amber-300/80">Publish: {publishBlock}</span>
            ) : (
              <span>Siap dipublikasikan.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isNew && (
              <button
                type="button"
                onClick={removeArticle}
                disabled={!!promoting || saving}
                className="admin-secondary-button text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            )}
            <button
              type="button"
              onClick={saveDraft}
              disabled={!canSaveDraft}
              className="admin-primary-button"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Simpan Draft
            </button>
            <PromoteMenu
              status={article?.status ?? "DRAFT"}
              promoting={promoting}
              disabled={!canPublish || isNew}
              onPublish={() => runPromote("publish", () => m.publish(articleId!))}
              onSchedule={() => setScheduleOpen(true)}
              onUnpublish={() => runPromote("unpublish", () => m.unpublish(articleId!))}
              onArchive={() => runPromote("archive", () => m.archive(articleId!))}
              onUnarchive={() => runPromote("unarchive", () => m.unarchive(articleId!))}
            />
          </div>
        </div>

        <InlineImageDialog
          open={imageDialogOpen}
          onClose={() => setImageDialogOpen(false)}
          onInsert={(m) => {
            editor?.chain().focus().setImage({ src: m.url, alt: m.alt ?? "" }).run();
          }}
        />

        <ScheduleDialog
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          onConfirm={async (at) => {
            setScheduleOpen(false);
            await runPromote("schedule", () => m.schedule(articleId!, at));
          }}
        />

        {restoreConfirm && (
          <div
            className="fixed inset-0 z-[200] grid place-items-center bg-black/70 backdrop-blur-sm"
            onMouseDown={() => setRestoreConfirm(null)}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#12100e] p-6 shadow-2xl"
            >
              <h3 className="font-display text-lg">Pulihkan revisi?</h3>
              <p className="mt-2 text-xs text-white/55">
                Konten akan dikembalikan ke versi {restoreConfirm.version}. Revisi baru akan dibuat
                untuk mencatat pemulihan ini.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setRestoreConfirm(null)}
                  className="admin-secondary-button"
                >
                  Batal
                </button>
                <button
                  onClick={() => restoreRev(restoreConfirm)}
                  className="admin-primary-button"
                >
                  <RotateCcw className="h-4 w-4" /> Pulihkan
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 2d: Sub-components — EditTab, PreviewTab, RevisionsTab, PromoteMenu, TabButton**

Append to the same file:

```tsx
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
        active
          ? "border-bara-orange text-white"
          : "border-transparent text-white/55 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function EditTab({
  form,
  updateField,
  editor,
  onInsertImage,
  categories,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  editor: ReturnType<typeof useEditor>;
  onInsertImage: () => void;
  categories: { id: string; name: string }[];
}) {
  const excerptLen = form.excerpt.length;
  return (
    <div className="space-y-5">
      <Field label="Judul">
        <input
          type="text"
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="Judul artikel"
          className="admin-input"
          maxLength={255}
        />
      </Field>

      <Field label="Excerpt (maks 260 karakter)">
        <textarea
          value={form.excerpt}
          onChange={(e) => updateField("excerpt", e.target.value)}
          placeholder="Ringkasan singkat untuk kartu dan daftar artikel"
          className="admin-input min-h-20 resize-y"
          maxLength={EXCERPT_MAX + 20}
        />
        <div
          className={`mt-1.5 text-right text-[10px] ${
            excerptLen > EXCERPT_MAX ? "text-red-300" : "text-white/30"
          }`}
        >
          {excerptLen} / {EXCERPT_MAX}
        </div>
      </Field>

      <Field label="Kategori">
        <select
          value={form.categoryId}
          onChange={(e) => updateField("categoryId", e.target.value)}
          className="admin-input"
        >
          <option value="">— Tanpa kategori —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Visibilitas">
        <div className="flex gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={form.visibility === "PUBLIC"}
              onChange={() => updateField("visibility", "PUBLIC")}
            />
            Publik
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={form.visibility === "INTERNAL"}
              onChange={() => updateField("visibility", "INTERNAL")}
            />
            Internal
          </label>
        </div>
      </Field>

      <Field label="Cover">
        <CoverImageField
          value={form.cover}
          onChange={(v) => updateField("cover", v)}
        />
      </Field>

      {form.cover && (
        <Field label="Teks alternatif cover (wajib sebelum publish)">
          <input
            type="text"
            value={form.coverAlt}
            onChange={(e) => updateField("coverAlt", e.target.value)}
            placeholder="Deskripsikan gambar untuk aksesibilitas"
            className="admin-input"
            maxLength={255}
          />
        </Field>
      )}

      <Field label="Konten">
        <ArticleEditorToolbar editor={editor} onInsertImage={onInsertImage} />
        <div className="rounded-b-2xl border border-t-0 border-white/[0.07] bg-[#0e0c0a]">
          <EditorContent editor={editor} />
        </div>
      </Field>
    </div>
  );
}

function PreviewTab({ form }: { form: FormState }) {
  return (
    <article className="prose prose-invert mx-auto max-w-2xl">
      <h1 className="font-display">{form.title || "Tanpa judul"}</h1>
      {form.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={form.cover.url}
          alt={form.coverAlt}
          className="w-full rounded-2xl border border-white/10"
        />
      )}
      {form.excerpt && (
        <p className="text-base leading-7 text-white/65">{form.excerpt}</p>
      )}
      <SafeHtml html={form.content} />
    </article>
  );
}

function RevisionsTab({
  revisions,
  isLoading,
  onRestore,
  promoting,
}: {
  revisions: ArticleRevision[];
  isLoading: boolean;
  onRestore: (r: ArticleRevision) => void;
  promoting: string | null;
}) {
  if (isLoading) {
    return (
      <div className="grid h-40 place-items-center text-xs text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (revisions.length === 0) {
    return (
      <p className="py-12 text-center text-xs text-white/40">
        Belum ada revisi tersimpan.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {revisions.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
        >
          <div>
            <p className="font-display text-base text-white/80">
              v{r.version}
              {r.restoreSourceId && (
                <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] uppercase text-amber-300">
                  restore
                </span>
              )}
            </p>
            <p className="mt-1 text-[10px] text-white/40">
              {new Date(r.createdAt).toLocaleString("id-ID")} ·{" "}
              {r.createdBy?.name ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRestore(r)}
            disabled={!!promoting}
            className="admin-secondary-button"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Pulihkan
          </button>
        </li>
      ))}
    </ul>
  );
}

function PromoteMenu({
  status,
  promoting,
  disabled,
  onPublish,
  onSchedule,
  onUnpublish,
  onArchive,
  onUnarchive,
}: {
  status: string;
  promoting: string | null;
  disabled: boolean;
  onPublish: () => void;
  onSchedule: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || !!promoting}
        onClick={() => setOpen((o) => !o)}
        className="admin-primary-button"
      >
        Promosikan <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-10 mb-2 w-56 rounded-xl border border-white/[0.08] bg-[#1a1614] p-1 shadow-2xl">
          <PromoteItem
            label="Publish Sekarang"
            onClick={() => {
              setOpen(false);
              onPublish();
            }}
            disabled={!!promoting}
          />
          <PromoteItem
            label="Jadwalkan..."
            onClick={() => {
              setOpen(false);
              onSchedule();
            }}
            disabled={!!promoting}
          />
          {(status === "PUBLISHED" || status === "SCHEDULED") && (
            <PromoteItem
              label="Kembalikan ke Draft"
              onClick={() => {
                setOpen(false);
                onUnpublish();
              }}
              disabled={!!promoting}
            />
          )}
          {status === "PUBLISHED" && (
            <PromoteItem
              label="Arsipkan"
              onClick={() => {
                setOpen(false);
                onArchive();
              }}
              disabled={!!promoting}
            />
          )}
          {status === "ARCHIVED" && (
            <PromoteItem
              label="Pulihkan dari Arsip"
              onClick={() => {
                setOpen(false);
                onUnarchive();
              }}
              disabled={!!promoting}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PromoteItem({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full rounded-lg px-3 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
    >
      {label}
    </button>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-2 block text-[11px] font-semibold text-white/55">{label}</span>
    {children}
  </label>
);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npx tsc --noEmit
```

Expected: exit code 0. If errors about missing imports (e.g. `safeMedia`, `placeholderCover`, `formatDateShort` from earlier `Field` definition), they are local redefinitions in the file — those are fine because the file has its own private `Field` constant.

- [ ] **Step 4: Commit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
git add src/components/admin/ArticleEditor.tsx
git commit -m "feat(admin): add ArticleEditor with Tiptap, tabs, and lifecycle"
```

---

## Task 9: Wire `ArticleEditor` into `AdminDashboard.tsx`

**Files:**
- Modify: `bemfsmundip2026_fe/src/components/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: existing `EditorDrawer` shape, `DrawerKind = "instagram" | "unit" | "news" | null`, `NewsModule`, `useAdminArticles` from `@/lib/hooks`; `<ArticleEditor>` from `./ArticleEditor`
- Produces: news drawer branch uses `<ArticleEditor>` instead of placeholder

- [ ] **Step 1: Update import line 14–17 to include `useAdminArticles`**

Replace the existing hooks import:

```ts
import {
  useAdminArticles,
  useAdminDashboard,
  usePublicArticles,
  usePublicUnits,
} from "@/lib/hooks";
```

- [ ] **Step 2: Add ArticleEditor import**

After the existing imports (around line 28), add:

```ts
import ArticleEditor from "./ArticleEditor";
```

- [ ] **Step 3: Update `NewsModule` to use admin list and pass id, not title**

In `NewsModule` (line 615 area), replace the `usePublicArticles` line and `onEdit` signature:

```ts
function NewsModule({
  search,
  setSearch,
  onEdit,
}: {
  search: string;
  setSearch: (v: string) => void;
  onEdit: (id: string) => void;
}) {
  const { data, isLoading } = useAdminArticles({ pageSize: 50 });
  const articles: Article[] = data?.data ?? [];
  // ...rest unchanged, except:
```

Then change `onClick={() => onEdit(article.title)}` to `onClick={() => onEdit(article.id)}` (around line 667).

- [ ] **Step 4: Update the call site of NewsModule**

Find (around line 159):

```tsx
{module === "news" && <NewsModule search={search} setSearch={setSearch} onEdit={(n) => openDrawer("news", n)} />}
```

Change to pass `article.id` (the existing `openDrawer` already receives `name: string` — but we'll repurpose it to receive `id: string` for news). Since the type was `string`, no signature change needed; only the meaning changes.

- [ ] **Step 5: Replace `kind: "news"` branch inside `EditorDrawer`**

In `EditorDrawer` (around line 702–745), add a branch before the current body. The simplest approach is to change the function to dispatch by `kind`:

Replace the entire `EditorDrawer` function body with:

```tsx
function EditorDrawer({
  kind,
  editing,
  onClose,
  onSaved,
  notify,
}: {
  kind: Exclude<DrawerKind, null>;
  editing: string | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (msg: string) => void;
}) {
  if (kind === "news") {
    return (
      <ArticleEditor
        articleId={editing}
        onClose={onClose}
        onSaved={() => onSaved()}
        notify={notify}
      />
    );
  }
  // Existing placeholder for instagram/unit
  const labels = {
    instagram: ["Konten Instagram", "Hubungkan post dan pilih lokasi tampil."],
    unit: ["Profil Unit", "Kelola seluruh isi halaman detail unit."],
  } as const;
  return (
    <div className="fixed inset-0 z-[180] bg-black/65 backdrop-blur-sm" onMouseDown={onClose}>
      <aside
        className="absolute inset-y-0 right-0 w-full max-w-[620px] overflow-y-auto border-l border-white/[0.08] bg-[#12100e] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[0.07] bg-[#12100e]/95 px-6 py-5 backdrop-blur-xl">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-bara-orange">{editing ? "Edit" : "Tambah baru"}</p>
            <h2 className="mt-2 font-display text-2xl">{labels[kind][0]}</h2>
            <p className="mt-1 text-xs text-white/35">{labels[kind][1]}</p>
          </div>
          <button onClick={onClose} className="admin-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <ComingSoonNotice />
        </div>
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/[0.07] bg-[#12100e]/95 px-6 py-4 backdrop-blur-xl">
          <p className="hidden text-[10px] text-white/25 sm:block">Periksa kembali sebelum menyimpan.</p>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="admin-secondary-button">Batal</button>
            <button onClick={onSaved} className="admin-primary-button">
              <Check className="h-4 w-4" />Simpan
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 6: Update the call site of `EditorDrawer` to pass `notify`**

Find (around line 163):

```tsx
{drawer && (
  <EditorDrawer
    kind={drawer}
    editing={editing}
    onClose={() => setDrawer(null)}
    onSave={() => {
      setDrawer(null);
      setEditing(null);
    }}
  />
)}
```

Replace with:

```tsx
{drawer && (
  <EditorDrawer
    kind={drawer}
    editing={editing}
    onClose={() => {
      setDrawer(null);
      setEditing(null);
    }}
    onSaved={() => {
      setDrawer(null);
      setEditing(null);
    }}
    notify={setToast}
  />
)}
```

(Note: `onSave` was renamed to `onSaved` in Task 9 Step 5 — update the prop name and add `notify={setToast}`.)

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 8: Commit**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
git add src/components/admin/AdminDashboard.tsx
git commit -m "feat(admin): wire ArticleEditor into news drawer branch"
```

---

## Task 10: Production build verification

**Files:** none

- [ ] **Step 1: Run production build**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
pkill -f "next dev" || true
sleep 1
npm run build 2>&1 | tail -30
```

Expected: build completes, zero TypeScript errors, all routes listed.

- [ ] **Step 2: Verify Tiptap bundle size delta**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
ls -la .next/static/chunks/ | sort -k5 -n | tail -10
```

Note the largest chunk size. If > 500KB, consider lazy-loading ArticleEditor in a follow-up.

- [ ] **Step 3: Restart dev server**

```bash
cd "/Users/zelphyx/Projects/BEM FSM/bemfsmundip2026_fe"
PORT=3000 NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1 npm run dev > /tmp/fe-dev.log 2>&1 &
sleep 6
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200`.

- [ ] **Step 4: Verify admin route renders**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin
```

Expected: `200`.

- [ ] **Step 5: Confirm no errors in dev log**

```bash
grep -iE "error|warn" /tmp/fe-dev.log | head -10
```

Expected: no TypeScript errors, no missing-module errors. Hydration warnings acceptable.

---

## Task 11: Functional smoke test

**Files:** none (testing only)

- [ ] **Step 1: Get a fresh JWT**

```bash
TOKEN=$(curl -sS -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bemfsm.id","password":"ChangeMe123!ChangeMe"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
echo "$TOKEN" > /tmp/admin-token
echo "Token length: ${#TOKEN}"
```

- [ ] **Step 2: Confirm there is at least one existing article**

```bash
curl -sS "http://localhost:3001/api/v1/admin/articles?page=1&pageSize=5" \
  -H "Authorization: Bearer $(cat /tmp/admin-token)" | head -c 400
```

Expected: JSON with at least one article.

- [ ] **Step 3: Test create via API**

```bash
NEW=$(curl -sS -X POST "http://localhost:3001/api/v1/admin/articles" \
  -H "Authorization: Bearer $(cat /tmp/admin-token)" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Plan 1","content":"<p>Body 1</p>","excerpt":"Excerpt"}')
echo "$NEW" | head -c 400
NEW_ID=$(echo "$NEW" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "$NEW_ID" > /tmp/test-article-id
echo "New article id: $NEW_ID"
```

Expected: returns an Article with id.

- [ ] **Step 4: Test update with If-Match**

```bash
V=$(curl -sS "http://localhost:3001/api/v1/admin/articles/$(cat /tmp/test-article-id)" \
  -H "Authorization: Bearer $(cat /tmp/admin-token)" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])")
echo "Current version: $V"
curl -sS -X PATCH "http://localhost:3001/api/v1/admin/articles/$(cat /tmp/test-article-id)" \
  -H "Authorization: Bearer $(cat /tmp/admin-token)" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"$V\"" \
  -d '{"title":"Test Plan 1 (updated)"}' | head -c 300
```

Expected: 200 OK with new version.

- [ ] **Step 5: Test stale If-Match returns 409**

```bash
curl -sS -X PATCH "http://localhost:3001/api/v1/admin/articles/$(cat /tmp/test-article-id)" \
  -H "Authorization: Bearer $(cat /tmp/admin-token)" \
  -H "Content-Type: application/json" \
  -H "If-Match: \"$V\"" \
  -d '{"title":"stale update"}' | head -c 300
```

Expected: 409 with version conflict error.

- [ ] **Step 6: Test publish validation (coverAlt missing)**

```bash
curl -sS -X POST "http://localhost:3001/api/v1/admin/articles/$(cat /tmp/test-article-id)/publish" \
  -H "Authorization: Bearer $(cat /tmp/admin-token)" | head -c 300
```

Expected: 422 (or similar) because coverAlt is missing.

- [ ] **Step 7: Test revisions endpoint**

```bash
curl -sS "http://localhost:3001/api/v1/admin/articles/$(cat /tmp/test-article-id)/revisions" \
  -H "Authorization: Bearer $(cat /tmp/admin-token)" | head -c 300
```

Expected: array with at least one revision.

- [ ] **Step 8: Test feature endpoint**

```bash
curl -sS -X POST "http://localhost:3001/api/v1/admin/articles/$(cat /tmp/test-article-id)/feature" \
  -H "Authorization: Bearer $(cat /tmp/admin-token)" | head -c 300
```

Expected: 200 OK with article that has `isFeatured: true`.

- [ ] **Step 9: Cleanup test article**

```bash
curl -sS -X DELETE "http://localhost:3001/api/v1/admin/articles/$(cat /tmp/test-article-id)" \
  -H "Authorization: Bearer $(cat /tmp/admin-token)" -o /dev/null -w "Status: %{http_code}\n"
```

Expected: 204 No Content.

- [ ] **Step 10: Manually test in browser**

Open http://localhost:3000/admin, log in, navigate to **Informasi** module. Verify:

- [ ] 10a. List loads from real backend (not hardcoded mock)
- [ ] 10b. Click pencil icon on an existing article → drawer opens with form populated
- [ ] 10c. Edit title → "Simpan Draft" → toast "Perubahan disimpan" → list updates
- [ ] 10d. Click "Promosikan → Publish Sekarang" → if blocked, message shows the rule; if allowed, status updates
- [ ] 10e. Click "Jadikan Unggulan" → toast → featured badge appears
- [ ] 10f. Open "Revisi" tab → list shows previous revisions → click "Pulihkan" → confirmation → restore
- [ ] 10g. Open Tiptap toolbar → bold, italic, headings, lists, blockquote, alignment, link all work
- [ ] 10h. Click image icon → upload dialog → upload → image appears in editor

- [ ] **Step 11: Document results**

If all pass: write a brief summary of what was verified and any known issues in the response. If any fail: fix and re-run before declaring done.

---

## Out of Scope (deferred to follow-up specs)

- Signed preview token UI (PRD line 447): requires backend route that does not exist yet
- Real-time collaboration
- Autosave
- i18n of editor UI strings
- Organization unit editor
- User management module
