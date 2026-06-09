"use server";

import { prisma } from "@/lib/prisma";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { computeNewFullId, batchCascadeFullIdChanges } from "@/lib/fullid-cascade";
import { collectDescendantChanges, writeReorderHistory } from "@/actions/item-reorder";

// ==================== Type Definitions ====================

const REVIEWER_ROLES = ["INSPECTOR", "ADMIN"];

export interface DeletedItemsResult {
  success: boolean;
  error?: string;
  data?: {
    items: {
      id: number;
      fullId: string;
      title: string;
      parentId: number | null;
      updatedAt: Date;
    }[];
  };
}

export interface RestoreResult {
  success: boolean;
  error?: string;
  data?: {
    changes: { itemId: number; oldFullId: string; newFullId: string }[];
  };
}

// ==================== getDeletedItems ====================

/**
 * Returns all soft-deleted items for a project, ordered by most recently deleted first.
 */
export async function getDeletedItems(
  projectId: number
): Promise<DeletedItemsResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !REVIEWER_ROLES.includes(session.user.role)) {
    return { success: false, error: "權限不足" };
  }

  try {
    const items = await prisma.item.findMany({
      where: { projectId, isDeleted: true },
      select: {
        id: true,
        fullId: true,
        title: true,
        parentId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return { success: true, data: { items } };
  } catch (error) {
    console.error("[getDeletedItems] Error:", error);
    return {
      success: false,
      error: `取得已刪除項目失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
    };
  }
}

// ==================== previewRestore ====================

/**
 * Preview the fullId changes from restoring a deleted item to a given parent and position.
 */
export async function previewRestore(
  itemId: number,
  newParentId: number | null,
  position: number
): Promise<RestoreResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !REVIEWER_ROLES.includes(session.user.role)) {
    return { success: false, error: "權限不足" };
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      fullId: true,
      projectId: true,
      parentId: true,
      isDeleted: true,
    },
  });

  if (!item) return { success: false, error: "找不到該項目" };
  if (!item.isDeleted) return { success: false, error: "該項目未被刪除，無需還原" };

  const projectId = item.projectId;

  if (newParentId !== null) {
    // Validate the specified parent
    const parentItem = await prisma.item.findUnique({
      where: { id: newParentId },
      select: { fullId: true, projectId: true, isDeleted: true },
    });
    if (!parentItem) return { success: false, error: "找不到目標父項目" };
    if (parentItem.projectId !== projectId) {
      return { success: false, error: "不支援跨專案還原" };
    }
    if (parentItem.isDeleted) {
      return { success: false, error: "目標父項目已被刪除，請選擇其他父項目" };
    }
  }

  // If original parentId is set, check if parent is also deleted — warn user
  if (newParentId === undefined) {
    // This shouldn't happen with typed params, but guard anyway
    return { success: false, error: "請指定還原的目標位置" };
  }

  let targetParentFullId: string | null = null;
  let codePrefix: string | null = null;

  if (newParentId !== null) {
    const parentItem = await prisma.item.findUnique({
      where: { id: newParentId },
      select: { fullId: true },
    });
    if (!parentItem) return { success: false, error: "找不到目標父項目" };
    targetParentFullId = parentItem.fullId;
  } else {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { codePrefix: true },
    });
    if (!project) return { success: false, error: "找不到專案" };
    codePrefix = project.codePrefix;
  }

  // Fetch existing siblings at target parent (excluding deleted items and the item being restored)
  const siblings = await prisma.item.findMany({
    where: {
      projectId,
      parentId: newParentId,
      isDeleted: false,
      id: { not: itemId },
    },
    select: { id: true, fullId: true },
    orderBy: { fullId: "asc" },
  });

  const clampedPosition = Math.max(0, Math.min(position, siblings.length));
  const orderedItems = [...siblings];
  orderedItems.splice(clampedPosition, 0, {
    id: item.id,
    fullId: item.fullId,
  });

  const changes: { itemId: number; oldFullId: string; newFullId: string }[] =
    [];
  for (let i = 0; i < orderedItems.length; i++) {
    const newFullId = computeNewFullId(codePrefix, targetParentFullId, i + 1);
    changes.push({
      itemId: orderedItems[i].id,
      oldFullId: orderedItems[i].fullId,
      newFullId,
    });
  }

  return { success: true, data: { changes } };
}

// ==================== restoreItem ====================

/**
 * Restore a soft-deleted item to a given parent at a given position.
 */
export async function restoreItem(
  itemId: number,
  newParentId: number | null,
  position: number
): Promise<RestoreResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !REVIEWER_ROLES.includes(session.user.role)) {
    return { success: false, error: "權限不足" };
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      fullId: true,
      title: true,
      projectId: true,
      parentId: true,
      isDeleted: true,
    },
  });

  if (!item) return { success: false, error: "找不到該項目" };
  if (!item.isDeleted) return { success: false, error: "該項目未被刪除，無需還原" };

  const projectId = item.projectId;
  const oldFullId = item.fullId;

  const preview = await previewRestore(itemId, newParentId, position);
  if (!preview.success || !preview.data) return preview;

  const actualChanges = preview.data.changes.filter(
    (c) => c.oldFullId !== c.newFullId
  );

  // Find the restored item's new fullId from the preview changes
  const restoredChange = preview.data.changes.find((c) => c.itemId === itemId);
  const newFullId = restoredChange?.newFullId ?? oldFullId;

  try {
    await prisma.$transaction(async (tx) => {
      // Restore the item: undelete and update parent
      await tx.item.update({
        where: { id: itemId },
        data: {
          isDeleted: false,
          parentId: newParentId,
        },
      });

      // Collect descendant changes before cascade (must read current fullIds first)
      const descendantChanges = actualChanges.length > 0
        ? await collectDescendantChanges(tx, actualChanges)
        : [];

      // Apply fullId cascading changes if any
      if (actualChanges.length > 0) {
        await batchCascadeFullIdChanges(tx, actualChanges, projectId);
      }

      // Write history for all affected sibling/descendant items
      const allCascadeChanges = [...actualChanges, ...descendantChanges];
      if (allCascadeChanges.length > 0) {
        await writeReorderHistory(tx, allCascadeChanges, session.user.id, projectId, "還原項目連動");
      }

      // Create RESTORE history record
      await tx.itemHistory.create({
        data: {
          itemId,
          version: 0,
          changeType: "RESTORE",
          snapshot: JSON.stringify({
            oldFullId,
            newFullId,
            restoredTo: newParentId,
          }),
          diff: null,
          submittedById: session.user.id,
          reviewedById: session.user.id,
          reviewStatus: "APPROVED",
          reviewNote: `還原項目：${oldFullId} → ${newFullId}`,
          itemFullId: newFullId,
          itemTitle: item.title,
          projectId,
        },
      });
    });
  } catch (error) {
    console.error("[restoreItem] Transaction failed:", error);
    return {
      success: false,
      error: `還原項目失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { changes: actualChanges } };
}
