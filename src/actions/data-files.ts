'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// ============================================
// Query Actions
// ============================================

/**
 * Get all data files with optional year filter
 */
export async function getDataFiles(year?: number) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');

    const files = await prisma.dataFile.findMany({
        where: {
            isDeleted: false,
            ...(year ? { dataYear: year } : {})
        },
        include: {
            changeRequests: {
                where: { status: 'PENDING' },
                select: { id: true, type: true }
            }
        },
        orderBy: [
            { dataYear: 'desc' },
            { createdAt: 'desc' }
        ]
    });

    // Map to include hasPendingRequest flag
    return files.map(file => ({
        ...file,
        hasPendingRequest: file.changeRequests.length > 0,
        pendingRequestType: file.changeRequests[0]?.type || null
    }));
}

/**
 * Get single data file by ID
 */
export async function getDataFile(id: number) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');

    const file = await prisma.dataFile.findUnique({
        where: { id },
        include: {
            history: {
                orderBy: { version: 'desc' },
                take: 10,
                include: {
                    submittedBy: { select: { id: true, username: true } },
                    reviewedBy: { select: { id: true, username: true } }
                }
            }
        }
    });

    return file;
}

/**
 * Get available years for filtering
 */
export async function getDataFileYears() {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');

    const years = await prisma.dataFile.findMany({
        where: { isDeleted: false },
        select: { dataYear: true },
        distinct: ['dataYear'],
        orderBy: { dataYear: 'desc' }
    });

    return years.map(y => y.dataYear);
}

/**
 * Search data files
 */
export async function searchDataFiles(query: string, year?: number) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');

    const files = await prisma.dataFile.findMany({
        where: {
            isDeleted: false,
            ...(year ? { dataYear: year } : {}),
            OR: [
                { dataName: { contains: query } },
                { dataCode: { contains: query } },
                { author: { contains: query } },
                { description: { contains: query } }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });

    return files;
}

// ============================================
// Submit Request Actions
// ============================================

/**
 * Submit create data file request
 */
export async function submitCreateDataFileRequest(data: {
    dataYear: number;
    dataName: string;
    dataCode: string;
    author: string;
    description: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
}) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');
    if (session.user.role === 'VIEWER') throw new Error('Permission denied');

    // Check if dataCode already exists
    const existing = await prisma.dataFile.findUnique({
        where: { dataCode: data.dataCode }
    });
    if (existing) throw new Error('資料編碼已存在');

    // Check pending requests with same dataCode
    const pendingRequest = await prisma.dataFileChangeRequest.findFirst({
        where: {
            type: 'FILE_CREATE',
            status: 'PENDING',
            data: { contains: data.dataCode }
        }
    });
    if (pendingRequest) throw new Error('已有相同資料編碼的申請待審核中');

    const request = await prisma.dataFileChangeRequest.create({
        data: {
            type: 'FILE_CREATE',
            status: 'PENDING',
            data: JSON.stringify(data),
            submittedById: session.user.id
        }
    });

    revalidatePath('/admin/approval');
    return request;
}

/**
 * Submit update data file request
 */
export async function submitUpdateDataFileRequest(
    fileId: number,
    data: {
        dataYear?: number;
        dataName?: string;
        dataCode?: string;
        author?: string;
        description?: string;
    }
) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');
    if (session.user.role === 'VIEWER') throw new Error('Permission denied');

    const file = await prisma.dataFile.findUnique({ where: { id: fileId } });
    if (!file) throw new Error('File not found');
    if (file.isDeleted) throw new Error('File is deleted');

    // Check if new dataCode conflicts
    if (data.dataCode && data.dataCode !== file.dataCode) {
        const existing = await prisma.dataFile.findUnique({
            where: { dataCode: data.dataCode }
        });
        if (existing) throw new Error('資料編碼已存在');
    }

    const request = await prisma.dataFileChangeRequest.create({
        data: {
            type: 'FILE_UPDATE',
            status: 'PENDING',
            fileId,
            data: JSON.stringify(data),
            submittedById: session.user.id
        }
    });

    revalidatePath('/admin/approval');
    revalidatePath(`/datafiles/${fileId}`);
    return request;
}

/**
 * Submit delete data file request
 */
export async function submitDeleteDataFileRequest(fileId: number) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');
    if (session.user.role === 'VIEWER') throw new Error('Permission denied');

    const file = await prisma.dataFile.findUnique({ where: { id: fileId } });
    if (!file) throw new Error('File not found');
    if (file.isDeleted) throw new Error('File already deleted');

    const request = await prisma.dataFileChangeRequest.create({
        data: {
            type: 'FILE_DELETE',
            status: 'PENDING',
            fileId,
            data: JSON.stringify({ reason: 'User requested deletion' }),
            submittedById: session.user.id
        }
    });

    revalidatePath('/admin/approval');
    revalidatePath(`/datafiles/${fileId}`);
    return request;
}

// ============================================
// Approval Actions
// ============================================

/**
 * Get pending data file requests
 */
export async function getPendingDataFileRequests() {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');
    if (!['ADMIN', 'INSPECTOR'].includes(session.user.role)) {
        throw new Error('Permission denied');
    }

    const requests = await prisma.dataFileChangeRequest.findMany({
        where: { status: 'PENDING' },
        include: {
            file: true,
            submittedBy: { select: { id: true, username: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return requests;
}

/**
 * Approve data file request
 */
export async function approveDataFileRequest(requestId: number) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');
    if (!['ADMIN', 'INSPECTOR'].includes(session.user.role)) {
        throw new Error('Permission denied');
    }

    const request = await prisma.dataFileChangeRequest.findUnique({
        where: { id: requestId },
        include: { file: true, submittedBy: true }
    });

    if (!request) throw new Error('Request not found');
    if (request.status !== 'PENDING') throw new Error('Request already processed');

    // Self-approval prevention (except ADMIN)
    if (session.user.role !== 'ADMIN' && request.submittedById === session.user.id) {
        throw new Error('您不能審核自己提交的申請');
    }

    const data = JSON.parse(request.data);

    if (request.type === 'FILE_CREATE') {
        // Create new file
        const file = await prisma.dataFile.create({
            data: {
                dataYear: data.dataYear,
                dataName: data.dataName,
                dataCode: data.dataCode,
                author: data.author,
                description: data.description,
                fileName: data.fileName,
                filePath: data.filePath,
                fileSize: data.fileSize,
                mimeType: data.mimeType
            }
        });

        // Create history
        await prisma.dataFileHistory.create({
            data: {
                fileId: file.id,
                version: 1,
                changeType: 'CREATE',
                snapshot: JSON.stringify(file),
                submittedById: request.submittedById,
                reviewedById: session.user.id,
                reviewStatus: 'APPROVED',
                dataCode: file.dataCode,
                dataName: file.dataName,
                dataYear: file.dataYear
            }
        });
    } else if (request.type === 'FILE_UPDATE') {
        const file = request.file!;
        const newVersion = file.currentVersion + 1;

        // Update file
        const updatedFile = await prisma.dataFile.update({
            where: { id: file.id },
            data: {
                ...data,
                currentVersion: newVersion
            }
        });

        // Create history
        await prisma.dataFileHistory.create({
            data: {
                fileId: file.id,
                version: newVersion,
                changeType: 'UPDATE',
                snapshot: JSON.stringify(updatedFile),
                diff: JSON.stringify(data),
                submittedById: request.submittedById,
                reviewedById: session.user.id,
                reviewStatus: 'APPROVED',
                dataCode: updatedFile.dataCode,
                dataName: updatedFile.dataName,
                dataYear: updatedFile.dataYear
            }
        });
    } else if (request.type === 'FILE_DELETE') {
        const file = request.file!;
        const newVersion = file.currentVersion + 1;

        // Soft delete
        await prisma.dataFile.update({
            where: { id: file.id },
            data: {
                isDeleted: true,
                currentVersion: newVersion
            }
        });

        // Create history
        await prisma.dataFileHistory.create({
            data: {
                fileId: file.id,
                version: newVersion,
                changeType: 'DELETE',
                snapshot: JSON.stringify(file),
                submittedById: request.submittedById,
                reviewedById: session.user.id,
                reviewStatus: 'APPROVED',
                dataCode: file.dataCode,
                dataName: file.dataName,
                dataYear: file.dataYear
            }
        });
    }

    // Update request status
    await prisma.dataFileChangeRequest.update({
        where: { id: requestId },
        data: {
            status: 'APPROVED',
            reviewedById: session.user.id
        }
    });

    revalidatePath('/admin/approval');
    revalidatePath('/datafiles');
    return { success: true };
}

/**
 * Reject data file request
 */
export async function rejectDataFileRequest(requestId: number, reviewNote?: string) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');
    if (!['ADMIN', 'INSPECTOR'].includes(session.user.role)) {
        throw new Error('Permission denied');
    }

    const request = await prisma.dataFileChangeRequest.findUnique({
        where: { id: requestId }
    });

    if (!request) throw new Error('Request not found');
    if (request.status !== 'PENDING') throw new Error('Request already processed');

    // Self-rejection prevention
    if (session.user.role !== 'ADMIN' && request.submittedById === session.user.id) {
        throw new Error('您不能審核自己提交的申請');
    }

    await prisma.dataFileChangeRequest.update({
        where: { id: requestId },
        data: {
            status: 'REJECTED',
            reviewedById: session.user.id,
            reviewNote
        }
    });

    revalidatePath('/admin/approval');
    return { success: true };
}
