/**
 * @file qc-approval.ts
 * @description 品質管制 (QC) 審查流程模組
 *
 * 此模組負責管理 RMS 系統的二階段品質審查流程。
 * 當項目變更被批准並建立歷史紀錄後，會自動進入 QC → PM 的審查流程。
 *
 * ## 審查流程狀態 (QCDocumentApproval.status)
 * 1. `PENDING_QC`：等待品質管制人員 (QC) 審核
 * 2. `PENDING_PM`：QC 已通過，等待計畫主管 (PM) 審核
 * 3. `REVISION_REQUESTED`：PM 要求修訂（可多次）
 * 4. `COMPLETED`：審查完成
 * 5. `REJECTED`：審查被拒絕
 *
 * ## 核心功能
 * - `initializeQCApproval`：初始化審查流程（由 history.ts 呼叫）
 * - `approveQC` / `rejectQC`：QC 審核操作
 * - `approvePM` / `requestRevision`：PM 審核操作
 * - `submitRevision`：編輯者提交修訂版本
 *
 * ## 修訂機制
 * PM 可要求無限次修訂，每次修訂會：
 * - 建立 QCDocumentRevision 記錄
 * - 遞增 revisionCount
 * - 通知原編輯者
 *
 * ## PDF 生成時機
 * 品質文件 (QC Document) 僅在 **PM 核定後** 才會生成，
 * 確保文件反映最終的審核結果。
 *
 * ## 使用者資格
 * - QC 資格：`User.isQC = true`
 * - PM 資格：`User.isPM = true`
 * - 一個使用者可同時擁有 QC 和 PM 資格
 *
 * @see /src/actions/history.ts - 歷史紀錄（呼叫 initializeQCApproval）
 * @see /src/lib/pdf-generator.ts - PDF 文件生成
 * @see /src/components/approval/QCDocumentApprovalList.tsx - 前端審核介面
 */

"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateQCDocument } from "@/lib/pdf-generator";
import { createNotification } from "./notifications";
import { getRequestChain } from "./history";

// ============================================
// QC Document Approval Actions
// ============================================

export type QCApprovalState = {
    message?: string;
    error?: string;
};

// ==================== Helper Functions ====================

/** 取得當前使用者的 QC/PM 資格 */
const getUserQualifications = async (userId: string) =>
    prisma.user.findUnique({
        where: { id: userId },
        select: { isQC: true, isPM: true, username: true }
    });

/** 取得 ChangeRequest 的提交日期 */
const getSubmissionDate = async (changeRequestId: number | null) => {
    if (!changeRequestId) return undefined;
    const req = await prisma.changeRequest.findUnique({ where: { id: changeRequestId } });
    return req?.createdAt;
};

/** 共用的 include 結構 */
const APPROVAL_INCLUDE = {
    itemHistory: {
        include: {
            project: true,
            submittedBy: { select: { id: true, username: true } },
            reviewedBy: { select: { id: true, username: true } },
        }
    }
} as const;

/**
 * Get pending QC approvals for QC users
 */
export async function getPendingQCApprovals(take = 100, skip = 0) {
    const session = await getServerSession(authOptions);
    if (!session) return [];

    const user = await getUserQualifications(session.user.id);
    if (!user?.isQC) return [];

    return await prisma.qCDocumentApproval.findMany({
        where: { status: "PENDING_QC" },
        include: APPROVAL_INCLUDE,
        orderBy: { createdAt: "desc" },
        take,
        skip,
    });
}

/**
 * Get pending PM approvals for PM users
 */
export async function getPendingPMApprovals(take = 100, skip = 0) {
    const session = await getServerSession(authOptions);
    if (!session) return [];

    const user = await getUserQualifications(session.user.id);
    if (!user?.isPM) return [];

    return await prisma.qCDocumentApproval.findMany({
        where: { status: "PENDING_PM" },
        include: {
            itemHistory: {
                include: {
                    project: true,
                    submittedBy: { select: { id: true, username: true } },
                    reviewedBy: { select: { id: true, username: true } },
                }
            },
            qcApprovedBy: { select: { id: true, username: true } }
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
    });
}

/**
 * Get all QC document approvals for the current user based on their qualifications
 */
export async function getQCDocumentApprovals() {
    const session = await getServerSession(authOptions);
    if (!session) return [];

    const user = await getUserQualifications(session.user.id);

    if (!user?.isQC && !user?.isPM) {
        return [];
    }

    // Build where clause based on user's qualifications
    const whereConditions: string[] = [];
    if (user.isQC) whereConditions.push("PENDING_QC");
    if (user.isPM) whereConditions.push("PENDING_PM");

    return await prisma.qCDocumentApproval.findMany({
        where: {
            status: { in: whereConditions }
        },
        include: {
            itemHistory: {
                include: {
                    project: true,
                    submittedBy: { select: { id: true, username: true } },
                    reviewedBy: { select: { id: true, username: true } },
                }
            },
            qcApprovedBy: { select: { id: true, username: true } },
            pmApprovedBy: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: "desc" }
    });
}

/**
 * Approve as QC - Advance to PM stage (PDF will be generated after PM approval)
 */
export async function approveAsQC(
    approvalId: number,
    note?: string
): Promise<QCApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    const user = await getUserQualifications(session.user.id);
    if (!user?.isQC) return { error: "Unauthorized - QC qualification required" };

    // Get the approval record
    const approval = await prisma.qCDocumentApproval.findUnique({
        where: { id: approvalId },
        include: {
            itemHistory: true
        }
    });

    if (!approval) return { error: "Approval record not found" };
    if (approval.status !== "PENDING_QC") return { error: "Document is not pending QC approval" };

    // Update approval status (PDF will be generated only after PM approval)
    await prisma.qCDocumentApproval.update({
        where: { id: approvalId },
        data: {
            status: "PENDING_PM",
            qcApprovedById: session.user.id,
            qcApprovedAt: new Date(),
            qcNote: note || "同意",
        }
    });

    revalidatePath("/admin/approval");
    revalidatePath("/iso-docs");
    return { message: "QC approval completed" };
}

/** Process a single PM approval: fetch data, generate PDF, update DB, send notification. */
async function processSinglePMApproval(
    approvalId: number,
    sessionUserId: string,
    pmUsername: string,
    note: string
): Promise<{ error?: string }> {
    const approval = await prisma.qCDocumentApproval.findUnique({
        where: { id: approvalId },
        include: {
            itemHistory: true,
            qcApprovedBy: { select: { username: true } }
        }
    });

    if (!approval) return { error: "記錄不存在" };
    if (approval.status !== "PENDING_PM") return { error: "非待 PM 核定狀態" };

    // Parallelize independent DB queries
    const [submissionDate, fullHistory, reviewChain] = await Promise.all([
        getSubmissionDate(approval.itemHistory.changeRequestId),
        prisma.itemHistory.findUnique({
            where: { id: approval.itemHistoryId },
            include: {
                project: true,
                submittedBy: { select: { username: true } },
                reviewedBy: { select: { username: true } }
            }
        }),
        approval.itemHistory.changeRequestId
            ? getRequestChain(approval.itemHistory.changeRequestId)
            : Promise.resolve([] as unknown[])
    ]);

    if (!fullHistory) return { error: "歷史記錄不存在" };

    // Generate PDF - must succeed before updating status
    const pdfPath = await generateQCDocument({
        ...fullHistory,
        submissionDate,
        qcNote: approval.qcNote,
        qcDate: approval.qcApprovedAt,
        qcUser: approval.qcApprovedBy?.username,
        pmNote: note,
        pmDate: new Date(),
        pmUser: pmUsername,
        reviewChain
    }, null);

    // DB updates in a single transaction
    await prisma.$transaction([
        prisma.itemHistory.update({
            where: { id: approval.itemHistoryId },
            data: { isoDocPath: pdfPath }
        }),
        prisma.qCDocumentApproval.update({
            where: { id: approvalId },
            data: {
                status: "COMPLETED",
                pmApprovedById: sessionUserId,
                pmApprovedAt: new Date(),
                pmNote: note,
            }
        })
    ]);

    // Send completion notification (non-critical)
    if (approval.itemHistory.submittedById) {
        await createNotification({
            userId: approval.itemHistory.submittedById,
            type: "COMPLETED",
            title: `品質文件審核完成`,
            message: `${approval.itemHistory.itemFullId} ${approval.itemHistory.itemTitle} - 已完成 PM 核定`,
            link: `/admin/history/detail/${approval.itemHistory.id}`,
            qcApprovalId: approvalId,
            itemHistoryId: approval.itemHistory.id,
        });
    }

    return {};
}

export async function approveAsPM(
    approvalId: number,
    note?: string
): Promise<QCApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    const user = await getUserQualifications(session.user.id);
    if (!user?.isPM) return { error: "Unauthorized - PM qualification required" };

    try {
        const result = await processSinglePMApproval(approvalId, session.user.id, user.username, note || "同意");
        if (result.error) return { error: result.error };
    } catch (err) {
        console.error("Failed PM approval:", err);
        return { error: "PM 核定失敗，請稍後再試" };
    }

    revalidatePath("/admin/approval");
    revalidatePath("/iso-docs");
    return { message: "PM approval completed - Document finalized" };
}

/**
 * Batch approve multiple QC documents as PM.
 * Processes each approval sequentially (PDF generation is I/O heavy).
 *
 * **設計決策：Partial Success 是預期行為**
 * 每個核准會觸發 PDF 生成（I/O 密集），因此不使用 transaction 包裹整個迴圈。
 * 如果某個核准失敗，其他已成功的核准不會被回滾。
 * 回傳 `{ successful, failed }` 結構讓呼叫端可以顯示部分成功的結果。
 */
export async function batchApproveAsPM(
    approvalIds: number[],
    note?: string
): Promise<{ successful: number[]; failed: { id: number; error: string }[] }> {
    const session = await getServerSession(authOptions);
    if (!session) return { successful: [], failed: approvalIds.map(id => ({ id, error: "Unauthorized" })) };

    const user = await getUserQualifications(session.user.id);
    if (!user?.isPM) return { successful: [], failed: approvalIds.map(id => ({ id, error: "PM qualification required" })) };

    const successful: number[] = [];
    const failed: { id: number; error: string }[] = [];
    const pmNote = note || "同意";

    for (const approvalId of approvalIds) {
        try {
            const result = await processSinglePMApproval(approvalId, session.user.id, user.username, pmNote);
            if (result.error) {
                failed.push({ id: approvalId, error: result.error });
            } else {
                successful.push(approvalId);
            }
        } catch (err) {
            console.error(`Batch PM approval failed for id=${approvalId}:`, err);
            failed.push({ id: approvalId, error: "處理失敗" });
        }
    }

    revalidatePath("/admin/approval");
    revalidatePath("/iso-docs");
    return { successful, failed };
}

/**
 * Reject QC Document - Changes status to REJECTED and marks the original ChangeRequest as REJECTED
 */
export async function rejectQCDocument(
    approvalId: number,
    note: string
): Promise<QCApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    const user = await getUserQualifications(session.user.id);
    if (!user?.isQC && !user?.isPM) {
        return { error: "Unauthorized - QC or PM qualification required" };
    }

    // Get the approval record with itemHistory and the associated change request
    const approval = await prisma.qCDocumentApproval.findUnique({
        where: { id: approvalId },
        include: {
            itemHistory: {
                select: {
                    id: true,
                    itemFullId: true,
                    itemTitle: true,
                    submittedById: true,
                    changeRequestId: true,
                }
            }
        }
    });

    if (!approval) return { error: "Approval record not found" };

    // Verify proper stage for rejection
    if (approval.status === "PENDING_QC" && !user.isQC) {
        return { error: "Only QC users can reject at QC stage" };
    }
    if (approval.status === "PENDING_PM" && !user.isPM) {
        return { error: "Only PM users can reject at PM stage" };
    }

    // Update approval status to REJECTED
    const updateData: {
        status: string;
        qcApprovedById?: string;
        qcApprovedAt?: Date;
        qcNote?: string;
        pmApprovedById?: string;
        pmApprovedAt?: Date;
        pmNote?: string;
    } = {
        status: "REJECTED",
    };

    if (approval.status === "PENDING_QC") {
        updateData.qcApprovedById = session.user.id;
        updateData.qcApprovedAt = new Date();
        updateData.qcNote = note;
    } else {
        updateData.pmApprovedById = session.user.id;
        updateData.pmApprovedAt = new Date();
        updateData.pmNote = note;
    }

    await prisma.qCDocumentApproval.update({
        where: { id: approvalId },
        data: updateData
    });

    // CRITICAL: Also mark the original ChangeRequest as REJECTED so it appears in /admin/rejected-requests
    if (approval.itemHistory.changeRequestId) {
        await prisma.changeRequest.update({
            where: { id: approval.itemHistory.changeRequestId },
            data: {
                status: "REJECTED",
                reviewedById: session.user.id,
                reviewNote: note,
            }
        });
    }

    // Send notification to editor - Now linking back to standard rejected-requests
    if (approval.itemHistory.submittedById && approval.itemHistory.changeRequestId) {
        await createNotification({
            userId: approval.itemHistory.submittedById,
            type: "REJECTION",
            title: `品質文件已被退回 (${user.isPM ? 'PM' : 'QC'})`,
            message: `${approval.itemHistory.itemFullId} ${approval.itemHistory.itemTitle} - ${note}`,
            link: `/admin/rejected-requests/${approval.itemHistory.changeRequestId}`,
            qcApprovalId: approvalId,
            itemHistoryId: approval.itemHistory.id,
        });
    }

    revalidatePath("/admin/approval");
    revalidatePath("/admin/rejected-requests");
    revalidatePath("/iso-docs");
    return { message: "已退回要求修改" };
}



/**
 * Get count of pending QC/PM documents for badge display
 */
export async function getPendingQCDocumentCount(): Promise<number> {
    const session = await getServerSession(authOptions);
    if (!session) return 0;

    const user = await getUserQualifications(session.user.id);
    if (!user?.isQC && !user?.isPM) return 0;

    const whereConditions: string[] = [];
    if (user.isQC) whereConditions.push("PENDING_QC");
    if (user.isPM) whereConditions.push("PENDING_PM");

    return await prisma.qCDocumentApproval.count({
        where: { status: { in: whereConditions } }
    });
}
