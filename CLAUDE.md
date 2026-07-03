# CLAUDE.md

Guidance for Claude Code in this repository. Previous version backed up at `.claude/backups/CLAUDE.md.2026-07-03.bak`.

## Project Overview

LLRWD-RMS (Low-level Radiowaste Disposal Management System) — hierarchical item tracking with change approval workflows, QC/PM document approval, and audit logging. Next.js 15 App Router, React 19, TypeScript, Prisma ORM, PostgreSQL. UI entirely in Traditional Chinese (zh-TW).

## Read-Before-Acting Routes

Load a file ONLY when its trigger matches. Do not read them all upfront.

| Trigger | Read this |
|---|---|
| About to delegate work to a subagent; choosing model; task failed twice | `.claude/guides/model-dispatch.md` |
| Unsure if work is done, whether to ask the user, or whether to keep retrying | `.claude/guides/judgment-rubrics.md` |
| Writing a subagent prompt (search / implement / refactor / research / review) | `.claude/guides/delegation-templates.md` |
| About to edit CLAUDE.md or any file in `.claude/guides/` | `.claude/guides/maintenance-protocol.md` |
| Starting a substantial multi-step task (read once per session) | `.claude/guides/letter-to-next-session.md` |
| Working on backup/restore features | `docs/backup-restore-design-reference.md` — 625 lines: delegate it to an Explore subagent for a summary, or read only the relevant section; don't read it whole inline |
| Need project status or next tasks | Root `NextSteps.md` ONLY (the stale 2025-12 copy now lives in `docs/archive/NEXT_STEPS.md`) |

Staleness warnings: `AGENTS.md` is a short pointer for Codex — this file is the single source of truth. Historical planning docs (`*_plan.md` / `*_task.md`) live in `docs/archive/`; treat as archive, not current instructions.

## Common Commands

```bash
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build (standalone output)
npm run lint         # ESLint
npx tsc --noEmit     # Type-check
npx prisma generate  # Regenerate client after schema changes
npx prisma migrate dev --name <name>
npx vitest run       # All tests (node environment)
npx vitest run path/to/test  # Single test file
```

Seeding: `npx prisma db seed` (requires `ADMIN_PASSWORD` env var; `ADMIN_USERNAME` defaults to `admin`). Env vars: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (see `.env.example`).

## Architecture

- `src/app/` — App Router pages + API routes (REST under `src/app/api/`, all session-authenticated)
- `src/actions/` — Server Actions for ALL mutations, with role-based access checks
- `src/components/` — by domain: project/, item/, editor/, admin/, datafile/, iso-docs/
- `src/lib/` — prisma.ts singleton, auth.ts, pdf-generator.ts (pdf-lib, pure JS), tree-utils.ts, backup/
- `src/stores/` (Zustand sidebar), `src/contexts/` (ThemeContext), `src/types/` (NextAuth extensions)
- Path alias: `@/*` → `./src/*` — always use for imports
- Styling: vanilla CSS + CSS variables (no Tailwind); `globals.css`, `theme.css`, light/dark via ThemeContext
- Auth: NextAuth Credentials + JWT strategy (`src/lib/auth.ts`). Session: id, username, role, isPM, isQC. Lockout after 5 failed logins (15 min)
- DB: `prisma/schema.prisma`. Roles: VIEWER / EDITOR / INSPECTOR / ADMIN, plus `isQC` / `isPM` flags

### Domain Rules (violating these causes real bugs)

1. **Change approval**: all Item/Project/DataFile mutations go through `ChangeRequest` (PENDING → APPROVED/REJECTED). Editors submit, Inspectors/Admins review. Resubmission chains via `previousRequestId`.
2. **QC 2-stage approval**: after item approval, quality docs go QC approval → PM approval, with revision iteration tracking.
3. **fullId**: items form a tree; `fullId` (e.g. `WQ-1-1`) is auto-generated from project `codePrefix` + hierarchy position (`src/lib/item-utils.ts`).
4. **Soft-deleted items still occupy their fullId**. `batchCascadeFullIdChanges` prefixes conflicting deleted items with `__DELETED_` before cascade. Always account for deleted items when computing fullId assignments.
5. **Reorder/Move/Renumber cascade to ALL descendants**: call `collectDescendantChanges()` before `batchCascadeFullIdChanges()`, then write `ItemHistory` records for every affected item, not just direct targets.
6. **Audit trail**: every change writes `ItemHistory` (JSON snapshot + diff); logins write `LoginLog`.
7. **Edge middleware** (`src/middleware.ts`) has a 10MB body limit — upload routes are excluded from it and must authenticate internally. Excluded: `/auth/login`, `/api/auth`, `/api/health`, `/api/admin/restore`, `/api/datafiles/upload` (100MB), `/api/upload` (20MB), static assets.
8. **Tiptap fullId regex**: project `codePrefix` can contain hyphens (`RMS-DAREN`), so the pattern is `(?:[A-Z]+-)+\d+`, exported as `ITEM_ID_CORE_PATTERN` from `src/components/editor/plugins/itemLinkPlugin.ts`. Never duplicate this regex — import the constant. After changing Tiptap/ProseMirror plugins, restart the dev server and clear `.next` (hot reload misses plugin changes).
9. **Backup/restore** lives in `src/lib/backup/` (project ZIP) and `src/lib/backup-utils.ts` (full DB); admin endpoints at `src/app/api/admin/restore/{database,iso-docs,uploads}/`. Before touching any of it, digest `docs/backup-restore-design-reference.md` (via subagent summary or targeted sections — see route table).

## Conventions

- All user-facing text in Traditional Chinese. History changeType labels: CREATE→建立, UPDATE→更新, DELETE→刪除, REORDER→排序, RESTORE→還原
- Server Actions return `{ success, error?, data? }`
- Soft deletes use `isDeleted` flag (Items, DataFiles)
- ESLint: `no-explicit-any` and unused vars are warnings (underscore-prefixed ignored)
- Next.js standalone output (Docker); Server Actions body limit 100MB

## Security Checklist (verify on every mutation-path change)

- **Role re-validation**: re-fetch role from DB in privilege-sensitive Server Actions (`getCurrentRole(session.user.id)`) — JWT claims go stale after demotion. Never trust `session.user.role` alone for mutations.
- **Self-approval**: check `submittedById !== session.user.id` in ALL approval paths (Item, QC, PM). ADMIN exempt for Item approval only.
- **Open redirect**: validate `notification.link` with `/^\/[^/]/`, not `startsWith('/')` — `//evil.com` bypasses the naive check.
- **Zip Slip**: verify `path.resolve(entry)` stays inside the target directory before extraction.
- **SQL restore whitelist**: allow only specific prefixes (`INSERT INTO`, `DELETE FROM`, `TRUNCATE`, `SET CONSTRAINTS`, `SET STATEMENT_TIMEOUT`, `SET LOCK_TIMEOUT`). Filter `BEGIN`/`COMMIT` and `SET session_replication_role`. A broad `SET ` prefix enables `SET ROLE` privilege escalation.
- **MIME validation**: whitelist + reject empty `file.type` and `application/octet-stream`. Sanitize displayed user HTML with `isomorphic-dompurify`.
- **Transactions**: wrap multi-step DB mutations in `prisma.$transaction()` (bidirectional relations, reordering, imports).
- **Error sanitization**: never return raw `e.message` to clients — generic Chinese message + `console.error` the original.
- **File cleanup**: when soft-deleting DataFiles, also `unlink()` the physical file; verify `path.resolve()` stays within `process.cwd()` first.
