/**
 * @file RecentUpdatesTable.tsx
 * @description 最近更新紀錄表格元件
 *
 * 顯示系統中最近的項目和檔案變更紀錄。
 *
 * ## 核心功能
 * - 表格式顯示更新紀錄
 * - 項目/檔案類型過濾
 * - 操作類型標籤（新增/編輯/刪除/還原）
 * - 相對時間顯示
 * - 點擊導航到詳情
 *
 * ## Props
 * - `updates`：更新紀錄陣列
 *
 * ## 紀錄結構
 * - `type`：ITEM 或 FILE
 * - `changeType`：CREATE, UPDATE, DELETE, RESTORE
 * - `identifier`：項目編號或檔案編碼
 * - `name`：項目標題或檔案名稱
 * - `submittedBy`：提交者
 * - `reviewedBy`：核准者
 *
 * ## 過濾選項
 * - 全部
 * - 僅項目
 * - 僅檔案
 *
 * @see /src/app/page.tsx - 首頁（使用此元件）
 * @see /src/actions/history.ts - 取得更新紀錄
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDate } from '@/lib/date-utils';

type UpdateRecord = {
    id: string;
    type: 'ITEM' | 'FILE';
    changeType: string;
    identifier: string;
    name: string;
    projectTitle: string;
    submittedBy: string;
    reviewedBy: string | null;
    createdAt: Date;
    targetId?: number | null;
};

// 相對時間格式化
function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '剛剛';
    if (minutes < 60) return `${minutes} 分鐘前`;
    if (hours < 24) return `${hours} 小時前`;
    if (days < 7) return `${days} 天前`;
    return formatDate(date);
}

// 操作類型標籤
function getChangeTypeLabel(changeType: string): { label: string; color: string; bgColor: string } {
    switch (changeType) {
        case 'CREATE': return { label: '新增', color: '#16a34a', bgColor: '#dcfce7' };
        case 'UPDATE': return { label: '編輯', color: '#ca8a04', bgColor: '#fef9c3' };
        case 'DELETE': return { label: '刪除', color: '#dc2626', bgColor: '#fee2e2' };
        case 'RESTORE': return { label: '還原', color: '#2563eb', bgColor: '#dbeafe' };
        default: return { label: changeType, color: '#6b7280', bgColor: '#f3f4f6' };
    }
}

// 類型標籤元件
const TypeBadge = ({ type }: { type: 'ITEM' | 'FILE' }) => {
    const isItem = type === 'ITEM';
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 600,
            backgroundColor: isItem ? '#ede9fe' : '#e0f2fe',
            color: isItem ? '#7c3aed' : '#0284c7'
        }}>
            {isItem ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
            ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
            )}
            {isItem ? '項目' : '檔案'}
        </span>
    );
};

export default function RecentUpdatesTable({ updates }: { updates: UpdateRecord[] }) {
    const [filter, setFilter] = useState<'ALL' | 'ITEM' | 'FILE'>('ALL');

    // 篩選資料
    const filteredUpdates = filter === 'ALL'
        ? updates
        : updates.filter(u => u.type === filter);

    return (
        <div className="glass" style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)'
        }}>
            {/* Header with filter */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <h2 style={{
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        marginBottom: '0.25rem',
                        color: 'var(--color-text-main)'
                    }}>
                        最近更新紀錄
                    </h2>
                    <span style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)'
                    }}>
                        共 {filteredUpdates.length} 筆紀錄
                    </span>
                </div>

                {/* Filter Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    padding: '0.3rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)'
                }}>
                    {(['ALL', 'ITEM', 'FILE'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: filter === f ? 600 : 400,
                                backgroundColor: filter === f ? 'var(--color-primary)' : 'transparent',
                                color: filter === f ? 'white' : 'var(--color-text)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {f === 'ALL' ? '全部' : f === 'ITEM' ? '項目' : '檔案'}
                        </button>
                    ))}
                </div>
            </div>

            {filteredUpdates.length === 0 ? (
                <div style={{
                    color: 'var(--color-text-muted)',
                    textAlign: 'center',
                    padding: '3rem 2rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-border)'
                }}>
                    <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ marginBottom: '0.75rem', opacity: 0.4 }}
                    >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        {filter === 'ALL' ? '尚無更新紀錄' : `尚無${filter === 'ITEM' ? '項目' : '檔案'}更新紀錄`}
                    </p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.85rem'
                    }}>
                        <thead>
                            <tr style={{
                                borderBottom: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-bg-elevated)',
                                textAlign: 'left'
                            }}>
                                <th style={thStyle}>類型</th>
                                <th style={thStyle}>操作</th>
                                <th style={thStyle}>編號 / 名稱</th>
                                <th style={thStyle}>專案 / 年度</th>
                                <th style={thStyle}>提交者</th>
                                <th style={thStyle}>核准者</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>時間</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUpdates.map((update) => {
                                const changeInfo = getChangeTypeLabel(update.changeType);
                                return (
                                    <tr
                                        key={update.id}
                                        style={{
                                            borderBottom: '1px solid var(--color-border)',
                                            transition: 'background-color 0.15s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                                    >
                                        <td style={tdStyle}>
                                            <TypeBadge type={update.type} />
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                backgroundColor: changeInfo.bgColor,
                                                color: changeInfo.color,
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                            }}>
                                                {changeInfo.label}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <div>
                                                {update.targetId ? (
                                                    <Link
                                                        href={update.type === 'ITEM' ? `/items/${update.targetId}` : `/datafiles/${update.targetId}`}
                                                        style={{
                                                            fontFamily: 'var(--font-geist-mono)',
                                                            color: 'var(--color-primary)',
                                                            fontWeight: 600,
                                                            textDecoration: 'none',
                                                            fontSize: '0.8rem'
                                                        }}
                                                    >
                                                        {update.identifier}
                                                    </Link>
                                                ) : (
                                                    <span style={{
                                                        fontFamily: 'var(--font-geist-mono)',
                                                        color: 'var(--color-primary)',
                                                        fontWeight: 600,
                                                        fontSize: '0.8rem'
                                                    }}>
                                                        {update.identifier}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--color-text-muted)',
                                                marginTop: '0.2rem',
                                                maxWidth: '180px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {update.targetId ? (
                                                    <Link
                                                        href={update.type === 'ITEM' ? `/items/${update.targetId}` : `/datafiles/${update.targetId}`}
                                                        style={{ color: 'inherit', textDecoration: 'none' }}
                                                    >
                                                        {update.name}
                                                    </Link>
                                                ) : (
                                                    update.name
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                            {update.projectTitle}
                                        </td>
                                        <td style={tdStyle}>
                                            {update.submittedBy}
                                        </td>
                                        <td style={{ ...tdStyle, color: update.reviewedBy ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                            {update.reviewedBy || '—'}
                                        </td>
                                        <td style={{
                                            ...tdStyle,
                                            textAlign: 'right',
                                            color: 'var(--color-text-muted)',
                                            whiteSpace: 'nowrap',
                                            fontSize: '0.8rem'
                                        }}>
                                            {formatRelativeTime(update.createdAt)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.025em'
};

const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    verticalAlign: 'middle'
};
