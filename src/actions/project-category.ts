"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export type CategoryState = {
    message?: string;
    error?: string;
};

/**
 * Get all project categories ordered by sortOrder
 */
export async function getCategories() {
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
    } catch (e: any) {
        if (e.code === 'P2002') {
            return { error: "分區名稱已存在" };
        }
        return { error: "建立分區失敗: " + (e.message || "未知錯誤") };
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
    } catch (e: any) {
        if (e.code === 'P2002') {
            return { error: "分區名稱已存在" };
        }
        return { error: "更新分區失敗: " + (e.message || "未知錯誤") };
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
        // First, unlink all projects from this category
        await prisma.project.updateMany({
            where: { categoryId: id },
            data: { categoryId: null }
        });

        // Then delete the category
        await prisma.projectCategory.delete({
            where: { id }
        });

        revalidatePath("/projects");
        return { message: "分區刪除成功" };
    } catch (e: any) {
        return { error: "刪除分區失敗: " + (e.message || "未知錯誤") };
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
        // Update each category's sortOrder
        await Promise.all(
            orderedIds.map((id, index) =>
                prisma.projectCategory.update({
                    where: { id },
                    data: { sortOrder: index }
                })
            )
        );

        revalidatePath("/projects");
        return { message: "排序更新成功" };
    } catch (e: any) {
        return { error: "排序更新失敗: " + (e.message || "未知錯誤") };
    }
}
