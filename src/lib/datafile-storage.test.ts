import { afterEach, describe, expect, it } from 'vitest';
import { access, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import {
    buildDataFileUploadTarget,
    prepareDataFileUploadTarget,
    resolveDataFilePath,
    resolveDataFilePathSafely,
    UnsafeUploadPathError,
} from './datafile-storage';

describe('DataFile storage paths', () => {
    const tempDirectories: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
    });

    async function createWorkspace(): Promise<string> {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'rms-datafile-storage-'));
        tempDirectories.push(directory);
        return directory;
    }

    it('maps the canonical DataFile URL to public/uploads/datafiles', async () => {
        const cwd = await createWorkspace();
        const target = buildDataFileUploadTarget({
            cwd,
            dataYear: '2026',
            userId: 'user-1',
            subDir: 'abc123',
            fileName: 'file.pdf',
        });

        expect(target.urlPath).toBe('/uploads/datafiles/2026/user-1/abc123/file.pdf');
        expect(target.absolutePath).toBe(
            path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user-1', 'abc123', 'file.pdf'),
        );
        expect(target.directoryPath).toBe(path.dirname(target.absolutePath));
    });

    it.each([
        '/uploads/datafiles/2026/../outside/file.pdf',
        '/uploads/datafiles/2026/user\\outside/file.pdf',
        '/uploads/datafiles/2026/user/file\0.pdf',
        '/uploads/datafiles-evil/2026/user/file.pdf',
        '/uploads/datafiles',
        '/uploads/2026/user/file.pdf',
    ])('rejects unsafe or non-canonical URL %s', (filePath) => {
        expect(() => resolveDataFilePath(filePath)).toThrow(UnsafeUploadPathError);
    });

    it('does not decode percent literals a second time', async () => {
        const cwd = await createWorkspace();
        const urlPath = '/uploads/datafiles/2026/user/subdir/name%2Fwith-percent.pdf';
        const resolved = resolveDataFilePath(urlPath, cwd);
        expect(resolved).toBe(
            path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user', 'subdir', 'name%2Fwith-percent.pdf'),
        );
    });

    it('rejects a descendant symlink escaping the DataFile root', async () => {
        const cwd = await createWorkspace();
        const dataFilesRoot = path.join(cwd, 'public', 'uploads', 'datafiles');
        const outside = path.join(cwd, 'outside');
        await mkdir(dataFilesRoot, { recursive: true });
        await mkdir(outside, { recursive: true });
        await writeFile(path.join(outside, 'secret.pdf'), 'secret');
        await symlink(outside, path.join(dataFilesRoot, '2026'));

        await expect(
            resolveDataFilePathSafely('/uploads/datafiles/2026/user/secret.pdf', cwd, { allowMissing: true }),
        ).rejects.toThrow(UnsafeUploadPathError);
    });

    it('rejects a descendant symlink before mkdir can create outside directories', async () => {
        const cwd = await createWorkspace();
        const dataFilesRoot = path.join(cwd, 'public', 'uploads', 'datafiles');
        const outside = path.join(cwd, 'outside');
        await mkdir(dataFilesRoot, { recursive: true });
        await mkdir(outside, { recursive: true });
        await symlink(outside, path.join(dataFilesRoot, '2026'));
        const target = buildDataFileUploadTarget({
            cwd,
            dataYear: 2026,
            userId: 'user-1',
            subDir: 'abc123',
            fileName: 'file.pdf',
        });

        await expect(prepareDataFileUploadTarget(target, cwd)).rejects.toThrow(UnsafeUploadPathError);
        await expect(access(path.join(outside, 'user-1'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('rejects a symlinked public/uploads trust boundary', async () => {
        const cwd = await createWorkspace();
        const publicDirectory = path.join(cwd, 'public');
        const outside = path.join(cwd, 'outside-uploads');
        await mkdir(publicDirectory, { recursive: true });
        await mkdir(outside, { recursive: true });
        await symlink(outside, path.join(publicDirectory, 'uploads'));
        const target = buildDataFileUploadTarget({
            cwd,
            dataYear: 2026,
            userId: 'user-1',
            subDir: 'abc123',
            fileName: 'file.pdf',
        });

        await expect(prepareDataFileUploadTarget(target, cwd)).rejects.toThrow(UnsafeUploadPathError);
        await expect(access(path.join(outside, 'datafiles'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('accepts a missing final file after checking the existing parent', async () => {
        const cwd = await createWorkspace();
        await mkdir(path.join(cwd, 'public', 'uploads', 'datafiles'), { recursive: true });
        const urlPath = '/uploads/datafiles/2026/user/subdir/new.pdf';
        const resolved = await resolveDataFilePathSafely(urlPath, cwd, { allowMissing: true });
        expect(resolved).toBe(path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user', 'subdir', 'new.pdf'));
    });

    it('creates a fresh deployment storage tree under the trusted cwd', async () => {
        const cwd = await createWorkspace();
        const target = buildDataFileUploadTarget({
            cwd,
            dataYear: 2026,
            userId: 'user-1',
            subDir: 'abc123',
            fileName: 'file.pdf',
        });

        const resolved = await prepareDataFileUploadTarget(target, cwd);
        await writeFile(resolved, 'fresh');
        expect(await readFile(resolved, 'utf8')).toBe('fresh');
    });

    it('allows a regular file and preserves its contents', async () => {
        const cwd = await createWorkspace();
        const target = buildDataFileUploadTarget({
            cwd,
            dataYear: 2026,
            userId: 'user-1',
            subDir: 'abc123',
            fileName: 'file.pdf',
        });
        await mkdir(target.directoryPath, { recursive: true });
        await writeFile(target.absolutePath, 'ok');

        const resolved = await resolveDataFilePathSafely(target.urlPath, cwd);
        expect((await lstat(resolved)).isFile()).toBe(true);
        expect(await readFile(resolved, 'utf8')).toBe('ok');
    });
});
