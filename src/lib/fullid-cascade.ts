/**
 * @file fullid-cascade.ts
 * @description Utility functions for cascading fullId updates.
 *
 * When items are reordered, moved, or renumbered, their fullId values
 * (e.g., "RMS-1-2-3") change. These functions handle:
 * - Computing new fullIds from parent context
 * - Replacing fullId prefixes in descendant items
 * - Updating fullId references embedded in HTML content (rich text editors)
 * - Cascading fullId changes through all database references (within transactions)
 */

import { Prisma } from "@prisma/client";

/**
 * Computes the prefix string used when generating child fullIds.
 *
 * @param parentFullId - The fullId of the parent item, or null for root items
 * @param codePrefix - The project code prefix (e.g., "RMS"), used only for root items
 * @returns The prefix string ending with "-" (e.g., "RMS-" or "RMS-1-")
 */
export function computeFullIdPrefix(
  parentFullId: string | null,
  codePrefix: string | null
): string {
  if (parentFullId) {
    return `${parentFullId}-`;
  }
  if (codePrefix) {
    return `${codePrefix}-`;
  }
  throw new Error("Either parentFullId or codePrefix must be provided");
}

/**
 * Computes a new fullId for an item given its context and sequence number.
 *
 * @param codePrefix - The project code prefix, used for root items
 * @param parentFullId - The parent's fullId, used for child items
 * @param seq - The sequence number within siblings
 * @returns The computed fullId (e.g., "RMS-3" or "RMS-1-2")
 */
export function computeNewFullId(
  codePrefix: string | null,
  parentFullId: string | null,
  seq: number
): string {
  const prefix = computeFullIdPrefix(parentFullId, codePrefix);
  return `${prefix}${seq}`;
}

/**
 * Replaces a fullId prefix in a given fullId string, handling descendants correctly.
 *
 * This function uses boundary-aware matching to avoid partial replacements.
 * "RMS-1-2" matches "RMS-1-2" (exact) and "RMS-1-2-3" (descendant with "-" boundary),
 * but NOT "RMS-1-20" (partial numeric match).
 *
 * @param fullId - The fullId to transform
 * @param oldPrefix - The old prefix to match
 * @param newPrefix - The new prefix to substitute
 * @returns The transformed fullId, or the original if no match
 */
export function replaceFullIdPrefix(
  fullId: string,
  oldPrefix: string,
  newPrefix: string
): string {
  if (fullId === oldPrefix) {
    // Exact match
    return newPrefix;
  }
  // Descendant match: must be followed by "-"
  if (fullId.startsWith(oldPrefix + "-")) {
    return newPrefix + fullId.substring(oldPrefix.length);
  }
  // No match (including partial like RMS-1-20 when oldPrefix is RMS-1-2)
  return fullId;
}

/**
 * Replaces fullId references within HTML content (from rich text editors).
 *
 * Targets two patterns:
 * 1. `data-item-id="RMS-1-2"` attribute values (exact or descendant)
 * 2. `>RMS-1-2</a>` link text (exact or descendant)
 *
 * Uses boundary-aware matching to prevent partial replacements.
 *
 * @param html - The HTML string to process
 * @param oldFullId - The old fullId to find
 * @param newFullId - The new fullId to substitute
 * @returns The modified HTML string, or null if no changes were made
 */
export function replaceFullIdInHtml(
  html: string,
  oldFullId: string,
  newFullId: string
): string | null {
  // Escape special regex characters in the fullId
  const escaped = oldFullId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Pattern matches the oldFullId exactly or as a prefix followed by "-" and more segments.
  // Uses a word-boundary-like approach: after the ID, the next char must be a "-" (descendant)
  // or end of the captured context (exact match).
  //
  // For data-item-id="...", the boundary is the closing quote.
  // For >...</a>, the boundary is the "<" of </a>.

  // Match data-item-id attribute values: exact or descendant
  const attrPattern = new RegExp(
    `(data-item-id=")${escaped}(-[\\w-]*)?(")`  ,
    "g"
  );

  // Match link text: >fullId</a> — exact or descendant
  const linkPattern = new RegExp(
    `(>)${escaped}(-[\\w-]*)?(</a>)`,
    "g"
  );

  let result = html;

  result = result.replace(attrPattern, (_match, before, descendantSuffix, after) => {
    const suffix = descendantSuffix || "";
    return `${before}${newFullId}${suffix}${after}`;
  });

  result = result.replace(linkPattern, (_match, before, descendantSuffix, after) => {
    const suffix = descendantSuffix || "";
    return `${before}${newFullId}${suffix}${after}`;
  });

  return result === html ? null : result;
}

/**
 * Cascades a single fullId change through all database references within a Prisma transaction.
 *
 * Updates (in order):
 * 1. Item.fullId — exact match
 * 2. Item.fullId — descendants (startsWith oldFullId + "-")
 * 3. ItemHistory.itemFullId — exact match
 * 4. ItemHistory.itemFullId — descendants
 * 5. Item.content — HTML references in non-deleted items within the project
 * 6. ChangeRequest.data — PENDING requests for the project (JSON data.fullId and data.content)
 *
 * @param tx - Prisma transaction client
 * @param oldFullId - The old fullId to replace
 * @param newFullId - The new fullId to substitute
 * @param projectId - The project ID to scope content/request updates
 */
export async function cascadeFullIdChange(
  tx: Prisma.TransactionClient,
  oldFullId: string,
  newFullId: string,
  projectId: number
): Promise<void> {
  if (oldFullId === newFullId) return;

  // 1. Item.fullId — exact match
  await tx.item.updateMany({
    where: { fullId: oldFullId },
    data: { fullId: newFullId },
  });

  // 2. Item.fullId — descendants
  const descendantItems = await tx.item.findMany({
    where: { fullId: { startsWith: `${oldFullId}-` } },
    select: { id: true, fullId: true },
  });
  for (const item of descendantItems) {
    const updatedFullId = replaceFullIdPrefix(item.fullId, oldFullId, newFullId);
    if (updatedFullId !== item.fullId) {
      await tx.item.update({
        where: { id: item.id },
        data: { fullId: updatedFullId },
      });
    }
  }

  // 3. ItemHistory.itemFullId — exact match
  await tx.itemHistory.updateMany({
    where: { itemFullId: oldFullId },
    data: { itemFullId: newFullId },
  });

  // 4. ItemHistory.itemFullId — descendants
  const descendantHistories = await tx.itemHistory.findMany({
    where: { itemFullId: { startsWith: `${oldFullId}-` } },
    select: { id: true, itemFullId: true },
  });
  for (const history of descendantHistories) {
    const updatedFullId = replaceFullIdPrefix(history.itemFullId, oldFullId, newFullId);
    if (updatedFullId !== history.itemFullId) {
      await tx.itemHistory.update({
        where: { id: history.id },
        data: { itemFullId: updatedFullId },
      });
    }
  }

  // 5. Item.content — HTML references in non-deleted items within the project
  const contentItems = await tx.item.findMany({
    where: {
      projectId,
      isDeleted: false,
      content: { contains: oldFullId },
    },
    select: { id: true, content: true },
  });
  for (const item of contentItems) {
    if (!item.content) continue;
    const updatedContent = replaceFullIdInHtml(item.content, oldFullId, newFullId);
    if (updatedContent !== null) {
      await tx.item.update({
        where: { id: item.id },
        data: { content: updatedContent },
      });
    }
  }

  // 6. ChangeRequest.data — PENDING requests for the project
  const pendingRequests = await tx.changeRequest.findMany({
    where: {
      status: "PENDING",
      OR: [
        { targetProjectId: projectId },
        { item: { projectId } },
        { targetParent: { projectId } },
      ],
    },
    select: { id: true, data: true },
  });
  for (const request of pendingRequests) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(request.data) as Record<string, unknown>;
    } catch {
      continue;
    }

    let changed = false;

    if (typeof parsed.fullId === "string") {
      const newVal = replaceFullIdPrefix(parsed.fullId, oldFullId, newFullId);
      if (newVal !== parsed.fullId) {
        parsed.fullId = newVal;
        changed = true;
      }
    }

    if (typeof parsed.content === "string") {
      const newContent = replaceFullIdInHtml(parsed.content, oldFullId, newFullId);
      if (newContent !== null) {
        parsed.content = newContent;
        changed = true;
      }
    }

    if (changed) {
      await tx.changeRequest.update({
        where: { id: request.id },
        data: { data: JSON.stringify(parsed) },
      });
    }
  }
}

/**
 * Handles batch fullId updates using a two-phase approach to avoid unique constraint violations.
 *
 * Phase 1: Change all oldFullId → `__TEMP_` + newFullId
 * Phase 2: Change all `__TEMP_` + newFullId → newFullId
 *
 * @param tx - Prisma transaction client
 * @param changes - Array of { itemId, oldFullId, newFullId } changes
 * @param projectId - The project ID to scope content/request updates
 */
export async function batchCascadeFullIdChanges(
  tx: Prisma.TransactionClient,
  changes: { itemId: number; oldFullId: string; newFullId: string }[],
  projectId: number
): Promise<void> {
  const TEMP_PREFIX = "__TEMP_";

  // Filter out no-op changes
  const effectiveChanges = changes.filter((c) => c.oldFullId !== c.newFullId);
  if (effectiveChanges.length === 0) return;

  // Phase 1: oldFullId → __TEMP_ + newFullId
  for (const change of effectiveChanges) {
    await cascadeFullIdChange(
      tx,
      change.oldFullId,
      `${TEMP_PREFIX}${change.newFullId}`,
      projectId
    );
  }

  // Phase 2: __TEMP_ + newFullId → newFullId
  for (const change of effectiveChanges) {
    await cascadeFullIdChange(
      tx,
      `${TEMP_PREFIX}${change.newFullId}`,
      change.newFullId,
      projectId
    );
  }
}
