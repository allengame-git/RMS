import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    prisma: {
        user: { findUnique: vi.fn() },
        dataFile: { findUnique: vi.fn(), findFirst: vi.fn() },
        dataFileChangeRequest: {
            findUnique: vi.fn(),
            deleteMany: vi.fn(),
            updateMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
    tx: {
        dataFile: { create: vi.fn(), update: vi.fn() },
        dataFileHistory: { create: vi.fn() },
        dataFileChangeRequest: { updateMany: vi.fn() },
    },
    getServerSession: vi.fn(),
    revalidatePath: vi.fn(),
    cleanupApprovedDataFile: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/datafile-lifecycle', () => ({ cleanupApprovedDataFile: mocks.cleanupApprovedDataFile }));

import {
    approveDataFileRequest,
    cancelDataFileChangeRequest,
    rejectDataFileRequest,
} from './data-files';

const fileFixture = {
    id: 10,
    currentVersion: 3,
    dataYear: 2026,
    dataName: '原名稱',
    dataCode: 'DOC-10',
    author: '作者',
    description: '說明',
    fileName: '原檔案.pdf',
    filePath: '/uploads/datafiles/2026/user-1/abc123/file.pdf',
    fileSize: 12,
    mimeType: 'application/pdf',
    isDeleted: false,
};

const deleteRequest = {
    id: 1,
    status: 'PENDING',
    type: 'FILE_DELETE',
    data: '{}',
    fileId: 10,
    file: fileFixture,
    submittedById: 'editor',
};

function configureTransaction() {
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.dataFileChangeRequest.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.dataFile.update.mockResolvedValue({ ...fileFixture, isDeleted: true, currentVersion: 4 });
    mocks.tx.dataFileHistory.create.mockResolvedValue({});
    mocks.tx.dataFile.create.mockResolvedValue({
        ...fileFixture,
        id: 20,
        currentVersion: 1,
    });
    mocks.cleanupApprovedDataFile.mockResolvedValue({ status: 'deleted' });
}

describe('DataFile approval lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getServerSession.mockResolvedValue({ user: { id: 'reviewer', role: 'ADMIN' } });
        mocks.prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
        mocks.prisma.dataFileChangeRequest.findUnique.mockResolvedValue(deleteRequest);
        configureTransaction();
    });

    it('does not unlink when the approval transaction rolls back', async () => {
        mocks.tx.dataFileHistory.create.mockRejectedValue(new Error('transaction sentinel'));

        const result = await approveDataFileRequest(1);

        expect(result).toEqual({ success: false, error: '套用變更失敗，請稍後再試' });
        expect(mocks.cleanupApprovedDataFile).not.toHaveBeenCalled();
    });

    it('performs cleanup only after a successful delete approval transaction', async () => {
        const events: string[] = [];
        mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => {
            events.push('transaction');
            const result = await callback(mocks.tx);
            events.push('commit');
            return result;
        });
        mocks.cleanupApprovedDataFile.mockImplementation(async () => {
            events.push('cleanup');
            return { status: 'deleted' };
        });

        const result = await approveDataFileRequest(1);

        expect(result).toEqual({ success: true });
        expect(events).toEqual(['transaction', 'commit', 'cleanup']);
        expect(mocks.cleanupApprovedDataFile).toHaveBeenCalledWith(
            mocks.prisma,
            10,
            deleteRequest.file.filePath,
        );
        expect(mocks.tx.dataFileChangeRequest.updateMany).toHaveBeenCalledWith({
            where: { id: 1, status: 'PENDING' },
            data: { status: 'APPROVED', reviewedById: 'reviewer' },
        });
    });

    it('keeps a committed approval successful when post-commit cleanup fails', async () => {
        mocks.cleanupApprovedDataFile.mockRejectedValue(new Error('cleanup sentinel'));

        const result = await approveDataFileRequest(1);

        expect(result).toEqual({ success: true });
        expect(mocks.tx.dataFileChangeRequest.updateMany).toHaveBeenCalled();
    });

    it('never applies a request after losing the pending CAS race', async () => {
        mocks.tx.dataFileChangeRequest.updateMany.mockResolvedValue({ count: 0 });

        const result = await approveDataFileRequest(1);

        expect(result).toEqual({ success: false, error: 'Request already processed' });
        expect(mocks.tx.dataFile.update).not.toHaveBeenCalled();
        expect(mocks.cleanupApprovedDataFile).not.toHaveBeenCalled();
    });

    it('updates metadata only and excludes file replacement fields from history diff', async () => {
        const updateRequest = {
            ...deleteRequest,
            type: 'FILE_UPDATE',
            data: JSON.stringify({
                dataName: '新名稱',
                filePath: '/uploads/datafiles/2026/attacker/replace.pdf',
                fileName: 'replace.pdf',
                fileSize: 999,
                mimeType: 'application/x-dangerous',
            }),
        };
        mocks.prisma.dataFileChangeRequest.findUnique.mockResolvedValue(updateRequest);
        mocks.tx.dataFile.update.mockResolvedValue({ ...fileFixture, dataName: '新名稱', currentVersion: 4 });

        const result = await approveDataFileRequest(1);

        expect(result).toEqual({ success: true });
        expect(mocks.tx.dataFile.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: { dataName: '新名稱', currentVersion: 4 },
        });
        expect(mocks.tx.dataFileHistory.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ diff: JSON.stringify({ dataName: '新名稱' }) }),
        }));
        expect(JSON.stringify(mocks.tx.dataFile.update.mock.calls[0][0])).not.toContain('replace.pdf');
    });

    it('sanitizes approval errors instead of exposing database messages', async () => {
        mocks.tx.dataFileHistory.create.mockRejectedValue(new Error('secret database detail'));

        const result = await approveDataFileRequest(1);

        expect(result).toEqual({ success: false, error: '套用變更失敗，請稍後再試' });
        expect(JSON.stringify(result)).not.toContain('secret database detail');
    });
});

describe('DataFile request state CAS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getServerSession.mockResolvedValue({ user: { id: 'editor', role: 'EDITOR' } });
        mocks.prisma.dataFileChangeRequest.findUnique.mockResolvedValue({
            id: 3,
            status: 'PENDING',
            type: 'FILE_UPDATE',
            fileId: 10,
            submittedById: 'editor',
        });
    });

    it('uses a pending-only delete CAS for cancellation', async () => {
        mocks.prisma.dataFileChangeRequest.deleteMany.mockResolvedValue({ count: 0 });

        const result = await cancelDataFileChangeRequest(3);

        expect(result).toEqual({ success: false, error: 'Request already processed' });
        expect(mocks.prisma.dataFileChangeRequest.deleteMany).toHaveBeenCalledWith({
            where: { id: 3, status: 'PENDING' },
        });
    });

    it('uses a pending-only update CAS for rejection', async () => {
        mocks.prisma.dataFileChangeRequest.updateMany.mockResolvedValue({ count: 0 });

        const result = await rejectDataFileRequest(3, '退回');

        expect(result).toEqual({ success: false, error: 'Request already processed' });
        expect(mocks.prisma.dataFileChangeRequest.updateMany).toHaveBeenCalledWith({
            where: { id: 3, status: 'PENDING' },
            data: { status: 'REJECTED', reviewedById: 'editor', reviewNote: '退回' },
        });
    });
});
