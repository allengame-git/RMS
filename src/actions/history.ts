/**
 * @file history.ts
 * @description 項目歷史紀錄管理模組
 *
 * 此模組負責管理 RMS 系統中所有項目 (Item) 的歷史版本紀錄。
 * 每當項目發生變更（新增、修改、刪除、還原），系統會自動建立一筆 ItemHistory。
 *
 * ## 核心功能
 * - `createHistoryRecord`：建立歷史紀錄（含快照和差異比對）
 * - `getItemHistory`：取得項目的歷史版本列表
 * - `getHistoryDetail`：取得單筆歷史的詳細資訊
 * - `regenerateQCDocument`：重新生成品質管制文件 (PDF)
 *
 * ## 資料結構
 * ### ItemSnapshot（項目快照）
 * 記錄項目在某時間點的完整狀態，包含：
 * - 標題、內容、附件
 * - 關聯項目 (relatedItems)
 * - 參考文獻 (references)
 *
 * ### Diff（差異紀錄）
 * 對於 UPDATE 類型的變更，會計算新舊快照的差異：
 * - 記錄哪些欄位被修改
 * - 保留修改前後的值，供審計追蹤
 *
 * ## 版本號邏輯
 * - CREATE：版本號從 1 開始
 * - UPDATE/DELETE：版本號遞增
 * - 版本號存儲於 `Item.currentVersion`
 *
 * ## 與 QC 流程的整合
 * 歷史紀錄建立後，會自動觸發 QC 審查流程（透過 `initializeQCApproval`），
 * 確保所有變更都經過品質管制審核。
 *
 * @see /src/actions/approval.ts - 審批流程（呼叫此模組建立歷史）
 * @see /src/actions/qc-approval.ts - QC 審查流程
 * @see /src/lib/pdf-generator.ts - 品質文件 PDF 生成
 */

"use server";

import { prisma } from "@/lib/prisma";
import type { Item, Prisma } from "@prisma/client";
import {
    recordApprovedHistory,
    type ItemSnapshot as ItemSnapshotType,
} from "@/lib/qc-lifecycle";

export type {
    ApprovedHistoryChangeRequest,
    ItemSnapshot,
    RecordApprovedHistoryInput,
    RecordApprovedHistoryResult,
} from "@/lib/qc-lifecycle";

/**
 * Creates a history record for an item.
 * Automatically increments item version.
 */
export async function createHistoryRecord(
    item: Item,
    snapshotData: ItemSnapshotType,
    changeRequest: {
        id: number;
        submittedById: string | null;
        submitReason?: string | null;
        reviewNote?: string | null;
        createdAt: Date;
        previousRequestId?: number | null;
    },
    changeType: "CREATE" | "UPDATE" | "DELETE" | "RESTORE",
    reviewerId: string,
    oldSnapshot?: ItemSnapshotType,
    tx?: Prisma.TransactionClient
) {
    const input = {
        item,
        snapshot: snapshotData,
        changeRequest: {
            id: changeRequest.id,
            submittedById: changeRequest.submittedById,
            submitReason: changeRequest.submitReason,
            reviewNote: changeRequest.reviewNote,
            createdAt: changeRequest.createdAt,
            previousRequestId: changeRequest.previousRequestId,
        },
        changeType,
        reviewerId,
        oldSnapshot,
    } as const;

    if (tx) {
        return recordApprovedHistory(tx, input);
    }

    return prisma.$transaction((transaction) => recordApprovedHistory(transaction, input));
}

/**
 * Get history for a specific item
 */
export async function getItemHistory(itemId: number, take = 200) {
    const history = await prisma.itemHistory.findMany({
        where: { itemId },
        include: {
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } }
        },
        orderBy: { createdAt: 'desc' },
        take,
    });

    return history;
}

/**
 * Get the chain of previous change requests for a given request ID
 */
export async function getRequestChain(requestId: number) {
    type RequestWithUsers = any;
    const chain: any[] = [];
    let currentId: number | null = requestId;

    while (currentId) {
        const req: RequestWithUsers | null = await prisma.changeRequest.findUnique({
            where: { id: currentId },
            include: {
                submittedBy: { select: { username: true } },
                reviewedBy: { select: { username: true } },
            }
        });

        if (!req) break;

        // 關鍵修正：直接查詢此申請案產出的歷史記錄。
        // 如果有歷史記錄，代表該申請案已通過初審。
        const historyRecord = await prisma.itemHistory.findFirst({
            where: { changeRequestId: req.id },
            select: { id: true, reviewedBy: { select: { username: true } }, createdAt: true, reviewNote: true }
        });

        chain.push({
            ...req,
            producedHistory: historyRecord
        });

        currentId = req.previousRequestId;
    }

    return chain;
}

/**
 * Get detailed history record
 */
export async function getHistoryDetail(historyId: number) {
    const history = await prisma.itemHistory.findUnique({
        where: { id: historyId },
        include: {
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } },
            item: { select: { fullId: true, title: true } },
            qcApproval: {
                include: {
                    qcApprovedBy: { select: { username: true } },
                    pmApprovedBy: { select: { username: true } },
                    revisions: {
                        orderBy: { revisionNumber: "asc" },
                        include: {
                            requestedBy: { select: { username: true } }
                        }
                    }
                }
            }
        }
    });

    if (!history) return null;

    // Fetch the FULL chain of ChangeRequests for this ItemHistory
    // The entire review cycle (submit -> reject -> resubmit -> approve) 
    // should be displayed as one unified flow
    let reviewChain: any[] = [];
    if (history.changeRequestId) {
        reviewChain = await getRequestChain(history.changeRequestId);
    }

    return {
        ...history,
        reviewChain
    };
}


/**
 * Get global history (Dashboard)
 */
export async function getGlobalHistory(filters?: {
    projectId?: number;
    changeType?: string;
    dateFrom?: Date;
    dateTo?: Date;
}, take = 200, skip = 0) {
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
        orderBy: { createdAt: 'desc' },
        take,
        skip,
    });

    return history;
}

/**
 * Get project stats for history dashboard
 */
export async function getProjectHistoryStats() {
    return await prisma.project.findMany({
        include: {
            _count: {
                select: {
                    items: {
                        where: { isDeleted: false }
                    }
                }
            },
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
            reviewedBy: { select: { username: true } },
            qcApproval: { select: { status: true } }
        }
    });
}

/**
 * Get ISO docs grouped by project with stats (supports search)
 */
export async function getIsoDocsGroupedByProject(query?: string) {
    const whereProject: Prisma.ProjectWhereInput = {};
    const whereHistory: Prisma.ItemHistoryWhereInput = { isoDocPath: { not: null } };

    if (query) {
        const _lowerQuery = query.toLowerCase();
        // If query exists, we want projects that MATCH the query OR contain docs matching the query
        // BUT straightforward approach:
        // Find projects where Title/Code matches query
        // OR projects where they have ItemHistory matching query

        // Let's broaden relation filter
        whereProject.OR = [
            { title: { contains: query, mode: 'insensitive' } },
            { codePrefix: { contains: query, mode: 'insensitive' } },
            {
                itemHistories: {
                    some: {
                        isoDocPath: { not: null },
                        OR: [
                            { itemFullId: { contains: query, mode: 'insensitive' } },
                            { itemTitle: { contains: query, mode: 'insensitive' } }
                        ]
                    }
                }
            }
        ];
    }

    // Get all projects that have ISO docs (and match query if provided)
    const projects = await prisma.project.findMany({
        where: whereProject,
        include: {
            itemHistories: {
                where: whereHistory,
                select: { id: true, createdAt: true },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    return projects
        .filter(p => p.itemHistories.length > 0)
        .map(p => ({
            id: p.id,
            title: p.title,
            codePrefix: p.codePrefix,
            isoDocCount: p.itemHistories.length,
            lastUpdated: p.itemHistories[0]?.createdAt || null
        }))
        .sort((a, b) => {
            if (!a.lastUpdated) return 1;
            if (!b.lastUpdated) return -1;
            return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        });
}

/**
 * Get ISO documents for a specific project
 */
export async function getIsoDocumentsByProject(projectId: number) {
    return await prisma.itemHistory.findMany({
        where: {
            projectId,
            isoDocPath: { not: null }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            item: { select: { fullId: true, title: true } },
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } },
            qcApproval: { select: { status: true, revisionCount: true } }
        }
    });
}

/**
 * Get recent ISO document updates (supports search)
 */
export async function getRecentIsoDocUpdates(limit = 50, query?: string) {
    const where: Prisma.ItemHistoryWhereInput = { isoDocPath: { not: null } };

    if (query) {
        where.OR = [
            { itemFullId: { contains: query, mode: 'insensitive' } },
            { itemTitle: { contains: query, mode: 'insensitive' } },
            { project: { title: { contains: query, mode: 'insensitive' } } },
            { project: { codePrefix: { contains: query, mode: 'insensitive' } } }
        ];
    }

    return await prisma.itemHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            project: { select: { title: true, codePrefix: true } },
            item: { select: { fullId: true, title: true } },
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } },
            qcApproval: { select: { status: true, revisionCount: true } }
        }
    });
}
