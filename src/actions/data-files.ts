/**
 * @file data-files.ts
 * @description 參考文獻/資料檔案管理模組
 *
 * 此模組負責管理 RMS 系統中的參考文獻 (DataFile)。
 * DataFile 是獨立於項目的資料檔案，可被多個項目引用。
 *
 * ## 核心功能
 * - `getDataFiles`：取得資料檔案列表（可依年份篩選）
 * - `getDataFileById`：取得單一檔案詳情
 * - `submitCreateDataFile`：提交新增申請
 * - `submitUpdateDataFile`：提交更新申請
 * - `submitDeleteDataFile`：提交刪除申請
 * - `handleDataFileApproval`：處理審批結果
 *
 * ## 資料結構
 * - `dataYear`：資料年份
 * - `dataCode`：唯一識別碼（如 `2024-REF-001`）
 * - `dataName`：檔案名稱/標題
 * - `author`：作者
 * - `description`：描述
 * - `filePath`：實際檔案路徑
 *
 * ## 審批流程
 * DataFile 的新增/修改/刪除都需經過審批流程，
 * 使用獨立的 `DataFileChangeRequest` 資料表追蹤。
 *
 * ## 與項目的關聯
 * 透過 `ItemReference` 資料表，項目可引用 DataFile，
 * 並附加引用說明 (citation)。
 *
 * @see /src/app/datafiles - 前端資料檔案頁面
 * @see /src/components/datafile - 相關 UI 元件
 */

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
    dataCode?: string; // Now optional
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

    // Auto-generate dataCode if not provided
    let finalDataCode = data.dataCode?.trim();
    if (!finalDataCode) {
        // Generate unique code: DOC-{year}-{timestamp}
        finalDataCode = `DOC-${data.dataYear}-${Date.now().toString(36).toUpperCase()}`;
    }

    // Check if dataCode already exists
    const existing = await prisma.dataFile.findUnique({
        where: { dataCode: finalDataCode }
    });
    if (existing) throw new Error('資料編碼已存在');

    // Check pending requests with same dataCode
    const pendingRequest = await prisma.dataFileChangeRequest.findFirst({
        where: {
            type: 'FILE_CREATE',
            status: 'PENDING',
            data: { contains: finalDataCode }
        }
    });
    if (pendingRequest) throw new Error('已有相同資料編碼的申請待審核中');

    const request = await prisma.dataFileChangeRequest.create({
        data: {
            type: 'FILE_CREATE',
            status: 'PENDING',
            data: JSON.stringify({ ...data, dataCode: finalDataCode }),
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

    // Filter for non-reviewers: can only see their own requests
    const isReviewer = ['ADMIN', 'INSPECTOR'].includes(session.user.role);
    const whereCondition = {
        status: 'PENDING' as const,
        ...(isReviewer ? {} : { submittedById: session.user.id })
    };

    const requests = await prisma.dataFileChangeRequest.findMany({
        where: whereCondition,
        include: {
            file: true,
            submittedBy: { select: { id: true, username: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return requests;
}

/**
 * 撤回（取消）資料文件變更申請
 *
 * 允許提交者本人後悔並撤回尚未審核的申請，或由管理員強制撤回。
 * 撤回操作是「物理刪除」，資料庫中不會保留此次申請記錄。
 *
 * @param requestId DataFileChangeRequest ID
 * @throws Error 如果申請不存在、權限不足或狀態非 PENDING
 */
export async function cancelDataFileChangeRequest(requestId: number) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const request = await prisma.dataFileChangeRequest.findUnique({
        where: { id: requestId }
    });

    if (!request) throw new Error("Request not found");

    // Check permissions: Admin or Original Submitter
    const isAdmin = session.user.role === "ADMIN";
    const isSubmitter = request.submittedById === session.user.id;

    if (!isAdmin && !isSubmitter) {
        throw new Error("You do not have permission to cancel this request");
    }

    if (request.status !== "PENDING") {
        throw new Error("Only pending requests can be cancelled");
    }

    await prisma.dataFileChangeRequest.delete({
        where: { id: requestId }
    });

    revalidatePath("/admin/approval");
    if (request.fileId) revalidatePath(`/datafiles/${request.fileId}`);

    return { message: "Request cancelled successfully" };
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

    try {
        await prisma.$transaction(async (tx) => {
            if (request.type === 'FILE_CREATE') {
                // Create new file
                const file = await tx.dataFile.create({
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
                await tx.dataFileHistory.create({
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
                const updatedFile = await tx.dataFile.update({
                    where: { id: file.id },
                    data: {
                        ...data,
                        currentVersion: newVersion
                    }
                });

                // Create history
                await tx.dataFileHistory.create({
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
                await tx.dataFile.update({
                    where: { id: file.id },
                    data: {
                        isDeleted: true,
                        currentVersion: newVersion
                    }
                });

                // Create history
                await tx.dataFileHistory.create({
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
            await tx.dataFileChangeRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    reviewedById: session.user.id
                }
            });
        });

        revalidatePath('/admin/approval');
        revalidatePath('/datafiles');
        return { success: true };
    } catch (e: unknown) {
        console.error("Failed to approve data file request", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        throw new Error(`Failed to apply change: ${message}`);
    }
}

/**
 * Reject data file request
 */
export async function rejectDataFileRequest(requestId: number, reviewNote?: string) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error('Unauthorized');
    if (!['ADMIN', 'INSPECTOR', 'EDITOR'].includes(session.user.role)) {
        throw new Error('Permission denied');
    }

    const request = await prisma.dataFileChangeRequest.findUnique({
        where: { id: requestId }
    });

    if (!request) throw new Error('Request not found');
    if (request.status !== 'PENDING') throw new Error('Request already processed');

    // EDITOR 僅能撤回自己的申請，不可拒絕他人的申請
    if (session.user.role === 'EDITOR' && request.submittedById !== session.user.id) {
        throw new Error('編輯者僅能撤回自己的申請');
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
