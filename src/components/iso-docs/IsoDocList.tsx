'use client';

import { useState, useMemo } from 'react';

type IsoDoc = {
    id: number;
    itemFullId: string;
    itemTitle: string;
    version: number;
    isoDocPath: string | null;
    createdAt: Date;
    submittedBy: { username: string } | null;
    submitterName?: string | null;  // Fallback when user is deleted
    reviewedBy: { username: string } | null;
    item?: { fullId: string; title: string } | null;
    qcApproval?: {
        status: string;
        revisionCount: number;
    } | null;
};

type SortKey = 'itemFullId' | 'itemTitle' | 'version' | 'createdAt' | 'submittedBy';
type SortOrder = 'asc' | 'desc';

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
            setSortOrder('asc'); // Default to ascending for new sort key
        }
    };

    const getSortIcon = (key: SortKey) => {
        if (sortKey !== key) return '↕️';
        return sortOrder === 'asc' ? '↑' : '↓';
    };

    if (docs.length === 0) {
        return (
            <div className="glass" style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: 'var(--color-text-muted)',
                borderRadius: 'var(--radius-lg)'
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                <p>目前沒有品質文件記錄</p>
            </div>
        );
    }

    return (
        <div className="glass" style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            marginTop: '2rem'
        }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem'
                }}>
                    <thead>
                        <tr style={{
                            borderBottom: '2px solid var(--color-border)',
                            textAlign: 'left'
                        }}>
                            <th style={thStyle} onClick={() => handleSort('itemFullId')}>
                                項目編號 {getSortIcon('itemFullId')}
                            </th>
                            <th style={thStyle} onClick={() => handleSort('itemTitle')}>
                                標題 {getSortIcon('itemTitle')}
                            </th>
                            <th style={thStyle} onClick={() => handleSort('version')}>
                                版本 {getSortIcon('version')}
                            </th>
                            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('createdAt')}>
                                日期 {getSortIcon('createdAt')}
                            </th>
                            <th style={thStyle} onClick={() => handleSort('submittedBy')}>
                                提交 / 核准 {getSortIcon('submittedBy')}
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
                        {sortedDocs.map(doc => (
                            <tr
                                key={doc.id}
                                style={{
                                    borderBottom: '1px solid var(--color-border)',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                            >
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                        fontFamily: 'var(--font-geist-mono)',
                                        color: 'var(--color-primary)',
                                        fontWeight: 600
                                    }}>
                                        {doc.item?.fullId || doc.itemFullId}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <div style={{
                                        maxWidth: '300px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {doc.item?.title || doc.itemTitle}
                                    </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                        padding: '0.2rem 0.5rem',
                                        backgroundColor: 'var(--color-info-bg)', // changed from primary-soft to match history "UPDATE" color loosely or keep distinct
                                        color: 'var(--color-info)',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600
                                    }}>
                                        v{doc.version}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                    {new Date(doc.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <div>{doc.submittedBy?.username || doc.submitterName || '(已刪除)'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        {doc.reviewedBy?.username || '-'}
                                    </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                    {doc.qcApproval?.status === 'REVISION_REQUIRED' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                            <span style={{
                                                padding: '0.2rem 0.5rem',
                                                backgroundColor: 'rgba(249, 168, 37, 0.15)',
                                                color: '#d97706',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                border: '1px solid rgba(249, 168, 37, 0.3)'
                                            }}>
                                                待修訂
                                            </span>
                                            {doc.qcApproval.revisionCount > 0 && (
                                                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                                    (修訂 {doc.qcApproval.revisionCount} 次)
                                                </span>
                                            )}
                                        </div>
                                    ) : doc.qcApproval?.status === 'COMPLETED' ? (
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                            color: '#10b981',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}>
                                            已完成
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>-</span>
                                    )}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    {doc.isoDocPath ? (
                                        <a
                                            href={doc.isoDocPath}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline"
                                            style={{
                                                padding: '0.25rem 0.75rem',
                                                fontSize: '0.85rem',
                                                textDecoration: 'none',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                            }}
                                        >
                                            📄 下載
                                        </a>
                                    ) : (
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
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
    fontSize: '0.9rem',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap'
};
