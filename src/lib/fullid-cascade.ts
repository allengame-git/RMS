/**
 * @file fullid-cascade.ts
 * @description Pure utility functions for cascading fullId updates.
 *
 * When items are reordered, moved, or renumbered, their fullId values
 * (e.g., "RMS-1-2-3") change. These functions handle:
 * - Computing new fullIds from parent context
 * - Replacing fullId prefixes in descendant items
 * - Updating fullId references embedded in HTML content (rich text editors)
 *
 * All functions are pure (no database access) and safe for use in transactions.
 */

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
