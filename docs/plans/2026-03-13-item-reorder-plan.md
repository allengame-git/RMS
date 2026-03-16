# Item Reorder / Move / Renumber 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓 ADMIN/INSPECTOR 可以重新排序、跨層級移動、重新編號項目，直接修改 `fullId` 並級聯更新所有引用。

**Architecture:** 新增 `src/actions/item-reorder.ts` 包含三個 Server Action，搭配 `src/lib/fullid-cascade.ts` 處理級聯更新邏輯。UI 層在 ItemTree 加入操作按鈕和三個 Dialog 元件。所有操作在單一 `prisma.$transaction` 內完成。

**Tech Stack:** Next.js Server Actions, Prisma transactions, React client components, vanilla CSS

---

## Task 1: 級聯更新核心工具函式

**Files:**
- Create: `src/lib/fullid-cascade.ts`
- Test: `src/lib/__tests__/fullid-cascade.test.ts`

這是整個功能的基礎。所有三個操作（reorder、move、renumber）都依賴這些工具函式。

**Step 1: 寫測試 — `computeFullIdPrefix` 和 `replaceFullIdPrefix`**

```typescript
// src/lib/__tests__/fullid-cascade.test.ts
import { describe, it, expect } from 'vitest';
import { computeFullIdPrefix, replaceFullIdPrefix, computeNewFullId } from '../fullid-cascade';

describe('computeFullIdPrefix', () => {
    it('should return project prefix for root items', () => {
        expect(computeFullIdPrefix(null, 'RMS')).toBe('RMS-');
    });

    it('should return parent fullId prefix for child items', () => {
        expect(computeFullIdPrefix('RMS-1', null)).toBe('RMS-1-');
    });
});

describe('replaceFullIdPrefix', () => {
    it('should replace exact match', () => {
        expect(replaceFullIdPrefix('RMS-1-2', 'RMS-1-2', 'RMS-1-1')).toBe('RMS-1-1');
    });

    it('should replace prefix for descendants', () => {
        expect(replaceFullIdPrefix('RMS-1-2-3', 'RMS-1-2', 'RMS-1-1')).toBe('RMS-1-1-3');
    });

    it('should not replace partial matches', () => {
        expect(replaceFullIdPrefix('RMS-1-20', 'RMS-1-2', 'RMS-1-1')).toBe('RMS-1-20');
    });
});

describe('computeNewFullId', () => {
    it('should compute root item fullId', () => {
        expect(computeNewFullId('RMS', null, 3)).toBe('RMS-3');
    });

    it('should compute child item fullId', () => {
        expect(computeNewFullId(null, 'RMS-1', 2)).toBe('RMS-1-2');
    });
});
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/__tests__/fullid-cascade.test.ts`
Expected: FAIL — module not found

**Step 3: 實作純函式**

```typescript
// src/lib/fullid-cascade.ts

/**
 * 計算某層級的 fullId 前綴
 * Root: "RMS-"  Child: "RMS-1-"
 */
export function computeFullIdPrefix(parentFullId: string | null, codePrefix: string | null): string {
    if (parentFullId) return `${parentFullId}-`;
    if (codePrefix) return `${codePrefix}-`;
    throw new Error('Must provide either parentFullId or codePrefix');
}

/**
 * 計算新的 fullId
 */
export function computeNewFullId(codePrefix: string | null, parentFullId: string | null, seq: number): string {
    const prefix = parentFullId ? `${parentFullId}-` : `${codePrefix}-`;
    return `${prefix}${seq}`;
}

/**
 * 替換 fullId 的前綴（精確匹配，避免 RMS-1-2 匹配到 RMS-1-20）
 *
 * oldFullId: "RMS-1-2"  oldPrefix: "RMS-1-2"  newPrefix: "RMS-1-1"
 * → "RMS-1-1"
 *
 * oldFullId: "RMS-1-2-3"  oldPrefix: "RMS-1-2"  newPrefix: "RMS-1-1"
 * → "RMS-1-1-3"
 *
 * oldFullId: "RMS-1-20"  oldPrefix: "RMS-1-2"  newPrefix: "RMS-1-1"
 * → "RMS-1-20" (不變，因為 "RMS-1-20" 不是以 "RMS-1-2-" 開頭，也不等於 "RMS-1-2")
 */
export function replaceFullIdPrefix(fullId: string, oldPrefix: string, newPrefix: string): string {
    if (fullId === oldPrefix) return newPrefix;
    if (fullId.startsWith(oldPrefix + '-')) {
        return newPrefix + fullId.substring(oldPrefix.length);
    }
    return fullId;
}
```

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/__tests__/fullid-cascade.test.ts`
Expected: PASS

**Step 5: 寫測試 — HTML content 中 `data-item-id` 的替換**

```typescript
// 追加到 src/lib/__tests__/fullid-cascade.test.ts

import { replaceFullIdInHtml } from '../fullid-cascade';

describe('replaceFullIdInHtml', () => {
    it('should replace data-item-id attribute values', () => {
        const html = '<a data-item-id="RMS-1-2" class="item-link">RMS-1-2</a>';
        const result = replaceFullIdInHtml(html, 'RMS-1-2', 'RMS-1-1');
        expect(result).toBe('<a data-item-id="RMS-1-1" class="item-link">RMS-1-1</a>');
    });

    it('should replace descendant references in content', () => {
        const html = '<a data-item-id="RMS-1-2-3">RMS-1-2-3</a> and <a data-item-id="RMS-1-2">RMS-1-2</a>';
        const result = replaceFullIdInHtml(html, 'RMS-1-2', 'RMS-1-1');
        expect(result).toBe('<a data-item-id="RMS-1-1-3">RMS-1-1-3</a> and <a data-item-id="RMS-1-1">RMS-1-1</a>');
    });

    it('should not replace partial matches like RMS-1-20', () => {
        const html = '<a data-item-id="RMS-1-20">RMS-1-20</a>';
        const result = replaceFullIdInHtml(html, 'RMS-1-2', 'RMS-1-1');
        expect(result).toBe('<a data-item-id="RMS-1-20">RMS-1-20</a>');
    });

    it('should return null for content without matches', () => {
        const html = '<p>No links here</p>';
        const result = replaceFullIdInHtml(html, 'RMS-1-2', 'RMS-1-1');
        expect(result).toBeNull();
    });
});
```

**Step 6: 跑測試確認失敗**

Run: `npx vitest run src/lib/__tests__/fullid-cascade.test.ts`
Expected: FAIL — replaceFullIdInHtml not found

**Step 7: 實作 `replaceFullIdInHtml`**

追加到 `src/lib/fullid-cascade.ts`：

```typescript
/**
 * 替換 HTML content 中的 fullId 引用
 * 處理：data-item-id="XXX" 屬性值 和 連結文字
 *
 * 回傳 null 表示沒有任何替換發生（用於跳過不需要更新的 Item）
 */
export function replaceFullIdInHtml(html: string, oldFullId: string, newFullId: string): string | null {
    let changed = false;

    // 替換 data-item-id 屬性值（精確匹配或子孫匹配）
    // Pattern: data-item-id="RMS-1-2" 或 data-item-id="RMS-1-2-3"
    const result = html.replace(
        /data-item-id="([^"]+)"/g,
        (match, id: string) => {
            const replaced = replaceFullIdPrefix(id, oldFullId, newFullId);
            if (replaced !== id) {
                changed = true;
                return `data-item-id="${replaced}"`;
            }
            return match;
        }
    ).replace(
        // 替換連結文字中的 fullId（只替換 <a> 標籤內的文字）
        // Pattern: >RMS-1-2</a> 或 >RMS-1-2-3</a>
        />([A-Z]+-\d+(?:-\d+)*)<\/a>/g,
        (match, id: string) => {
            const replaced = replaceFullIdPrefix(id, oldFullId, newFullId);
            if (replaced !== id) {
                changed = true;
                return `>${replaced}</a>`;
            }
            return match;
        }
    );

    return changed ? result : null;
}
```

**Step 8: 跑測試確認通過**

Run: `npx vitest run src/lib/__tests__/fullid-cascade.test.ts`
Expected: PASS

**Step 9: Commit**

```bash
git add src/lib/fullid-cascade.ts src/lib/__tests__/fullid-cascade.test.ts
git commit -m "feat: add fullId cascade utility functions for reorder/move/renumber"
```

---

## Task 2: 級聯更新資料庫操作函式

**Files:**
- Modify: `src/lib/fullid-cascade.ts` — 新增 `cascadeFullIdChange`
- Test: `src/lib/__tests__/fullid-cascade.test.ts` — 新增整合測試（可選，因為需要 DB）

這個函式封裝了單一 fullId 變更需要的所有資料庫更新操作。

**Step 1: 實作 `cascadeFullIdChange`**

追加到 `src/lib/fullid-cascade.ts`：

```typescript
import { Prisma } from "@prisma/client";

/**
 * 將單一項目的 fullId 從 oldFullId 改為 newFullId，並級聯更新所有引用。
 * 必須在 prisma.$transaction 內呼叫。
 *
 * 更新範圍：
 * 1. Item.fullId（本項 + 所有子孫）
 * 2. ItemHistory.itemFullId（本項 + 所有子孫的歷史）
 * 3. Item.content 中的 data-item-id 連結（全專案掃描）
 * 4. PENDING ChangeRequest.data 中的 fullId 引用
 */
export async function cascadeFullIdChange(
    tx: Prisma.TransactionClient,
    oldFullId: string,
    newFullId: string,
    projectId: number
): Promise<void> {
    if (oldFullId === newFullId) return;

    // 1. 更新 Item.fullId — 本項目
    await tx.item.updateMany({
        where: { fullId: oldFullId },
        data: { fullId: newFullId }
    });

    // 2. 更新 Item.fullId — 所有子孫（fullId 以 "oldFullId-" 開頭）
    const descendants = await tx.item.findMany({
        where: { fullId: { startsWith: `${oldFullId}-` } },
        select: { id: true, fullId: true }
    });

    for (const desc of descendants) {
        const newDescFullId = replaceFullIdPrefix(desc.fullId, oldFullId, newFullId);
        if (newDescFullId !== desc.fullId) {
            await tx.item.update({
                where: { id: desc.id },
                data: { fullId: newDescFullId }
            });
        }
    }

    // 3. 更新 ItemHistory.itemFullId — 精確匹配
    await tx.itemHistory.updateMany({
        where: { itemFullId: oldFullId },
        data: { itemFullId: newFullId }
    });

    // 4. 更新 ItemHistory.itemFullId — 子孫
    const descHistories = await tx.itemHistory.findMany({
        where: { itemFullId: { startsWith: `${oldFullId}-` } },
        select: { id: true, itemFullId: true }
    });

    for (const hist of descHistories) {
        const newHistFullId = replaceFullIdPrefix(hist.itemFullId, oldFullId, newFullId);
        if (newHistFullId !== hist.itemFullId) {
            await tx.itemHistory.update({
                where: { id: hist.id },
                data: { itemFullId: newHistFullId }
            });
        }
    }

    // 5. 更新所有 Item.content 中的連結引用
    // 查找 content 包含舊 fullId 的項目（粗篩，精確替換在 replaceFullIdInHtml 中）
    const itemsWithContent = await tx.item.findMany({
        where: {
            projectId,
            content: { contains: oldFullId },
            isDeleted: false
        },
        select: { id: true, content: true }
    });

    for (const item of itemsWithContent) {
        if (!item.content) continue;
        const newContent = replaceFullIdInHtml(item.content, oldFullId, newFullId);
        if (newContent !== null) {
            await tx.item.update({
                where: { id: item.id },
                data: { content: newContent }
            });
        }
    }

    // 6. 更新 PENDING ChangeRequest 中的 fullId
    const pendingRequests = await tx.changeRequest.findMany({
        where: {
            status: "PENDING",
            targetProjectId: projectId
        },
        select: { id: true, data: true }
    });

    for (const req of pendingRequests) {
        try {
            const data = JSON.parse(req.data);
            let changed = false;

            // 替換 data.fullId
            if (data.fullId) {
                const newReqFullId = replaceFullIdPrefix(data.fullId, oldFullId, newFullId);
                if (newReqFullId !== data.fullId) {
                    data.fullId = newReqFullId;
                    changed = true;
                }
            }

            // 替換 data.content 中的連結
            if (data.content && typeof data.content === 'string') {
                const newContent = replaceFullIdInHtml(data.content, oldFullId, newFullId);
                if (newContent !== null) {
                    data.content = newContent;
                    changed = true;
                }
            }

            if (changed) {
                await tx.changeRequest.update({
                    where: { id: req.id },
                    data: { data: JSON.stringify(data) }
                });
            }
        } catch {
            // JSON parse error — skip
        }
    }
}
```

**Step 2: 實作兩階段批次更新函式**

```typescript
/**
 * 批次更新多個項目的 fullId（兩階段，避免 unique constraint 衝突）
 *
 * @param changes 每個元素包含 { itemId, oldFullId, newFullId }
 */
export async function batchCascadeFullIdChanges(
    tx: Prisma.TransactionClient,
    changes: { itemId: number; oldFullId: string; newFullId: string }[],
    projectId: number
): Promise<void> {
    // 過濾掉沒有實際變更的項目
    const actualChanges = changes.filter(c => c.oldFullId !== c.newFullId);
    if (actualChanges.length === 0) return;

    const TEMP_PREFIX = '__TEMP_';

    // Phase 1: 全部改成臨時值
    for (const change of actualChanges) {
        const tempFullId = `${TEMP_PREFIX}${change.newFullId}`;
        await cascadeFullIdChange(tx, change.oldFullId, tempFullId, projectId);
    }

    // Phase 2: 臨時值改成最終值
    for (const change of actualChanges) {
        const tempFullId = `${TEMP_PREFIX}${change.newFullId}`;
        await cascadeFullIdChange(tx, tempFullId, change.newFullId, projectId);
    }
}
```

**Step 3: 確認型別檢查通過**

Run: `npx tsc --noEmit`
Expected: PASS (或只有既有 warnings)

**Step 4: Commit**

```bash
git add src/lib/fullid-cascade.ts
git commit -m "feat: add cascadeFullIdChange and batch cascade for DB operations"
```

---

## Task 3: Server Actions — reorderItems

**Files:**
- Create: `src/actions/item-reorder.ts`

**Step 1: 實作 `reorderItems` Server Action**

```typescript
// src/actions/item-reorder.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { computeNewFullId, batchCascadeFullIdChanges } from "@/lib/fullid-cascade";

const REVIEWER_ROLES = ["INSPECTOR", "ADMIN"];

interface ReorderResult {
    success: boolean;
    error?: string;
    data?: {
        changes: { itemId: number; oldFullId: string; newFullId: string }[];
    };
}

/**
 * 取得預覽：重新排序後的 fullId 變更
 */
export async function previewReorder(
    parentId: number | null,
    projectId: number,
    orderedItemIds: number[]
): Promise<ReorderResult> {
    const session = await getServerSession(authOptions);
    if (!session || !REVIEWER_ROLES.includes(session.user.role)) {
        return { success: false, error: "權限不足" };
    }

    // 查詢同層現有項目
    const items = await prisma.item.findMany({
        where: { projectId, parentId, isDeleted: false },
        select: { id: true, fullId: true }
    });

    // 驗證 orderedItemIds 包含所有同層項目
    const existingIds = new Set(items.map(i => i.id));
    if (orderedItemIds.length !== existingIds.size || !orderedItemIds.every(id => existingIds.has(id))) {
        return { success: false, error: "項目 ID 列表不完整或包含無效項目" };
    }

    // 取得 prefix 資訊
    let codePrefix: string | null = null;
    let parentFullId: string | null = null;

    if (parentId) {
        const parent = await prisma.item.findUnique({ where: { id: parentId }, select: { fullId: true } });
        if (!parent) return { success: false, error: "父項目不存在" };
        parentFullId = parent.fullId;
    } else {
        const project = await prisma.project.findUnique({ where: { id: projectId }, select: { codePrefix: true } });
        if (!project) return { success: false, error: "專案不存在" };
        codePrefix = project.codePrefix;
    }

    const itemMap = new Map(items.map(i => [i.id, i]));
    const changes: { itemId: number; oldFullId: string; newFullId: string }[] = [];

    orderedItemIds.forEach((itemId, index) => {
        const item = itemMap.get(itemId)!;
        const newFullId = computeNewFullId(codePrefix, parentFullId, index + 1);
        changes.push({ itemId, oldFullId: item.fullId, newFullId });
    });

    return { success: true, data: { changes } };
}

/**
 * 執行重新排序
 */
export async function reorderItems(
    parentId: number | null,
    projectId: number,
    orderedItemIds: number[]
): Promise<ReorderResult> {
    const session = await getServerSession(authOptions);
    if (!session || !REVIEWER_ROLES.includes(session.user.role)) {
        return { success: false, error: "權限不足" };
    }

    try {
        // 驗證並計算變更（同 preview 邏輯）
        const preview = await previewReorder(parentId, projectId, orderedItemIds);
        if (!preview.success || !preview.data) return preview;

        const { changes } = preview.data;
        const actualChanges = changes.filter(c => c.oldFullId !== c.newFullId);
        if (actualChanges.length === 0) {
            return { success: true, data: { changes: [] } };
        }

        await prisma.$transaction(async (tx) => {
            await batchCascadeFullIdChanges(tx, actualChanges, projectId);

            // 寫歷史紀錄
            for (const change of actualChanges) {
                await tx.itemHistory.create({
                    data: {
                        itemId: change.itemId,
                        version: 0, // 不影響版本號
                        changeType: "REORDER",
                        snapshot: JSON.stringify({ oldFullId: change.oldFullId, newFullId: change.newFullId }),
                        diff: null,
                        reviewedById: session.user.id,
                        reviewStatus: "APPROVED",
                        reviewNote: `重新排序：${change.oldFullId} → ${change.newFullId}`,
                        itemFullId: change.newFullId,
                        itemTitle: "", // 會由下面的查詢補上
                        projectId,
                    }
                });
            }

            // 補上 itemTitle
            for (const change of actualChanges) {
                const item = await tx.item.findUnique({ where: { id: change.itemId }, select: { title: true } });
                if (item) {
                    await tx.itemHistory.updateMany({
                        where: {
                            itemId: change.itemId,
                            changeType: "REORDER",
                            itemFullId: change.newFullId,
                            itemTitle: ""
                        },
                        data: { itemTitle: item.title }
                    });
                }
            }
        });

        revalidatePath(`/projects/${projectId}`);
        return { success: true, data: { changes: actualChanges } };
    } catch (e) {
        console.error("reorderItems failed:", e);
        const message = e instanceof Error ? e.message : "未知錯誤";
        return { success: false, error: `重新排序失敗：${message}` };
    }
}
```

**Step 2: 確認型別檢查通過**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/actions/item-reorder.ts
git commit -m "feat: add reorderItems server action with preview support"
```

---

## Task 4: Server Actions — moveItem

**Files:**
- Modify: `src/actions/item-reorder.ts`

**Step 1: 實作 `moveItem`**

追加到 `src/actions/item-reorder.ts`：

```typescript
/**
 * 檢查是否會造成循環：newParentId 是否是 itemId 的子孫
 */
async function isDescendant(tx: Prisma.TransactionClient, itemId: number, targetId: number): Promise<boolean> {
    let currentId: number | null = targetId;
    while (currentId !== null) {
        if (currentId === itemId) return true;
        const parent = await tx.item.findUnique({
            where: { id: currentId },
            select: { parentId: true }
        });
        currentId = parent?.parentId ?? null;
    }
    return false;
}

/**
 * 取得預覽：移動項目後的 fullId 變更
 */
export async function previewMove(
    itemId: number,
    newParentId: number | null,
    position: number
): Promise<ReorderResult> {
    const session = await getServerSession(authOptions);
    if (!session || !REVIEWER_ROLES.includes(session.user.role)) {
        return { success: false, error: "權限不足" };
    }

    const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { id: true, fullId: true, projectId: true, parentId: true, isDeleted: true }
    });
    if (!item || item.isDeleted) return { success: false, error: "項目不存在或已刪除" };

    // 如果目標 parent 跟現在一樣，等同 reorder
    // 但仍允許（使用者可能只是想改變位置）

    // 取得目標 parent 資訊
    let targetCodePrefix: string | null = null;
    let targetParentFullId: string | null = null;

    if (newParentId !== null) {
        const newParent = await prisma.item.findUnique({
            where: { id: newParentId },
            select: { fullId: true, projectId: true, isDeleted: true }
        });
        if (!newParent || newParent.isDeleted) return { success: false, error: "目標父項目不存在或已刪除" };
        if (newParent.projectId !== item.projectId) return { success: false, error: "不支援跨專案移動" };
        targetParentFullId = newParent.fullId;
    } else {
        const project = await prisma.project.findUnique({
            where: { id: item.projectId },
            select: { codePrefix: true }
        });
        if (!project) return { success: false, error: "專案不存在" };
        targetCodePrefix = project.codePrefix;
    }

    // 取得目標 parent 下現有的子項目（排除被移動的項目）
    const siblings = await prisma.item.findMany({
        where: {
            projectId: item.projectId,
            parentId: newParentId,
            isDeleted: false,
            id: { not: itemId }
        },
        select: { id: true, fullId: true },
        orderBy: { fullId: 'asc' }
    });

    // 計算移動項目的新 fullId
    // position 是 0-based，插入到 siblings 中的位置
    const clampedPosition = Math.max(0, Math.min(position, siblings.length));

    // 構建新順序
    const newOrder = [...siblings];
    newOrder.splice(clampedPosition, 0, { id: itemId, fullId: item.fullId });

    const changes: { itemId: number; oldFullId: string; newFullId: string }[] = [];
    newOrder.forEach((sib, index) => {
        const newFullId = computeNewFullId(targetCodePrefix, targetParentFullId, index + 1);
        changes.push({ itemId: sib.id, oldFullId: sib.fullId, newFullId });
    });

    // 也需要處理原 parent 下的剩餘項目重新編號
    if (item.parentId !== newParentId) {
        const oldSiblings = await prisma.item.findMany({
            where: {
                projectId: item.projectId,
                parentId: item.parentId,
                isDeleted: false,
                id: { not: itemId }
            },
            select: { id: true, fullId: true },
            orderBy: { fullId: 'asc' }
        });

        let oldCodePrefix: string | null = null;
        let oldParentFullId: string | null = null;

        if (item.parentId !== null) {
            const oldParent = await prisma.item.findUnique({
                where: { id: item.parentId },
                select: { fullId: true }
            });
            oldParentFullId = oldParent?.fullId ?? null;
        } else {
            const project = await prisma.project.findUnique({
                where: { id: item.projectId },
                select: { codePrefix: true }
            });
            oldCodePrefix = project?.codePrefix ?? null;
        }

        oldSiblings.forEach((sib, index) => {
            const newFullId = computeNewFullId(oldCodePrefix, oldParentFullId, index + 1);
            changes.push({ itemId: sib.id, oldFullId: sib.fullId, newFullId });
        });
    }

    return { success: true, data: { changes } };
}

/**
 * 執行跨層級移動
 */
export async function moveItem(
    itemId: number,
    newParentId: number | null,
    position: number
): Promise<ReorderResult> {
    const session = await getServerSession(authOptions);
    if (!session || !REVIEWER_ROLES.includes(session.user.role)) {
        return { success: false, error: "權限不足" };
    }

    try {
        const item = await prisma.item.findUnique({
            where: { id: itemId },
            select: { id: true, fullId: true, projectId: true, parentId: true, isDeleted: true }
        });
        if (!item || item.isDeleted) return { success: false, error: "項目不存在或已刪除" };

        // 循環檢查
        if (newParentId !== null) {
            const wouldCycle = await prisma.$transaction(async (tx) => {
                return isDescendant(tx, itemId, newParentId);
            });
            if (wouldCycle) return { success: false, error: "不能將項目移動到自己的子項目下（循環）" };
        }

        // 計算變更
        const preview = await previewMove(itemId, newParentId, position);
        if (!preview.success || !preview.data) return preview;

        const { changes } = preview.data;
        const actualChanges = changes.filter(c => c.oldFullId !== c.newFullId);

        await prisma.$transaction(async (tx) => {
            // 先更新 parentId
            await tx.item.update({
                where: { id: itemId },
                data: { parentId: newParentId }
            });

            // 批次級聯更新
            if (actualChanges.length > 0) {
                await batchCascadeFullIdChanges(tx, actualChanges, item.projectId);
            }

            // 寫歷史紀錄
            for (const change of actualChanges) {
                const targetItem = await tx.item.findUnique({ where: { id: change.itemId }, select: { title: true } });
                await tx.itemHistory.create({
                    data: {
                        itemId: change.itemId,
                        version: 0,
                        changeType: "REORDER",
                        snapshot: JSON.stringify({ oldFullId: change.oldFullId, newFullId: change.newFullId }),
                        diff: null,
                        reviewedById: session.user.id,
                        reviewStatus: "APPROVED",
                        reviewNote: `移動項目：${change.oldFullId} → ${change.newFullId}`,
                        itemFullId: change.newFullId,
                        itemTitle: targetItem?.title || "",
                        projectId: item.projectId,
                    }
                });
            }
        });

        revalidatePath(`/projects/${item.projectId}`);
        return { success: true, data: { changes: actualChanges } };
    } catch (e) {
        console.error("moveItem failed:", e);
        const message = e instanceof Error ? e.message : "未知錯誤";
        return { success: false, error: `移動項目失敗：${message}` };
    }
}
```

**Step 2: 需要在檔案頂部新增 import**

```typescript
import { Prisma } from "@prisma/client";
```

**Step 3: 確認型別檢查通過**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/actions/item-reorder.ts
git commit -m "feat: add moveItem server action with cycle detection and preview"
```

---

## Task 5: Server Actions — renumberItems

**Files:**
- Modify: `src/actions/item-reorder.ts`

**Step 1: 實作 `renumberItems`**

追加到 `src/actions/item-reorder.ts`：

```typescript
/**
 * 取得預覽：重新編號後的 fullId 變更
 */
export async function previewRenumber(
    parentId: number | null,
    projectId: number,
    recursive: boolean
): Promise<ReorderResult> {
    const session = await getServerSession(authOptions);
    if (!session || !REVIEWER_ROLES.includes(session.user.role)) {
        return { success: false, error: "權限不足" };
    }

    const allChanges: { itemId: number; oldFullId: string; newFullId: string }[] = [];

    async function collectChanges(pId: number | null, projId: number) {
        // 取得同層項目（按目前 fullId 自然排序）
        const items = await prisma.item.findMany({
            where: { projectId: projId, parentId: pId, isDeleted: false },
            select: { id: true, fullId: true },
            orderBy: { fullId: 'asc' }
        });

        // 用自然排序確保 RMS-2 排在 RMS-10 前面
        items.sort((a, b) => {
            const partsA = a.fullId.split('-');
            const partsB = b.fullId.split('-');
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                const valA = parseInt(partsA[i]);
                const valB = parseInt(partsB[i]);
                if (!isNaN(valA) && !isNaN(valB)) {
                    if (valA !== valB) return valA - valB;
                } else {
                    if (partsA[i] !== partsB[i]) return (partsA[i] || '').localeCompare(partsB[i] || '');
                }
            }
            return 0;
        });

        let codePrefix: string | null = null;
        let parentFullId: string | null = null;

        if (pId !== null) {
            // 查找 parent 的最終 fullId（可能在 allChanges 中已被改過）
            const parentChange = allChanges.find(c => c.itemId === pId);
            if (parentChange) {
                parentFullId = parentChange.newFullId;
            } else {
                const parent = await prisma.item.findUnique({ where: { id: pId }, select: { fullId: true } });
                parentFullId = parent?.fullId ?? null;
            }
        } else {
            const project = await prisma.project.findUnique({ where: { id: projId }, select: { codePrefix: true } });
            codePrefix = project?.codePrefix ?? null;
        }

        items.forEach((item, index) => {
            const newFullId = computeNewFullId(codePrefix, parentFullId, index + 1);
            allChanges.push({ itemId: item.id, oldFullId: item.fullId, newFullId });
        });

        // 遞迴處理子項目
        if (recursive) {
            for (const item of items) {
                await collectChanges(item.id, projId);
            }
        }
    }

    await collectChanges(parentId, projectId);

    return { success: true, data: { changes: allChanges } };
}

/**
 * 執行重新編號
 */
export async function renumberItems(
    parentId: number | null,
    projectId: number,
    recursive: boolean
): Promise<ReorderResult> {
    const session = await getServerSession(authOptions);
    if (!session || !REVIEWER_ROLES.includes(session.user.role)) {
        return { success: false, error: "權限不足" };
    }

    try {
        const preview = await previewRenumber(parentId, projectId, recursive);
        if (!preview.success || !preview.data) return preview;

        const { changes } = preview.data;
        const actualChanges = changes.filter(c => c.oldFullId !== c.newFullId);
        if (actualChanges.length === 0) {
            return { success: true, data: { changes: [] } };
        }

        await prisma.$transaction(async (tx) => {
            await batchCascadeFullIdChanges(tx, actualChanges, projectId);

            // 寫歷史紀錄
            for (const change of actualChanges) {
                const item = await tx.item.findUnique({ where: { id: change.itemId }, select: { title: true } });
                await tx.itemHistory.create({
                    data: {
                        itemId: change.itemId,
                        version: 0,
                        changeType: "REORDER",
                        snapshot: JSON.stringify({ oldFullId: change.oldFullId, newFullId: change.newFullId }),
                        diff: null,
                        reviewedById: session.user.id,
                        reviewStatus: "APPROVED",
                        reviewNote: `重新編號：${change.oldFullId} → ${change.newFullId}`,
                        itemFullId: change.newFullId,
                        itemTitle: item?.title || "",
                        projectId,
                    }
                });
            }
        });

        revalidatePath(`/projects/${projectId}`);
        return { success: true, data: { changes: actualChanges } };
    } catch (e) {
        console.error("renumberItems failed:", e);
        const message = e instanceof Error ? e.message : "未知錯誤";
        return { success: false, error: `重新編號失敗：${message}` };
    }
}
```

**Step 2: 確認型別檢查通過**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/actions/item-reorder.ts
git commit -m "feat: add renumberItems server action with recursive support"
```

---

## Task 6: ReorderDialog 元件（拖拉排序彈窗）

**Files:**
- Create: `src/components/item/ReorderDialog.tsx`

**Step 1: 實作元件**

```typescript
// src/components/item/ReorderDialog.tsx
'use client';

import { useState, useCallback } from 'react';
import { previewReorder, reorderItems } from '@/actions/item-reorder';
import { useRouter } from 'next/navigation';

interface ReorderItem {
    id: number;
    fullId: string;
    title: string;
}

interface ReorderDialogProps {
    items: ReorderItem[];
    parentId: number | null;
    projectId: number;
    onClose: () => void;
}

export default function ReorderDialog({ items, parentId, projectId, onClose }: ReorderDialogProps) {
    const router = useRouter();
    const [orderedItems, setOrderedItems] = useState<ReorderItem[]>(items);
    const [preview, setPreview] = useState<{ itemId: number; oldFullId: string; newFullId: string }[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    const handleDragStart = (index: number) => {
        setDragIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        const newItems = [...orderedItems];
        const [dragged] = newItems.splice(dragIndex, 1);
        newItems.splice(index, 0, dragged);
        setOrderedItems(newItems);
        setDragIndex(index);
    };

    const moveItem = (fromIndex: number, direction: -1 | 1) => {
        const toIndex = fromIndex + direction;
        if (toIndex < 0 || toIndex >= orderedItems.length) return;
        const newItems = [...orderedItems];
        [newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]];
        setOrderedItems(newItems);
        setPreview(null);
    };

    const handlePreview = useCallback(async () => {
        setLoading(true);
        setError(null);
        const result = await previewReorder(parentId, projectId, orderedItems.map(i => i.id));
        setLoading(false);
        if (result.success && result.data) {
            setPreview(result.data.changes.filter(c => c.oldFullId !== c.newFullId));
        } else {
            setError(result.error || '預覽失敗');
        }
    }, [orderedItems, parentId, projectId]);

    const handleConfirm = async () => {
        setLoading(true);
        setError(null);
        const result = await reorderItems(parentId, projectId, orderedItems.map(i => i.id));
        setLoading(false);
        if (result.success) {
            router.refresh();
            onClose();
        } else {
            setError(result.error || '操作失敗');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content reorder-dialog" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>管理順序</h3>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        拖拉項目或使用箭頭調整順序
                    </p>

                    <div className="reorder-list">
                        {orderedItems.map((item, index) => (
                            <div
                                key={item.id}
                                className={`reorder-item ${dragIndex === index ? 'dragging' : ''}`}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={() => setDragIndex(null)}
                            >
                                <span className="reorder-handle">&#x2630;</span>
                                <span className="reorder-id">{item.fullId}</span>
                                <span className="reorder-title">{item.title}</span>
                                <div className="reorder-arrows">
                                    <button
                                        onClick={() => moveItem(index, -1)}
                                        disabled={index === 0}
                                        className="arrow-btn"
                                        title="上移"
                                    >&#9650;</button>
                                    <button
                                        onClick={() => moveItem(index, 1)}
                                        disabled={index === orderedItems.length - 1}
                                        className="arrow-btn"
                                        title="下移"
                                    >&#9660;</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {preview && preview.length > 0 && (
                        <div className="reorder-preview">
                            <h4>變更預覽</h4>
                            <table>
                                <thead>
                                    <tr><th>原 ID</th><th></th><th>新 ID</th></tr>
                                </thead>
                                <tbody>
                                    {preview.map(c => (
                                        <tr key={c.itemId}>
                                            <td><code>{c.oldFullId}</code></td>
                                            <td>&rarr;</td>
                                            <td><code>{c.newFullId}</code></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {preview && preview.length === 0 && (
                        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>順序未改變</p>
                    )}

                    {error && <p className="error-message">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>取消</button>
                    {preview === null ? (
                        <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>
                            {loading ? '計算中...' : '預覽變更'}
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handleConfirm}
                            disabled={loading || preview.length === 0}
                        >
                            {loading ? '處理中...' : '確認排序'}
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                .reorder-dialog {
                    max-width: 600px;
                    width: 90vw;
                }
                .reorder-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    max-height: 400px;
                    overflow-y: auto;
                }
                .reorder-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.5rem 0.75rem;
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    cursor: grab;
                    transition: background 0.15s;
                }
                .reorder-item:hover {
                    background: var(--color-bg-elevated);
                }
                .reorder-item.dragging {
                    opacity: 0.5;
                }
                .reorder-handle {
                    color: var(--color-text-muted);
                    cursor: grab;
                }
                .reorder-id {
                    font-family: var(--font-geist-mono);
                    font-weight: 600;
                    font-size: 0.85rem;
                    color: var(--color-primary);
                    flex-shrink: 0;
                }
                .reorder-title {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 0.9rem;
                }
                .reorder-arrows {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }
                .arrow-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0 0.25rem;
                    font-size: 0.6rem;
                    color: var(--color-text-muted);
                    line-height: 1;
                }
                .arrow-btn:hover:not(:disabled) {
                    color: var(--color-primary);
                }
                .arrow-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }
                .reorder-preview {
                    margin-top: 1rem;
                    padding: 0.75rem;
                    background: var(--color-bg-elevated);
                    border-radius: var(--radius-sm);
                }
                .reorder-preview h4 {
                    font-size: 0.85rem;
                    margin-bottom: 0.5rem;
                }
                .reorder-preview table {
                    width: 100%;
                    font-size: 0.85rem;
                }
                .reorder-preview td, .reorder-preview th {
                    padding: 0.25rem 0.5rem;
                }
                .reorder-preview td:nth-child(2) {
                    text-align: center;
                    color: var(--color-text-muted);
                }
            `}</style>
        </div>
    );
}
```

**Step 2: 確認型別檢查通過**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/item/ReorderDialog.tsx
git commit -m "feat: add ReorderDialog component with drag-and-drop and arrow buttons"
```

---

## Task 7: RenumberDialog 元件

**Files:**
- Create: `src/components/item/RenumberDialog.tsx`

**Step 1: 實作元件**

```typescript
// src/components/item/RenumberDialog.tsx
'use client';

import { useState, useCallback } from 'react';
import { previewRenumber, renumberItems } from '@/actions/item-reorder';
import { useRouter } from 'next/navigation';

interface RenumberDialogProps {
    parentId: number | null;
    parentFullId: string | null; // null for root level
    projectId: number;
    onClose: () => void;
}

export default function RenumberDialog({ parentId, parentFullId, projectId, onClose }: RenumberDialogProps) {
    const router = useRouter();
    const [recursive, setRecursive] = useState(false);
    const [preview, setPreview] = useState<{ itemId: number; oldFullId: string; newFullId: string }[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePreview = useCallback(async () => {
        setLoading(true);
        setError(null);
        const result = await previewRenumber(parentId, projectId, recursive);
        setLoading(false);
        if (result.success && result.data) {
            setPreview(result.data.changes.filter(c => c.oldFullId !== c.newFullId));
        } else {
            setError(result.error || '預覽失敗');
        }
    }, [parentId, projectId, recursive]);

    const handleConfirm = async () => {
        setLoading(true);
        setError(null);
        const result = await renumberItems(parentId, projectId, recursive);
        setLoading(false);
        if (result.success) {
            router.refresh();
            onClose();
        } else {
            setError(result.error || '操作失敗');
        }
    };

    const scopeLabel = parentFullId ? `${parentFullId} 的子項目` : '根層級項目';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content renumber-dialog" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>重新編號</h3>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <p style={{ marginBottom: '0.75rem' }}>
                        將 <strong>{scopeLabel}</strong> 按照目前順序重新編為連續數字。
                    </p>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={recursive}
                            onChange={(e) => { setRecursive(e.target.checked); setPreview(null); }}
                        />
                        包含所有子層級
                    </label>

                    {preview && preview.length > 0 && (
                        <div className="renumber-preview" style={{ marginTop: '1rem' }}>
                            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                變更預覽（{preview.length} 個項目）
                            </h4>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr><th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>原 ID</th><th></th><th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>新 ID</th></tr>
                                    </thead>
                                    <tbody>
                                        {preview.map(c => (
                                            <tr key={c.itemId}>
                                                <td style={{ padding: '0.25rem 0.5rem' }}><code>{c.oldFullId}</code></td>
                                                <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>&rarr;</td>
                                                <td style={{ padding: '0.25rem 0.5rem' }}><code>{c.newFullId}</code></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {preview && preview.length === 0 && (
                        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>編號已經是連續的，無需變更。</p>
                    )}

                    {error && <p className="error-message">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>取消</button>
                    {preview === null ? (
                        <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>
                            {loading ? '計算中...' : '預覽變更'}
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handleConfirm}
                            disabled={loading || preview.length === 0}
                        >
                            {loading ? '處理中...' : '確認重新編號'}
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                .renumber-dialog {
                    max-width: 550px;
                    width: 90vw;
                }
            `}</style>
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add src/components/item/RenumberDialog.tsx
git commit -m "feat: add RenumberDialog component with recursive option and preview"
```

---

## Task 8: MoveItemDialog 元件

**Files:**
- Create: `src/components/item/MoveItemDialog.tsx`

**Step 1: 實作元件**

```typescript
// src/components/item/MoveItemDialog.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { previewMove, moveItem } from '@/actions/item-reorder';
import { useRouter } from 'next/navigation';
import { ItemNode } from '@/lib/tree-utils';

interface MoveItemDialogProps {
    itemId: number;
    itemFullId: string;
    itemTitle: string;
    projectId: number;
    treeNodes: ItemNode[]; // 整個專案的 tree
    onClose: () => void;
}

export default function MoveItemDialog({ itemId, itemFullId, itemTitle, projectId, treeNodes, onClose }: MoveItemDialogProps) {
    const router = useRouter();
    const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
    const [position, setPosition] = useState(0);
    const [preview, setPreview] = useState<{ itemId: number; oldFullId: string; newFullId: string }[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 扁平化 tree 供選擇（排除自己和自己的子孫）
    const flattenNodes = useCallback((nodes: ItemNode[], excludeId: number): { id: number | null; fullId: string; title: string; depth: number }[] => {
        const result: { id: number | null; fullId: string; title: string; depth: number }[] = [];
        result.push({ id: null, fullId: '（根層級）', title: '（根層級）', depth: 0 });

        function walk(nodeList: ItemNode[], depth: number) {
            for (const node of nodeList) {
                if (node.id === excludeId) continue; // 排除自己及子孫
                result.push({ id: node.id, fullId: node.fullId, title: node.title, depth });
                walk(node.children, depth + 1);
            }
        }
        walk(nodes, 1);
        return result;
    }, []);

    const parentOptions = flattenNodes(treeNodes, itemId);

    const handlePreview = useCallback(async () => {
        setLoading(true);
        setError(null);
        const result = await previewMove(itemId, selectedParentId, position);
        setLoading(false);
        if (result.success && result.data) {
            setPreview(result.data.changes.filter(c => c.oldFullId !== c.newFullId));
        } else {
            setError(result.error || '預覽失敗');
        }
    }, [itemId, selectedParentId, position]);

    const handleConfirm = async () => {
        setLoading(true);
        setError(null);
        const result = await moveItem(itemId, selectedParentId, position);
        setLoading(false);
        if (result.success) {
            router.refresh();
            onClose();
        } else {
            setError(result.error || '操作失敗');
        }
    };

    // 當選擇的 parent 改變時，重置 preview
    useEffect(() => {
        setPreview(null);
    }, [selectedParentId, position]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content move-dialog" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>移動項目</h3>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <p style={{ marginBottom: '1rem' }}>
                        移動 <strong>{itemFullId}</strong> <span style={{ color: 'var(--color-text-muted)' }}>{itemTitle}</span>
                    </p>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
                            目標位置
                        </label>
                        <select
                            value={selectedParentId === null ? '__root__' : String(selectedParentId)}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedParentId(val === '__root__' ? null : parseInt(val));
                            }}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-surface)',
                                fontSize: '0.9rem',
                            }}
                        >
                            {parentOptions.map((opt) => (
                                <option key={opt.id ?? '__root__'} value={opt.id === null ? '__root__' : String(opt.id)}>
                                    {'　'.repeat(opt.depth)}{opt.fullId} {opt.id !== null ? `- ${opt.title}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
                            插入位置（第幾個，從 0 開始）
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={position}
                            onChange={(e) => setPosition(parseInt(e.target.value) || 0)}
                            style={{
                                width: '100px',
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-surface)',
                                fontSize: '0.9rem',
                            }}
                        />
                    </div>

                    {preview && preview.length > 0 && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                變更預覽（{preview.length} 個項目受影響）
                            </h4>
                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr><th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>原 ID</th><th></th><th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>新 ID</th></tr>
                                    </thead>
                                    <tbody>
                                        {preview.map(c => (
                                            <tr key={c.itemId}>
                                                <td style={{ padding: '0.25rem 0.5rem' }}><code>{c.oldFullId}</code></td>
                                                <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>&rarr;</td>
                                                <td style={{ padding: '0.25rem 0.5rem' }}><code>{c.newFullId}</code></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {preview && preview.length === 0 && (
                        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>無需變更（位置未改變）</p>
                    )}

                    {error && <p className="error-message">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>取消</button>
                    {preview === null ? (
                        <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>
                            {loading ? '計算中...' : '預覽變更'}
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handleConfirm}
                            disabled={loading || preview.length === 0}
                        >
                            {loading ? '處理中...' : '確認移動'}
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                .move-dialog {
                    max-width: 600px;
                    width: 90vw;
                }
            `}</style>
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add src/components/item/MoveItemDialog.tsx
git commit -m "feat: add MoveItemDialog component with tree selector and preview"
```

---

## Task 9: 整合到 ItemTree — 操作選單

**Files:**
- Modify: `src/components/item/ItemTree.tsx`

在每個 `AccordionItem` 的 header 中，為 ADMIN/INSPECTOR 加入操作選單（三個按鈕圖示）。

**Step 1: 修改 `ItemTree.tsx`**

修改 `ItemTreeProps` 新增：
- `canManage?: boolean` — 是否顯示管理按鈕
- `allNodes?: ItemNode[]` — 整個專案的 tree（用於 MoveItemDialog）

修改 `AccordionItem` 在 header 中加入操作選單按鈕：
- 排序按鈕（▲▼）：`moveItem(index, -1|1)` — 呼叫 `reorderItems` 直接上/下移一格
- 「管理順序」按鈕：打開 `ReorderDialog`
- 「移動」按鈕：打開 `MoveItemDialog`
- 「重新編號」按鈕：打開 `RenumberDialog`

具體修改如下：

1. 新增 import：
```typescript
import { useState } from 'react';
import ReorderDialog from './ReorderDialog';
import RenumberDialog from './RenumberDialog';
import MoveItemDialog from './MoveItemDialog';
```

2. `ItemTreeProps` 新增：
```typescript
interface ItemTreeProps {
    nodes: ItemNode[];
    level?: number;
    canEdit?: boolean;
    canManage?: boolean;  // NEW
    projectId?: number;
    currentItemId?: number;
    allNodes?: ItemNode[];  // NEW — 整個專案的 tree（給 MoveItemDialog 用）
}
```

3. 在 `AccordionItem` header 的 `+ 新增子項目` 按鈕旁邊，加入管理操作的下拉選單：

```tsx
{canManage && projectId && (
    <div onClick={(e) => e.stopPropagation()}>
        <ItemManageMenu
            node={node}
            siblings={nodes}  // 同層所有節點
            parentId={node.parentId}
            projectId={projectId}
            allNodes={allNodes || nodes}
        />
    </div>
)}
```

4. 新增 `ItemManageMenu` 子元件（在同一檔案內）：

```tsx
function ItemManageMenu({ node, siblings, parentId, projectId, allNodes }: {
    node: ItemNode;
    siblings: ItemNode[];
    parentId: number | null;
    projectId: number;
    allNodes: ItemNode[];
}) {
    const [showMenu, setShowMenu] = useState(false);
    const [showReorder, setShowReorder] = useState(false);
    const [showMove, setShowMove] = useState(false);
    const [showRenumber, setShowRenumber] = useState(false);

    return (
        <>
            <button
                title="管理"
                className="manage-btn"
                onClick={() => setShowMenu(!showMenu)}
                style={{
                    width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-surface)',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.85rem',
                    position: 'relative',
                }}
            >
                ⋮
            </button>

            {showMenu && (
                <div className="manage-dropdown" style={{
                    position: 'absolute', right: 0, top: '100%', zIndex: 100,
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    minWidth: '160px',
                    padding: '0.25rem 0',
                }}>
                    <button className="dropdown-item" onClick={() => { setShowMenu(false); setShowReorder(true); }}>
                        管理同層順序
                    </button>
                    <button className="dropdown-item" onClick={() => { setShowMenu(false); setShowMove(true); }}>
                        移動到...
                    </button>
                    <button className="dropdown-item" onClick={() => { setShowMenu(false); setShowRenumber(true); }}>
                        重新編號子項目
                    </button>
                </div>
            )}

            {showReorder && (
                <ReorderDialog
                    items={siblings.map(s => ({ id: s.id, fullId: s.fullId, title: s.title }))}
                    parentId={parentId}
                    projectId={projectId}
                    onClose={() => setShowReorder(false)}
                />
            )}

            {showMove && (
                <MoveItemDialog
                    itemId={node.id}
                    itemFullId={node.fullId}
                    itemTitle={node.title}
                    projectId={projectId}
                    treeNodes={allNodes}
                    onClose={() => setShowMove(false)}
                />
            )}

            {showRenumber && (
                <RenumberDialog
                    parentId={node.id}
                    parentFullId={node.fullId}
                    projectId={projectId}
                    onClose={() => setShowRenumber(false)}
                />
            )}
        </>
    );
}
```

**Step 2: 修改 `src/app/projects/[id]/page.tsx`**

傳入 `canManage` 和 `allNodes` props：

```tsx
// 在 page.tsx 中計算 canManage
const canManage = session?.user.role === "ADMIN" || session?.user.role === "INSPECTOR";

// 傳給 ItemTree
<ItemTree
    nodes={rootNodes}
    canEdit={canEdit}
    canManage={canManage}
    projectId={projectId}
    allNodes={rootNodes}
/>
```

**Step 3: 確認型別檢查通過**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/item/ItemTree.tsx src/app/projects/[id]/page.tsx
git commit -m "feat: integrate reorder/move/renumber controls into ItemTree"
```

---

## Task 10: 專案根層級的重新編號入口

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`

在專案頁面的「項目列表」header 區域（`item-list-header`），為 ADMIN/INSPECTOR 加一個「重新編號」按鈕。

**Step 1: 新增 client wrapper 元件**

因為 `page.tsx` 是 server component，需要一個 client wrapper 來處理 dialog 開關。在 `src/components/item/` 新增：

```typescript
// src/components/item/RenumberButton.tsx
'use client';

import { useState } from 'react';
import RenumberDialog from './RenumberDialog';

interface RenumberButtonProps {
    parentId: number | null;
    parentFullId: string | null;
    projectId: number;
}

export default function RenumberButton({ parentId, parentFullId, projectId }: RenumberButtonProps) {
    const [showDialog, setShowDialog] = useState(false);

    return (
        <>
            <button
                className="btn btn-secondary"
                onClick={() => setShowDialog(true)}
                style={{ fontSize: '0.85rem' }}
            >
                重新編號
            </button>
            {showDialog && (
                <RenumberDialog
                    parentId={parentId}
                    parentFullId={parentFullId}
                    projectId={projectId}
                    onClose={() => setShowDialog(false)}
                />
            )}
        </>
    );
}
```

**Step 2: 在 `page.tsx` 加入按鈕**

在 `item-list-header` 中：

```tsx
import RenumberButton from "@/components/item/RenumberButton";

// 在 header 中
<div className="item-list-header">
    <h2 className="section-title">...</h2>
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {canManage && <RenumberButton parentId={null} parentFullId={null} projectId={projectId} />}
        {canEdit && <CreateItemForm projectId={projectId} codePrefix={project.codePrefix} />}
    </div>
</div>
```

**Step 3: Commit**

```bash
git add src/components/item/RenumberButton.tsx src/app/projects/[id]/page.tsx
git commit -m "feat: add root-level renumber button on project page"
```

---

## Task 11: 驗證與修正

**Step 1: 跑 lint**

Run: `npx next lint`
Expected: PASS (只有既有 warnings)

**Step 2: 跑型別檢查**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: 跑測試**

Run: `npx vitest run`
Expected: PASS

**Step 4: 跑 build**

Run: `npm run build`
Expected: PASS

**Step 5: 手動測試**

1. 啟動 dev server: `npm run dev`
2. 以 ADMIN 帳號登入
3. 進入一個有多個項目的專案
4. 測試：
   - 點擊項目右側 ⋮ → 管理同層順序 → 拖拉排序 → 預覽 → 確認
   - 點擊項目右側 ⋮ → 移動到 → 選擇目標 → 預覽 → 確認
   - 點擊項目右側 ⋮ → 重新編號子項目 → 勾選遞迴 → 預覽 → 確認
   - 點擊根層級「重新編號」按鈕 → 預覽 → 確認
5. 驗證歷史紀錄是否正確記錄
6. 驗證富文字連結是否正確更新

**Step 6: 修正任何發現的問題**

**Step 7: 最終 commit**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

---

## 依賴關係圖

```
Task 1 (純函式) → Task 2 (DB 操作)
                          ↓
Task 3 (reorder) ─┐
Task 4 (move)    ─┼→ Task 6-8 (UI Dialogs) → Task 9 (整合到 ItemTree) → Task 10 (根層級按鈕) → Task 11 (驗證)
Task 5 (renumber) ┘
```

**可並行的 tasks：**
- Task 3、4、5 彼此獨立（都依賴 Task 2）
- Task 6、7、8 彼此獨立（都依賴 Task 3-5）
