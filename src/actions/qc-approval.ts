"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateQCDocument } from "@/lib/pdf-generator";
import { createNotification } from "./notifications";

// ============================================
// QC Document Approval Actions
// ============================================

export type QCApprovalState = {
    message?: string;
    error?: string;
};

/**
 * Get pending QC approvals for QC users
 */
export async function getPendingQCApprovals() {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    // Get user's qualifications
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isQC: true, isPM: true }
    });

    if (!user?.isQC) throw new Error("Unauthorized - QC qualification required");

    return await prisma.qCDocumentApproval.findMany({
        where: { status: "PENDING_QC" },
        include: {
            itemHistory: {
                include: {
                    project: true,
                    submittedBy: { select: { id: true, username: true } },
                    reviewedBy: { select: { id: true, username: true } },
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });
}

/**
 * Get pending PM approvals for PM users
 */
export async function getPendingPMApprovals() {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    // Get user's qualifications
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isQC: true, isPM: true }
    });

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

    // Get user's qualifications
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isQC: true, isPM: true }
    });

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
 * Approve as QC - Embed QC signature (by regenerating PDF) and advance to PM stage
 */
export async function approveAsQC(
    approvalId: number,
    note?: string
): Promise<QCApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    // Verify QC qualification
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isQC: true, username: true }
    });

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

    // Link ChangeRequest to get submission date
    let submissionDate: Date | undefined;
    if (approval.itemHistory.changeRequestId) {
        const req = await prisma.changeRequest.findUnique({ where: { id: approval.itemHistory.changeRequestId } });
        if (req?.createdAt) {
            submissionDate = req.createdAt;
        }
    }

    // Regenerate PDF to include QC data
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
            const pdfPath = await generateQCDocument({
                // @ts-ignore - Prisma types vs Local Interface
                ...fullHistory,
                submissionDate: submissionDate,
                qcNote: note || "同意",
                qcDate: new Date(),
                qcUser: user.username, // Passed from session user
                pmNote: null,
                pmDate: null,
                pmUser: null
            }, null);

            // Update history with new path
            await prisma.itemHistory.update({
                where: { id: approval.itemHistoryId },
                data: { isoDocPath: pdfPath }
            });
        }
    } catch (err) {
        console.error("Failed to regenerate PDF during QC approval:", err);
    }

    // Update approval status
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

    // Verify PM qualification
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isPM: true, username: true }
    });

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
            const pdfPath = await generateQCDocument({
                // @ts-ignore
                ...fullHistory,
                submissionDate: submissionDate,
                qcNote: approval.qcNote,
                qcDate: approval.qcApprovedAt,
                qcUser: approval.qcApprovedBy?.username, // Existing QC approver
                pmNote: note || "同意",
                pmDate: new Date(),
                pmUser: user.username // Current PM approver
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
 * Reject QC Document - Changes to REVISION_REQUIRED and creates revision record
 */
export async function rejectQCDocument(
    approvalId: number,
    note: string
): Promise<QCApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    // Verify user has QC or PM qualification
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isQC: true, isPM: true, username: true }
    });

    if (!user?.isQC && !user?.isPM) {
        return { error: "Unauthorized - QC or PM qualification required" };
    }

    // Get the approval record with itemHistory
    const approval = await prisma.qCDocumentApproval.findUnique({
        where: { id: approvalId },
        include: {
            itemHistory: {
                select: {
                    id: true,
                    itemFullId: true,
                    itemTitle: true,
                    submittedById: true,
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

    // Calculate next revision number
    const existingRevisions = await prisma.qCDocumentRevision.count({
        where: { approvalId }
    });
    const nextRevisionNumber = existingRevisions + 1;

    // Create revision record
    await prisma.qCDocumentRevision.create({
        data: {
            approvalId,
            revisionNumber: nextRevisionNumber,
            requestedById: session.user.id,
            requestNote: note,
        }
    });

    // Update approval status to REVISION_REQUIRED
    const updateData: Record<string, unknown> = {
        status: "REVISION_REQUIRED",
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

    // Send notification to editor
    if (approval.itemHistory.submittedById) {
        await createNotification({
            userId: approval.itemHistory.submittedById,
            type: "REVISION_REQUEST",
            title: `品質文件需要修改`,
            message: `${approval.itemHistory.itemFullId} ${approval.itemHistory.itemTitle} - ${note}`,
            link: `/admin/revisions`,
            qcApprovalId: approvalId,
            itemHistoryId: approval.itemHistory.id,
        });
    }

    revalidatePath("/admin/approvals");
    revalidatePath("/admin/revisions");
    revalidatePath("/iso-docs");
    return { message: "已退回要求修改" };
}

/**
 * Get documents requiring revision for current user
 */
export async function getRevisionRequiredDocuments(userId?: string) {
    const session = await getServerSession(authOptions);
    if (!session) return [];

    const targetUserId = userId || session.user.id;

    const approvals = await prisma.qCDocumentApproval.findMany({
        where: {
            status: "REVISION_REQUIRED",
            itemHistory: {
                submittedById: targetUserId
            }
        },
        include: {
            itemHistory: {
                select: {
                    id: true,
                    itemId: true,
                    itemFullId: true,
                    itemTitle: true,
                    version: true,
                    changeType: true,
                    createdAt: true,
                }
            },
            revisions: {
                orderBy: { revisionNumber: "desc" },
                take: 1,
                include: {
                    requestedBy: { select: { username: true } }
                }
            }
        },
        orderBy: { updatedAt: "desc" }
    });

    return approvals;
}

/**
 * Resubmit a revised document for review
 * Called after editor makes changes and creates new ItemHistory
 */
export async function resubmitForReview(
    approvalId: number,
    newItemHistoryId: number
): Promise<QCApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    // Get the approval record
    const approval = await prisma.qCDocumentApproval.findUnique({
        where: { id: approvalId },
        include: {
            revisions: {
                where: { resolvedAt: null },
                orderBy: { revisionNumber: "desc" },
                take: 1
            }
        }
    });

    if (!approval) return { error: "Approval record not found" };
    if (approval.status !== "REVISION_REQUIRED") {
        return { error: "Document is not in revision required state" };
    }

    // Get the latest unresolved revision
    const latestRevision = approval.revisions[0];
    if (!latestRevision) {
        return { error: "No pending revision found" };
    }

    // Update revision record to mark as resolved
    await prisma.qCDocumentRevision.update({
        where: { id: latestRevision.id },
        data: {
            resolvedAt: new Date(),
            resolvedItemHistoryId: newItemHistoryId
        }
    });

    // Update approval: increment revision count, reset to PENDING_QC
    await prisma.qCDocumentApproval.update({
        where: { id: approvalId },
        data: {
            status: "PENDING_QC",
            revisionCount: { increment: 1 },
            // Clear previous approval data for re-review
            qcApprovedById: null,
            qcApprovedAt: null,
            qcNote: null,
            pmApprovedById: null,
            pmApprovedAt: null,
            pmNote: null,
        }
    });

    revalidatePath("/admin/approvals");
    revalidatePath("/admin/revisions");
    revalidatePath("/iso-docs");

    return { message: "已重新提交審核" };
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

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isQC: true, isPM: true }
    });

    if (!user?.isQC && !user?.isPM) return 0;

    const whereConditions: string[] = [];
    if (user.isQC) whereConditions.push("PENDING_QC");
    if (user.isPM) whereConditions.push("PENDING_PM");

    return await prisma.qCDocumentApproval.count({
        where: { status: { in: whereConditions } }
    });
}
