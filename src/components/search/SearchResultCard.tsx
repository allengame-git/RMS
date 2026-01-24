/**
 * @file SearchResultCard.tsx
 * @description 單筆搜尋結果展示卡片
 *
 * 在搜尋結果列表中，用於顯示單個匹配項目的摘要資訊。
 *
 * ## 核心功能
 * - **項目識別**：顯示項目的 fullId 與標題。
 * - **關鍵字摘要**：調用 `HighlightedSnippet` 顯示匹配的文字內容及高亮。
 * - **詳情跳轉**：提供指向該項目詳情的直接連結。
 */

'use client';

import Link from 'next/link';
import type { SearchResult } from '@/actions/search';
import HighlightedSnippet from './HighlightedSnippet';

interface SearchResultCardProps {
    result: SearchResult;
}

export default function SearchResultCard({ result }: SearchResultCardProps) {
    return (
        <div className="glass" style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1rem',
            transition: 'transform 0.2s, box-shadow 0.2s'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <span style={{
                            fontFamily: 'var(--font-geist-mono)',
                            fontWeight: 'bold',
                            color: 'var(--color-primary)',
                            fontSize: '0.9rem'
                        }}>
                            {result.fullId}
                        </span>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>
                            {result.title}
                        </h3>
                    </div>

                    {result.snippets.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                            {result.snippets.map((snippet, index) => (
                                <HighlightedSnippet key={index} snippet={snippet} />
                            ))}
                        </div>
                    )}
                </div>

                <Link
                    href={`/items/${result.id}`}
                    className="btn btn-primary"
                    style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        whiteSpace: 'nowrap',
                        marginLeft: '1rem'
                    }}
                >
                    查看詳情
                </Link>
            </div>
        </div>
    );
}
