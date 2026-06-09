/**
 * @file HighlightedSnippet.tsx
 * @description 搜尋結果關鍵字高亮元件
 *
 * 在搜尋結果摘要中，根據指定的起始位置與長度，將匹配的文字區塊進行視覺高亮。
 *
 * ## 核心功能
 * - **精準切割**：將原始文字拆分為「前綴」、「匹配項」、「後綴」。
 * - **視覺強化**：使用 `<mark>` 標籤搭配顯眼的金色背景與陰影，提升可讀性。
 *
 * @param snippet 包含原始文字與匹配索引的物件
 */

'use client';

interface HighlightedSnippetProps {
    snippet: {
        text: string;
        matchStart: number;
        matchLength: number;
    };
}

export default function HighlightedSnippet({ snippet }: HighlightedSnippetProps) {
    const { text, matchStart, matchLength } = snippet;

    const before = text.substring(0, matchStart);
    const match = text.substring(matchStart, matchStart + matchLength);
    const after = text.substring(matchStart + matchLength);

    return (
        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
            {before}
            <mark style={{
                background: 'var(--color-warning)',
                color: 'var(--color-text-main)',
                fontWeight: '700',
                padding: '0.15rem 0.3rem',
                borderRadius: '3px',
                boxShadow: '0 0 0 2px rgba(249, 168, 37, 0.3)'
            }}>
                {match}
            </mark>
            {after}
        </div>
    );
}
