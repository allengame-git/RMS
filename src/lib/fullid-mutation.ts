import { Prisma } from "@prisma/client";
import { batchCascadeFullIdChanges } from "@/lib/fullid-cascade";

/** A direct fullId update and the value it has before/after the cascade. */
export interface FullIdChange {
  itemId: number;
  oldFullId: string;
  newFullId: string;
}

/**
 * Collect descendant changes while the database still has the old fullIds.
 *
 * This is intentionally kept private to the mutation helper. Callers should
 * provide only the direct changes; the helper owns the ordering contract for
 * descendant collection, cascading, and audit history.
 */
async function collectDescendantChanges(
  tx: Prisma.TransactionClient,
  changes: FullIdChange[]
): Promise<FullIdChange[]> {
  const descendantChanges: FullIdChange[] = [];

  for (const change of changes) {
    if (change.oldFullId === change.newFullId) continue;

    const descendants = await tx.item.findMany({
      where: { fullId: { startsWith: `${change.oldFullId}-` } },
      select: { id: true, fullId: true },
    });

    for (const descendant of descendants) {
      descendantChanges.push({
        itemId: descendant.id,
        oldFullId: descendant.fullId,
        newFullId:
          change.newFullId + descendant.fullId.substring(change.oldFullId.length),
      });
    }
  }

  return descendantChanges;
}

/** Write one approved REORDER history record for each supplied fullId change. */
async function writeReorderHistory(
  tx: Prisma.TransactionClient,
  changes: FullIdChange[],
  context: { userId: string; projectId: number; notePrefix: string }
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
        submittedById: context.userId,
        reviewedById: context.userId,
        reviewStatus: "APPROVED",
        reviewNote: `${context.notePrefix}：${change.oldFullId} → ${change.newFullId}`,
        itemFullId: change.newFullId,
        itemTitle: item?.title ?? "",
        projectId: context.projectId,
      },
    });
  }
}

/**
 * Apply direct fullId changes, cascade their descendants, and record the
 * resulting REORDER history in one transaction supplied by the caller.
 *
 * The descendant lookup must happen before the batch cascade changes the
 * current fullIds. Direct changes remain first, and descendants retain the
 * query order and any duplicate entries from the supplied changes.
 */
export async function applyFullIdChangesWithHistory(
  tx: Prisma.TransactionClient,
  changes: FullIdChange[],
  context: { userId: string; projectId: number; notePrefix: string }
): Promise<void> {
  if (changes.length === 0) return;

  const descendantChanges = await collectDescendantChanges(tx, changes);
  await batchCascadeFullIdChanges(tx, changes, context.projectId);
  await writeReorderHistory(tx, [...changes, ...descendantChanges], context);
}
