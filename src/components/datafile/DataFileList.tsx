/**
 * @file DataFileList.tsx
 * @description 資料檔案列表元件
 *
 * 顯示系統中的參考文獻/資料檔案列表，支援多種檢視模式。
 *
 * ## 核心功能
 * - 卡片/列表雙模式檢視
 * - 搜尋過濾
 * - 多欄位排序
 * - 年份篩選
 * - 檔案類型標籤
 *
 * ## 顯示資訊
 * - 檔案名稱/標題
 * - 資料代碼
 * - 資料年份
 * - 作者
 * - 檔案大小
 * - 上傳日期
 *
 * ## 排序選項
 * - 檔案名稱 (dataName)
 * - 資料代碼 (dataCode)
 * - 年份 (dataYear)
 * - 作者 (author)
 * - 檔案大小 (fileSize)
 * - 建立日期 (createdAt)
 *
 * ## 待審核標示
 * 若檔案有待審核的變更申請，會顯示狀態標籤。
 *
 * @see /src/app/datafiles/page.tsx - 資料檔案列表頁面
 * @see /src/actions/data-files.ts - 資料檔案 Server Actions
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/date-utils';

type DataFile = {
    id: number;
    dataYear: number;
    dataName: string;
    dataCode: string;
    author: string;
    description: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
    hasPendingRequest?: boolean;
    pendingRequestType?: string | null;
};

type SortKey = 'dataName' | 'dataCode' | 'dataYear' | 'author' | 'fileSize' | 'createdAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'card' | 'list';

const FileTypeIcon = ({ mimeType }: { mimeType: string }) => {
    const getLabel = () => {
        if (mimeType.startsWith('image/')) return 'IMG';
        if (mimeType.includes('pdf')) return 'PDF';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'XLS';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PPT';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'ZIP';
        if (mimeType.includes('video')) return 'VID';
        if (mimeType.includes('audio')) return 'AUD';
        return 'FILE';
    };

    const getColor = () => {
        if (mimeType.startsWith('image/')) return '#10b981';
        if (mimeType.includes('pdf')) return '#ef4444';
        if (mimeType.includes('word') || mimeType.includes('document')) return '#3b82f6';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '#22c55e';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '#f97316';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '#8b5cf6';
        if (mimeType.includes('video')) return '#ec4899';
        if (mimeType.includes('audio')) return '#06b6d4';
        return '#6b7280';
    };

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.35rem 0.6rem',
            backgroundColor: `${getColor()}15`,
            color: getColor(),
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 700,
            fontFamily: 'monospace',
            letterSpacing: '0.025em'
        }}>
            {getLabel()}
        </span>
    );
};

export default function DataFileList({
    files,
    canEdit: _canEdit
}: {
    files: DataFile[];
    canEdit: boolean;
}) {
    const [viewMode, setViewMode] = useState<ViewMode>('card');
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const sortedFiles = useMemo(() => {
        return [...files].sort((a, b) => {
            let comparison = 0;
            switch (sortKey) {
                case 'dataName':
                case 'dataCode':
                case 'author':
                    comparison = a[sortKey].localeCompare(b[sortKey]);
                    break;
                case 'dataYear':
                case 'fileSize':
                    comparison = a[sortKey] - b[sortKey];
                    break;
                case 'createdAt':
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [files, sortKey, sortOrder]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getSortIcon = (key: SortKey) => {
        if (sortKey !== key) return '';
        return sortOrder === 'asc' ? ' ↑' : ' ↓';
    };

    if (files.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: 'var(--color-text-muted)',
                backgroundColor: 'var(--color-bg-elevated)',
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
                    style={{ marginBottom: '1rem', opacity: 0.5 }}
                >
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                </svg>
                <p style={{ margin: 0, fontSize: '1rem' }}>目前沒有檔案</p>
            </div>
        );
    }

    return (
        <div>
            {/* Toolbar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)'
            }}>
                {/* View Toggle */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setViewMode('card')}
                        className={`btn ${viewMode === 'card' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        卡片
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" />
                            <line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                        清單
                    </button>
                </div>

                {/* Sort Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>排序：</span>
                    <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as SortKey)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text)',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        <option value="createdAt">建立時間</option>
                        <option value="dataName">名稱</option>
                        <option value="dataCode">編碼</option>
                        <option value="dataYear">年份</option>
                        <option value="author">作者</option>
                        <option value="fileSize">檔案大小</option>
                    </select>
                    <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="btn btn-outline"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    >
                        {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
                    </button>
                </div>
            </div>

            {/* Card View */}
            {viewMode === 'card' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '1.25rem'
                }}>
                    {sortedFiles.map(file => (
                        <Link
                            key={file.id}
                            href={`/datafiles/${file.id}`}
                            style={{ textDecoration: 'none' }}
                        >
                            <div
                                className="glass"
                                style={{
                                    padding: '1.25rem',
                                    borderRadius: 'var(--radius-lg)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    border: '1px solid var(--color-border)',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column'
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
                                    alignItems: 'center',
                                    marginBottom: '1rem'
                                }}>
                                    <FileTypeIcon mimeType={file.mimeType} />
                                    <span style={{
                                        padding: '0.25rem 0.6rem',
                                        backgroundColor: 'var(--color-primary-soft)',
                                        color: 'var(--color-primary)',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600
                                    }}>
                                        {file.dataYear}
                                    </span>
                                </div>

                                {/* Pending Badge */}
                                {file.hasPendingRequest && (
                                    <div style={{
                                        padding: '0.35rem 0.6rem',
                                        backgroundColor: 'var(--color-warning-soft)',
                                        color: 'var(--color-warning)',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        marginBottom: '0.75rem',
                                        display: 'inline-block',
                                        width: 'fit-content'
                                    }}>
                                        審核中 ({file.pendingRequestType === 'FILE_UPDATE' ? '編輯' : file.pendingRequestType === 'FILE_DELETE' ? '刪除' : '新增'})
                                    </div>
                                )}

                                <h3 style={{
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    marginBottom: '0.4rem',
                                    color: 'var(--color-text)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {file.dataName}
                                </h3>
                                <div style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-muted)',
                                    marginBottom: '0.6rem',
                                    fontFamily: 'monospace'
                                }}>
                                    {file.dataCode}
                                </div>
                                <p style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--color-text-secondary)',
                                    marginBottom: '1rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    lineHeight: 1.5,
                                    flex: 1
                                }}>
                                    {file.description}
                                </p>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.75rem',
                                    color: 'var(--color-text-muted)',
                                    borderTop: '1px solid var(--color-border)',
                                    paddingTop: '0.75rem',
                                    marginTop: 'auto'
                                }}>
                                    <span>{file.author}</span>
                                    <span>{formatFileSize(file.fileSize)}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
                                <th style={thStyle} onClick={() => handleSort('dataName')}>
                                    名稱{getSortIcon('dataName')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('dataCode')}>
                                    編碼{getSortIcon('dataCode')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('dataYear')}>
                                    年份{getSortIcon('dataYear')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('author')}>
                                    作者{getSortIcon('author')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('fileSize')}>
                                    大小{getSortIcon('fileSize')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('createdAt')}>
                                    建立時間{getSortIcon('createdAt')}
                                </th>
                                <th style={thStyle}>
                                    狀態
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedFiles.map(file => (
                                <tr
                                    key={file.id}
                                    style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                                    onClick={() => window.location.href = `/datafiles/${file.id}`}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                                >
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <FileTypeIcon mimeType={file.mimeType} />
                                            <span style={{ fontWeight: 500 }}>{file.dataName}</span>
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {file.dataCode}
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
                                            {file.dataYear}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>{file.author}</td>
                                    <td style={{ ...tdStyle, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{formatFileSize(file.fileSize)}</td>
                                    <td style={{ ...tdStyle, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                        {formatDate(file.createdAt)}
                                    </td>
                                    <td style={tdStyle}>
                                        {file.hasPendingRequest ? (
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                backgroundColor: 'var(--color-warning-soft)',
                                                color: 'var(--color-warning)',
                                                borderRadius: '4px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600
                                            }}>
                                                審核中
                                            </span>
                                        ) : (
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                backgroundColor: 'var(--color-success-soft)',
                                                color: 'var(--color-success)',
                                                borderRadius: '4px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600
                                            }}>
                                                正常
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '0.875rem 1rem',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--color-border)'
};

const tdStyle: React.CSSProperties = {
    padding: '0.875rem 1rem',
    verticalAlign: 'middle'
};
