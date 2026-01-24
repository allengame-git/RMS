/**
 * @file item-relations.ts
 * @description 項目關聯管理模組
 *
 * 此模組負責管理 RMS 系統中項目之間的關聯關係。
 * 項目可以雙向關聯其他項目，用於表達依賴、參照等關係。
 *
 * ## 核心功能
 * - `addRelatedItem`：新增關聯項目
 * - `removeRelatedItem`：移除關聯項目
 * - `updateRelationDescription`：更新關聯說明
 *
 * ## 關聯結構
 * - 使用 `ItemRelation` 資料表
 * - `sourceId`：來源項目 ID
 * - `targetId`：目標項目 ID
 * - `description`：關聯說明（選填）
 *
 * ## 關聯行為
 * - 關聯是有方向性的（source → target）
 * - 同一對項目只能有一個關聯
 * - 不允許自我關聯
 *
 * ## 使用場景
 * - 法規項目參照其他法規
 * - 文件之間的依賴關係
 * - 版本之間的繼承關係
 *
 * @see /src/components/item/RelatedItemsManager.tsx - 關聯項目管理 UI
 * @see /src/actions/approval.ts - 審批時處理關聯資料
 */

'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function addRelatedItem(sourceItemId: number, targetFullId: string, description?: string) {
    try {
        // 1. Validate target item
        const targetItem = await prisma.item.findUnique({
            where: { fullId: targetFullId }
        });

        if (!targetItem) {
            return { success: false, error: `項目 ${targetFullId} 不存在` };
        }

        if (targetItem.id === sourceItemId) {
            return { success: false, error: '無法將項目關聯至自己' };
        }

        // 2. Check if already related
        const existingRelation = await prisma.itemRelation.findUnique({
            where: {
                sourceId_targetId: {
                    sourceId: sourceItemId,
                    targetId: targetItem.id
                }
            }
        });

        if (existingRelation) {
            return { success: false, error: `項目 ${targetFullId} 已經是關聯項目` };
        }

        // 3. Create relation (bidirectional)
        // Create A -> B
        await prisma.itemRelation.create({
            data: {
                sourceId: sourceItemId,
                targetId: targetItem.id,
                description: description || null
            }
        });

        // Create B -> A (symmetric relation)
        const reverseExists = await prisma.itemRelation.findUnique({
            where: {
                sourceId_targetId: {
                    sourceId: targetItem.id,
                    targetId: sourceItemId
                }
            }
        });

        if (!reverseExists) {
            await prisma.itemRelation.create({
                data: {
                    sourceId: targetItem.id,
                    targetId: sourceItemId,
                    description: description || null
                }
            });
        }

        revalidatePath(`/items/${sourceItemId}`);
        return { success: true };
    } catch (error) {
        console.error('Failed to add related item:', error);
        return { success: false, error: '新增關聯項目失敗' };
    }
}

export async function removeRelatedItem(sourceItemId: number, targetItemId: number) {
    try {
        // Remove both directions for symmetry
        await prisma.itemRelation.deleteMany({
            where: {
                OR: [
                    { sourceId: sourceItemId, targetId: targetItemId },
                    { sourceId: targetItemId, targetId: sourceItemId }
                ]
            }
        });

        revalidatePath(`/items/${sourceItemId}`);
        return { success: true };
    } catch (error) {
        console.error('Failed to remove related item:', error);
        return { success: false, error: '移除關聯項目失敗' };
    }
}

export async function updateRelatedItemDescription(sourceItemId: number, targetItemId: number, description: string) {
    try {
        // Update both directions
        await prisma.itemRelation.updateMany({
            where: {
                OR: [
                    { sourceId: sourceItemId, targetId: targetItemId },
                    { sourceId: targetItemId, targetId: sourceItemId }
                ]
            },
            data: {
                description: description || null
            }
        });

        revalidatePath(`/items/${sourceItemId}`);
        return { success: true };
    } catch (error) {
        console.error('Failed to update description:', error);
        return { success: false, error: '更新描述失敗' };
    }
}

// Get related items with description
export async function getRelatedItems(itemId: number) {
    const relations = await prisma.itemRelation.findMany({
        where: { sourceId: itemId },
        include: {
            target: {
                select: {
                    id: true,
                    fullId: true,
                    title: true,
                    projectId: true,
                    project: {
                        select: { title: true }
                    }
                }
            }
        },
        orderBy: { createdAt: 'asc' }
    });

    return relations.map(r => ({
        id: r.target.id,
        fullId: r.target.fullId,
        title: r.target.title,
        projectId: r.target.projectId,
        projectTitle: r.target.project.title,
        description: r.description
    }));
}
