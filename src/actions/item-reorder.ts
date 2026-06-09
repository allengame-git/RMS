"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { computeNewFullId, batchCascadeFullIdChanges } from "@/lib/fullid-cascade";

// ==================== Type Definitions ====================

const REVIEWER_ROLES = ["INSPECTOR", "ADMIN"];

export interface ReorderResult {
  success: boolean;
  error?: string;
  data?: {
    changes: { itemId: number; oldFullId: string; newFullId: string }[];
  };
}

// ==================== Helper Functions ====================

/**
 * Check if any of the given item IDs have PENDING ChangeRequests.
 * Returns an error message if blocked, or null if clear.
 */
async function checkPendingChangeRequests(
  itemIds: number[]
): Promise<string | null> {
  if (itemIds.length === 0) return null;

  const pending = await prisma.changeRequest.findMany({
    where: {
      itemId: { in: itemIds },
      status: "PENDING",
    },
    select: {
      item: { select: { fullId: true } },
    },
  });

  if (pending.length > 0) {
    const affectedIds = pending
      .map((p) => p.item?.fullId)
      .filter(Boolean)
      .join("、");
    return `以下項目有待審核的變更申請，無法進行操作：${affectedIds}`;
  }

  return null;
}

/**
 * Walks up the parent chain from targetId to detect cycles.
 * Returns true if any ancestor of targetId === itemId.
 */
async function isDescendant(
  tx: Prisma.TransactionClient,
  itemId: number,
  targetId: number
): Promise<boolean> {
  let currentId: number | null = targetId;

  while (currentId !== null) {
    if (currentId === itemId) return true;
    const ancestor: { parentId: number | null } | null = await tx.item.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    if (!ancestor) break;
    currentId = ancestor.parentId;
  }

  return false;
}

/**
 * Collects all descendant fullId changes that will result from a set of parent changes.
 * Must be called BEFORE batchCascadeFullIdChanges so we can read the current fullIds.
 */
export async function collectDescendantChanges(
  tx: Prisma.TransactionClient,
  changes: { itemId: number; oldFullId: string; newFullId: string }[]
): Promise<{ itemId: number; oldFullId: string; newFullId: string }[]> {
  const descendantChanges: { itemId: number; oldFullId: string; newFullId: string }[] = [];

  for (const change of changes) {
    if (change.oldFullId === change.newFullId) continue;

    const descendants = await tx.item.findMany({
      where: { fullId: { startsWith: `${change.oldFullId}-` } },
      select: { id: true, fullId: true },
    });

    for (const desc of descendants) {
      const newDescFullId = change.newFullId + desc.fullId.substring(change.oldFullId.length);
      descendantChanges.push({
        itemId: desc.id,
        oldFullId: desc.fullId,
        newFullId: newDescFullId,
      });
    }
  }

  return descendantChanges;
}

/**
 * Writes REORDER history records for a batch of fullId changes.
 */
export async function writeReorderHistory(
  tx: Prisma.TransactionClient,
  changes: { itemId: number; oldFullId: string; newFullId: string }[],
  userId: string,
  projectId: number,
  notePrefix: string
): Promise<void> {
  for (const change of changes) {
    const item = await tx.item.findUnique({
      where: { id: change.itemId },
      select: { title: true },
    });

    await tx.itemHistory.create({
      data: {
        itemId: change.itemId,
        version: 0,
        changeType: "REORDER",
        snapshot: JSON.stringify({
          oldFullId: change.oldFullId,
          newFullId: change.newFullId,
        }),
        diff: null,
        submittedById: userId,
        reviewedById: userId,
        reviewStatus: "APPROVED",
        reviewNote: `${notePrefix}：${change.oldFullId} → ${change.newFullId}`,
        itemFullId: change.newFullId,
        itemTitle: item?.title ?? "",
        projectId,
      },
    });
  }
}

// ==================== Reorder (同層重新排序) ====================

/**
 * Preview reorder changes without applying them.
 */
export async function previewReorder(
  parentId: number | null,
  projectId: number,
  orderedItemIds: number[]
): Promise<ReorderResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !REVIEWER_ROLES.includes(session.user.role)) {
    return { success: false, error: "權限不足" };
  }

  const items = await prisma.item.findMany({
    where: { projectId, parentId, isDeleted: false },
    select: { id: true, fullId: true },
  });

  const existingIds = new Set(items.map((item) => item.id));
  const orderedIds = new Set(orderedItemIds);

  if (existingIds.size !== orderedIds.size) {
    return {
      success: false,
      error: `排序項目數量不符：現有 ${existingIds.size} 項，提供 ${orderedIds.size} 項`,
    };
  }
  for (const id of orderedItemIds) {
    if (!existingIds.has(id)) {
      return { success: false, error: `項目 ID ${id} 不存在於此層級` };
    }
  }
  if (orderedItemIds.length !== orderedIds.size) {
    return { success: false, error: "排序清單中包含重複的項目 ID" };
  }

  let codePrefix: string | null = null;
  let parentFullId: string | null = null;

  if (parentId) {
    const parent = await prisma.item.findUnique({
      where: { id: parentId },
      select: { fullId: true },
    });
    if (!parent) return { success: false, error: "父項目不存在" };
    parentFullId = parent.fullId;
  } else {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { codePrefix: true },
    });
    if (!project) return { success: false, error: "專案不存在" };
    codePrefix = project.codePrefix;
  }

  const itemMap = new Map(items.map((item) => [item.id, item]));
  const changes: { itemId: number; oldFullId: string; newFullId: string }[] = [];

  for (let i = 0; i < orderedItemIds.length; i++) {
    const itemId = orderedItemIds[i];
    const item = itemMap.get(itemId)!;
    const newFullId = computeNewFullId(codePrefix, parentFullId, i + 1);
    changes.push({ itemId, oldFullId: item.fullId, newFullId });
  }

  return { success: true, data: { changes } };
}

/**
 * Apply reorder changes: update fullIds and create audit history records.
 */
export async function reorderItems(
  parentId: number | null,
  projectId: number,
  orderedItemIds: number[]
): Promise<ReorderResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !REVIEWER_ROLES.includes(session.user.role)) {
    return { success: false, error: "權限不足" };
  }

  const preview = await previewReorder(parentId, projectId, orderedItemIds);
  if (!preview.success || !preview.data) return preview;

  const actualChanges = preview.data.changes.filter(
    (c) => c.oldFullId !== c.newFullId
  );

  if (actualChanges.length === 0) {
    return { success: true, data: { changes: [] } };
  }

  // Check for pending ChangeRequests on affected items
  const pendingError = await checkPendingChangeRequests(
    actualChanges.map((c) => c.itemId)
  );
  if (pendingError) return { success: false, error: pendingError };

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const descendantChanges = await collectDescendantChanges(tx, actualChanges);
      await batchCascadeFullIdChanges(tx, actualChanges, projectId);
      const allChanges = [...actualChanges, ...descendantChanges];
      await writeReorderHistory(tx, allChanges, session.user.id, projectId, "重新排序");
    });
  } catch (error) {
    console.error("Reorder transaction failed:", error);
    return {
      success: false,
      error: `重新排序失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { changes: actualChanges } };
}

// ==================== Move (跨層級移動) ====================

/**
 * Preview the fullId changes from moving an item to a new parent.
 */
export async function previewMove(
  itemId: number,
  newParentId: number | null,
  position: number
): Promise<ReorderResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !REVIEWER_ROLES.includes(session.user.role)) {
    return { success: false, error: "權限不足" };
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, fullId: true, projectId: true, parentId: true, isDeleted: true },
  });

  if (!item) return { success: false, error: "找不到該項目" };
  if (item.isDeleted) return { success: false, error: "無法移動已刪除的項目" };

  let targetParentFullId: string | null = null;
  let codePrefix: string | null = null;
  const projectId = item.projectId;

  if (newParentId !== null) {
    const parentItem = await prisma.item.findUnique({
      where: { id: newParentId },
      select: { fullId: true, projectId: true, isDeleted: true },
    });
    if (!parentItem) return { success: false, error: "找不到目標父項目" };
    if (parentItem.projectId !== projectId) return { success: false, error: "不支援跨專案移動" };
    if (parentItem.isDeleted) return { success: false, error: "目標父項目已被刪除" };
    targetParentFullId = parentItem.fullId;
  } else {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { codePrefix: true },
    });
    if (!project) return { success: false, error: "找不到專案" };
    codePrefix = project.codePrefix;
  }

  // Fetch siblings at target parent (excluding the moved item)
  const siblings = await prisma.item.findMany({
    where: { projectId, parentId: newParentId, isDeleted: false, id: { not: itemId } },
    select: { id: true, fullId: true },
    orderBy: { fullId: "asc" },
  });

  const clampedPosition = Math.max(0, Math.min(position, siblings.length));
  const orderedItems = [...siblings];
  orderedItems.splice(clampedPosition, 0, { id: item.id, fullId: item.fullId });

  const changes: { itemId: number; oldFullId: string; newFullId: string }[] = [];
  for (let i = 0; i < orderedItems.length; i++) {
    const newFullId = computeNewFullId(codePrefix, targetParentFullId, i + 1);
    changes.push({ itemId: orderedItems[i].id, oldFullId: orderedItems[i].fullId, newFullId });
  }

  // If parent changed, also renumber old parent's remaining siblings
  if (item.parentId !== newParentId) {
    let oldParentFullId: string | null = null;
    let oldCodePrefix: string | null = null;

    if (item.parentId !== null) {
      const oldParent = await prisma.item.findUnique({
        where: { id: item.parentId },
        select: { fullId: true },
      });
      oldParentFullId = oldParent?.fullId ?? null;
    } else {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { codePrefix: true },
      });
      oldCodePrefix = project?.codePrefix ?? null;
    }

    const oldSiblings = await prisma.item.findMany({
      where: { projectId, parentId: item.parentId, isDeleted: false, id: { not: itemId } },
      select: { id: true, fullId: true },
      orderBy: { fullId: "asc" },
    });

    for (let i = 0; i < oldSiblings.length; i++) {
      const newFullId = computeNewFullId(oldCodePrefix, oldParentFullId, i + 1);
      changes.push({ itemId: oldSiblings[i].id, oldFullId: oldSiblings[i].fullId, newFullId });
    }
  }

  return { success: true, data: { changes } };
}

/**
 * Move an item to a new parent at a given position.
 */
export async function moveItem(
  itemId: number,
  newParentId: number | null,
  position: number
): Promise<ReorderResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !REVIEWER_ROLES.includes(session.user.role)) {
    return { success: false, error: "權限不足" };
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, fullId: true, projectId: true, parentId: true, isDeleted: true },
  });
  if (!item) return { success: false, error: "找不到該項目" };
  if (item.isDeleted) return { success: false, error: "無法移動已刪除的項目" };

  // Check for pending ChangeRequests on the item being moved
  const pendingError = await checkPendingChangeRequests([itemId]);
  if (pendingError) return { success: false, error: pendingError };

  // Cycle check
  if (newParentId !== null) {
    const wouldCycle = await prisma.$transaction(async (tx) => {
      return isDescendant(tx, itemId, newParentId);
    });
    if (wouldCycle) return { success: false, error: "不能將項目移動到自己的子項目下（循環）" };
  }

  const preview = await previewMove(itemId, newParentId, position);
  if (!preview.success || !preview.data) return preview;

  const actualChanges = preview.data.changes.filter((c) => c.oldFullId !== c.newFullId);

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const descendantChanges = await collectDescendantChanges(tx, actualChanges);

      await tx.item.update({
        where: { id: itemId },
        data: { parentId: newParentId },
      });

      if (actualChanges.length > 0) {
        await batchCascadeFullIdChanges(tx, actualChanges, item.projectId);
      }

      const allChanges = [...actualChanges, ...descendantChanges];
      await writeReorderHistory(tx, allChanges, session.user.id, item.projectId, "移動項目");
    });
  } catch (error) {
    console.error("[moveItem] Transaction failed:", error);
    return {
      success: false,
      error: `移動項目失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
    };
  }

  revalidatePath(`/projects/${item.projectId}`);
  return { success: true, data: { changes: actualChanges } };
}

// ==================== Renumber (重新編號) ====================

/**
 * Preview renumbering changes for items under a given parent.
 */
export async function previewRenumber(
  parentId: number | null,
  projectId: number,
  recursive: boolean
): Promise<ReorderResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !REVIEWER_ROLES.includes(session.user.role)) {
    return { success: false, error: "權限不足" };
  }

  const allChanges: { itemId: number; oldFullId: string; newFullId: string }[] = [];

  async function collectChanges(pId: number | null, projId: number) {
    const items = await prisma.item.findMany({
      where: { projectId: projId, parentId: pId, isDeleted: false },
      select: { id: true, fullId: true },
    });

    // Natural sort by fullId segments
    items.sort((a, b) => {
      const partsA = a.fullId.split("-");
      const partsB = b.fullId.split("-");
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const valA = parseInt(partsA[i]);
        const valB = parseInt(partsB[i]);
        if (!isNaN(valA) && !isNaN(valB)) {
          if (valA !== valB) return valA - valB;
        } else {
          if (partsA[i] !== partsB[i])
            return (partsA[i] || "").localeCompare(partsB[i] || "");
        }
      }
      return 0;
    });

    let parentFullId: string | null = null;
    let codePrefix: string | null = null;

    if (pId !== null) {
      // Check if parent was already renamed in allChanges
      const parentRename = allChanges.find((c) => c.itemId === pId);
      if (parentRename) {
        parentFullId = parentRename.newFullId;
      } else {
        const parent = await prisma.item.findUnique({
          where: { id: pId },
          select: { fullId: true },
        });
        parentFullId = parent?.fullId ?? null;
      }
    } else {
      const project = await prisma.project.findUnique({
        where: { id: projId },
        select: { codePrefix: true },
      });
      codePrefix = project?.codePrefix ?? null;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const newFullId = computeNewFullId(codePrefix, parentFullId, i + 1);
      allChanges.push({ itemId: item.id, oldFullId: item.fullId, newFullId });

      if (recursive) {
        await collectChanges(item.id, projId);
      }
    }
  }

  try {
    await collectChanges(parentId, projectId);
    return { success: true, data: { changes: allChanges } };
  } catch (error) {
    console.error("[previewRenumber] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "預覽重新編號時發生錯誤",
    };
  }
}

/**
 * Execute renumbering of items under a given parent.
 */
export async function renumberItems(
  parentId: number | null,
  projectId: number,
  recursive: boolean
): Promise<ReorderResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !REVIEWER_ROLES.includes(session.user.role)) {
    return { success: false, error: "權限不足" };
  }

  const preview = await previewRenumber(parentId, projectId, recursive);
  if (!preview.success || !preview.data) return preview;

  const actualChanges = preview.data.changes.filter((c) => c.oldFullId !== c.newFullId);

  if (actualChanges.length === 0) {
    return { success: true, data: { changes: [] } };
  }

  // Check for pending ChangeRequests on affected items
  const pendingError = await checkPendingChangeRequests(
    actualChanges.map((c) => c.itemId)
  );
  if (pendingError) return { success: false, error: pendingError };

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const descendantChanges = await collectDescendantChanges(tx, actualChanges);
      await batchCascadeFullIdChanges(tx, actualChanges, projectId);
      const allChanges = [...actualChanges, ...descendantChanges];
      await writeReorderHistory(tx, allChanges, session.user.id, projectId, "重新編號");
    });
  } catch (error) {
    console.error("[renumberItems] Error:", error);
    return {
      success: false,
      error: `重新編號失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: { changes: actualChanges } };
}
