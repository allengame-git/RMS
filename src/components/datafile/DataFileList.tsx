'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

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

export default function DataFileList({
    files,
    canEdit
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

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '📦';
        if (mimeType.includes('video')) return '🎬';
        if (mimeType.includes('audio')) return '🎵';
        return '📁';
    };

    const getSortIcon = (key: SortKey) => {
        if (sortKey !== key) return '↕️';
        return sortOrder === 'asc' ? '↑' : '↓';
    };

    if (files.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: 'var(--color-text-muted)'
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                <p>目前沒有檔案</p>
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
                gap: '1rem'
            }}>
                {/* View Toggle */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setViewMode('card')}
                        className={`btn ${viewMode === 'card' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem' }}
                    >
                        🗂️ 卡片
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem' }}
                    >
                        📋 清單
                    </button>
                </div>

                {/* Sort Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>排序：</span>
                    <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as SortKey)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text)',
                            cursor: 'pointer'
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
                        style={{ padding: '0.5rem 0.75rem' }}
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
                    gap: '1.5rem'
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
                                    padding: '1.5rem',
                                    borderRadius: 'var(--radius-lg)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    border: '2px solid transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '';
                                    e.currentTarget.style.borderColor = 'transparent';
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '1rem'
                                }}>
                                    <span style={{ fontSize: '2rem' }}>
                                        {getFileIcon(file.mimeType)}
                                    </span>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        backgroundColor: 'var(--color-primary-soft)',
                                        color: 'var(--color-primary)',
                                        borderRadius: '999px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600
                                    }}>
                                        {file.dataYear}
                                    </span>
                                </div>
                                {/* Pending Badge */}
                                {file.hasPendingRequest && (
                                    <div style={{
                                        padding: '0.35rem 0.75rem',
                                        backgroundColor: 'var(--color-warning-soft)',
                                        color: 'var(--color-warning)',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        marginBottom: '0.75rem',
                                        display: 'inline-block'
                                    }}>
                                        ⏳ 審核中 ({file.pendingRequestType === 'FILE_UPDATE' ? '編輯' : file.pendingRequestType === 'FILE_DELETE' ? '刪除' : '新增'})
                                    </div>
                                )}
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: 600,
                                    marginBottom: '0.5rem',
                                    color: 'var(--color-text)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {file.dataName}
                                </h3>
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--color-text-muted)',
                                    marginBottom: '0.75rem',
                                    fontFamily: 'monospace'
                                }}>
                                    {file.dataCode}
                                </div>
                                <p style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--color-text-secondary)',
                                    marginBottom: '1rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    lineHeight: 1.5
                                }}>
                                    {file.description}
                                </p>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-muted)',
                                    borderTop: '1px solid var(--color-border)',
                                    paddingTop: '0.75rem',
                                    marginTop: 'auto'
                                }}>
                                    <span>👤 {file.author}</span>
                                    <span>{formatFileSize(file.fileSize)}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
                                <th style={thStyle} onClick={() => handleSort('dataName')}>
                                    名稱 {getSortIcon('dataName')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('dataCode')}>
                                    編碼 {getSortIcon('dataCode')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('dataYear')}>
                                    年份 {getSortIcon('dataYear')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('author')}>
                                    作者 {getSortIcon('author')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('fileSize')}>
                                    大小 {getSortIcon('fileSize')}
                                </th>
                                <th style={thStyle} onClick={() => handleSort('createdAt')}>
                                    建立時間 {getSortIcon('createdAt')}
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
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-soft)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                                >
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span>{getFileIcon(file.mimeType)}</span>
                                            <span style={{ fontWeight: 500 }}>{file.dataName}</span>
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                        {file.dataCode}
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            backgroundColor: 'var(--color-primary-soft)',
                                            color: 'var(--color-primary)',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem'
                                        }}>
                                            {file.dataYear}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>{file.author}</td>
                                    <td style={tdStyle}>{formatFileSize(file.fileSize)}</td>
                                    <td style={{ ...tdStyle, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                        {new Date(file.createdAt).toLocaleDateString('zh-TW')}
                                    </td>
                                    <td style={tdStyle}>
                                        {file.hasPendingRequest ? (
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                backgroundColor: 'var(--color-warning-soft)',
                                                color: 'var(--color-warning)',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                            }}>
                                                ⏳ 審核中
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--color-success)', fontSize: '0.85rem' }}>✓</span>
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
    padding: '1rem',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap'
};

const tdStyle: React.CSSProperties = {
    padding: '1rem',
    verticalAlign: 'middle'
};
