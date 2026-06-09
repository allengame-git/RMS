/**
 * @file IsoDocList.tsx
 * @description 品質文件 (ISO/QC) 歷史列表元件
 *
 * 顯示專案或全系統中已簽核產生的 PDF 品質文件清單。
 *
 * ## 核心功能
 * - **表格式呈現**：包含項目編號、標題、版本、提交者資訊。
 * - **狀態標籤**：動態顯示簽核狀態（待簽核、已核准、待修訂等）。
 * - **排序功能**：支援按編號、標題、版本、日期與提交者進行雙向排序。
 * - **檔案下載**：提供 PDF 文件的直接下載連結。
 *
 * @see /src/app/iso-docs - 使用此元件的頁面
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/date-utils';

type IsoDoc = {
    id: number;
    itemFullId: string;
    itemTitle: string;
    version: number;
    isoDocPath: string | null;
    createdAt: Date;
    submittedBy: { username: string } | null;
    submitterName?: string | null;
    reviewedBy: { username: string } | null;
    item?: { fullId: string; title: string } | null;
    qcApproval?: {
        status: string;
        revisionCount: number;
    } | null;
};

type SortKey = 'itemFullId' | 'itemTitle' | 'version' | 'createdAt' | 'submittedBy';
type SortOrder = 'asc' | 'desc';

// 狀態標籤配置
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    'REVISION_REQUIRED': { label: '待修訂', color: 'var(--color-warning)', bgColor: 'rgba(249, 168, 37, 0.15)' },
    'REJECTED': { label: '已退回', color: 'var(--color-danger)', bgColor: 'rgba(198, 40, 40, 0.15)' },
    'COMPLETED': { label: '已完成', color: 'var(--color-success)', bgColor: 'rgba(46, 125, 50, 0.15)' },
    'PENDING_QC': { label: '待 QC 簽核', color: 'var(--color-warning)', bgColor: 'rgba(249, 168, 37, 0.15)' },
    'PENDING_PM': { label: '待 PM 簽核', color: 'var(--color-primary)', bgColor: 'rgba(59, 130, 246, 0.15)' },
    'APPROVED': { label: '已核准', color: 'var(--color-success)', bgColor: 'rgba(46, 125, 50, 0.15)' }
};

export default function IsoDocList({ docs }: { docs: IsoDoc[] }) {
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const sortedDocs = useMemo(() => {
        return [...docs].sort((a, b) => {
            let comparison = 0;
            switch (sortKey) {
                case 'itemFullId':
                    comparison = (a.item?.fullId || a.itemFullId).localeCompare(b.item?.fullId || b.itemFullId);
                    break;
                case 'itemTitle':
                    comparison = (a.item?.title || a.itemTitle).localeCompare(b.item?.title || b.itemTitle);
                    break;
                case 'version':
                    comparison = a.version - b.version;
                    break;
                case 'submittedBy': {
                    const aName = a.submittedBy?.username || a.submitterName || '';
                    const bName = b.submittedBy?.username || b.submitterName || '';
                    comparison = aName.localeCompare(bName);
                    break;
                }
                case 'createdAt':
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [docs, sortKey, sortOrder]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    const getSortIcon = (key: SortKey) => {
        if (sortKey !== key) return '';
        return sortOrder === 'asc' ? ' ↑' : ' ↓';
    };

    if (docs.length === 0) {
        return (
            <div className="glass" style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: 'var(--color-text-muted)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--color-border)'
            }}>
                <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ marginBottom: '1rem', opacity: 0.4 }}
                >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>目前沒有品質文件記錄</p>
            </div>
        );
    }

    return (
        <div className="glass" style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)'
        }}>
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
                            <th style={thStyle} onClick={() => handleSort('itemFullId')}>
                                項目編號{getSortIcon('itemFullId')}
                            </th>
                            <th style={thStyle} onClick={() => handleSort('itemTitle')}>
                                標題{getSortIcon('itemTitle')}
                            </th>
                            <th style={thStyle} onClick={() => handleSort('version')}>
                                版本{getSortIcon('version')}
                            </th>
                            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('createdAt')}>
                                日期{getSortIcon('createdAt')}
                            </th>
                            <th style={thStyle} onClick={() => handleSort('submittedBy')}>
                                提交 / 核准{getSortIcon('submittedBy')}
                            </th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>
                                狀態
                            </th>
                            <th style={thStyle}>
                                下載
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDocs.map(doc => {
                            const status = doc.qcApproval?.status;
                            const statusInfo = status ? statusConfig[status] : null;

                            return (
                                <tr
                                    key={doc.id}
                                    style={{
                                        borderBottom: '1px solid var(--color-border)',
                                        transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                                >
                                    <td style={tdStyle}>
                                        <Link
                                            href={`/admin/history/detail/${doc.id}`}
                                            style={{
                                                fontFamily: 'var(--font-geist-mono)',
                                                color: 'var(--color-primary)',
                                                fontWeight: 600,
                                                textDecoration: 'none',
                                                fontSize: '0.8rem'
                                            }}
                                        >
                                            {doc.item?.fullId || doc.itemFullId}
                                        </Link>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{
                                            maxWidth: '250px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {doc.item?.title || doc.itemTitle}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            backgroundColor: 'var(--color-primary-soft)',
                                            color: 'var(--color-primary)',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}>
                                            v{doc.version}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                        {formatDate(doc.createdAt)}
                                    </td>
                                    <td style={tdStyle}>
                                        <div>{doc.submittedBy?.username || doc.submitterName || '(已刪除)'}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                            {doc.reviewedBy?.username || '—'}
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        {statusInfo ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    backgroundColor: statusInfo.bgColor,
                                                    color: statusInfo.color,
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600
                                                }}>
                                                    {statusInfo.label}
                                                </span>
                                                {status === 'REVISION_REQUIRED' && doc.qcApproval && doc.qcApproval.revisionCount > 0 && (
                                                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                                                        修訂 {doc.qcApproval.revisionCount} 次
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        {doc.isoDocPath ? (
                                            <a
                                                href={doc.isoDocPath}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-outline"
                                                style={{
                                                    padding: '0.3rem 0.75rem',
                                                    fontSize: '0.75rem',
                                                    textDecoration: 'none',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem'
                                                }}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                下載
                                            </a>
                                        ) : (
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.025em'
};

const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    verticalAlign: 'middle'
};
