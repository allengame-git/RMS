"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateNextItemId } from "@/lib/item-utils";

export type ApprovalState = {
    message?: string;
    error?: string;
};

// --- Submit Request ---

export async function submitCreateItemRequest(
    prevState: ApprovalState,
    formData: FormData
): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "EDITOR" && session.user.role !== "INSPECTOR" && session.user.role !== "ADMIN")) {
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

    if (!title || !projectId) {
        return { error: "Missing required fields" };
    }

    const data = JSON.stringify({ title, content, attachments, relatedItems });

    try {
        await prisma.changeRequest.create({
            data: {
                type: "CREATE",
                status: "PENDING",
                data,
                targetProjectId: projectId,
                targetParentId: parentId,
                submittedById: session.user.id,
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
    if (!session || (session.user.role !== "EDITOR" && session.user.role !== "INSPECTOR" && session.user.role !== "ADMIN")) {
        return { error: "Unauthorized" };
    }

    const itemId = parseInt(formData.get("itemId") as string);
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const attachmentsStr = formData.get("attachments") as string;
    const attachments = attachmentsStr ? JSON.parse(attachmentsStr) : null;

    if (!itemId || !title) {
        return { error: "Missing required fields" };
    }

    // Check if item exists
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return { error: "Item not found" };

    const data = JSON.stringify({ title, content, attachments });

    try {
        await prisma.changeRequest.create({
            data: {
                type: "UPDATE",
                status: "PENDING",
                data,
                itemId: itemId,
                targetProjectId: item.projectId, // Useful for filtering
                submittedById: session.user.id,
            },
        });

        revalidatePath(`/items/${itemId}`);
        return { message: "Update request submitted successfully! Waiting for approval." };
    } catch (e) {
        console.error(e);
        return { error: "Failed to submit request" };
    }
}

// --- Submit Delete Request ---
export async function submitDeleteItemRequest(itemId: number): Promise<ApprovalState> {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "EDITOR" && session.user.role !== "INSPECTOR" && session.user.role !== "ADMIN")) {
        return { error: "Unauthorized" };
    }

    // Check children (Defense)
    const childCount = await prisma.item.count({
        where: { parentId: itemId, isDeleted: false }
    });

    if (childCount > 0) {
        return { error: "Cannot delete item with existing children. Please delete children first." };
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return { error: "Item not found" };

    try {
        await prisma.changeRequest.create({
            data: {
                type: "DELETE",
                status: "PENDING",
                data: "{}", // No specific data needed for delete
                itemId: itemId,
                targetProjectId: item.projectId,
                submittedById: session.user.id,
            },
        });

        revalidatePath(`/items/${itemId}`);
        return { message: "Delete request submitted successfully! Waiting for approval." };
    } catch (e) {
        console.error(e);
        return { error: "Failed to submit request" };
    }
}

// --- Admin Actions ---

export async function getPendingRequests() {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "INSPECTOR")) return [];

    return await prisma.changeRequest.findMany({
        where: { status: "PENDING" },
        include: {
            submittedBy: { select: { username: true } },
            targetProject: { select: { title: true, codePrefix: true } },
            targetParent: { select: { fullId: true } },
            item: { select: { fullId: true, title: true } } // For Update/Delete
        },
        orderBy: { createdAt: "asc" }
    });
}

export async function approveRequest(requestId: number) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "INSPECTOR")) throw new Error("Unauthorized");

    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId },
    });

    if (!request || request.status !== "PENDING") throw new Error("Invalid request");

    const data = JSON.parse(request.data);

    // LOGIC: Apply Change
    try {
        if (request.type === "CREATE") {
            // Generate ID
            if (!request.targetProjectId) throw new Error("Missing target project");

            const fullId = await generateNextItemId(
                request.targetProjectId,
                request.targetParentId
            );

            await prisma.item.create({
                data: {
                    fullId,
                    title: data.title,
                    content: data.content,
                    attachments: data.attachments && data.attachments.length > 0
                        ? JSON.stringify(data.attachments)
                        : null,
                    projectId: request.targetProjectId,
                    parentId: request.targetParentId,
                    publishedAt: new Date(), // Publish immediately upon approval for now
                    relatedItems: data.relatedItems && data.relatedItems.length > 0 ? {
                        connect: data.relatedItems.map((item: any) => ({ id: item.id }))
                    } : undefined
                }
            });

            // Bidirectional Relation Sync for new item
            // Since we only connected one way above (New -> Related), we should also connect Related -> New?
            // Wait, implicit m-n table logic:
            // If we connect A -> B, the relation exists in the join table.
            // B.relatedItems will include A? Not necessarily. 
            // In Prisma explicit relation with @relation("name"), there are two fields.
            // If I connect A.relatedItems to B, then A is in B.relatedToItems.
            // But we want A in B.relatedItems too (symmetric).
            // So we need to manually update the other side.

            if (data.relatedItems && data.relatedItems.length > 0) {
                // Update the other items to also related to this new item
                // We can't do this in the same create call easily for symmetric self-relation logic unless we just rely on one relation field.
                // But our schema has two fields relatedItems/relatedToItems.
                // Let's manually iterate to sure symmetry.
                // The item we just created has `fullId`.

                // However, we don't have the new item's internal ID easily unless we capture the return of creation.
                const newItem = await prisma.item.findUnique({ where: { fullId } });

                if (newItem) {
                    for (const rItem of data.relatedItems) {
                        await prisma.item.update({
                            where: { id: rItem.id },
                            data: {
                                relatedItems: {
                                    connect: { id: newItem.id }
                                }
                            }
                        });
                    }
                }
            }
        }
        else if (request.type === "UPDATE") {
            if (!request.itemId) throw new Error("Missing target item ID");

            await prisma.item.update({
                where: { id: request.itemId },
                data: {
                    title: data.title,
                    content: data.content,
                    attachments: data.attachments ? JSON.stringify(data.attachments) : undefined,
                    updatedAt: new Date()
                }
            });
        }
        else if (request.type === "DELETE") {
            if (!request.itemId) throw new Error("Missing target item ID");

            // Double check children count
            const childCount = await prisma.item.count({ where: { parentId: request.itemId, isDeleted: false } });
            if (childCount > 0) throw new Error("Cannot delete item with children");

            await prisma.item.update({
                where: { id: request.itemId },
                data: { isDeleted: true }
            });
        }

        // Update Request Status
        await prisma.changeRequest.update({
            where: { id: requestId },
            data: {
                status: "APPROVED",
                reviewedById: session.user.id,
                updatedAt: new Date()
            }
        });

        revalidatePath("/admin/approval");
        if (request.targetProjectId) revalidatePath(`/projects/${request.targetProjectId}`);
        if (request.itemId) revalidatePath(`/items/${request.itemId}`);

    } catch (e: any) {
        console.error("Failed to approve request", e);
        console.error("Request data:", request);
        console.error("Parsed data:", data);
        throw new Error(`Failed to apply change: ${e.message}`);
    }
}

export async function rejectRequest(requestId: number) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "INSPECTOR")) throw new Error("Unauthorized");

    await prisma.changeRequest.update({
        where: { id: requestId },
        data: {
            status: "REJECTED",
            reviewedById: session.user.id,
            updatedAt: new Date()
        }
    });

    revalidatePath("/admin/approval");
}
