# Backup & Restore System Design Reference

> Target audience: AI Agent tasked with designing/implementing a similar backup-restore system.
> Source project: LLRWD-RMS (Next.js 15 + Prisma + PostgreSQL)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Backup Creation](#2-backup-creation)
   - 2.1 Database Backup (System-Level)
   - 2.2 File Backup (iso-docs / uploads)
   - 2.3 Project-Level Backup
3. [Restore Flow](#3-restore-flow)
   - 3.1 Database Restore
   - 3.2 File-Based Restore
   - 3.3 Project Import
4. [ZIP Structure Specifications](#4-zip-structure-specifications)
5. [Security Measures](#5-security-measures)
6. [Transaction & FK Handling Strategy](#6-transaction--fk-handling-strategy)
7. [File Size & Middleware Considerations](#7-file-size--middleware-considerations)
8. [Key Design Decisions](#8-key-design-decisions)
9. [Key Files Index](#9-key-files-index)

---

## 1. System Overview

The system has **two distinct backup/restore scopes**:

| Scope | Backup Content | ZIP Strategy | Restore Strategy |
|-------|---------------|-------------|-----------------|
| **System-Level** | Full DB (SQL) + all file directories (separate ZIPs) | `archiver` streaming | Destructive overwrite |
| **Project-Level** | Single project data (JSON) + associated files | `archiver` → buffer | Non-destructive insert with ID remapping |

Three ZIP libraries are used, each for a specific reason:

| Library | Used For | Why |
|---------|---------|-----|
| `archiver` | Backup creation (all types) | Stream-based, no memory buffering for large archives |
| `AdmZip` | Database restore, project import | Synchronous in-memory extraction, enables ZIP Slip checks before any disk write |
| `unzipper` | File restores (iso-docs, uploads) | Random-access buffer mode, efficient for selective entry extraction |

---

## 2. Backup Creation

### 2.1 Database Backup (System-Level)

**Endpoint:** `POST /api/admin/backup/database`
**Source:** `src/app/api/admin/backup/database/route.ts`

**Flow:**
1. Auth check (`ADMIN` role required)
2. Call `exportDatabaseToSQL()` from `src/lib/backup-utils.ts`
3. Call `generateDatabaseManifest()` for metadata
4. Create ZIP with `archiver('zip', { zlib: { level: 9 } })` containing `rms_db.sql` + `manifest.json`
5. Pipe through Node.js `PassThrough` stream → bridge to Web `ReadableStream` for HTTP response
6. Response header: `Content-Disposition: attachment; filename*=UTF-8''<percent-encoded-name>`

**SQL Generation (`exportDatabaseToSQL`):**
- Header comment block
- `TRUNCATE TABLE "<table>" CASCADE;` for all 15 tables (reverse FK order)
- For each table (forward FK order): `DELETE FROM` + `INSERT INTO` per row via `generateInsertStatements()`
- `escapeValue()` handles: null→`NULL`, bool→`TRUE/FALSE`, number→raw, Date→ISO string, string→single-quote-escaped (`''`), object/array→`JSON.stringify`

**Table Export Order (forward FK order):**
```
User → ProjectCategory → Project → Item → ItemRelation → DataFile →
ItemReference → ChangeRequest → ItemHistory → QCDocumentApproval →
QCDocumentRevision → DataFileChangeRequest → DataFileHistory →
Notification → LoginLog
```

**Database Manifest Schema:**
```json
{
  "version": "1.1",
  "createdAt": "<ISO timestamp>",
  "systemVersion": "1.6.0",
  "backupType": "database",
  "databaseType": "postgresql",
  "stats": {
    "tableCount": 15,
    "User": 5,
    "Project": 3,
    "Item": 120
    // ... one entry per table
  }
}
```

### 2.2 File Backup (iso-docs / uploads)

**Endpoints:**
- `POST /api/admin/backup/iso-docs` — backs up `public/iso_doc/`
- `POST /api/admin/backup/uploads` — backs up `public/uploads/` + root-level static images

**Flow (identical pattern):**
1. Auth check
2. Compute directory stats via recursive `getDirectoryStats()`
3. Generate file manifest
4. Create ZIP with `archiver` at compression level 6 (faster than DB's level 9)
5. Stream as Web `ReadableStream` response

**uploads backup extra:** Scans `public/` root for image files (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`) and adds them under `static/` path in the ZIP — captures logos and other static assets.

**File Manifest Schema:**
```json
{
  "version": "1.1",
  "createdAt": "<ISO timestamp>",
  "systemVersion": "1.6.0",
  "backupType": "uploads" | "iso-docs",
  "stats": {
    "fileCount": 42,
    "totalSizeBytes": 10485760,
    "totalSizeMB": 10
  }
}
```

### 2.3 Project-Level Backup

**Endpoint:** `POST /api/admin/backup/project/[id]`
**Source:** `src/app/api/admin/backup/project/[id]/route.ts` + `src/lib/backup/export-service.ts`

**Flow:**
1. Auth check, validate project exists
2. Collect all related DB records via `exportProjectData(projectId)`:
   - Project + category, items, itemRelations (both directions), itemReferences, dataFiles, changeRequests, itemHistories, qcDocumentApprovals, qcDocumentRevisions, dataFileChangeRequests, dataFileHistories
3. Collect physical files via `collectProjectFiles()`:
   - Item attachments → `assets/uploads/<basename>`
   - QC ISO PDFs → `assets/iso_doc/<basename>`
   - DataFile files → `assets/uploads/datafiles/<basename>`
4. Compute MD5 checksums for each file
5. Serialize all data (handles BigInt→string, Date→ISO)
6. Build ZIP: `manifest.json` + `data.json` + all asset files
7. **Unlike system backups**: collects all chunks into memory buffer before responding (not true streaming)

**Project Export Manifest (`ExportManifest`):**
```json
{
  "version": "1.0.0",
  "exportedAt": "<ISO timestamp>",
  "projectId": 1,
  "projectCodePrefix": "WQ",
  "projectTitle": "Project Name",
  "counts": {
    "items": 50,
    "itemRelations": 10,
    "itemReferences": 15,
    "changeRequests": 80,
    "itemHistories": 200,
    "qcApprovals": 30,
    "qcRevisions": 5,
    "dataFiles": 20,
    "dataFileChangeRequests": 25,
    "dataFileHistories": 40
  },
  "files": [
    { "path": "assets/uploads/file.pdf", "checksum": "<md5hex>", "size": 1024 }
  ]
}
```

---

## 3. Restore Flow

### 3.1 Database Restore (Destructive Full Overwrite)

**Endpoint:** `POST /api/admin/restore/database`
**Source:** `src/app/api/admin/restore/database/route.ts`

**Complete Flow:**

```
Upload (ZIP or SQL) → Extract if ZIP → Validate SQL content →
Parse & whitelist-filter statements → Transaction {
  Drop all FK constraints → Execute all statements →
  Recreate all FK constraints → Reset all sequences
} → Force logout all users → Response
```

**Step-by-step:**

1. **File parsing**: Accept `.sql` or `.zip` via `formData.get('file')`
   - `.sql`: buffer decoded directly to string
   - `.zip`: extract to `os.tmpdir()/rms-restore-<timestamp>/` with ZIP Slip check, read `manifest.json` + `rms_db.sql`, cleanup temp dir

2. **SQL content validation** (prevents lockout):
   ```js
   /INSERT INTO/gi          // at least one INSERT
   /INSERT INTO "User"/gi   // must have User data
   /INSERT INTO "User"[^;]*'ADMIN'/gi  // must have an ADMIN user
   ```

3. **Statement parsing & whitelist**:
   - Split on `';\n'`, trim, remove `--` comment lines
   - Skip: `BEGIN`, `COMMIT` (Prisma manages transaction)
   - Skip: `SET session_replication_role` (requires superuser, replaced by FK drop strategy)
   - Allowed prefixes: `INSERT INTO`, `DELETE FROM`, `TRUNCATE TABLE`, `TRUNCATE`, `SET CONSTRAINTS`, `SET STATEMENT_TIMEOUT`, `SET LOCK_TIMEOUT`
   - **Any non-matching statement → immediate 400 abort**

4. **Atomic execution** via `prisma.$transaction({ maxWait: 30000, timeout: 600000 })`:
   - **Step A**: Query all FK constraints from `information_schema.table_constraints` + `pg_constraint`
   - **Step B**: `ALTER TABLE DROP CONSTRAINT` for each FK
   - **Step C**: Execute all filtered SQL statements one by one via `tx.$executeRawUnsafe(stmt)`
   - **Step D**: `ALTER TABLE ADD CONSTRAINT` to rebuild each FK
   - **Step E**: Reset all auto-increment sequences:
     ```sql
     SELECT setval('"<seq>"', COALESCE((SELECT MAX("<col>") FROM "<table>"), 0) + 1)
     ```

5. **Force logout**: `forceLogoutAllUsers()` bumps `updatedAt` on every User record → invalidates JWT tokens (NextAuth compares token's `updatedAt` vs DB value)

### 3.2 File-Based Restore (iso-docs / uploads)

**Endpoints:**
- `POST /api/admin/restore/iso-docs`
- `POST /api/admin/restore/uploads`

**Flow (shared pattern, uses `unzipper`):**

```
Upload ZIP → unzipper.Open.buffer() → Parse manifest.json →
Validate backupType → Filter entries by path prefix →
WIPE target directory → Extract each file with ZIP Slip check
```

1. `unzipper.Open.buffer(buffer)` — random-access mode
2. Find & validate `manifest.json` entry, check `backupType`
3. Filter entries by prefix (`iso_doc/` or `uploads/`), type must be `'File'`
4. **Full wipe**: `fs.rmSync(targetDir, { recursive: true })` then `fs.mkdirSync(targetDir, { recursive: true })`
5. For each file: derive relative path, compute dest, ZIP Slip check, `mkdirSync` parent, `writeFileSync`

**uploads extra**: Also processes `static/` entries → writes to `public/` root (single-level only, no subdirectory traversal)

### 3.3 Project Import (Non-Destructive)

**Endpoints:**
- `PUT /api/admin/restore/project` — conflict pre-scan
- `POST /api/admin/restore/project` — execute import

**Source:** `src/app/api/admin/restore/project/route.ts` + `src/lib/backup/import-service.ts`

**Pre-scan (PUT):**
Checks if `codePrefix` or any `dataCode` already exists in DB. Returns `{ hasConflict, conflicts }`.

**Import (POST) complete flow:**

```
Upload ZIP → Auto pre-backup (SQL to server filesystem) →
AdmZip memory extraction → Parse manifest.json + data.json →
Stage files in memory (pendingFiles[]) →
14-step DB transaction with ID remapping →
Write files to disk only on DB success →
Cleanup on failure
```

**Key: ID Remapping Strategy**

The import uses `IdMapping` — separate `Map<number, number>` per entity type — translating old backup IDs to new auto-assigned database IDs:

| Step | Entity | Special Handling |
|------|--------|-----------------|
| 1 | ProjectCategory | Upsert by `name` (reuse existing) |
| 2 | Project | `codePrefix` conflict → append `_imported` suffix |
| 3 | Items | Sort parentless first; `regenerateFullId()` with new prefix |
| 4 | ItemRelations | Remap `sourceId` + `targetId` |
| 5 | DataFiles | Upsert by `dataCode` (reuse existing) |
| 6 | ItemReferences | Check `@@unique([itemId, fileId])` before insert |
| 7 | ChangeRequests Phase 1 | Insert all without `previousRequestId` |
| 8 | ChangeRequests Phase 2 | Update `previousRequestId` via ID map |
| 9 | ItemHistories | `regenerateFullId` on `itemFullId` field |
| 10 | QCDocumentApprovals | Remap `itemHistoryId` |
| 11 | QCDocumentRevisions Phase 1 | Insert without `resolvedItemHistoryId` |
| 12 | QCDocumentRevisions Phase 2 | Update `resolvedItemHistoryId` via ID map |
| 13 | DataFileChangeRequests | Remap `fileId` |
| 14 | DataFileHistories | Remap `fileId` |

**Two-pass pattern for self-referential FKs**: Entities with self-referential foreign keys (`ChangeRequest.previousRequestId`, `QCDocumentRevision.resolvedItemHistoryId`) must be inserted in two passes — first without the FK to get new IDs, then update the FK using the ID mapping.

**File atomicity**: Files staged in memory as `pendingFiles[]` during ZIP parsing. Written to disk only after DB transaction succeeds. On error: best-effort cleanup via `unlinkSync` on already-written files.

**Auto pre-backup**: Before import, exports current DB to `backups/pre_import_<timestamp>.sql` on server filesystem. Failure logged but does not abort import.

---

## 4. ZIP Structure Specifications

### System Database Backup
```
rms_database_backup_YYYYMMDD.zip
├── manifest.json    (backupType: "database")
└── rms_db.sql       (full SQL dump)
```

### System ISO Docs Backup
```
isodocs-YYYYMMDD.zip
├── manifest.json    (backupType: "iso-docs")
└── iso_doc/         (entire public/iso_doc directory tree)
```

### System Uploads Backup
```
uploads-YYYYMMDD.zip
├── manifest.json    (backupType: "uploads")
├── uploads/         (entire public/uploads directory tree)
└── static/          (root-level image files from public/)
```

### Project Backup
```
project_<codePrefix>_backup_<date>.zip
├── manifest.json    (ExportManifest with counts + file checksums)
├── data.json        (all DB records as JSON with serialized dates/BigInts)
└── assets/
    ├── uploads/
    │   ├── <attachment files>
    │   └── datafiles/
    │       └── <datafile physical files>
    └── iso_doc/
        └── <QC PDF files>
```

---

## 5. Security Measures

### ZIP Slip Protection

All extraction paths are validated before any disk write:

```js
// AdmZip pattern (database restore, project import)
const resolved = path.resolve(targetDir, entry.entryName);
if (!resolved.startsWith(path.resolve(targetDir) + path.sep)) {
  throw new Error('ZIP Slip detected');
}

// unzipper pattern (file restores)
const resolved = path.resolve(destPath);
if (!resolved.startsWith(resolvedTargetDir + path.sep)) {
  throw new Error('ZIP Slip detected');
}
```

### SQL Statement Whitelist

```js
const ALLOWED_SQL_PREFIXES = [
  'INSERT INTO',
  'DELETE FROM',
  'TRUNCATE TABLE',
  'TRUNCATE',
  'SET CONSTRAINTS',
  'SET STATEMENT_TIMEOUT',
  'SET LOCK_TIMEOUT'
];
```

Intentionally excluded:
- `BEGIN`/`COMMIT` → Prisma manages transaction boundaries
- `SET session_replication_role` → requires superuser privilege; replaced by FK drop/recreate strategy
- Everything else (including `SET ROLE` which could escalate privileges) → **400 abort**

### SQL Content Validation (Pre-Execution)

Three regex checks prevent restoring a backup that would lock out all admins:
1. Must contain at least one `INSERT INTO` statement
2. Must contain at least one `INSERT INTO "User"` statement
3. Must contain at least one `INSERT INTO "User"` with `'ADMIN'` role

### Auth on Upload Routes

Restore routes are **excluded from Edge middleware** (body size limit issue) but implement their own auth:
```js
const session = await getServerSession(authOptions);
if (!session || session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: '未授權的訪問' }, { status: 401 });
}
```

### Force Logout After DB Restore

Dual-layer session invalidation:
1. **Server-side**: `forceLogoutAllUsers()` bumps `updatedAt` on all User records → JWT token comparison fails on next request
2. **Client-side**: UI calls `signOut({ callbackUrl: '/login' })` after 2-second delay

### Restore Confirmation UI Guards

- System restore: user must type exactly `RESTORE` (case-sensitive)
- Project import: user must type `IMPORT` (input is `.toUpperCase()` before comparison)

---

## 6. Transaction & FK Handling Strategy

### Problem

PostgreSQL FK constraints prevent `DELETE`/`TRUNCATE` of parent tables before child tables. `SET session_replication_role = replica` (which disables FK checks) requires superuser privilege, unavailable in managed/restricted PostgreSQL environments.

### Solution: Dynamic FK Drop/Recreate

```sql
-- Step 1: Discover all FK constraints
SELECT tc.table_name, tc.constraint_name,
       pg_get_constraintdef(c.oid) as constraint_def
FROM information_schema.table_constraints tc
JOIN pg_constraint c ON c.conname = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public';

-- Step 2: Drop each FK
ALTER TABLE "<table>" DROP CONSTRAINT "<name>";

-- Step 3: Execute all data statements
-- (INSERT, DELETE, TRUNCATE — order no longer matters)

-- Step 4: Recreate each FK
ALTER TABLE "<table>" ADD CONSTRAINT "<name>" <original_definition>;

-- Step 5: Reset sequences
SELECT setval('"<seq>"', COALESCE((SELECT MAX("<col>") FROM "<table>"), 0) + 1);
```

**Transaction config:**
```js
prisma.$transaction(async (tx) => { ... }, {
  maxWait: 30000,   // 30s to acquire connection
  timeout: 600000   // 10 min execution timeout
});
```

### Project Import: Two-Pass Self-Referential FK

For entities with self-referential FKs (where a record references another record in the same table):

```
Phase 1: Insert all records WITHOUT the self-referential FK → get new IDs
Phase 2: UPDATE records to set the self-referential FK using the ID mapping
```

This avoids circular dependency during insertion.

---

## 7. File Size & Middleware Considerations

### Edge Middleware Body Size Limit

Next.js Edge Runtime enforces a **10MB** request body limit. Backup restore uploads can be much larger, so these routes **must be excluded** from middleware:

```js
// src/middleware.ts matcher config
export const config = {
  matcher: [
    // Excludes: /api/admin/restore/*, /api/datafiles/upload, /api/upload
    '/((?!api/auth|api/health|api/admin/restore|api/datafiles/upload|api/upload|auth/login|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Server Actions Body Size

```js
// next.config.mjs
experimental: {
  serverActions: {
    bodySizeLimit: '100mb'
  }
}
```

### External Package for Edge Compatibility

```js
// next.config.mjs
serverExternalPackages: ['unzipper']
```

`unzipper` uses Node.js native modules incompatible with Edge Runtime — must be declared as external.

---

## 8. Key Design Decisions

### Why three different ZIP libraries?

| Library | Strength | Used For |
|---------|---------|---------|
| `archiver` | Stream-based creation, no memory buffering | All backup creation |
| `AdmZip` | Synchronous in-memory extraction, full control before disk write | DB restore (temp dir), project import (pure memory) |
| `unzipper` | Random-access buffer reading, selective entry extraction | File restores (no need to extract everything) |

### System restore is destructive; project import is not

- **System DB restore**: Full overwrite — drops all data, re-inserts everything. Needed for disaster recovery.
- **Project import**: Additive only — creates new records with remapped IDs. `codePrefix` conflicts are renamed (`_imported` suffix). `dataCode` conflicts silently reuse existing records.

### File write atomicity via memory staging

Project import stages all files in memory (`pendingFiles[]`) before any disk write. Disk writes happen only after the DB transaction succeeds. This prevents orphan files if the DB transaction fails. Trade-off: higher memory usage for projects with many/large files.

### Auto pre-backup before project import

Writes `backups/pre_import_<timestamp>.sql` as a safety net. Failure is non-blocking (logged only). No automatic cleanup of old pre-import backups.

### Sequence reset only needed for system DB restore

System DB restore inserts explicit `id` values from the backup → sequences are stale. Must manually `setval()` to `MAX(id) + 1`.
Project import uses `prisma.create()` → PostgreSQL auto-assigns IDs → sequences naturally advance.

### SQL escaping is minimal by design

`escapeValue()` only doubles single quotes (`'` → `''`). This is sufficient because the SQL whitelist filter prevents arbitrary SQL injection — only `INSERT INTO`, `DELETE FROM`, and `TRUNCATE` statements are allowed through.

---

## 9. Key Files Index

### Backup Utils
| File | Responsibility |
|------|---------------|
| `src/lib/backup-utils.ts` | `exportDatabaseToSQL()`, `generateDatabaseManifest()`, `generateFileManifest()`, `forceLogoutAllUsers()`, `escapeValue()`, `generateInsertStatements()` |
| `src/lib/backup/export-service.ts` | `exportProjectToZip()`, `exportProjectData()`, `collectProjectFiles()`, MD5 checksums, archiver pipeline |
| `src/lib/backup/import-service.ts` | `importProjectFromZip()`, `importProjectData()`, 14-step ID-remapping transaction, `checkImportConflicts()`, file staging |

### Backup API Routes
| Endpoint | File |
|----------|------|
| `POST /api/admin/backup/database` | `src/app/api/admin/backup/database/route.ts` |
| `POST /api/admin/backup/iso-docs` | `src/app/api/admin/backup/iso-docs/route.ts` |
| `POST /api/admin/backup/uploads` | `src/app/api/admin/backup/uploads/route.ts` |
| `POST /api/admin/backup/project/[id]` | `src/app/api/admin/backup/project/[id]/route.ts` |

### Restore API Routes
| Endpoint | File |
|----------|------|
| `POST /api/admin/restore/database` | `src/app/api/admin/restore/database/route.ts` |
| `POST /api/admin/restore/iso-docs` | `src/app/api/admin/restore/iso-docs/route.ts` |
| `POST /api/admin/restore/uploads` | `src/app/api/admin/restore/uploads/route.ts` |
| `PUT /api/admin/restore/project` | `src/app/api/admin/restore/project/route.ts` (conflict check) |
| `POST /api/admin/restore/project` | `src/app/api/admin/restore/project/route.ts` (execute import) |

### UI Components
| Component | File |
|-----------|------|
| System backup/restore | `src/components/admin/BackupRestoreSection.tsx` |
| Project backup/import | `src/components/admin/ProjectBackupSection.tsx` |

### Config
| File | Relevant Settings |
|------|------------------|
| `src/middleware.ts` | Restore route exclusions from Edge auth |
| `next.config.mjs` | `bodySizeLimit: '100mb'`, `serverExternalPackages: ['unzipper']`, standalone output |
| `prisma/schema.prisma` | All 15 table models defining backup scope |

---

## Appendix: Data Flow Diagrams

### System Database Backup → Restore Cycle

```
[Backup]
  Prisma findMany (all 15 tables, FK order)
    → generateInsertStatements() per table
    → SQL string
    → archiver ZIP (rms_db.sql + manifest.json)
    → Web ReadableStream response
    → .zip file downloaded by browser

[Restore]
  .zip uploaded via FormData
    → AdmZip extract to temp dir
    → Read manifest.json (validate backupType)
    → Read rms_db.sql
    → Split statements, whitelist filter
    → prisma.$transaction {
        Query FK constraints from pg_catalog
        → DROP all FKs
        → Execute all statements
        → ADD all FKs back
        → Reset all sequences
      }
    → forceLogoutAllUsers()
    → Client signOut()
```

### Project Export → Import Cycle

```
[Export]
  exportProjectData() — fetch all related records
    → collectProjectFiles() — map physical files to ZIP paths
    → calculateFileChecksum() — MD5 per file
    → serializeData() — BigInt/Date conversion
    → archiver ZIP (manifest.json + data.json + assets/**)
    → Buffer response

[Import]
  .zip uploaded via FormData
    → Auto pre-backup (SQL to server disk)
    → AdmZip in-memory extraction
    → Parse manifest.json + data.json
    → Stage files in pendingFiles[] (memory only)
    → prisma.$transaction (120s timeout) {
        14-step ID remapping:
        Upsert category → Create project (rename if conflict)
        → Create items (parentless first, regenerateFullId)
        → Create relations → Upsert dataFiles
        → Create references (unique check)
        → ChangeRequests 2-pass (self-ref FK)
        → Create histories → Create approvals
        → QCRevisions 2-pass (self-ref FK)
        → Create dataFileChangeRequests → Create dataFileHistories
      }
    → Write pendingFiles[] to disk
    → On error: unlinkSync each written file
```
