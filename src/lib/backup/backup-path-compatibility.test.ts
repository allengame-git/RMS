import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdmZip from 'adm-zip';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { Writable } from 'stream';

const mocks = vi.hoisted(() => ({
    prisma: {
        $transaction: vi.fn(),
        project: { findUnique: vi.fn(), create: vi.fn() },
        projectCategory: { findUnique: vi.fn(), create: vi.fn() },
        item: { findMany: vi.fn(), create: vi.fn() },
        itemRelation: { findMany: vi.fn(), create: vi.fn() },
        dataFile: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
        itemReference: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
        changeRequest: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
        itemHistory: { findMany: vi.fn(), create: vi.fn() },
        qCDocumentApproval: { findMany: vi.fn(), create: vi.fn() },
        qCDocumentRevision: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
        dataFileChangeRequest: { findMany: vi.fn(), create: vi.fn() },
        dataFileHistory: { findMany: vi.fn(), create: vi.fn() },
    },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

import { exportProjectToZip } from './export-service';
import { importProjectFromZip } from './import-service';

const originalCwd = process.cwd();
const temporaryDirectories: string[] = [];

function makeDataFile(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        dataYear: 2026,
        dataName: 'Data file',
        dataCode: 'DF-001',
        author: 'Author',
        description: 'Description',
        fileName: 'report.pdf',
        filePath: '/uploads/datafiles/2026/user-1/abc123/report.pdf',
        fileSize: 7,
        mimeType: 'application/pdf',
        isDeleted: false,
        currentVersion: 1,
        ...overrides,
    };
}

function makeData(dataFiles: Array<Record<string, unknown>>) {
    return {
        projectCategory: null,
        project: {
            id: 1,
            title: 'Imported project',
            description: null,
            codePrefix: 'WQ',
            categoryId: null,
        },
        items: [],
        itemRelations: [],
        dataFiles,
        itemReferences: [],
        changeRequests: [],
        itemHistories: [],
        qcDocumentApprovals: [],
        qcDocumentRevisions: [],
        dataFileChangeRequests: [],
        dataFileHistories: [],
    };
}

function makeArchive(
    data: ReturnType<typeof makeData>,
    assets: Array<{ name: string; content: string }>,
    putMetadataLast = false,
): Buffer {
    const zip = new AdmZip();
    const addMetadata = () => {
        zip.addFile('manifest.json', Buffer.from(JSON.stringify({ version: '1.0.0', files: [] })));
        zip.addFile('data.json', Buffer.from(JSON.stringify(data)));
    };

    if (!putMetadataLast) addMetadata();
    for (const asset of assets) zip.addFile(asset.name, Buffer.from(asset.content));
    if (putMetadataLast) addMetadata();
    return zip.toBuffer();
}

async function createWorkspace(): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'rms-backup-path-'));
    temporaryDirectories.push(directory);
    process.chdir(directory);
    await mkdir(path.join(directory, 'public', 'uploads', 'datafiles'), { recursive: true });
    return directory;
}

function configureEmptyTransaction(): void {
    mocks.prisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mocks.prisma) => Promise<unknown>) => callback(mocks.prisma),
    );
    mocks.prisma.project.findUnique.mockResolvedValue(null);
    mocks.prisma.project.create.mockResolvedValue({ id: 2 });
    mocks.prisma.dataFile.findUnique.mockResolvedValue(null);
    mocks.prisma.dataFile.create.mockResolvedValue({ id: 3 });
    mocks.prisma.item.findMany.mockResolvedValue([]);
    mocks.prisma.itemRelation.findMany.mockResolvedValue([]);
    mocks.prisma.itemReference.findMany.mockResolvedValue([]);
    mocks.prisma.dataFile.findMany.mockResolvedValue([]);
    mocks.prisma.changeRequest.findMany.mockResolvedValue([]);
    mocks.prisma.itemHistory.findMany.mockResolvedValue([]);
    mocks.prisma.qCDocumentApproval.findMany.mockResolvedValue([]);
    mocks.prisma.qCDocumentRevision.findMany.mockResolvedValue([]);
    mocks.prisma.dataFileChangeRequest.findMany.mockResolvedValue([]);
    mocks.prisma.dataFileHistory.findMany.mockResolvedValue([]);
}

beforeEach(() => {
    vi.clearAllMocks();
    configureEmptyTransaction();
});

afterEach(async () => {
    process.chdir(originalCwd);
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('project backup DataFile paths', () => {
    it('exports the complete nested DataFile path in the archive', async () => {
        const cwd = await createWorkspace();
        const relativePath = '2026/user-1/abc123/report.pdf';
        const sourcePath = path.join(cwd, 'public', 'uploads', 'datafiles', relativePath);
        await mkdir(path.dirname(sourcePath), { recursive: true });
        await writeFile(sourcePath, 'archive me');

        mocks.prisma.project.findUnique.mockResolvedValue({
            id: 1,
            title: 'Project',
            codePrefix: 'WQ',
            category: null,
        });
        mocks.prisma.item.findMany.mockResolvedValue([]);
        mocks.prisma.itemRelation.findMany.mockResolvedValue([]);
        mocks.prisma.itemReference.findMany.mockResolvedValue([]);
        mocks.prisma.dataFile.findMany.mockResolvedValue([
            makeDataFile(),
            makeDataFile({ id: 2, dataCode: 'DF-002' }),
        ]);
        mocks.prisma.itemHistory.findMany.mockResolvedValue([]);
        mocks.prisma.qCDocumentApproval.findMany.mockResolvedValue([]);
        mocks.prisma.qCDocumentRevision.findMany.mockResolvedValue([]);
        mocks.prisma.dataFileChangeRequest.findMany.mockResolvedValue([]);
        mocks.prisma.dataFileHistory.findMany.mockResolvedValue([]);

        const chunks: Buffer[] = [];
        const output = new Writable({
            write(chunk: Buffer, _encoding, callback) {
                chunks.push(Buffer.from(chunk));
                callback();
            },
        });
        const { manifest } = await exportProjectToZip(1, output);

        expect(manifest.files.map((file) => file.path)).toContain(
            'assets/uploads/datafiles/2026/user-1/abc123/report.pdf',
        );
        const archive = new AdmZip(Buffer.concat(chunks));
        expect(archive.getEntries().filter((entry) => entry.entryName === 'assets/uploads/datafiles/2026/user-1/abc123/report.pdf')).toHaveLength(1);
        expect(archive.getEntry('assets/uploads/datafiles/2026/user-1/abc123/report.pdf')?.getData().toString()).toBe(
            'archive me',
        );
    });
});

describe('project restore DataFile paths', () => {
    it('restores a current-format nested asset to its DataFile path', async () => {
        const cwd = await createWorkspace();
        const data = makeData([makeDataFile()]);
        const archive = makeArchive(
            data,
            [{ name: 'assets/uploads/datafiles/2026/user-1/abc123/report.pdf', content: 'nested content' }],
            true,
        );

        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(true);
        expect(await readFile(path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user-1', 'abc123', 'report.pdf'), 'utf8')).toBe(
            'nested content',
        );
    });

    it('maps a legacy flattened asset when its basename is unique', async () => {
        const cwd = await createWorkspace();
        const data = makeData([makeDataFile()]);
        const archive = makeArchive(data, [{ name: 'assets/uploads/datafiles/report.pdf', content: 'legacy content' }]);

        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(true);
        expect(await readFile(path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user-1', 'abc123', 'report.pdf'), 'utf8')).toBe(
            'legacy content',
        );
    });

    it('rejects a legacy flattened asset when basename mapping is ambiguous', async () => {
        await createWorkspace();
        const data = makeData([
            makeDataFile({ id: 1, dataCode: 'DF-001', filePath: '/uploads/datafiles/2026/user-1/first/report.pdf' }),
            makeDataFile({ id: 2, dataCode: 'DF-002', filePath: '/uploads/datafiles/2027/user-2/second/report.pdf' }),
        ]);
        const archive = makeArchive(data, [{ name: 'assets/uploads/datafiles/report.pdf', content: 'ambiguous' }]);

        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('對應不明確');
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('treats duplicate records with the same canonical path as one legacy mapping', async () => {
        const cwd = await createWorkspace();
        const canonicalPath = '/uploads/datafiles/2026/user-1/shared/report.pdf';
        const data = makeData([
            makeDataFile({ id: 1, dataCode: 'DF-001', filePath: canonicalPath }),
            makeDataFile({ id: 2, dataCode: 'DF-002', filePath: canonicalPath }),
        ]);
        const archive = makeArchive(data, [{ name: 'assets/uploads/datafiles/report.pdf', content: 'shared content' }]);

        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(true);
        expect(result.stats.filesRestored).toBe(1);
        expect(await readFile(path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user-1', 'shared', 'report.pdf'), 'utf8')).toBe(
            'shared content',
        );
    });

    it('does not overwrite the physical asset of a reused DataFile', async () => {
        const cwd = await createWorkspace();
        const dataFile = makeDataFile();
        const targetPath = path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user-1', 'abc123', 'report.pdf');
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, 'existing content');
        mocks.prisma.dataFile.findUnique.mockResolvedValue({ id: 99, filePath: dataFile.filePath });

        const archive = makeArchive(dataForSingle(dataFile), [
            { name: 'assets/uploads/datafiles/2026/user-1/abc123/report.pdf', content: 'archive content' },
        ]);
        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(true);
        expect(result.stats.filesRestored).toBe(0);
        expect(await readFile(targetPath, 'utf8')).toBe('existing content');
    });

    it('does not overwrite an existing target for a newly imported DataFile', async () => {
        const cwd = await createWorkspace();
        const dataFile = makeDataFile();
        const targetPath = path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user-1', 'abc123', 'report.pdf');
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, 'unrelated existing content');

        const archive = makeArchive(dataForSingle(dataFile), [
            { name: 'assets/uploads/datafiles/2026/user-1/abc123/report.pdf', content: 'archive content' },
        ]);
        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(true);
        expect(result.stats.filesRestored).toBe(0);
        expect(await readFile(targetPath, 'utf8')).toBe('unrelated existing content');
    });

    it('restores shared bytes when a canonical path mixes reused and new DataFiles', async () => {
        const cwd = await createWorkspace();
        const canonicalPath = '/uploads/datafiles/2026/user-1/shared/report.pdf';
        const reused = makeDataFile({ id: 1, dataCode: 'DF-REUSED', filePath: canonicalPath });
        const created = makeDataFile({ id: 2, dataCode: 'DF-NEW', filePath: canonicalPath });
        const data = makeData([reused, created]);

        mocks.prisma.dataFile.findUnique.mockImplementation(async ({ where }: { where: { dataCode: string } }) => {
            return where.dataCode === 'DF-REUSED' ? { id: 99, filePath: '/uploads/datafiles/2025/old/reused/report.pdf' } : null;
        });

        const archive = makeArchive(data, [
            { name: 'assets/uploads/datafiles/2026/user-1/shared/report.pdf', content: 'new shared bytes' },
        ]);
        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(true);
        expect(result.stats.filesRestored).toBe(1);
        expect(await readFile(path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user-1', 'shared', 'report.pdf'), 'utf8')).toBe(
            'new shared bytes',
        );
    });

    it('keeps legacy duplicate attachment targets compatible', async () => {
        const cwd = await createWorkspace();
        const data = makeData([]);
        const archive = makeArchive(data, [
            { name: 'assets/uploads/item-a/attachment.txt', content: 'first attachment' },
            { name: 'assets/uploads/item-b/attachment.txt', content: 'last attachment' },
        ]);

        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(true);
        expect(result.stats.filesRestored).toBe(2);
        expect(await readFile(path.join(cwd, 'public', 'uploads', 'attachment.txt'), 'utf8')).toBe('last attachment');
    });

    it('rejects traversal in nested DataFile assets before the DB transaction', async () => {
        const cwd = await createWorkspace();
        const data = makeData([makeDataFile()]);
        // AdmZip normalizes `..` while adding an entry. Mutate the entry name
        // after creation so this test exercises the importer against the raw
        // traversal form an external archive can carry.
        const zip = new AdmZip(makeArchive(data, [
            { name: 'assets/uploads/datafiles/2026/user-1/abc123/outside.txt', content: 'must not escape' },
        ]));
        const entry = zip.getEntry('assets/uploads/datafiles/2026/user-1/abc123/outside.txt');
        if (!entry) throw new Error('test archive entry missing');
        entry.entryName = 'assets/uploads/datafiles/2026/user-1/abc123/../../../../outside.txt';
        const archive = zip.toBuffer();

        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('路徑穿越偵測');
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
        await expect(readFile(path.join(cwd, 'outside.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('does not write staged files when the database transaction rolls back', async () => {
        const cwd = await createWorkspace();
        const data = makeData([makeDataFile()]);
        const archive = makeArchive(
            data,
            [{ name: 'assets/uploads/datafiles/2026/user-1/abc123/report.pdf', content: 'not committed' }],
        );
        mocks.prisma.$transaction.mockRejectedValue(new Error('transaction failed'));

        const result = await importProjectFromZip(archive, { onConflict: 'rename' });

        expect(result.success).toBe(false);
        await expect(
            readFile(path.join(cwd, 'public', 'uploads', 'datafiles', '2026', 'user-1', 'abc123', 'report.pdf')),
        ).rejects.toMatchObject({ code: 'ENOENT' });
    });
});

function dataForSingle(dataFile: ReturnType<typeof makeDataFile>) {
    return makeData([dataFile]);
}
