/**
 * @file project.ts
 * @description 專案管理模組
 *
 * 此模組負責 RMS 系統的專案 (Project) 基本操作。
 * 專案是項目 (Item) 的容器，定義了項目編號的前綴。
 *
 * ## 核心功能
 * - `createProject`：建立新專案
 * - `updateProject`：更新專案資訊（需經審批流程）
 * - `getProjects`：取得專案列表
 * - `copyProject`：複製專案結構（含所有項目）
 *
 * ## 專案代碼 (codePrefix)
 * - 格式：大寫英數字，可用連字號分隔
 * - 範例：`PROJ-A`, `2024-MAIN`
 * - 用途：作為項目 fullId 的前綴（如 `PROJ-A-001`）
 *
 * ## 專案分區 (ProjectCategory)
 * 專案可歸屬於特定分區，用於組織和篩選
 *
 * ## 刪除限制
 * - 僅 ADMIN 可申請刪除專案
 * - 專案必須不包含任何項目才能刪除
 * - 刪除申請需經審批流程
 *
 * @see /src/actions/approval.ts - 專案變更審批
 * @see /src/actions/project-category.ts - 專案分區管理
 */

"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ProjectState = {
    message?: string;
    error?: string;
};

export async function createProject(prevState: ProjectState, formData: FormData): Promise<ProjectState> {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role === "VIEWER") {
        return { error: "Unauthorized: Only Admins and Editors can create projects." };
    }

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const codePrefix = formData.get("codePrefix") as string;
    const categoryIdStr = formData.get("categoryId") as string;
    const categoryId = categoryIdStr ? parseInt(categoryIdStr, 10) : null;

    if (!title || !codePrefix) {
        return { error: "Title and Code Prefix are required." };
    }

    // Code Prefix format validation (uppercase, alphanumeric, hyphen allowed)
    if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(codePrefix)) {
        return { error: "代碼前綴僅可使用大寫英文字母、數字與連字號(-)" };
    }

    try {
        await prisma.project.create({
            data: {
                title,
                description,
                codePrefix,
                categoryId,
            },
        });

        revalidatePath("/projects");
        return { message: "Project created successfully!" };
    } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === 'P2002') {
            return { error: "Code Prefix already exists." };
        }
        return { error: "Failed to create project." };
    }
}

/**
 * Update project directly (ADMIN/PM only - no approval needed)
 */
export async function updateProject(
    projectId: number,
    title: string,
    description?: string,
    categoryId?: number | null
): Promise<ProjectState> {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== "ADMIN" && !session.user.isPM)) {
        return { error: "權限不足：僅管理員與專案經理可直接編輯專案" };
    }

    if (!title?.trim()) {
        return { error: "專案標題為必填" };
    }

    try {
        await prisma.project.update({
            where: { id: projectId },
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                categoryId: categoryId ?? undefined
            }
        });

        revalidatePath("/projects");
        return { message: "專案更新成功" };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "未知錯誤";
        return { error: "更新失敗: " + message };
    }
}

export async function deleteProject(id: number): Promise<ProjectState> {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        return { error: "Unauthorized: Only Admins can delete projects." };
    }

    try {
        await prisma.project.delete({
            where: { id },
        });

        revalidatePath("/projects");
        return { message: "Project deleted successfully" };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "未知錯誤";
        return { error: "刪除專案失敗: " + message };
    }
}

export async function getProjects() {
    const projects = await prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: { items: true }
            }
        }
    });
    return projects;
}

/**
 * Copy a project with all its items to a new code prefix
 */
export async function copyProject(
    sourceProjectId: number,
    newTitle: string,
    newCodePrefix: string,
    newDescription?: string,
    newCategoryId?: number | null
): Promise<ProjectState> {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role === "VIEWER") {
        return { error: "權限不足：僅編輯者以上可複製專案" };
    }

    // Validate inputs
    if (!newTitle?.trim()) {
        return { error: "專案標題為必填" };
    }

    if (!newCodePrefix?.trim()) {
        return { error: "專案代碼為必填" };
    }

    // Code Prefix format validation (uppercase, alphanumeric, hyphen allowed)
    const normalizedPrefix = newCodePrefix.trim().toUpperCase();
    if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(normalizedPrefix)) {
        return { error: "專案代碼僅可使用大寫英文字母、數字與連字號(-)" };
    }

    try {
        // Check if source project exists
        const sourceProject = await prisma.project.findUnique({
            where: { id: sourceProjectId },
            include: {
                items: {
                    where: { isDeleted: false },
                    orderBy: { fullId: 'asc' }
                }
            }
        });

        if (!sourceProject) {
            return { error: "來源專案不存在" };
        }

        // Check if new codePrefix already exists
        const existingCodeProject = await prisma.project.findUnique({
            where: { codePrefix: normalizedPrefix }
        });

        if (existingCodeProject) {
            return { error: `專案代碼「${normalizedPrefix}」已被使用，請輸入其他代碼` };
        }

        // Check if title already exists
        const normalizedTitle = newTitle.trim();
        const existingTitleProject = await prisma.project.findFirst({
            where: { title: normalizedTitle }
        });

        if (existingTitleProject) {
            return { error: `專案標題「${normalizedTitle}」已存在，請輸入其他標題` };
        }

        // Create new project
        const newProject = await prisma.project.create({
            data: {
                title: newTitle.trim(),
                description: newDescription?.trim() || sourceProject.description,
                codePrefix: normalizedPrefix,
                categoryId: newCategoryId ?? sourceProject.categoryId
            }
        });

        // Copy items with hierarchy
        if (sourceProject.items.length > 0) {
            // Build a map of old ID -> new ID
            const idMap = new Map<number, number>();

            // First pass: create all items without parentId
            // Sort by fullId length to process parents first
            const sortedItems = [...sourceProject.items].sort(
                (a, b) => a.fullId.split('-').length - b.fullId.split('-').length
            );

            for (const item of sortedItems) {
                // Calculate new fullId
                const oldParts = item.fullId.split('-');
                const newParts = [normalizedPrefix, ...oldParts.slice(1)];
                const newFullId = newParts.join('-');

                // Determine new parentId
                let newParentId: number | null = null;
                if (item.parentId && idMap.has(item.parentId)) {
                    newParentId = idMap.get(item.parentId)!;
                }

                // Create new item
                const newItem = await prisma.item.create({
                    data: {
                        fullId: newFullId,
                        title: item.title,
                        content: item.content,
                        attachments: item.attachments,
                        projectId: newProject.id,
                        parentId: newParentId,
                        currentVersion: 1
                    }
                });

                idMap.set(item.id, newItem.id);
            }
        }

        revalidatePath("/projects");
        return { message: `專案已複製為 ${normalizedPrefix}` };
    } catch (e: unknown) {
        console.error("Copy project error:", e);
        const err = e as { code?: string; message?: string };
        if (err.code === 'P2002') {
            return { error: "專案代碼或項目編號重複" };
        }
        return { error: "複製專案失敗: " + (err.message || "未知錯誤") };
    }
}

