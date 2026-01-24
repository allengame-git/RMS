/**
 * @file IsoDocProjectCard.tsx
 * @description 品質文件專案入口卡片元件
 *
 * 在品質文件總覽頁面中，以卡片形式展示各專案的統計資訊。
 *
 * ## 核心功能
 * - **專案概覽**：顯示專案標題、代碼前綴。
 * - **統計數據**：顯示該專案下擁有的品質文件總數。
 * - **最後更新**：即時呈現最後一筆品質文件的產生日期。
 * - **互動效果**：具備懸浮位移與陰影加深效果。
 *
 * @see /src/app/iso-docs - 專案導覽頁面
 */

'use client';

import Link from 'next/link';
import { formatDate } from '@/lib/date-utils';

type IsoDocProjectCardProps = {
    id: number;
    title: string;
    codePrefix: string;
    isoDocCount: number;
    lastUpdated: Date | null;
};

export default function IsoDocProjectCard({ id, title, codePrefix, isoDocCount, lastUpdated }: IsoDocProjectCardProps) {
    return (
        <Link href={`/iso-docs/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div
                className="glass"
                style={{
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-lg)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid var(--color-border)'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1rem'
                }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            marginBottom: '0.4rem',
                            color: 'var(--color-text-main)'
                        }}>
                            {title}
                        </h2>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-muted)',
                            fontFamily: 'var(--font-geist-mono)'
                        }}>
                            {codePrefix}
                        </div>
                    </div>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--color-primary-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>
                </div>

                <div style={{
                    marginTop: 'auto',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    color: 'var(--color-text-muted)'
                }}>
                    <div>
                        <span style={{
                            fontWeight: 600,
                            color: 'var(--color-primary)'
                        }}>
                            {isoDocCount}
                        </span>
                        <span> 份文件</span>
                    </div>
                    <div>
                        {lastUpdated ? `更新於 ${formatDate(lastUpdated)}` : '尚無文件'}
                    </div>
                </div>
            </div>
        </Link>
    );
}
