/**
 * @file search.ts
 * @description 項目搜尋模組
 *
 * 此模組提供 RMS 系統的項目全文搜尋功能。
 *
 * ## 核心功能
 * - `searchProjectItems`：在指定專案內搜尋項目
 *
 * ## 搜尋邏輯
 * 1. 在資料庫中搜尋標題和內容
 * 2. 過濾掉僅匹配 HTML 標籤的結果
 * 3. 使用自然排序（alpha-numeric sort）排列結果
 * 4. 生成搜尋片段（snippets）供預覽
 *
 * ## 搜尋限制
 * - 最少輸入 2 個字元
 * - 最多回傳 50 筆結果
 * - 僅搜尋未刪除的項目
 *
 * ## 技術實作
 * - 使用 Prisma `contains` 進行模糊搜尋
 * - HTML 內容會被移除標籤後再進行匹配
 * - Snippets 高亮顯示搜尋關鍵字
 *
 * @see /src/lib/search-utils.ts - 搜尋輔助函式
 * @see /src/components/search/ProjectSearchBar.tsx - 搜尋 UI
 */

'use server';

import { prisma } from '@/lib/prisma';
import { naturalSort, generateSnippets, stripHtmlTags, type Snippet } from '@/lib/search-utils';

export interface SearchResult {
    id: number;
    fullId: string;
    title: string;
    snippets: Snippet[];
}

/**
 * Search items within a project
 */
export async function searchProjectItems(
    projectId: number,
    query: string
): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) {
        return [];
    }

    const trimmedQuery = query.trim();

    // Query database - may over-match (including HTML tags)
    const items = await prisma.item.findMany({
        where: {
            projectId,
            isDeleted: false,
            OR: [
                { title: { contains: trimmedQuery } },
                { content: { contains: trimmedQuery } }
            ]
        },
        select: {
            id: true,
            fullId: true,
            title: true,
            content: true
        },
        take: 50
    });

    // Filter: only keep items where query exists in plain text (not just HTML)
    const filteredItems = items.filter(item => {
        const plainContent = stripHtmlTags(item.content);
        const searchableText = `${item.title}\n\n${plainContent}`.toLowerCase();
        return searchableText.includes(trimmedQuery.toLowerCase());
    });

    // Sort by fullId (natural sort)
    const sorted = naturalSort(filteredItems, 'fullId');

    // Generate snippets
    return sorted.map(item => ({
        id: item.id,
        fullId: item.fullId,
        title: item.title,
        snippets: generateSnippets(item.title, item.content, trimmedQuery)
    }));
}
