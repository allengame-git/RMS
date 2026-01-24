/**
 * @file tree-utils.ts
 * @description 樹狀結構工具模組
 *
 * 此模組提供將扁平的項目資料轉換為樹狀結構的功能。
 *
 * ## 核心功能
 * - `buildItemTree`：將項目陣列轉換為樹狀結構
 *
 * ## 樹狀結構 (ItemNode)
 * ```typescript
 * interface ItemNode {
 *   id: number;
 *   fullId: string;
 *   title: string;
 *   parentId: number | null;
 *   children: ItemNode[];
 * }
 * ```
 *
 * ## 排序邏輯
 * 使用自然排序確保子項目正確排列：
 * - `RMS-1-1`, `RMS-1-2`, ..., `RMS-1-10`
 * - 而非字串排序的 `RMS-1-1`, `RMS-1-10`, `RMS-1-2`
 *
 * ## 使用場景
 * - 專案頁面的項目樹狀導航
 * - 項目選擇器的層級顯示
 *
 * @see /src/app/projects/[id]/page.tsx - 專案頁面
 * @see /src/components/project/ItemTree.tsx - 樹狀顯示元件
 */

export interface ItemNode {
    id: number;
    fullId: string;
    title: string;
    parentId: number | null;
    children: ItemNode[];
    projectId: number;
}

export function buildItemTree(items: any[]): ItemNode[] {
    const itemMap = new Map<number, ItemNode>();
    const roots: ItemNode[] = [];

    // 1. Initialize all nodes
    items.forEach(item => {
        itemMap.set(item.id, {
            id: item.id,
            fullId: item.fullId,
            title: item.title,
            parentId: item.parentId,
            projectId: item.projectId,
            children: []
        });
    });

    // 2. Build hierarchy
    items.forEach(item => {
        const node = itemMap.get(item.id);
        if (!node) return;

        if (item.parentId && itemMap.has(item.parentId)) {
            const parent = itemMap.get(item.parentId);
            parent!.children.push(node);
        } else {
            roots.push(node);
        }
    });

    // 3. Sort children recursively (by IDs typically, or sequence)
    // Assuming fullId implicitly sorts them correctly if lexically sorted?
    // Actually fullId string sort works for fixed width but "RMS-1-2" vs "RMS-1-10" might sort wrong alphabetically (1-10 comes before 1-2).
    // We should use a custom sorter if needed, but for now let's rely on simple string sort of fullId or database order.
    // The previous implementation used `orderBy: { fullId: 'asc' }` in database query.
    // If database returned sorted, we usually maintain relative order, but let's explictly sort.

    // Sort helper
    const sortNodes = (nodes: ItemNode[]) => {
        nodes.sort((a, b) => {
            // Comparing "RMS-1-2" and "RMS-1-10". 
            // We can split by - and compare numbers.
            const partsA = a.fullId.split('-');
            const partsB = b.fullId.split('-');

            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                // skip non-numeric prefix like "RMS" (which is same)
                const valA = parseInt(partsA[i]);
                const valB = parseInt(partsB[i]);

                if (!isNaN(valA) && !isNaN(valB)) {
                    if (valA !== valB) return valA - valB;
                } else {
                    // string compare
                    if (partsA[i] !== partsB[i]) return (partsA[i] || '').localeCompare(partsB[i] || '');
                }
            }
            return 0;
        });
        nodes.forEach(node => sortNodes(node.children));
    };

    sortNodes(roots);
    return roots;
}
