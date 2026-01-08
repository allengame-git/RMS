"use server";

import { prisma } from "@/lib/prisma";
import { Item, Prisma } from "@prisma/client";
import { generateQCDocument } from "@/lib/pdf-generator";

// Define Snapshot structure
export interface ItemSnapshot {
    title: string;
    content: string | null;
    attachments: string | null;
    relatedItems: { id: number; fullId: string; title?: string; description?: string | null }[];
}

/**
 * Computes difference between two snapshots.
 */
function computeDiff(oldData: ItemSnapshot, newData: ItemSnapshot) {
    const diff: Record<string, { old: any; new: any }> = {};

    // Compare basic fields
    for (const key of ['title', 'content', 'attachments'] as const) {
        const oldVal = oldData[key];
        const newVal = newData[key];

        if (oldVal !== newVal) {
            diff[key] = { old: oldVal, new: newVal };
        }
    }

    // Compare relatedItems (arrays)
    // We sort by id to ensure consistent comparison
    const oldRelations = [...oldData.relatedItems].sort((a, b) => a.id - b.id);
    const newRelations = [...newData.relatedItems].sort((a, b) => a.id - b.id);

    if (JSON.stringify(oldRelations) !== JSON.stringify(newRelations)) {
        diff['relatedItems'] = { old: oldRelations, new: newRelations };
    }

    return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * Creates a history record for an item.
 * Automatically increments item version.
 */
export async function createHistoryRecord(
    item: Item,
    snapshotData: ItemSnapshot,
    changeRequest: { id: number; submittedById: string | null; submitReason?: string | null; reviewNote?: string | null },
    changeType: "CREATE" | "UPDATE" | "DELETE" | "RESTORE",
    reviewerId: string,
    oldSnapshot?: ItemSnapshot
) {
    console.log('=== createHistoryRecord CALLED ===', { itemId: item.id, changeType, changeRequestId: changeRequest.id });
    const diff = (changeType === "UPDATE" && oldSnapshot)
        ? computeDiff(oldSnapshot, snapshotData)
        : null;

    // Logic: UPDATE/DELETE increments version counter
    let newVersion = item.currentVersion;

    if (changeType === "UPDATE" || changeType === "DELETE") {
        newVersion = item.currentVersion + 1;
    }

    // Create History Record
    const historyRecord = await prisma.itemHistory.create({
        data: {
            itemId: item.id, // Support soft delete linking
            version: newVersion,
            changeType,
            snapshot: JSON.stringify(snapshotData),
            diff: diff ? JSON.stringify(diff) : null,

            submittedById: changeRequest.submittedById,
            reviewedById: reviewerId,
            reviewStatus: "APPROVED",
            reviewNote: changeRequest.reviewNote || null,
            submitReason: changeRequest.submitReason || null,
            changeRequestId: changeRequest.id,

            // Redundant fields
            itemFullId: item.fullId,
            itemTitle: item.title,
            projectId: item.projectId,
        }
    });

    try {
        console.log('[createHistoryRecord] Fetching full history for PDF generation, historyId:', historyRecord.id);
        // Fetch full history with relations for PDF generation
        const fullHistory = await prisma.itemHistory.findUnique({
            where: { id: historyRecord.id },
            include: {
                submittedBy: { select: { username: true } },
                reviewedBy: { select: { username: true } },
                project: { select: { title: true } }
            }
        });
        console.log('[createHistoryRecord] fullHistory fetched:', fullHistory ? 'OK' : 'NULL');

        if (fullHistory) {
            console.log('[createHistoryRecord] Calling generateQCDocument...');
            // @ts-ignore - Types compatibility
            const pdfPath = await generateQCDocument(fullHistory, item);
            console.log('[createHistoryRecord] PDF generated at:', pdfPath);

            // Save path to history record
            await prisma.itemHistory.update({
                where: { id: historyRecord.id },
                data: { isoDocPath: pdfPath }
            });
            console.log('[createHistoryRecord] isoDocPath saved to history');

            // Create QC Document Approval record to start the signature workflow
            await prisma.qCDocumentApproval.create({
                data: {
                    itemHistoryId: historyRecord.id,
                    status: "PENDING_QC"
                }
            });
            console.log('[createHistoryRecord] QCDocumentApproval record created');
        }
    } catch (e) {
        console.error("[createHistoryRecord] Failed to generate QC document:", e);
        // Don't fail the whole transaction? Or should we?
        // For now, log error but allow history creation
    }

    // Increment Item Version (Only if not DELETE - conceptually. Practically, if soft delete, we might want to update version too? 
    // If we update version on soft delete, next time we recreate/restore, we know where we left off?
    // Our system doesn't restore easily yet.
    // But updating version on the item row is fine for soft delete.)
    // Actually, let's update it so currentVersion reflects the 'Deleted' state version.

    if (changeType !== "DELETE") {
        await prisma.item.update({
            where: { id: item.id },
            data: { currentVersion: newVersion }
        });
    } else {
        // For DELETE (Soft), we also update version to match history?
        // Yes, let's do it to keep consistency.
        await prisma.item.update({
            where: { id: item.id },
            data: { currentVersion: newVersion }
        });
    }
}

/**
 * Get history for a specific item
 */
export async function getItemHistory(itemId: number) {
    const history = await prisma.itemHistory.findMany({
        where: { itemId },
        include: {
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return history;
}

/**
 * Get detailed history record
 */
export async function getHistoryDetail(historyId: number) {
    return await prisma.itemHistory.findUnique({
        where: { id: historyId },
        include: {
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } },
            item: { select: { fullId: true, title: true } },
            qcApproval: {
                include: {
                    qcApprovedBy: { select: { username: true } },
                    pmApprovedBy: { select: { username: true } }
                }
            }
        }
    });
}


/**
 * Get global history (Dashboard)
 */
export async function getGlobalHistory(filters?: {
    projectId?: number;
    changeType?: string;
    dateFrom?: Date;
    dateTo?: Date;
}) {
    const where: Prisma.ItemHistoryWhereInput = {};

    if (filters?.projectId) where.projectId = filters.projectId;
    if (filters?.changeType && filters.changeType !== "ALL") where.changeType = filters.changeType;
    if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const history = await prisma.itemHistory.findMany({
        where,
        include: {
            project: { select: { title: true, codePrefix: true } },
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } },
            // Include item to check if deleted (if item is null, it's deleted - relying on SetNull if hard deleted, or check isDeleted if soft)
            item: { select: { id: true, isDeleted: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return history;
}

/**
 * Get project stats for history dashboard
 */
export async function getProjectHistoryStats() {
    return await prisma.project.findMany({
        include: {
            _count: { select: { items: true } },
            itemHistories: {
                select: { id: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    });
}

/**
 * Get all items (active and deleted) for a project
 */
export async function getProjectItems(projectId: number) {
    // 1. Get stats
    const grouped = await prisma.itemHistory.groupBy({
        by: ['itemFullId'],
        where: { projectId },
        _count: { id: true },
    });

    // 2. Get latest info for each
    const latestInfo = await prisma.itemHistory.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        distinct: ['itemFullId'],
        select: {
            itemFullId: true,
            itemTitle: true,
            changeType: true,
            itemId: true
        }
    });

    // Combine
    return latestInfo.map((info) => {
        const count = grouped.find((g) => g.itemFullId === info.itemFullId)?._count.id || 0;
        const isDeleted = info.itemId === null; // Hard delete check. For soft delete, we'd check item.isDeleted if we fetched it.
        // If we assume history correctly tracked DELETE event, then info.changeType === 'DELETE' means it was deleted at that point.
        // BUT subsequent changes might not happen.
        // However, if we soft delete, the Item row exists.
        // If we want to know current status, checking changeType of latest history is a good proxy IF history is strictly recorded.
        // OR we should join with Item table.

        // Let's rely on changeType === 'DELETE' OR itemId === null as deleted.
        // Actually, if soft delete is used, changeType will be 'DELETE'.

        return {
            fullId: info.itemFullId,
            title: info.itemTitle,
            isDeleted: isDeleted || info.changeType === 'DELETE',
            historyCount: count
        };
    }).sort((a, b: { fullId: string }) => {
        // Sort naturally by fullId
        return a.fullId.localeCompare(b.fullId, undefined, { numeric: true });
    });
}

/**
 * Get item history by full ID (for Global Dashboard, handling deleted items)
 */
export async function getItemHistoryByFullId(projectId: number, itemFullId: string) {
    const history = await prisma.itemHistory.findMany({
        where: {
            projectId,
            itemFullId
        },
        include: {
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    return history;
}

/**
 * Get recent updates combining ItemHistory and DataFileHistory
 */
export async function getRecentUpdates(limit = 100) {
    // 1. 查詢 ItemHistory 最近記錄
    const itemHistories = await prisma.itemHistory.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } },
            project: { select: { title: true } }
        }
    });

    // 2. 查詢 DataFileHistory 最近記錄
    const fileHistories = await prisma.dataFileHistory.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } }
        }
    });

    // 3. 轉換為統一格式
    const itemUpdates = itemHistories.map(h => ({
        id: `item-${h.id}`,
        type: 'ITEM' as const,
        changeType: h.changeType,
        identifier: h.itemFullId,
        name: h.itemTitle,
        projectTitle: h.project?.title || '',
        submittedBy: h.submittedBy?.username || h.submitterName || '(已刪除)',
        reviewedBy: h.reviewedBy?.username || null,
        createdAt: h.createdAt,
        targetId: h.itemId
    }));

    const fileUpdates = fileHistories.map(h => ({
        id: `file-${h.id}`,
        type: 'FILE' as const,
        changeType: h.changeType,
        identifier: h.dataCode,
        name: h.dataName,
        projectTitle: `${h.dataYear}年度`,
        submittedBy: h.submittedBy?.username || h.submitterName || '(已刪除)',
        reviewedBy: h.reviewedBy?.username || null,
        createdAt: h.createdAt,
        targetId: h.fileId
    }));

    // 4. 合併並排序，取前 limit 筆
    const combined = [...itemUpdates, ...fileUpdates]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

    return combined;
}

/**
 * Get all available ISO QC Documents
 */
export async function getIsoDocuments() {
    return await prisma.itemHistory.findMany({
        where: {
            isoDocPath: { not: null }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            item: { select: { fullId: true, title: true } },
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } }
        }
    });
}

