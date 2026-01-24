/**
 * @file SearchResultList.tsx
 * @description 全域搜尋結果列表元件
 *
 * 展示全系統項目全文檢索的結果清單。
 *
 * ## 核心功能
 * - **狀態處理**：處理「載入中」、「無結果」與「關鍵字太短」等邊界狀態。
 * - **結果摘要**：顯示符合條件的總筆數。
 * - **結果映射**：將搜尋結果映射為 `SearchResultCard` 進行精緻展現。
 *
 * ## 搜尋邏輯
 * - 僅在關鍵字長度 >= 2 時顯示結果。
 * - 配合 `actions/search.ts` 實現 Server-side 搜尋。
 *
 * @see /src/components/search/SearchResultCard.tsx - 單筆結果元件
 */

'use client';

import type { SearchResult } from '@/actions/search';
import SearchResultCard from './SearchResultCard';

interface SearchResultListProps {
    results: SearchResult[];
    query: string;
    loading: boolean;
}

export default function SearchResultList({ results, query, loading }: SearchResultListProps) {
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                搜尋中...
            </div>
        );
    }

    if (!query || query.length < 2) {
        return null;
    }

    if (results.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '3rem',
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--color-border)'
            }}>
                <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ marginBottom: '1rem', opacity: 0.4 }}
                >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                    <path d="M8 11h6" />
                </svg>
                <div style={{ fontSize: '1.1rem' }}>未找到包含「{query}」的項目</div>
                <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>請嘗試其他關鍵字</div>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '2rem' }}>
            <div style={{
                marginBottom: '1rem',
                fontSize: '0.95rem',
                color: 'var(--color-text-muted)',
                fontWeight: '500'
            }}>
                搜尋結果：找到 <strong style={{ color: 'var(--color-primary)' }}>{results.length}</strong> 個符合「{query}」的項目
            </div>

            {results.map(result => (
                <SearchResultCard key={result.id} result={result} />
            ))}
        </div>
    );
}
