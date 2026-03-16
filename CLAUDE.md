# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLRWD-RMS (Low-level Radiowaste Disposal Management System) — a full-featured project management system for hierarchical item tracking with change approval workflows, QC/PM document approval, and audit logging. Built with Next.js 15 App Router, React 19, TypeScript, Prisma ORM, and PostgreSQL. The UI is entirely in Traditional Chinese (zh-TW).

## Common Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build (standalone output)
npm run lint         # ESLint check
npx tsc --noEmit     # Type-check without emitting files
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create and apply migration
npx prisma studio    # GUI database browser
npx vitest run       # Run tests (vitest configured, node environment)
npx vitest run path/to/test  # Run a single test file
```

**Database seeding:** `npx prisma db seed` (creates default admin user: admin/adminpassword)

**Environment variables:** `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (see `.env.example`)

## Architecture

### Layered Structure

- **`src/app/`** — Next.js App Router pages and API routes
- **`src/actions/`** — Server Actions for all mutations (approval.ts, project.ts, data-files.ts, qc-approval.ts, etc.)
- **`src/components/`** — React components organized by domain (project/, item/, editor/, admin/, datafile/, iso-docs/)
- **`src/lib/`** — Shared utilities (prisma.ts singleton, auth.ts config, pdf-generator.ts, tree-utils.ts, backup/)
- **`src/stores/`** — Zustand stores (sidebarStore.ts for tree collapse state)
- **`src/contexts/`** — React contexts (ThemeContext.tsx for light/dark mode)
- **`src/types/`** — TypeScript type definitions (extended NextAuth types)

### Path Alias

`@/*` maps to `./src/*` — always use this for imports.

### Key Domain Concepts

1. **Change Approval Workflow**: All data mutations (create/update/delete Items, Projects, DataFiles) go through `ChangeRequest` with PENDING → APPROVED/REJECTED status. Editors submit, Inspectors/Admins review. Rejected items can be resubmitted (chained via `previousRequestId`).

2. **QC Document Approval (2-stage)**: After item changes are approved, quality documents go through QC approval → PM approval. Supports revision requests with iteration tracking.

3. **Hierarchical Items**: Items form a tree structure within projects. Each item gets an auto-generated `fullId` (e.g., `WQ-1-1`) based on project `codePrefix` and hierarchy position. See `src/lib/item-utils.ts`.

4. **Soft Delete fullId Retention**: Soft-deleted items (`isDeleted: true`) still occupy their `fullId` in the database. `batchCascadeFullIdChanges` prefixes conflicting deleted items with `__DELETED_` before cascade. Always account for deleted items when computing fullId assignments.

5. **Reorder/Move/Renumber Cascade**: These operations cascade fullId changes to all descendant items. Use `collectDescendantChanges()` before `batchCascadeFullIdChanges()` to capture child changes, then write history records for ALL affected items (not just direct targets).

6. **Audit Trail**: Every change creates an `ItemHistory` record with JSON snapshot and diff. Login attempts are logged in `LoginLog`.

### Database (Prisma + PostgreSQL)

Schema at `prisma/schema.prisma`. Key models: User, Project, Item (hierarchical), ChangeRequest, ItemHistory, QCDocumentApproval, DataFile, ItemRelation, ItemReference, Notification, LoginLog.

User roles: VIEWER, EDITOR, INSPECTOR, ADMIN. Users can also have `isQC` and `isPM` flags for document approval.

### Authentication

NextAuth.js with Credentials provider and JWT session strategy. Auth config in `src/lib/auth.ts`. Session includes: id, username, role, isPM, isQC. Account lockout after 5 failed attempts (15-min lock).

### Middleware (Edge Auth)

`src/middleware.ts` protects all routes at the edge using `next-auth/jwt`'s `getToken`. Edge middleware has a **10MB body size limit** — upload routes must be excluded and handle auth internally. Excludes: `/auth/login`, `/api/auth`, `/api/health`, `/api/admin/restore`, `/api/datafiles/upload` (100MB), `/api/upload` (20MB), `_next/static`, `_next/image`, `favicon.ico`.

### API Routes Pattern

REST endpoints under `src/app/api/`. All require session authentication. Server Actions in `src/actions/` handle mutations with role-based access checks.

### Backup & Restore

`src/lib/backup/` handles project import/export (ZIP with manifest.json). `src/lib/backup-utils.ts` handles full database export/import. Admin restore endpoints at `src/app/api/admin/restore/{database,iso-docs,uploads}/`. Database restore uses SQL whitelist, drops all FK constraints within a `prisma.$transaction`, executes statements, then recreates constraints. After restore, all PostgreSQL auto-increment sequences are reset to `MAX(id) + 1` to prevent unique constraint errors. File restores (iso-docs, uploads) use `unzipper` streaming to extract directly to target directories with Zip Slip protection.

### Styling

Vanilla CSS with CSS variables for theming (no Tailwind). Global styles in `globals.css`, theme variables in `theme.css`. Light/dark mode via ThemeContext.

### Rich Text Editor

Tiptap (ProseMirror-based) with custom extensions in `src/components/editor/`. Supports tables, images, links, and formatted text.

### PDF Generation

Uses `pdf-lib` (pure JS, no browser dependency) in `src/lib/pdf-generator.ts` for ISO quality document generation.

## Conventions

- All user-facing text is in Traditional Chinese
- changeType labels in history UI must use Chinese: CREATE→建立, UPDATE→更新, DELETE→刪除, REORDER→排序, RESTORE→還原
- Server Actions return `{ success, error?, data? }` pattern
- HTML content displayed from user input is sanitized with `isomorphic-dompurify`
- File uploads are validated against a MIME type whitelist
- Soft deletes use `isDeleted` flag on Items and DataFiles
- ESLint: `@typescript-eslint/no-explicit-any` and unused vars are warnings (underscore-prefixed vars ignored)
- Next.js standalone output mode for Docker deployment
- Server Actions body size limit: 100MB (for file uploads)

## Security Gotchas

- **Open redirect prevention**: Validate `notification.link` with `/^\/[^/]/` regex, not just `startsWith('/')` — protocol-relative URLs (`//evil.com`) bypass the naive check
- **ZIP Slip**: Always verify `path.resolve(entry)` stays within the target directory before extraction
- **SQL restore whitelist**: Only allow specific prefixes (`INSERT INTO`, `DELETE FROM`, `TRUNCATE`, `SET CONSTRAINTS`, `SET STATEMENT_TIMEOUT`, `SET LOCK_TIMEOUT`). Filter out `BEGIN`/`COMMIT` (Prisma manages transaction) and `SET session_replication_role` (no permission). A broad `SET ` prefix allows privilege escalation (`SET ROLE`)
- **MIME validation**: Reject empty `file.type` and `application/octet-stream` to prevent whitelist bypass
- **Multi-step DB mutations**: Wrap in `prisma.$transaction()` for atomicity (e.g., bidirectional relations, reordering, import operations)
