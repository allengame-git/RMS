# ARCHITECTURE.md

> Technical architecture reference for AI agents and developers.
> Last updated: 2026-06-09

---

## 1. System Overview

LLRWD-RMS is a hierarchical item management system with multi-stage approval workflows, built for tracking low-level radiowaste disposal project documentation.

### Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Runtime | React | 19 |
| Language | TypeScript | ^5 |
| ORM | Prisma | 5.22.0 |
| Database | PostgreSQL | - |
| Auth | NextAuth.js (Credentials + JWT) | ^4.24.13 |
| Rich Text | Tiptap (ProseMirror) | ^3.14.0 |
| PDF | pdf-lib | ^1.17.1 |
| State | Zustand | ^5.0.9 |
| Styling | Vanilla CSS + CSS Variables | - |
| Deploy | Docker + Nginx / Vercel + Neon | - |

**Decision:** No Tailwind — vanilla CSS with CSS variables for theming. Keeps bundle minimal and avoids build tooling complexity for a small team.

**Decision:** pdf-lib over Puppeteer — pure JS, no headless browser dependency, works in serverless (Vercel). Font subsetting via `@pdf-lib/fontkit` keeps PDF size ~300KB (was 7MB without subsetting).

---

## 2. Data Flow

### Request Lifecycle

```
Browser → Edge Middleware (JWT check) → App Router Page/API → Server Action → Prisma → PostgreSQL
```

- **Edge Middleware** (`src/middleware.ts`): Validates JWT token for all routes except auth, static assets, and upload endpoints (excluded due to 10MB body limit).
- **Server Actions** (`src/actions/`): All mutations go through server actions with role-based access checks. Return `{ success, error?, data? }` pattern.
- **API Routes** (`src/app/api/`): REST endpoints for file uploads, backup/restore, and health checks.

### Change Approval Pipeline

```
Editor submits → ChangeRequest (PENDING) → Inspector/Admin reviews → APPROVED / REJECTED
                                                                         ↓
                                                              QC Approval (PENDING_QC)
                                                                         ↓
                                                              PM Approval (PENDING_PM)
                                                                         ↓
                                                              PDF Generation → Complete
```

**Decision:** Two-stage QC/PM approval is sequential, not parallel — QC must approve before PM sees the document. This matches the organization's quality assurance chain of custody.

### File Upload Pipeline

1. Client sends multipart form data to `/api/datafiles/upload` or `/api/upload`
2. These routes are **excluded from Edge middleware** (10MB body limit)
3. Routes handle auth internally via `getServerSession`
4. MIME type validated against whitelist; empty type and `application/octet-stream` rejected
5. Filename replaced with UUID to prevent injection
6. File written to `uploads/` or `iso_doc/` directory

---

## 3. Frontend Architecture

### Page Structure (App Router)

- `src/app/` — Pages use React Server Components by default
- `src/app/api/` — API routes for uploads, backup/restore, health
- `src/app/admin/` — Admin pages: approvals, history, user management, deleted items
- `src/app/projects/` — Project CRUD and listing
- `src/app/items/[id]/` — Item detail with sidebar navigation (layout.tsx fetches sidebar data)

### State Management

- **Zustand** (`src/stores/sidebarStore.ts`): Sidebar tree collapse state only
- **React Context** (`src/contexts/ThemeContext.tsx`): Light/dark mode toggle
- **Server state**: All data fetched in Server Components or via server actions; no client-side data cache (no SWR/React Query)

**Decision:** No client-side data cache — simplicity over performance. Known trade-off: sidebar doesn't update after item create/delete without page reload (see NextSteps.md item #4).

### Rich Text Editor

Tiptap with custom extensions in `src/components/editor/`:

- `ItemLink.ts` — Extension that auto-converts fullId patterns (e.g., `RMS-DAREN-4-1`) to clickable links via ProseMirror InputRule
- `itemLinkPlugin.ts` — Decoration plugin that highlights potential item IDs in the document. Uses `docChanged` guard to skip regex scans on cursor-only transactions.
- Shared `ITEM_ID_CORE_PATTERN` constant ensures regex stays in sync between InputRule and decoration plugin.

---

## 4. Backend Architecture

### Server Actions (`src/actions/`)

| File | Responsibility |
|------|---------------|
| `approval.ts` | Item/project change request CRUD, submit/review/cancel/edit |
| `qc-approval.ts` | QC and PM document approval, batch PM approval |
| `item-reorder.ts` | Item reorder, move, renumber, restore |
| `project.ts` | Project CRUD, clone |
| `data-files.ts` | DataFile CRUD |

**Pattern:** `processSinglePMApproval()` is the shared helper for both single and batch PM approval — always modify this function, not the two callers.

### fullId Cascade System

When items are reordered, moved, or renumbered, their `fullId` (e.g., `WQ-1-1`) changes, and all descendants must be updated.

**Key files:**
- `src/lib/fullid-cascade.ts` — `batchCascadeFullIdChanges()` with two-phase `__TEMP_` prefix mechanism
- `src/lib/item-utils.ts` — `generateNextItemId()` for fullId generation

**Critical sequence:**
1. Call `collectDescendantChanges()` BEFORE `batchCascadeFullIdChanges()` — descendants' old fullIds are needed for history records
2. Soft-deleted items get `__DELETED_` prefix to avoid UNIQUE constraint conflicts
3. Two-phase rename (`__TEMP_` then final) avoids swapping conflicts

### Backup & Restore

- `src/lib/backup/` — Single project export/import (ZIP with manifest.json, ID mapping)
- `src/lib/backup-utils.ts` — Full database export (SQL dump)
- `src/app/api/admin/restore/database/route.ts` — SQL restore within `prisma.$transaction`, drops/recreates FK constraints, resets auto-increment sequences
- `src/app/api/admin/restore/{iso-docs,uploads}/route.ts` — File restore with Zip Slip protection

---

## 5. Authentication & Authorization

### Auth Flow

```
Login form → POST /api/auth/callback/credentials → bcrypt verify → JWT issued → stored in cookie
```

- **Provider:** Credentials only (no OAuth)
- **Strategy:** JWT (not database sessions)
- **Session shape:** `{ id, username, role, isPM, isQC }`
- **Lockout:** 5 failed attempts → 15-minute lock, logged in `LoginLog`

### Role Hierarchy

| Role | View | Submit Changes | Review | Manage Users |
|------|------|---------------|--------|-------------|
| VIEWER | Yes | No | No | No |
| EDITOR | Yes | Yes | No | No |
| INSPECTOR | Yes | Yes | Yes | No |
| ADMIN | Yes | Yes | Yes | Yes |

Additional flags: `isQC` (can approve QC stage), `isPM` (can approve PM stage).

**Decision:** Self-review prevention — submitters cannot approve their own change requests, except ADMIN role which can self-approve for Item approvals. QC/PM approvals enforce self-review prevention for ALL users including ADMIN.

**Decision:** Role re-validation — all privilege-sensitive Server Actions re-fetch the user's current role from the database via `getCurrentRole()`, never trusting JWT session claims alone. This prevents stale JWT privilege escalation after admin demotion.

---

## 6. Database Schema

Schema at `prisma/schema.prisma`. Key models:

| Model | Purpose |
|-------|---------|
| `User` | Authentication, roles (VIEWER/EDITOR/INSPECTOR/ADMIN), QC/PM flags |
| `Project` | Top-level container with `codePrefix` for fullId generation |
| `Item` | Hierarchical tree nodes, soft-deletable, `fullId` auto-generated |
| `ChangeRequest` | Approval workflow records (PENDING/APPROVED/REJECTED) |
| `ItemHistory` | Audit trail with JSON snapshots and diffs |
| `QCDocumentApproval` | Two-stage QC→PM document approval |
| `DataFile` | Uploaded files with year classification, soft-deletable |
| `ItemRelation` | Bidirectional item-to-item relationships |
| `ItemReference` | Item-to-DataFile references |
| `Notification` | In-app notifications |
| `LoginLog` | Authentication audit trail |

**Decision:** Soft deletes over hard deletes for Items and DataFiles — preserves audit trail and allows restore. Soft-deleted items retain their `fullId` in the database to prevent reuse conflicts.

---

## 7. PDF Generation

`src/lib/pdf-generator.ts` generates ISO quality documents using pdf-lib.

**Pipeline:**
1. Fetch approved item history + QC/PM approval records
2. Build PDF pages: header, item metadata, content diff, signatures
3. Embed QC and PM digital signatures (uploaded signature images)
4. Use `@pdf-lib/fontkit` for CJK font embedding with subsetting

**Key helper:** `formatDiffValue()` converts raw diff data (HTML content, JSON arrays for relations/references) into human-readable text. `stripHtml()` is a module-level utility for removing HTML tags.

---

## 8. Summary of Key Design Decisions

| Decision | Choice | Why | Alternatives Considered |
|----------|--------|-----|------------------------|
| CSS approach | Vanilla CSS + variables | Minimal bundle, simple theming | Tailwind, CSS Modules |
| PDF engine | pdf-lib | Pure JS, serverless-compatible, no browser dependency | Puppeteer (legacy, kept as fallback) |
| Auth strategy | JWT sessions | Stateless, no session DB table needed | Database sessions |
| Data mutations | Server Actions | Collocated with UI, type-safe, built-in form handling | API routes only |
| State management | Zustand (minimal) | Only sidebar collapse state; most state is server-fetched | Redux, React Query |
| Soft deletes | isDeleted flag | Preserve audit trail, enable restore | Hard deletes with archive table |
| fullId cascade | Two-phase __TEMP_ rename | Avoid UNIQUE constraint violations during batch rename | Single-phase with deferred constraints |
| Self-review | Blocked (except ADMIN for Items; always blocked for QC/PM) | Separation of duties for quality assurance | Allow all self-review |
| Upload auth | Internal (not middleware) | Edge middleware 10MB body limit | Presigned URLs |
| Role validation | Re-fetch from DB per mutation | JWT claims can be stale after demotion | Trust JWT only |
| Error messages | Generic Chinese to client | Prevent DB internals leaking (constraint names, SQL) | Raw error forwarding |
| fullId generation | Serializable transaction | Prevent concurrent CREATE submissions getting same fullId | Generate outside transaction |
| Backup passwords | Redacted in SQL export | Prevent offline brute-force on leaked backups | Export full records |
| DB restore | In-process lock flag | Prevent concurrent restore corrupting data | No protection |
