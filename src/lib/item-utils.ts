/**
 * @file item-utils.ts
 * @description 項目工具函式模組
 *
 * 此模組提供項目 (Item) 相關的工具函式。
 *
 * ## 核心功能
 * ### `generateNextItemId`
 * 生成下一個項目的階層式編號。
 *
 * ## 編號規則
 * - 根項目：`{專案代碼}-{序號}`，如 `RMS-1`, `RMS-2`
 * - 子項目：`{父項目編號}-{序號}`，如 `RMS-1-1`, `RMS-1-2`
 *
 * ## 序號邏輯
 * - 取同層級最大序號 + 1
 * - 不填補已刪除的序號空隙
 *
 * @example
 * // 專案 RMS 下已有 RMS-1, RMS-2
 * const nextId = await generateNextItemId(projectId, null);
 * // 返回 "RMS-3"
 *
 * @example
 * // RMS-1 下已有 RMS-1-1
 * const nextId = await generateNextItemId(projectId, parentId);
 * // 返回 "RMS-1-2"
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Generates the next hierarchical ID for an item.
 * Format:
 * - Root: {ProjectCode}-{Seq} (e.g., RMS-1)
 * - Child: {ParentFullId}-{Seq} (e.g., RMS-1-1)
 * 
 * Logic covers gaps? No, typically simpler to just take Max + 1 to avoid reuse confusion, 
 * unless user explicitly requests gap filling. We will use Max + 1.
 */
export async function generateNextItemId(projectId: number, parentId: number | null, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || prisma;
    const project = await client.project.findUnique({
        where: { id: projectId },
        select: { codePrefix: true }
    });

    if (!project) throw new Error("Project not found");

    let parentFullId = "";
    if (parentId) {
        const parent = await client.item.findUnique({
            where: { id: parentId },
            select: { fullId: true }
        });
        if (!parent) throw new Error("Parent item not found");
        parentFullId = parent.fullId;
    }

    const prefix = parentId ? `${parentFullId}-` : `${project.codePrefix}-`;

    // 1. Get IDs from existing items
    const existingItems = await client.item.findMany({
        where: { projectId, parentId },
        select: { fullId: true }
    });

    // 2. Get IDs from pending CREATE requests
    const pendingRequests = await client.changeRequest.findMany({
        where: {
            targetProjectId: projectId,
            targetParentId: parentId,
            type: "CREATE",
            status: "PENDING"
        },
        select: { data: true }
    });

    let maxSeq = 0;

    const processFullId = (fullId: string) => {
        if (fullId.startsWith(prefix)) {
            const suffix = fullId.substring(prefix.length);
            const seq = parseInt(suffix, 10);
            if (!isNaN(seq)) {
                if (seq > maxSeq) maxSeq = seq;
            }
        }
    };

    // Process existing items
    existingItems.forEach(item => processFullId(item.fullId));

    // Process pending requests
    pendingRequests.forEach(req => {
        try {
            const data = JSON.parse(req.data);
            if (data.fullId) {
                processFullId(data.fullId);
            }
        } catch (e) {
            console.error("Failed to parse pending request data", e);
        }
    });

    return `${prefix}${maxSeq + 1}`;
}
