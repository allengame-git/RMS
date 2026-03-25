/**
 * @file project-category.ts
 * @description 專案分區管理模組
 *
 * 此模組負責管理 RMS 系統的專案分區 (ProjectCategory)。
 * 分區用於組織和分類專案，支援自訂排序。
 *
 * ## 核心功能
 * - `getCategories`：取得所有分區（含專案數量統計）
 * - `createCategory`：建立新分區
 * - `updateCategory`：更新分區名稱和描述
 * - `deleteCategory`：刪除分區（僅限無專案時）
 * - `reorderCategories`：重新排序分區
 *
 * ## 資料結構
 * - `name`：分區名稱
 * - `description`：分區描述
 * - `sortOrder`：排序順序（數字越小越前）
 *
 * ## 使用限制
 * - 僅 INSPECTOR 和 ADMIN 可管理分區
 * - 分區名稱必須唯一
 * - 刪除分區前必須移除所有關聯專案
 *
 * @see /src/app/admin/categories - 分區管理頁面
 * @see /src/actions/project.ts - 專案建立時關聯分區
 */

"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type CategoryState = {
    message?: string;
    error?: string;
};

/**
 * Get all project categories ordered by sortOrder
 */
export async function getCategories() {
    const session = await getServerSession(authOptions);
    if (!session) return [];

    const categories = await prisma.projectCategory.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            _count: {
                select: { projects: true }
            }
        }
    });
    return categories;
}

/**
 * Create a new project category
 */
export async function createCategory(name: string, description?: string): Promise<CategoryState> {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== "ADMIN" && !session.user.isPM)) {
        return { error: "權限不足：僅管理員與專案經理可管理分區" };
    }

    if (!name?.trim()) {
        return { error: "分區名稱為必填" };
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Get max sortOrder for new category
            const maxOrder = await tx.projectCategory.aggregate({
                _max: { sortOrder: true }
            });

            const nextSortOrder = (maxOrder._max.sortOrder !== null) ? maxOrder._max.sortOrder + 1 : 0;

            await tx.projectCategory.create({
                data: {
                    name: name.trim(),
                    description: description?.trim() || null,
                    sortOrder: nextSortOrder
                }
            });
        });

        revalidatePath("/projects");
        return { message: "分區建立成功" };
    } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err.code === 'P2002') {
            return { error: "分區名稱已存在" };
        }
        return { error: "建立分區失敗: " + (err.message || "未知錯誤") };
    }
}

/**
 * Update a project category
 */
export async function updateCategory(
    id: number,
    name: string,
    description?: string
): Promise<CategoryState> {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== "ADMIN" && !session.user.isPM)) {
        return { error: "權限不足：僅管理員與專案經理可管理分區" };
    }

    if (!name?.trim()) {
        return { error: "分區名稱為必填" };
    }

    try {
        await prisma.projectCategory.update({
            where: { id },
            data: {
                name: name.trim(),
                description: description?.trim() || null
            }
        });

        revalidatePath("/projects");
        return { message: "分區更新成功" };
    } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err.code === 'P2002') {
            return { error: "分區名稱已存在" };
        }
        return { error: "更新分區失敗: " + (err.message || "未知錯誤") };
    }
}

/**
 * Delete a project category (unlinks projects, doesn't delete them)
 */
export async function deleteCategory(id: number): Promise<CategoryState> {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        return { error: "權限不足：僅管理員可刪除分區" };
    }

    try {
        // 使用交易確保解除關聯與刪除的原子性
        await prisma.$transaction(async (tx) => {
            // First, unlink all projects from this category
            await tx.project.updateMany({
                where: { categoryId: id },
                data: { categoryId: null }
            });

            // Then delete the category
            await tx.projectCategory.delete({
                where: { id }
            });
        });

        revalidatePath("/projects");
        return { message: "分區刪除成功" };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "未知錯誤";
        return { error: "刪除分區失敗: " + message };
    }
}

/**
 * Reorder categories
 */
export async function reorderCategories(orderedIds: number[]): Promise<CategoryState> {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== "ADMIN" && !session.user.isPM)) {
        return { error: "權限不足" };
    }

    try {
        // 使用交易確保排序更新的原子性，避免部分失敗導致不一致
        await prisma.$transaction(
            orderedIds.map((id, index) =>
                prisma.projectCategory.update({
                    where: { id },
                    data: { sortOrder: index }
                })
            )
        );

        revalidatePath("/projects");
        return { message: "排序更新成功" };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "未知錯誤";
        return { error: "排序更新失敗: " + message };
    }
}
