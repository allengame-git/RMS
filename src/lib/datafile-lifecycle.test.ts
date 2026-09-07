import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { buildDataFileUploadTarget } from './datafile-storage';
import { cleanupApprovedDataFile, DataFileCleanupDb } from './datafile-lifecycle';

describe('approved DataFile physical cleanup', () => {
    let cwd: string;
    let db: {
        dataFile: { findFirst: ReturnType<typeof vi.fn> };
        dataFileChangeRequest: { findMany: ReturnType<typeof vi.fn> };
    };

    beforeEach(async () => {
        cwd = await mkdtemp(path.join(os.tmpdir(), 'rms-datafile-lifecycle-'));
        await mkdir(path.join(cwd, 'public', 'uploads', 'datafiles'), { recursive: true });
        db = {
            dataFile: { findFirst: vi.fn().mockResolvedValue(null) },
            dataFileChangeRequest: { findMany: vi.fn().mockResolvedValue([]) },
        };
    });

    afterEach(async () => {
        await rm(cwd, { recursive: true, force: true });
    });

    async function createFile() {
        const target = buildDataFileUploadTarget({
            cwd,
            dataYear: 2026,
            userId: 'user-1',
            subDir: 'abc123',
            fileName: 'file.pdf',
        });
        await mkdir(target.directoryPath, { recursive: true });
        await writeFile(target.absolutePath, 'file');
        return target;
    }

    it('deletes the physical file after the database commit', async () => {
        const target = await createFile();

        const result = await cleanupApprovedDataFile(
            db as unknown as DataFileCleanupDb,
            10,
            target.urlPath,
            cwd,
        );

        expect(result).toEqual({ status: 'deleted' });
        await expect(access(target.absolutePath)).rejects.toMatchObject({ code: 'ENOENT' });
        expect(db.dataFile.findFirst).toHaveBeenCalledWith({
            where: { id: { not: 10 }, isDeleted: false, filePath: target.urlPath },
            select: { id: true },
        });
    });

    it('treats an already missing file as idempotent', async () => {
        const target = buildDataFileUploadTarget({
            cwd,
            dataYear: 2026,
            userId: 'user-1',
            subDir: 'abc123',
            fileName: 'missing.pdf',
        });

        await expect(
            cleanupApprovedDataFile(db as unknown as DataFileCleanupDb, 10, target.urlPath, cwd),
        ).resolves.toEqual({ status: 'missing' });
    });

    it.skipIf(process.platform === 'win32')('logs and retains a file when unlink is denied', async () => {
        const target = await createFile();
        await chmod(target.directoryPath, 0o555);

        let result: Awaited<ReturnType<typeof cleanupApprovedDataFile>>;
        try {
            result = await cleanupApprovedDataFile(
                db as unknown as DataFileCleanupDb,
                10,
                target.urlPath,
                cwd,
            );
        } finally {
            await chmod(target.directoryPath, 0o755);
        }

        expect(result!).toEqual({ status: 'error' });
        await expect(access(target.absolutePath)).resolves.toBeUndefined();
    });

    it('retains a file referenced by another active DataFile', async () => {
        const target = await createFile();
        db.dataFile.findFirst.mockResolvedValue({ id: 11 });

        await expect(
            cleanupApprovedDataFile(db as unknown as DataFileCleanupDb, 10, target.urlPath, cwd),
        ).resolves.toEqual({ status: 'skipped-active-reference', fileId: 11 });
        await expect(rm(target.absolutePath)).resolves.toBeUndefined();
        expect(db.dataFileChangeRequest.findMany).not.toHaveBeenCalled();
    });

    it('retains a file referenced by a pending CREATE request', async () => {
        const target = await createFile();
        db.dataFileChangeRequest.findMany.mockResolvedValue([
            { data: JSON.stringify({ filePath: target.urlPath }) },
        ]);

        await expect(
            cleanupApprovedDataFile(db as unknown as DataFileCleanupDb, 10, target.urlPath, cwd),
        ).resolves.toEqual({ status: 'skipped-pending-create' });
        await expect(rm(target.absolutePath)).resolves.toBeUndefined();
    });

    it('fails closed when reference lookup fails', async () => {
        const target = await createFile();
        db.dataFile.findFirst.mockRejectedValue(new Error('database unavailable'));

        await expect(
            cleanupApprovedDataFile(db as unknown as DataFileCleanupDb, 10, target.urlPath, cwd),
        ).resolves.toEqual({ status: 'error' });
        await expect(rm(target.absolutePath)).resolves.toBeUndefined();
    });

    it('refuses a symlink that points outside the DataFile root', async () => {
        const target = buildDataFileUploadTarget({
            cwd,
            dataYear: 2026,
            userId: 'user-1',
            subDir: 'abc123',
            fileName: 'file.pdf',
        });
        const outside = path.join(cwd, 'outside.pdf');
        await writeFile(outside, 'must keep');
        await mkdir(target.directoryPath, { recursive: true });
        await symlink(outside, target.absolutePath);

        await expect(
            cleanupApprovedDataFile(db as unknown as DataFileCleanupDb, 10, target.urlPath, cwd),
        ).resolves.toEqual({ status: 'invalid-path' });
        await expect(rm(outside)).resolves.toBeUndefined();
    });
});
