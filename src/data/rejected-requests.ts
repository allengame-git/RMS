import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Get rejected change requests for the current user
 * This is a data fetching function, NOT a server action.
 */
export async function getRejectedRequests() {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    // 1. 獲取項目變更退回
    const itemRequests = await prisma.changeRequest.findMany({
        where: {
            submittedById: session.user.id,
            status: "REJECTED"
        },
        include: {
            item: { select: { id: true, fullId: true, title: true, content: true, attachments: true } },
            targetProject: { select: { id: true, title: true, codePrefix: true } },
            reviewedBy: { select: { username: true } },
        },
        orderBy: { updatedAt: "desc" }
    });

    // 2. 獲取檔案變更退回
    const fileRequests = await prisma.dataFileChangeRequest.findMany({
        where: {
            submittedById: session.user.id,
            status: "REJECTED"
        },
        include: {
            file: { select: { id: true, dataCode: true, dataName: true } },
            reviewedBy: { select: { username: true } },
        },
        orderBy: { updatedAt: "desc" }
    });

    // 3. 獲取品質文件修訂要求
    const qcRevisions = await prisma.qCDocumentApproval.findMany({
        where: {
            status: "REVISION_REQUIRED",
            itemHistory: {
                submittedById: session.user.id
            }
        },
        include: {
            itemHistory: {
                include: {
                    project: { select: { title: true, codePrefix: true } }
                }
            }
        },
        orderBy: { updatedAt: "desc" }
    });

    // 合併並轉換為統一格式
    const combined = [
        ...itemRequests.map(r => ({ ...r, category: 'ITEM' as const })),
        ...fileRequests.map(r => ({
            ...r,
            category: 'FILE' as const,
            // 兼容前端渲染欄位
            item: r.file ? { fullId: r.file.dataCode, title: r.file.dataName } : null,
            targetProject: null
        })),
        ...qcRevisions.map(r => ({
            id: r.id,
            type: 'REVISION_REQUIRED',
            category: 'QC' as const,
            updatedAt: r.updatedAt,
            item: { fullId: r.itemHistory.itemFullId, title: r.itemHistory.itemTitle },
            targetProject: r.itemHistory.project,
            reviewedBy: null, // PM/QC 資訊較複雜，暫不在此顯示單一審核者
            reviewNote: r.pmNote || r.qcNote,
            itemHistoryId: r.itemHistoryId
        }))
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return combined;
}

/**
 * Get a single rejected request by ID (for detail view)
 * This is a data fetching function, NOT a server action.
 */
export async function getRejectedRequestDetail(requestId: number) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId },
        include: {
            item: {
                select: {
                    id: true,
                    fullId: true,
                    title: true,
                    content: true,
                    attachments: true,
                    relationsFrom: {
                        include: {
                            target: { select: { id: true, fullId: true, title: true, projectId: true } }
                        }
                    }
                }
            },
            targetProject: { select: { id: true, title: true, codePrefix: true } },
            submittedBy: { select: { username: true } },
            reviewedBy: { select: { username: true } },
        }
    });

    if (!request) return null;

    // Verify ownership
    if (request.submittedById !== session.user.id && session.user.role !== "ADMIN") {
        throw new Error("Unauthorized");
    }

    return request;
}
