/**
 * Post-transaction lifecycle operations for DataFiles.
 *
 * Database approval is the source of truth.  Physical file removal is best
 * effort and happens only after a successful FILE_DELETE transaction.  A
 * cleanup failure must never make a committed approval look rolled back.
 */

import { unlink } from 'fs/promises';
import { resolveDataFilePath, resolveDataFilePathSafely } from '@/lib/datafile-storage';

export interface DataFileCleanupDb {
    dataFile: {
        findFirst(args: {
            where: {
                id: { not: number };
                isDeleted: false;
                filePath: string;
            };
            select: { id: true };
        }): Promise<{ id: number } | null>;
    };
    dataFileChangeRequest: {
        findMany(args: {
            where: { type: 'FILE_CREATE'; status: 'PENDING' };
            select: { data: true };
        }): Promise<Array<{ data: string }>>;
    };
}

export type DataFileCleanupResult =
    | { status: 'deleted' }
    | { status: 'missing' }
    | { status: 'skipped-active-reference'; fileId: number }
    | { status: 'skipped-pending-create' }
    | { status: 'invalid-path' }
    | { status: 'error' };

function isNodeError(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}

/**
 * Remove an approved DataFile's physical file when it is no longer referenced.
 *
 * The active-file and pending-create checks intentionally happen immediately
 * before unlink.  A new reference can still race in after these checks and
 * before unlink; no schema-level reference lock or garbage collector is in
 * scope, so this residual concurrency limitation is documented explicitly.
 */
export async function cleanupApprovedDataFile(
    db: DataFileCleanupDb,
    fileId: number,
    filePath: string,
    cwd = process.cwd(),
): Promise<DataFileCleanupResult> {
    let absolutePath: string;
    try {
        // The path must be rooted in DataFile storage and pass symlink checks
        // before we consider the missing-file case idempotent.
        absolutePath = await resolveDataFilePathSafely(filePath, cwd);
    } catch (error: unknown) {
        if (isNodeError(error, 'ENOENT')) {
            // The root or one of the already-created directories may have
            // disappeared.  Validate the URL lexically before treating this
            // as an idempotent missing-file case.  Do not fall back to
            // unlinking a lexical path: a concurrent root replacement could
            // otherwise turn a missing-root condition into a symlink race.
            try {
                resolveDataFilePath(filePath, cwd);
            } catch (pathError: unknown) {
                console.error('[DataFile cleanup] Refusing unsafe/unresolvable path', { filePath, error: pathError });
                return { status: 'invalid-path' };
            }
            return { status: 'missing' };
        } else {
            console.error('[DataFile cleanup] Refusing unsafe/unresolvable path', { filePath, error });
            return { status: 'invalid-path' };
        }
    }

    let activeReference: { id: number } | null;
    try {
        activeReference = await db.dataFile.findFirst({
            where: {
                id: { not: fileId },
                isDeleted: false,
                filePath,
            },
            select: { id: true },
        });
    } catch (error: unknown) {
        // Fail closed if reference state cannot be established.
        console.error('[DataFile cleanup] Could not inspect active references; retaining file', { fileId, filePath, error });
        return { status: 'error' };
    }

    if (activeReference) {
        console.warn('[DataFile cleanup] Physical file retained for active DataFile reference', {
            fileId,
            activeFileId: activeReference.id,
            filePath,
        });
        return { status: 'skipped-active-reference', fileId: activeReference.id };
    }

    let pendingCreates: Array<{ data: string }>;
    try {
        pendingCreates = await db.dataFileChangeRequest.findMany({
            where: { type: 'FILE_CREATE', status: 'PENDING' },
            select: { data: true },
        });
    } catch (error: unknown) {
        // Fail closed if pending CREATE state cannot be established.
        console.error('[DataFile cleanup] Could not inspect pending CREATE references; retaining file', {
            fileId,
            filePath,
            error,
        });
        return { status: 'error' };
    }

    for (const pending of pendingCreates) {
        try {
            const data: unknown = JSON.parse(pending.data);
            if (
                data !== null &&
                typeof data === 'object' &&
                'filePath' in data &&
                typeof data.filePath === 'string' &&
                data.filePath === filePath
            ) {
                console.warn('[DataFile cleanup] Physical file retained for pending CREATE reference', { fileId, filePath });
                return { status: 'skipped-pending-create' };
            }
        } catch (error: unknown) {
            // A malformed pending request cannot prove that the path is unused.
            console.error('[DataFile cleanup] Could not parse pending CREATE reference; retaining file', {
                fileId,
                filePath,
                error,
            });
            return { status: 'error' };
        }
    }

    try {
        await unlink(absolutePath);
        return { status: 'deleted' };
    } catch (error: unknown) {
        if (isNodeError(error, 'ENOENT')) {
            return { status: 'missing' };
        }
        // The database commit already succeeded.  Log the operational failure
        // and report it separately so callers do not claim a rollback.
        console.error('[DataFile cleanup] Failed to remove physical file after commit', {
            fileId,
            filePath,
            error,
        });
        return { status: 'error' };
    }
}
