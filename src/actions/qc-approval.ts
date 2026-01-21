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
export async function getPendingQCApprovals() {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const user = await getUserQualifications(session.user.id);
    if (!user?.isQC) throw new Error("Unauthorized - QC qualification required");

    return await prisma.qCDocumentApproval.findMany({
        where: { status: "PENDING_QC" },
        include: APPROVAL_INCLUDE,
        orderBy: { createdAt: "desc" }
    });
}

/**
 * Get pending PM approvals for PM users
 */
export async function getPendingPMApprovals() {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const user = await getUserQualifications(session.user.id);
    if (!user?.isPM) throw new Error("Unauthorized - PM qualification required");

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
        orderBy: { createdAt: "desc" }
    });
}

/**
 * Get all QC document approvals for the current user based on their qualifications
 */
export async function getQCDocumentApprovals() {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

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

    revalidatePath("/admin/approvals");
    revalidatePath("/iso-docs");
    return { message: "QC approval completed" };
}

/**
 * Approve as PM - Embed PM signature (by regenerating PDF) and complete the workflow
 */
export async function approveAsPM(
    approvalId: number,
    note?: string
): Promise<QCApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    const user = await getUserQualifications(session.user.id);
    if (!user?.isPM) return { error: "Unauthorized - PM qualification required" };

    // Get the approval record
    const approval = await prisma.qCDocumentApproval.findUnique({
        where: { id: approvalId },
        include: {
            itemHistory: true,
            qcApprovedBy: { select: { username: true } } // Fetch QC approver name
        }
    });

    if (!approval) return { error: "Approval record not found" };
    if (approval.status !== "PENDING_PM") return { error: "Document is not pending PM approval" };

    // Link ChangeRequest to get submission date
    let submissionDate: Date | undefined;
    if (approval.itemHistory.changeRequestId) {
        const req = await prisma.changeRequest.findUnique({ where: { id: approval.itemHistory.changeRequestId } });
        if (req?.createdAt) {
            submissionDate = req.createdAt;
        }
    }

    // Regenerate PDF to include PM data (and keep QC data)
    try {
        const fullHistory = await prisma.itemHistory.findUnique({
            where: { id: approval.itemHistoryId },
            include: {
                project: true,
                submittedBy: { select: { username: true } },
                reviewedBy: { select: { username: true } }
            }
        });

        if (fullHistory) {
            let reviewChain: any[] = [];
            if (approval.itemHistory.changeRequestId) {
                reviewChain = await getRequestChain(approval.itemHistory.changeRequestId);
            }

            const pdfPath = await generateQCDocument({
                // @ts-ignore
                ...fullHistory,
                submissionDate: submissionDate,
                qcNote: approval.qcNote,
                qcDate: approval.qcApprovedAt,
                qcUser: approval.qcApprovedBy?.username, // Existing QC approver
                pmNote: note || "同意",
                pmDate: new Date(),
                pmUser: user.username, // Current PM approver
                reviewChain
            }, null);

            await prisma.itemHistory.update({
                where: { id: approval.itemHistoryId },
                data: { isoDocPath: pdfPath }
            });
        }
    } catch (err) {
        console.error("Failed to regenerate PDF during PM approval:", err);
    }

    // Update approval status
    await prisma.qCDocumentApproval.update({
        where: { id: approvalId },
        data: {
            status: "COMPLETED",
            pmApprovedById: session.user.id,
            pmApprovedAt: new Date(),
            pmNote: note || "同意",
        }
    });

    // Send completion notification to original submitter
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

    revalidatePath("/admin/approvals");
    revalidatePath("/iso-docs");
    return { message: "PM approval completed - Document finalized" };
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
    const updateData: any = {
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

    revalidatePath("/admin/approvals");
    revalidatePath("/admin/rejected-requests");
    revalidatePath("/iso-docs");
    return { message: "已退回要求修改" };
}


/**
 * Create a QC Document Approval record for a new ItemHistory
 * Called after PDF generation in history.ts
 */
export async function createQCDocumentApproval(itemHistoryId: number): Promise<void> {
    await prisma.qCDocumentApproval.create({
        data: {
            itemHistoryId,
            status: "PENDING_QC"
        }
    });
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
