/**
 * Shared path handling for DataFile uploads.
 *
 * DataFile paths are stored as public URL paths (for example
 * `/uploads/datafiles/2026/user-id/abc/uuid.pdf`).  The same path must be
 * resolved relative to the application's `public` directory everywhere it
 * is used.  This module deliberately does not URI-decode path segments:
 * Next.js has already decoded route parameters and a literal `%` in a legacy
 * filename must not be decoded a second time.
 */

import path from 'path';
import { lstat, mkdir, realpath } from 'fs/promises';

export const UPLOADS_URL_PREFIX = '/uploads';
export const DATAFILES_URL_PREFIX = '/uploads/datafiles';

export class UnsafeUploadPathError extends Error {
    readonly code = 'UNSAFE_UPLOAD_PATH';

    constructor(message = 'Unsafe upload path') {
        super(message);
        this.name = 'UnsafeUploadPathError';
    }
}

export interface DataFileUploadTarget {
    /** Canonical URL path stored in DataFile.filePath. */
    urlPath: string;
    /** Absolute path for the directory that contains the upload. */
    directoryPath: string;
    /** Absolute path for the uploaded file. */
    absolutePath: string;
}

export interface DataFileUploadTargetInput {
    dataYear: string | number;
    userId: string;
    subDir: string;
    fileName: string;
    cwd?: string;
}

function isWithinRoot(rootPath: string, candidatePath: string): boolean {
    const relative = path.relative(rootPath, candidatePath);
    return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function isWithinOrEqualRoot(rootPath: string, candidatePath: string): boolean {
    return candidatePath === rootPath || isWithinRoot(rootPath, candidatePath);
}

function isNodeError(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}

function rejectUnsafeSegment(segment: string, fieldName: string): void {
    if (!segment || segment === '.' || segment === '..') {
        throw new UnsafeUploadPathError(`Invalid ${fieldName} path segment`);
    }

    // Both separators are rejected even on POSIX.  This keeps values safe if
    // the same request is later handled on Windows.
    if (segment.includes('/') || segment.includes('\\') || segment.includes('\0')) {
        throw new UnsafeUploadPathError(`Invalid ${fieldName} path segment`);
    }
}

function assertRelativeSegments(segments: readonly string[], fieldName: string): void {
    if (segments.length === 0) {
        throw new UnsafeUploadPathError(`Missing ${fieldName} path`);
    }
    segments.forEach((segment) => rejectUnsafeSegment(segment, fieldName));
}

function assertCanonicalDataFileUrl(filePath: string): string[] {
    if (typeof filePath !== 'string' || filePath.length === 0) {
        throw new UnsafeUploadPathError('Invalid DataFile URL path');
    }
    if (filePath.includes('\0') || filePath.includes('\\')) {
        throw new UnsafeUploadPathError('Invalid DataFile URL path');
    }

    const prefix = `${DATAFILES_URL_PREFIX}/`;
    if (!filePath.startsWith(prefix)) {
        throw new UnsafeUploadPathError('DataFile path is outside the DataFile upload root');
    }

    // Do not call decodeURIComponent here.  Route params are already decoded
    // by Next.js; encoded percent literals are intentionally left untouched.
    const segments = filePath.slice(prefix.length).split('/');
    assertRelativeSegments(segments, 'DataFile');
    return segments;
}

function assertUploadSegments(segments: readonly string[]): void {
    assertRelativeSegments(segments, 'upload');
}

export function getUploadsRoot(cwd = process.cwd()): string {
    return path.resolve(cwd, 'public', 'uploads');
}

export function getDataFilesRoot(cwd = process.cwd()): string {
    return path.resolve(cwd, 'public', 'uploads', 'datafiles');
}

/**
 * Resolve a DataFile URL path lexically under public/uploads/datafiles.
 * This performs strict validation but does not touch the filesystem.
 */
export function resolveDataFilePath(filePath: string, cwd = process.cwd()): string {
    const segments = assertCanonicalDataFileUrl(filePath);
    const root = getDataFilesRoot(cwd);
    const resolved = path.resolve(root, ...segments);

    // Keep this explicit even though segments are validated.  It protects the
    // boundary if this function is changed to accept additional path forms.
    if (!isWithinRoot(root, resolved)) {
        throw new UnsafeUploadPathError('DataFile path escapes the upload root');
    }
    return resolved;
}

/**
 * Resolve a route's path segments lexically under public/uploads.
 * The route intentionally passes params through unchanged; no URL decoding
 * or basename sanitization is performed here.
 */
export function resolveUploadsPath(segments: readonly string[], cwd = process.cwd()): string {
    assertUploadSegments(segments);
    const root = getUploadsRoot(cwd);
    const resolved = path.resolve(root, ...segments);
    if (!isWithinRoot(root, resolved)) {
        throw new UnsafeUploadPathError('Upload path escapes the upload root');
    }
    return resolved;
}

/**
 * Build the canonical URL and disk target for a newly generated DataFile.
 * Callers are expected to generate a unique filename before calling this.
 */
export function buildDataFileUploadTarget(input: DataFileUploadTargetInput): DataFileUploadTarget {
    const year = String(input.dataYear);
    rejectUnsafeSegment(year, 'dataYear');
    rejectUnsafeSegment(input.userId, 'userId');
    rejectUnsafeSegment(input.subDir, 'subDir');
    rejectUnsafeSegment(input.fileName, 'fileName');

    const urlPath = `${DATAFILES_URL_PREFIX}/${year}/${input.userId}/${input.subDir}/${input.fileName}`;
    const absolutePath = resolveDataFilePath(urlPath, input.cwd);
    return {
        urlPath,
        directoryPath: path.dirname(absolutePath),
        absolutePath,
    };
}

/**
 * Create an upload directory only after validating its existing ancestors,
 * then validate the resulting tree once more before a caller writes a file.
 */
export async function prepareDataFileUploadTarget(
    target: DataFileUploadTarget,
    cwd = process.cwd(),
): Promise<string> {
    const expectedAbsolutePath = resolveDataFilePath(target.urlPath, cwd);
    if (target.absolutePath !== expectedAbsolutePath || target.directoryPath !== path.dirname(expectedAbsolutePath)) {
        throw new UnsafeUploadPathError('Upload target does not match its canonical URL');
    }
    await resolveDataFilePathSafely(target.urlPath, cwd, { allowMissing: true });
    await mkdir(target.directoryPath, { recursive: true });
    return resolveDataFilePathSafely(target.urlPath, cwd, { allowMissing: true });
}

async function nearestExistingRealPath(candidatePath: string): Promise<string> {
    let current = candidatePath;
    while (true) {
        try {
            return await realpath(current);
        } catch (error: unknown) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
                throw error;
            }
            const parent = path.dirname(current);
            if (parent === current) throw error;
            current = parent;
        }
    }
}

/**
 * Reject symlink components below the configured root.  The root itself is
 * checked separately because it is the deployment-owned trust boundary.
 */
async function assertNoSymlinkComponents(root: string, candidate: string): Promise<void> {
    const relative = path.relative(root, candidate);
    if (relative === '' || path.isAbsolute(relative) || relative.startsWith(`..${path.sep}`) || relative === '..') {
        throw new UnsafeUploadPathError('Path is outside the upload root');
    }

    let current = root;
    for (const segment of relative.split(path.sep)) {
        current = path.join(current, segment);
        try {
            const stats = await lstat(current);
            if (stats.isSymbolicLink()) {
                throw new UnsafeUploadPathError('Symlinked upload path is not allowed');
            }
        } catch (error: unknown) {
            if (error instanceof UnsafeUploadPathError) throw error;
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
                throw error;
            }
            // A missing descendant cannot hide a symlink below it.  Its
            // existing parent is checked, and the caller may explicitly allow
            // a missing final file for a new upload.
            return;
        }
    }
}

export interface SafePathOptions {
    /** Allow a missing final file (used immediately before an upload write). */
    allowMissing?: boolean;
}

/**
 * Resolve an existing upload path while checking realpath containment and
 * symlink components.  The returned value is the lexical path suitable for
 * fs APIs; realpath is used only for the safety check.
 */
export async function resolveDataFilePathSafely(
    filePath: string,
    cwd = process.cwd(),
    options: SafePathOptions = {},
): Promise<string> {
    const lexicalPath = resolveDataFilePath(filePath, cwd);
    const root = getDataFilesRoot(cwd);
    const trustedRoot = path.resolve(cwd);

    // Check from the trusted application cwd, rather than requiring every
    // storage directory to exist.  This both rejects symlinked public/uploads
    // or datafiles ancestors and permits a fresh deployment to create missing
    // directories below the trusted cwd.
    await assertNoSymlinkComponents(trustedRoot, lexicalPath);

    let rootRealPath: string;
    try {
        rootRealPath = await realpath(root);
    } catch (error: unknown) {
        if (options.allowMissing && isNodeError(error, 'ENOENT')) return lexicalPath;
        throw error;
    }

    let checkedPath: string;
    try {
        checkedPath = await realpath(lexicalPath);
    } catch (error: unknown) {
        if (!options.allowMissing || !(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
            throw error;
        }
        checkedPath = await nearestExistingRealPath(path.dirname(lexicalPath));
    }

    if (!(options.allowMissing ? isWithinOrEqualRoot(rootRealPath, checkedPath) : isWithinRoot(rootRealPath, checkedPath))) {
        throw new UnsafeUploadPathError('Resolved DataFile path escapes the upload root');
    }
    return lexicalPath;
}

export async function resolveUploadsPathSafely(
    segments: readonly string[],
    cwd = process.cwd(),
    options: SafePathOptions = {},
): Promise<string> {
    const lexicalPath = resolveUploadsPath(segments, cwd);
    const root = getUploadsRoot(cwd);
    const trustedRoot = path.resolve(cwd);
    await assertNoSymlinkComponents(trustedRoot, lexicalPath);

    let rootRealPath: string;
    try {
        rootRealPath = await realpath(root);
    } catch (error: unknown) {
        if (options.allowMissing && isNodeError(error, 'ENOENT')) return lexicalPath;
        throw error;
    }

    let checkedPath: string;
    try {
        checkedPath = await realpath(lexicalPath);
    } catch (error: unknown) {
        if (!options.allowMissing || !(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
            throw error;
        }
        checkedPath = await nearestExistingRealPath(path.dirname(lexicalPath));
    }

    if (!(options.allowMissing ? isWithinOrEqualRoot(rootRealPath, checkedPath) : isWithinRoot(rootRealPath, checkedPath))) {
        throw new UnsafeUploadPathError('Resolved upload path escapes the upload root');
    }
    return lexicalPath;
}
