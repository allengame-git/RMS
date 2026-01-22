"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateNextItemId } from "@/lib/item-utils";
import { createHistoryRecord, ItemSnapshot } from "./history";
import { createNotification } from "./notifications";

export type ApprovalState = {
    message?: string;
    error?: string;
};

// ==================== Helper Functions ====================

/** 可編輯角色列表 */
const EDITABLE_ROLES = ["EDITOR", "INSPECTOR", "ADMIN"];

/** 可審核角色列表 */
const REVIEWER_ROLES = ["INSPECTOR", "ADMIN"];

/** 檢查使用者是否有編輯權限 */
const canEdit = (role: string) => EDITABLE_ROLES.includes(role);

/** 檢查使用者是否有審核權限 */
const canReview = (role: string) => REVIEWER_ROLES.includes(role);

/** 將 ItemRelation 陣列映射為 snapshot 格式 */
const mapRelationsToSnapshot = (relations: any[]) =>
    relations.map(r => ({
        id: r.target.id,
        fullId: r.target.fullId,
        title: r.target.title,
        description: r.description
    }));

/** 將 ItemReference 陣列映射為 snapshot 格式 */
const mapReferencesToSnapshot = (refs: any[]) =>
    refs.map(r => ({
        fileId: r.file.id,
        dataCode: r.file.dataCode,
        dataName: r.file.dataName,
        dataYear: r.file.dataYear,
        author: r.file.author,
        citation: r.citation
    }));

// --- Submit Request ---

export async function submitCreateItemRequest(
    prevState: ApprovalState,
    formData: FormData
): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user.role)) {
        return { error: "Unauthorized" };
    }

    const projectId = parseInt(formData.get("projectId") as string);
    const parentIdStr = formData.get("parentId") as string;
    const parentId = parentIdStr ? parseInt(parentIdStr) : null;

    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const attachmentsStr = formData.get("attachments") as string;
    const attachments = attachmentsStr ? JSON.parse(attachmentsStr) : [];

    const relatedItemsStr = formData.get("relatedItems") as string;
    const relatedItems = relatedItemsStr ? JSON.parse(relatedItemsStr) : [];
    const referencesStr = formData.get("references") as string;
    const references = referencesStr ? JSON.parse(referencesStr) : [];

    if (!title || !projectId) {
        return { error: "Missing required fields" };
    }

    const submitReason = formData.get("submitReason") as string || null;
    const data = JSON.stringify({ title, content, attachments, relatedItems, references });

    try {
        await prisma.changeRequest.create({
            data: {
                type: "CREATE",
                status: "PENDING",
                data,
                targetProject: { connect: { id: projectId } },
                targetParent: parentId ? { connect: { id: parentId } } : undefined,
                submittedBy: { connect: { id: session.user.id } },
                submitReason,
            },
        });

        revalidatePath(`/projects/${projectId}`);
        return { message: "Request submitted successfully! Waiting for approval." };
    } catch (e) {
        console.error(e);
        return { error: "Failed to submit request" };
    }
}

// --- Submit Update Request ---
export async function submitUpdateItemRequest(
    prevState: ApprovalState,
    formData: FormData
): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user.role)) {
        return { error: "Unauthorized" };
    }

    const itemId = parseInt(formData.get("itemId") as string);
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const attachmentsStr = formData.get("attachments") as string;
    const attachments = attachmentsStr ? JSON.parse(attachmentsStr) : null;
    const relatedItemsStr = formData.get("relatedItems") as string;
    const relatedItems = relatedItemsStr ? JSON.parse(relatedItemsStr) : null;
    const referencesStr = formData.get("references") as string;
    const references = referencesStr ? JSON.parse(referencesStr) : null;

    if (!itemId || !title) {
        return { error: "Missing required fields" };
    }

    // Check if item exists
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return { error: "Item not found" };

    const data = JSON.stringify({ title, content, attachments, relatedItems, references });
    const submitReason = formData.get("submitReason") as string || null;
    const rawPreviousRequestId = formData.get("previousRequestId");
    const previousRequestId = (rawPreviousRequestId && rawPreviousRequestId !== "") ? parseInt(rawPreviousRequestId as string) : null;

    try {
        await prisma.changeRequest.create({
            data: {
                type: "UPDATE",
                status: "PENDING",
                data,
                item: { connect: { id: itemId } },
                targetProject: { connect: { id: item.projectId } },
                submittedBy: { connect: { id: session.user.id } },
                submitReason,
                // Use previousRequestId if relation name is causing issues, but connect is preferred
                ...(previousRequestId ? { previousRequest: { connect: { id: previousRequestId } } } : {}),
            },
        });

        revalidatePath(`/items/${itemId}`);
        return { message: "Update request submitted successfully! Waiting for approval." };
    } catch (e: any) {
        console.error("Submission Error:", e);
        return { error: `Failed to submit request: ${e.message || "Unknown error"}` };
    }
}

// --- Submit Delete Request ---
export async function submitDeleteItemRequest(itemId: number, submitReason?: string): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user.role)) {
        return { error: "Unauthorized" };
    }

    // Check children (Defense)
    const childCount = await prisma.item.count({
        where: { parentId: itemId, isDeleted: false }
    });

    if (childCount > 0) {
        return { error: "Cannot delete item with existing children. Please delete children first." };
    }

    // 檢查是否有進行中的 ChangeRequest (PENDING 狀態)
    const pendingChangeRequests = await prisma.changeRequest.count({
        where: {
            itemId: itemId,
            status: "PENDING"
        }
    });
    if (pendingChangeRequests > 0) {
        return { error: "該項目有待審核的變更申請，請等待審核完成後再申請刪除" };
    }

    // 檢查是否有未完成的 QC/PM 審查流程
    const pendingApprovals = await prisma.qCDocumentApproval.count({
        where: {
            itemHistory: { itemId: itemId },
            status: { notIn: ["COMPLETED", "REJECTED"] }
        }
    });
    if (pendingApprovals > 0) {
        return { error: "該項目有未完成的品質審查流程，請等待 QC/PM 審核完成後再申請刪除" };
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return { error: "Item not found" };

    try {
        await prisma.changeRequest.create({
            data: {
                type: "DELETE",
                status: "PENDING",
                data: "{}",
                item: { connect: { id: itemId } },
                targetProject: { connect: { id: item.projectId } },
                submittedBy: { connect: { id: session.user.id } },
                submitReason: submitReason || null,
            },
        });

        revalidatePath(`/items/${itemId}`);
        return { message: "Delete request submitted successfully! Waiting for approval." };
    } catch (e) {
        console.error(e);
        return { error: "Failed to submit request" };
    }
}

// --- Submit Project Update Request ---
export async function submitUpdateProjectRequest(
    prevState: ApprovalState,
    formData: FormData
): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user.role)) {
        return { error: "Unauthorized" };
    }

    const projectId = parseInt(formData.get("projectId") as string);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    if (!projectId || !title) {
        return { error: "Missing required fields" };
    }

    // Check if project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { error: "Project not found" };

    const data = JSON.stringify({ title, description });
    const submitReason = formData.get("submitReason") as string || null;

    try {
        await prisma.changeRequest.create({
            data: {
                type: "PROJECT_UPDATE",
                status: "PENDING",
                data,
                targetProjectId: projectId,
                submittedById: session.user.id,
                submitReason,
            },
        });

        revalidatePath(`/projects`);
        revalidatePath(`/projects/${projectId}`);
        return { message: "Project update request submitted successfully! Waiting for approval." };
    } catch (e) {
        console.error(e);
        return { error: "Failed to submit request" };
    }
}

// --- Submit Project Delete Request ---
export async function submitDeleteProjectRequest(projectId: number): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return { error: "Unauthorized: Only Admins can request project deletion." };
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { _count: { select: { items: true } } }
    });
    if (!project) return { error: "Project not found" };

    // Check if project has items
    if (project._count.items > 0) {
        return { error: `Cannot delete project with ${project._count.items} existing items. Please delete all items first.` };
    }

    // Store project info in data for display in approval dashboard
    const data = JSON.stringify({ title: project.title, codePrefix: project.codePrefix });

    try {
        await prisma.changeRequest.create({
            data: {
                type: "PROJECT_DELETE",
                status: "PENDING",
                data,
                targetProjectId: projectId,
                submittedById: session.user.id,
            },
        });

        revalidatePath(`/projects`);
        return { message: "Project delete request submitted successfully! Waiting for approval." };
    } catch (e) {
        console.error(e);
        return { error: "Failed to submit request" };
    }
}

// --- Admin Actions ---

export async function getPendingRequests() {
    const session = await getServerSession(authOptions);
    if (!session || !canReview(session.user.role)) return [];

    return await prisma.changeRequest.findMany({
        where: { status: "PENDING" },
        include: {
            submittedBy: { select: { username: true } },
            targetProject: { select: { title: true, codePrefix: true } },
            targetParent: { select: { fullId: true } },
            item: {
                select: {
                    fullId: true,
                    title: true,
                    content: true,
                    attachments: true,
                    relationsFrom: {
                        include: {
                            target: {
                                select: { id: true, fullId: true, title: true }
                            }
                        }
                    },
                    references: {
                        include: {
                            file: {
                                select: { id: true, dataCode: true, dataName: true, dataYear: true, author: true }
                            }
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: "asc" }
    });
}

// ==================== Approval Handlers (Private) ====================

async function handleItemCreateApproval(
    tx: Prisma.TransactionClient,
    request: any,
    data: any,
    session: any,
    reviewNote?: string
) {
    if (!request.targetProjectId) throw new Error("Missing target project");

    const fullId = await generateNextItemId(
        request.targetProjectId,
        request.targetParentId,
        tx
    );

    const newItem = await tx.item.create({
        data: {
            fullId,
            title: data.title,
            content: data.content,
            attachments: data.attachments && data.attachments.length > 0
                ? JSON.stringify(data.attachments)
                : null,
            projectId: request.targetProjectId,
            parentId: request.targetParentId,
            publishedAt: new Date(),
        },
    });

    // Bulk create relations
    if (data.relatedItems && data.relatedItems.length > 0) {
        const relationData: any[] = [];
        for (const rItem of data.relatedItems) {
            relationData.push({ sourceId: newItem.id, targetId: rItem.id, description: rItem.description || null });
            relationData.push({ sourceId: rItem.id, targetId: newItem.id, description: rItem.description || null });
        }
        await tx.itemRelation.createMany({
            data: relationData,
            skipDuplicates: true
        });
    }

    // Bulk create references
    if (data.references && data.references.length > 0) {
        await tx.itemReference.createMany({
            data: data.references.map((ref: any) => ({
                itemId: newItem.id,
                fileId: ref.fileId,
                citation: ref.citation || null
            })),
            skipDuplicates: true
        });
    }

    const relationsForSnapshot = await tx.itemRelation.findMany({
        where: { sourceId: newItem.id },
        include: { target: { select: { id: true, fullId: true, title: true } } }
    });
    const referencesForSnapshot = await tx.itemReference.findMany({
        where: { itemId: newItem.id },
        include: { file: { select: { id: true, dataCode: true, dataName: true, dataYear: true, author: true } } }
    });

    const snapshot: ItemSnapshot = {
        title: newItem.title,
        content: newItem.content,
        attachments: newItem.attachments,
        relatedItems: mapRelationsToSnapshot(relationsForSnapshot),
        references: mapReferencesToSnapshot(referencesForSnapshot)
    };

    await createHistoryRecord(
        newItem,
        snapshot,
        {
            id: request.id,
            submittedById: request.submittedById,
            submitReason: request.submitReason,
            reviewNote: reviewNote,
            createdAt: request.createdAt
        },
        "CREATE",
        session.user.id,
        undefined,
        tx
    );
}

async function handleItemUpdateApproval(
    tx: Prisma.TransactionClient,
    request: any,
    data: any,
    session: any,
    reviewNote?: string
) {
    if (!request.itemId) throw new Error("Missing target item ID");

    const originalRelations = await tx.itemRelation.findMany({
        where: { sourceId: request.itemId },
        include: { target: { select: { id: true, fullId: true, title: true } } }
    });
    const originalReferences = await tx.itemReference.findMany({
        where: { itemId: request.itemId },
        include: { file: { select: { id: true, dataCode: true, dataName: true, dataYear: true, author: true } } }
    });
    const originalItem = await tx.item.findUnique({
        where: { id: request.itemId }
    });
    if (!originalItem) throw new Error("Original item not found");

    const oldSnapshot: ItemSnapshot = {
        title: originalItem.title,
        content: originalItem.content,
        attachments: originalItem.attachments,
        relatedItems: mapRelationsToSnapshot(originalRelations),
        references: mapReferencesToSnapshot(originalReferences)
    };

    const updatedItem = await tx.item.update({
        where: { id: request.itemId },
        data: {
            title: data.title,
            content: data.content,
            attachments: data.attachments ? JSON.stringify(data.attachments) : undefined,
            updatedAt: new Date()
        }
    });

    if (data.relatedItems) {
        await tx.itemRelation.deleteMany({
            where: { OR: [{ sourceId: request.itemId }, { targetId: request.itemId }] }
        });

        const relationData: any[] = [];
        for (const rItem of data.relatedItems) {
            relationData.push({ sourceId: request.itemId, targetId: rItem.id, description: rItem.description || null });
            relationData.push({ sourceId: rItem.id, targetId: request.itemId, description: rItem.description || null });
        }
        await tx.itemRelation.createMany({
            data: relationData,
            skipDuplicates: true
        });
    }

    if (data.references) {
        await tx.itemReference.deleteMany({ where: { itemId: request.itemId } });
        await tx.itemReference.createMany({
            data: data.references.map((ref: any) => ({
                itemId: request.itemId,
                fileId: ref.fileId,
                citation: ref.citation || null
            })),
            skipDuplicates: true
        });
    }

    const updatedRelations = await tx.itemRelation.findMany({
        where: { sourceId: request.itemId },
        include: { target: { select: { id: true, fullId: true, title: true } } }
    });
    const updatedReferences = await tx.itemReference.findMany({
        where: { itemId: request.itemId },
        include: { file: { select: { id: true, dataCode: true, dataName: true, dataYear: true, author: true } } }
    });

    const newSnapshot: ItemSnapshot = {
        title: updatedItem.title,
        content: updatedItem.content,
        attachments: updatedItem.attachments,
        relatedItems: mapRelationsToSnapshot(updatedRelations),
        references: mapReferencesToSnapshot(updatedReferences)
    };

    await createHistoryRecord(
        updatedItem,
        newSnapshot,
        {
            id: request.id,
            submittedById: request.submittedById,
            submitReason: request.submitReason,
            reviewNote: reviewNote,
            createdAt: request.createdAt
        },
        "UPDATE",
        session.user.id,
        oldSnapshot,
        tx
    );
}

async function handleItemDeleteApproval(
    tx: Prisma.TransactionClient,
    request: any,
    session: any,
    reviewNote?: string
) {
    if (!request.itemId) throw new Error("Missing target item ID");

    const childCount = await tx.item.count({ where: { parentId: request.itemId, isDeleted: false } });
    if (childCount > 0) throw new Error("Cannot delete item with children");

    const item = await tx.item.findUnique({ where: { id: request.itemId } });
    if (!item) throw new Error("Item not found");

    const relations = await tx.itemRelation.findMany({
        where: { sourceId: request.itemId },
        include: { target: { select: { id: true, fullId: true, title: true } } }
    });
    const itemReferences = await tx.itemReference.findMany({
        where: { itemId: request.itemId },
        include: { file: { select: { id: true, dataCode: true, dataName: true, dataYear: true, author: true } } }
    });

    const lastSnapshot: ItemSnapshot = {
        title: item.title,
        content: item.content,
        attachments: item.attachments,
        relatedItems: mapRelationsToSnapshot(relations),
        references: mapReferencesToSnapshot(itemReferences)
    };

    await tx.itemRelation.deleteMany({
        where: { OR: [{ sourceId: request.itemId }, { targetId: request.itemId }] }
    });

    await tx.item.update({
        where: { id: request.itemId },
        data: { isDeleted: true }
    });

    await createHistoryRecord(
        item,
        lastSnapshot,
        {
            id: request.id,
            submittedById: request.submittedById,
            submitReason: request.submitReason,
            reviewNote: reviewNote,
            createdAt: request.createdAt
        },
        "DELETE",
        session.user.id,
        undefined,
        tx
    );
}

// ==================== Public Actions ====================

export async function approveRequest(requestId: number, reviewNote?: string) {
    const session = await getServerSession(authOptions);
    if (!session || !canReview(session.user.role)) throw new Error("Unauthorized");

    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId },
        include: {
            submittedBy: { select: { id: true } },
            item: { select: { fullId: true, title: true } },
            targetProject: { select: { title: true, codePrefix: true } },
        }
    });

    if (!request || request.status !== "PENDING") throw new Error("Invalid request");

    if (session.user.role !== "ADMIN" && request.submittedById === session.user.id) {
        throw new Error("You cannot approve your own change request");
    }

    const data = JSON.parse(request.data);

    try {
        await prisma.$transaction(async (tx) => {
            if (request.type === "CREATE") {
                await handleItemCreateApproval(tx, request, data, session, reviewNote);
            } else if (request.type === "UPDATE") {
                await handleItemUpdateApproval(tx, request, data, session, reviewNote);
            } else if (request.type === "DELETE") {
                await handleItemDeleteApproval(tx, request, session, reviewNote);
            } else if (request.type === "PROJECT_UPDATE") {
                if (!request.targetProjectId) throw new Error("Missing target project ID");
                await tx.project.update({
                    where: { id: request.targetProjectId },
                    data: {
                        title: data.title,
                        description: data.description || null,
                        updatedAt: new Date()
                    }
                });
            } else if (request.type === "PROJECT_DELETE") {
                if (!request.targetProjectId) throw new Error("Missing target project ID");
                const itemCount = await tx.item.count({ where: { projectId: request.targetProjectId } });
                if (itemCount > 0) throw new Error("Cannot delete project with existing items");
                await tx.project.delete({ where: { id: request.targetProjectId } });
            }

            // Update Request Status
            await tx.changeRequest.update({
                where: { id: requestId },
                data: {
                    status: "APPROVED",
                    reviewedById: session.user.id,
                    reviewNote: reviewNote || "同意",
                    updatedAt: new Date()
                }
            });

            // Send notification
            if (request.submittedById) {
                const itemId = request.item?.fullId || request.targetProject?.codePrefix || "項目";
                const itemTitle = request.item?.title || request.targetProject?.title || "";

                await createNotification({
                    userId: request.submittedById,
                    type: "APPROVAL",
                    title: `變更申請已核准`,
                    message: `${itemId} ${itemTitle} - 已通過審核`,
                    link: request.itemId ? `/items/${request.itemId}` : `/projects/${request.targetProjectId}`,
                    changeRequestId: requestId,
                }, tx);
            }
        });

        revalidatePath("/admin/approval");
        if (request.targetProjectId) revalidatePath(`/projects/${request.targetProjectId}`);
        if (request.itemId) revalidatePath(`/items/${request.itemId}`);

    } catch (e: any) {
        console.error("Failed to approve request", e);
        throw new Error(`Failed to apply change: ${e.message}`);
    }
}

export async function rejectRequest(requestId: number, reviewNote?: string) {
    const session = await getServerSession(authOptions);
    if (!session || !canReview(session.user.role)) throw new Error("Unauthorized");

    // Get request details for notification
    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId },
        include: {
            item: { select: { fullId: true, title: true } },
            targetProject: { select: { title: true, codePrefix: true } },
        }
    });

    if (!request) throw new Error("Request not found");

    await prisma.changeRequest.update({
        where: { id: requestId },
        data: {
            status: "REJECTED",
            reviewedById: session.user.id,
            reviewNote: reviewNote || null,
            updatedAt: new Date()
        }
    });

    // Send notification to submitter
    if (request.submittedById) {
        const itemId = request.item?.fullId || request.targetProject?.codePrefix || "項目";
        const itemTitle = request.item?.title || request.targetProject?.title || "";

        await createNotification({
            userId: request.submittedById,
            type: "REJECTION",
            title: `變更申請已退回`,
            message: `${itemId} ${itemTitle} - ${reviewNote || "無審查意見"}`,
            link: `/admin/rejected-requests/${requestId}`,
            changeRequestId: requestId,
        });
    }

    revalidatePath("/admin/approval");
}

// --- Cancel Rejected Request ---
export async function cancelRejectedRequest(requestId: number): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "未登入" };

    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId }
    });

    if (!request) return { error: "找不到該申請" };
    if (request.status !== "REJECTED") return { error: "只能取消被退回的申請" };

    // 權限檢查：只有原提交者或管理員可以取消
    if (request.submittedById !== session.user.id && session.user.role !== "ADMIN") {
        return { error: "您沒有權限取消此申請" };
    }

    try {
        await prisma.changeRequest.delete({
            where: { id: requestId }
        });

        revalidatePath("/admin/rejected-requests");
        return { message: "申請已取消" };
    } catch (e) {
        console.error("Failed to cancel request:", e);
        return { error: "取消申請失敗" };
    }
}
