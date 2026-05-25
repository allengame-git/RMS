/**
 * @file approval.ts
 * @description 審批工作流程核心模組
 *
 * 此檔案是 RMS (Records Management System) 的核心 Server Actions 模組，
 * 負責處理所有與變更請求 (ChangeRequest) 相關的工作流程。
 *
 * ## 核心概念
 * RMS 採用「先申請、後審核」的變更管理機制：
 * 1. 使用者（Editor 以上）提交變更申請 → 建立 ChangeRequest（狀態：PENDING）
 * 2. 審核者（Inspector/Admin）審核申請 → 批准或拒絕
 * 3. 批准後系統自動執行變更，並建立歷史紀錄 (ItemHistory)
 *
 * ## 變更類型 (ChangeRequest.type)
 * - `CREATE`：新增項目
 * - `UPDATE`：修改項目
 * - `DELETE`：刪除項目（軟刪除）
 * - `PROJECT_UPDATE`：修改專案基本資料
 * - `PROJECT_DELETE`：刪除專案
 *
 * ## 角色權限定義
 * - VIEWER：僅能檢視
 * - EDITOR：可提交變更申請
 * - INSPECTOR：可審核申請 + EDITOR 權限
 * - ADMIN：完整權限，包含專案刪除等敏感操作
 *
 * ## 重要注意事項
 * - 所有資料庫操作使用 Prisma Transaction 確保一致性
 * - 審批通過後會觸發：建立歷史紀錄 → 建立通知 → 觸發 QC 審查流程（若適用）
 * - 項目刪除前會檢查：子項目、待審核申請、未完成的 QC 流程
 *
 * @see /src/lib/prisma.ts - Prisma Client 實例
 * @see /src/actions/history.ts - 歷史紀錄相關邏輯
 * @see /src/actions/qc-approval.ts - QC 審查流程
 */

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

// ==================== Type Definitions ====================

interface RelationWithTarget {
    description: string | null;
    target: { id: number; fullId: string; title: string };
}

interface ReferenceWithFile {
    citation: string | null;
    file: { id: number; dataCode: string; dataName: string; dataYear: number | null; author: string | null };
}

// Flexible type for ChangeRequest with partial includes - avoids strict Item type requirement
interface ChangeRequestWithIncludes {
    id: number;
    type: string;
    status: string;
    data: string;
    itemId: number | null;
    targetProjectId: number | null;
    targetParentId: number | null;
    submittedById: string | null;
    reviewedById?: string | null;
    reviewNote?: string | null;
    submitReason?: string | null;
    createdAt: Date;
    updatedAt?: Date;
    reviewedAt?: Date | null;
    previousRequestId?: number | null;
    item?: { id?: number; fullId: string; title: string } | null;
    targetProject?: { id?: number; title: string; codePrefix: string } | null;
    submittedBy?: { id: string } | null;
}

interface ApprovalData {
    title: string;
    content: string | null;
    fullId?: string;
    attachments?: { name: string; path: string; size: number; type: string }[];
    relatedItems?: { id: number; description?: string }[];
    references?: { fileId: number; citation?: string }[];
}

interface SessionUser {
    id: string;
    role: string;
    username: string;
}

// ==================== Helper Functions ====================

/** 可編輯角色列表 */
const EDITABLE_ROLES = ["EDITOR", "INSPECTOR", "ADMIN"];

/** 可審核角色列表 */
const REVIEWER_ROLES = ["INSPECTOR", "ADMIN"];

/** 檢查使用者是否有編輯權限 */
const canEdit = (role: string) => EDITABLE_ROLES.includes(role);

/** 檢查使用者是否有審核權限 */
const canReview = (role: string) => REVIEWER_ROLES.includes(role);

/** 從 DB 取得使用者當前角色（避免 JWT 過期不同步） */
const getUserCurrentRole = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
    });
    return user?.role;
};

/** 將 ItemRelation 陣列映射為 snapshot 格式 */
const mapRelationsToSnapshot = (relations: RelationWithTarget[]) =>
    relations.map(r => ({
        id: r.target.id,
        fullId: r.target.fullId,
        title: r.target.title,
        description: r.description
    }));

/** 將 ItemReference 陣列映射為 snapshot 格式 */
const mapReferencesToSnapshot = (refs: ReferenceWithFile[]) =>
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

    // 提交時就預分配 fullId，確保編號順序對應提交順序
    const fullId = await generateNextItemId(projectId, parentId);

    const data = JSON.stringify({
        title,
        content,
        attachments,
        relatedItems,
        references,
        fullId,
    });

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
    } catch (e: unknown) {
        console.error("Submission Error:", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return { error: `Failed to submit request: ${message}` };
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

export async function getPendingRequests(take = 100, skip = 0) {
    const session = await getServerSession(authOptions);
    if (!session) return [];

    // Filter for non-reviewers (Editors/Viewers): can only see their own requests
    const isReviewer = canReview(session.user.role);
    const whereCondition: Prisma.ChangeRequestWhereInput = {
        status: "PENDING",
        ...(isReviewer ? {} : { submittedById: session.user.id })
    };

    return await prisma.changeRequest.findMany({
        where: whereCondition,
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
        orderBy: { createdAt: "asc" },
        take,
        skip,
    });
}

/**
 * 撤回（取消）項目變更申請
 *
 * 允許提交者本人後悔並撤回尚未審核的申請，或由管理員強制撤回。
 * 撤回操作是「物理刪除」，資料庫中不會保留此次申請記錄。
 *
 * @param requestId ChangeRequest ID
 * @returns ApprovalState 包含 error 或 message
 */
export async function cancelChangeRequest(requestId: number): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId },
        include: { submittedBy: true }
    });

    if (!request) return { error: "Request not found" };

    // Check permissions: Admin or Original Submitter
    // 從 DB 驗證當前角色（防止 JWT 過期不同步）
    const cancelRole = await getUserCurrentRole(session.user.id);
    const isAdmin = cancelRole === "ADMIN";
    const isSubmitter = request.submittedById === session.user.id;

    if (!isAdmin && !isSubmitter) {
        return { error: "You do not have permission to cancel this request" };
    }

    if (request.status !== "PENDING") {
        return { error: "Only pending requests can be cancelled" };
    }

    try {
        await prisma.changeRequest.delete({
            where: { id: requestId }
        });

        // Revalidate relevant paths
        revalidatePath("/admin/approval");
        if (request.targetProjectId) revalidatePath(`/projects/${request.targetProjectId}`);
        if (request.itemId) revalidatePath(`/items/${request.itemId}`);

        return { message: "Request cancelled successfully" };
    } catch (e) {
        console.error("Failed to cancel request:", e);
        return { error: "Failed to cancel request" };
    }
}

/**
 * 編輯待審核的變更申請
 *
 * 允許原提交者在審核前修改 PENDING 狀態的 ChangeRequest 內容。
 * 直接更新同一筆記錄的 data、submitReason、updatedAt。
 *
 * @param requestId ChangeRequest ID
 * @param formData 包含更新後的 title、content、relatedItems、references、submitReason
 */
export async function updatePendingRequest(
    requestId: number,
    formData: FormData
): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user.role)) {
        return { error: "權限不足" };
    }

    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId },
    });

    if (!request) return { error: "找不到該申請" };
    if (request.status !== "PENDING") return { error: "只有待審核的申請才能編輯" };
    if (request.submittedById !== session.user.id) return { error: "只有原提交者才能編輯此申請" };

    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const submitReason = formData.get("submitReason") as string || null;

    if (!title) return { error: "標題為必填" };

    // Parse existing data to preserve fields not in the form (e.g., fullId for CREATE)
    const existingData = JSON.parse(request.data);

    const relatedItemsStr = formData.get("relatedItems") as string;
    const relatedItems = relatedItemsStr ? JSON.parse(relatedItemsStr) : [];
    const referencesStr = formData.get("references") as string;
    const references = referencesStr ? JSON.parse(referencesStr) : [];

    const updatedData = {
        ...existingData,
        title,
        content,
        relatedItems,
        references,
    };

    try {
        await prisma.changeRequest.update({
            where: { id: requestId },
            data: {
                data: JSON.stringify(updatedData),
                submitReason,
                updatedAt: new Date(),
            },
        });

        revalidatePath("/admin/approval");
        if (request.targetProjectId) revalidatePath(`/projects/${request.targetProjectId}`);
        if (request.itemId) revalidatePath(`/items/${request.itemId}`);

        return { message: "申請已更新" };
    } catch (e) {
        console.error("Failed to update pending request:", e);
        return { error: "更新申請失敗" };
    }
}

// ==================== Approval Handlers (Private) ====================

async function handleItemCreateApproval(
    tx: Prisma.TransactionClient,
    request: ChangeRequestWithIncludes,
    data: ApprovalData,
    session: { user: SessionUser },
    reviewNote?: string
) {
    if (!request.targetProjectId) throw new Error("Missing target project");

    // 優先使用提交時預分配的 fullId，若不存在則 fallback 動態產生（相容舊資料）
    const fullId = data.fullId || await generateNextItemId(
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
        const relationData: { sourceId: number; targetId: number; description: string | null }[] = [];
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
            data: data.references.map((ref: { fileId: number; citation?: string }) => ({
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

    // 關鍵：回寫 itemId 到 ChangeRequest
    // 這樣如果後續被 QC/PM 退回，重新提交時可以找到已建立的 Item
    await tx.changeRequest.update({
        where: { id: request.id },
        data: { itemId: newItem.id }
    });
}

async function handleItemUpdateApproval(
    tx: Prisma.TransactionClient,
    request: ChangeRequestWithIncludes,
    data: ApprovalData,
    session: { user: SessionUser },
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

        const relationData: { sourceId: number; targetId: number; description: string | null }[] = [];
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
            data: data.references.map((ref: { fileId: number; citation?: string }) => ({
                itemId: request.itemId!,
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

    // 關鍵邏輯：檢查是否為 QC/PM 退回後的重提
    // 如果是，則更新現有的 ItemHistory 而非建立新版本
    if (request.previousRequestId) {
        // 找出前一個申請案關聯的 ItemHistory
        const previousHistory = await tx.itemHistory.findFirst({
            where: { changeRequestId: request.previousRequestId },
            include: { qcApproval: true }
        });

        // 如果前一個 History 存在且其 QC 審查被 REJECTED，代表這是 QC/PM 退回後的重提
        if (previousHistory && previousHistory.qcApproval?.status === "REJECTED") {
            console.log('[handleItemUpdateApproval] Detected QC/PM rejection resubmission - updating existing history');

            // 更新現有的 ItemHistory（保持相同版本號）
            await tx.itemHistory.update({
                where: { id: previousHistory.id },
                data: {
                    snapshot: JSON.stringify(newSnapshot),
                    changeRequestId: request.id, // 更新關聯到新的 ChangeRequest
                    submittedById: request.submittedById,
                    reviewedById: session.user.id,
                    reviewNote: reviewNote || null,
                    submitReason: request.submitReason || null,
                }
            });

            // 重置 QCDocumentApproval 狀態，重新開始 QC/PM 審查流程
            await tx.qCDocumentApproval.update({
                where: { id: previousHistory.qcApproval.id },
                data: {
                    status: "PENDING_QC",
                    qcApprovedById: null,
                    qcApprovedAt: null,
                    qcNote: null,
                    pmApprovedById: null,
                    pmApprovedAt: null,
                    pmNote: null,
                    revisionCount: { increment: 1 }
                }
            });

            return; // 不建立新的 History
        }
    }

    // 正常流程：建立新的 HistoryRecord
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
    request: ChangeRequestWithIncludes,
    session: { user: SessionUser },
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

export async function approveRequest(requestId: number, reviewNote?: string): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    // 從 DB 驗證當前角色（防止 JWT 過期不同步）
    const currentRole = await getUserCurrentRole(session.user.id);
    if (!currentRole || !canReview(currentRole)) return { error: "Unauthorized" };

    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId },
        include: {
            submittedBy: { select: { id: true } },
            item: { select: { fullId: true, title: true } },
            targetProject: { select: { title: true, codePrefix: true } },
        }
    });

    if (!request || request.status !== "PENDING") return { error: "Invalid request" };

    if (currentRole !== "ADMIN" && request.submittedById === session.user.id) {
        return { error: "You cannot approve your own change request" };
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

        return { message: "Request approved successfully" };
    } catch (e: unknown) {
        console.error("Failed to approve request", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return { error: `Failed to apply change: ${message}` };
    }
}

export async function rejectRequest(requestId: number, reviewNote?: string): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    // 從 DB 驗證當前角色（防止 JWT 過期不同步）
    const currentRole = await getUserCurrentRole(session.user.id);
    if (!currentRole || !canReview(currentRole)) return { error: "Unauthorized" };

    // Get request details for notification
    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId },
        include: {
            item: { select: { fullId: true, title: true } },
            targetProject: { select: { title: true, codePrefix: true } },
        }
    });

    if (!request) return { error: "Request not found" };

    try {
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
        return { message: "Request rejected successfully" };
    } catch (e: unknown) {
        console.error("Failed to reject request:", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return { error: `Failed to reject request: ${message}` };
    }
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
    // 從 DB 驗證當前角色（防止 JWT 過期不同步）
    const rejCancelRole = await getUserCurrentRole(session.user.id);
    if (request.submittedById !== session.user.id && rejCancelRole !== "ADMIN") {
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
