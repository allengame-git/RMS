'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Reference {
    fileId: number;
    dataCode: string;
    dataName: string;
    dataYear: number;
    author: string;
    fileName: string;
    filePath?: string;
    citation: string | null;
}

interface SearchResult {
    id: number;
    dataCode: string;
    dataName: string;
    dataYear: number;
    author: string;
    fileName: string;
    filePath: string;
}

interface ReferencesManagerProps {
    initialReferences?: Reference[];
    onChange?: (references: Reference[]) => void;
    canEdit?: boolean;
}

export default function ReferencesManager({
    initialReferences = [],
    onChange,
    canEdit = true
}: ReferencesManagerProps) {
    const [references, setReferences] = useState<Reference[]>(initialReferences);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [newCitation, setNewCitation] = useState('');
    const [selectedFile, setSelectedFile] = useState<SearchResult | null>(null);
    const [error, setError] = useState('');

    // Edit state
    const [editingFileId, setEditingFileId] = useState<number | null>(null);
    const [editCitation, setEditCitation] = useState('');

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setError('');

        try {
            const response = await fetch(`/api/datafiles/search?q=${encodeURIComponent(searchQuery.trim())}`);
            if (!response.ok) {
                throw new Error('搜尋失敗');
            }
            const data = await response.json();
            setSearchResults(data.files || []);
        } catch (err) {
            setError('搜尋失敗，請稍後再試');
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectFile = (file: SearchResult) => {
        if (references.some(r => r.fileId === file.id)) {
            setError('此檔案已被引用');
            return;
        }
        setSelectedFile(file);
        setError('');
    };

    const handleAddReference = () => {
        if (!selectedFile) return;

        const newRef: Reference = {
            fileId: selectedFile.id,
            dataCode: selectedFile.dataCode,
            dataName: selectedFile.dataName,
            dataYear: selectedFile.dataYear,
            author: selectedFile.author,
            fileName: selectedFile.fileName,
            filePath: selectedFile.filePath,
            citation: newCitation.trim() || null,
        };

        const updated = [...references, newRef];
        setReferences(updated);
        onChange?.(updated);

        // Reset
        setSelectedFile(null);
        setNewCitation('');
        setSearchResults([]);
        setSearchQuery('');
    };

    const handleRemove = (fileId: number) => {
        if (!confirm('確定要移除此參考文獻嗎？')) return;

        const updated = references.filter(r => r.fileId !== fileId);
        setReferences(updated);
        onChange?.(updated);
    };

    const handleStartEdit = (ref: Reference) => {
        setEditingFileId(ref.fileId);
        setEditCitation(ref.citation || '');
    };

    const handleSaveEdit = () => {
        if (editingFileId === null) return;

        const updated = references.map(r =>
            r.fileId === editingFileId
                ? { ...r, citation: editCitation.trim() || null }
                : r
        );
        setReferences(updated);
        onChange?.(updated);
        setEditingFileId(null);
        setEditCitation('');
    };

    const handleCancelEdit = () => {
        setEditingFileId(null);
        setEditCitation('');
    };

    // Group by year (descending)
    const groupedByYear = references.reduce((acc, ref) => {
        const year = ref.dataYear;
        if (!acc[year]) acc[year] = [];
        acc[year].push(ref);
        return acc;
    }, {} as Record<number, Reference[]>);

    const sortedYears = Object.keys(groupedByYear)
        .map(Number)
        .sort((a, b) => b - a);

    return (
        <div style={{ marginTop: '2rem' }} className="glass">
            <h3 style={{
                marginBottom: '1rem',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                📚 參考文獻
                <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 'normal',
                    color: 'var(--color-text-muted)'
                }}>
                    ({references.length})
                </span>
            </h3>

            {/* References List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {references.length === 0 && (
                    <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        尚無參考文獻
                    </p>
                )}

                {sortedYears.map(year => (
                    <div key={year}>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'var(--color-text-muted)',
                            marginBottom: '0.5rem',
                            fontWeight: 600,
                            borderBottom: '1px dashed var(--color-border)',
                            paddingBottom: '0.25rem'
                        }}>
                            {year} 年
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {groupedByYear[year].map(ref => (
                                <div key={ref.fileId} style={{
                                    padding: '1rem',
                                    backgroundColor: 'var(--color-bg-elevated)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                <span style={{ fontSize: '1.1rem' }}>📄</span>
                                                <Link
                                                    href={`/api/datafiles/${ref.fileId}/download`}
                                                    target="_blank"
                                                    style={{
                                                        fontWeight: 'bold',
                                                        color: 'var(--color-primary)',
                                                        textDecoration: 'none'
                                                    }}
                                                >
                                                    {ref.dataName}
                                                </Link>
                                            </div>
                                            <div style={{
                                                fontSize: '0.85rem',
                                                color: 'var(--color-text-muted)',
                                                marginLeft: '1.6rem'
                                            }}>
                                                作者：{ref.author}
                                            </div>

                                            {/* Citation display or edit */}
                                            {editingFileId === ref.fileId ? (
                                                <div style={{
                                                    marginTop: '0.5rem',
                                                    marginLeft: '1.6rem',
                                                    display: 'flex',
                                                    gap: '0.5rem',
                                                    alignItems: 'center'
                                                }}>
                                                    <input
                                                        type="text"
                                                        value={editCitation}
                                                        onChange={(e) => setEditCitation(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleSaveEdit();
                                                            } else if (e.key === 'Escape') {
                                                                handleCancelEdit();
                                                            }
                                                        }}
                                                        placeholder="引用說明"
                                                        autoFocus
                                                        style={{
                                                            flex: 1,
                                                            padding: '0.5rem 0.75rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            border: '1px solid var(--color-primary)',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    />
                                                    <button
                                                        onClick={handleSaveEdit}
                                                        style={{
                                                            padding: '0.5rem 0.75rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            border: 'none',
                                                            background: 'var(--color-primary)',
                                                            color: 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    >
                                                        儲存
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        style={{
                                                            padding: '0.5rem 0.75rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            border: '1px solid var(--color-border)',
                                                            background: 'transparent',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    >
                                                        取消
                                                    </button>
                                                </div>
                                            ) : ref.citation && (
                                                <div style={{
                                                    marginTop: '0.5rem',
                                                    marginLeft: '1.6rem',
                                                    fontSize: '0.85rem',
                                                    color: 'var(--color-text)',
                                                    paddingLeft: '0.5rem',
                                                    borderLeft: '2px solid var(--color-primary)',
                                                    fontStyle: 'italic'
                                                }}>
                                                    「{ref.citation}」
                                                </div>
                                            )}
                                        </div>

                                        {canEdit && editingFileId !== ref.fileId && (
                                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => handleStartEdit(ref)}
                                                    style={{
                                                        color: 'var(--color-primary)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid currentColor',
                                                        background: 'transparent',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    編輯
                                                </button>
                                                <button
                                                    onClick={() => handleRemove(ref.fileId)}
                                                    style={{
                                                        color: 'var(--color-danger, #ef4444)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid currentColor',
                                                        background: 'transparent',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    移除
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Reference Section */}
            {canEdit && (
                <div style={{
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        marginBottom: '0.25rem'
                    }}>
                        🔍 搜尋檔案
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSearch();
                                }
                            }}
                            placeholder="輸入編碼、名稱、作者或年份..."
                            style={{
                                flex: 1,
                                padding: '0.5rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                fontSize: '0.9rem'
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleSearch}
                            disabled={isSearching || !searchQuery.trim()}
                            className="btn btn-outline"
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.9rem',
                                opacity: isSearching || !searchQuery.trim() ? 0.6 : 1
                            }}
                        >
                            {isSearching ? '搜尋中...' : '搜尋'}
                        </button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div style={{
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-bg-elevated)'
                        }}>
                            {searchResults.map(file => {
                                const isSelected = selectedFile?.id === file.id;
                                const isAdded = references.some(r => r.fileId === file.id);
                                return (
                                    <div
                                        key={file.id}
                                        onClick={() => !isAdded && handleSelectFile(file)}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            borderBottom: '1px solid var(--color-border)',
                                            cursor: isAdded ? 'not-allowed' : 'pointer',
                                            backgroundColor: isSelected ? 'rgba(0, 131, 143, 0.1)' : 'transparent',
                                            opacity: isAdded ? 0.5 : 1,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500 }}>
                                                📄 {file.dataName}
                                                <span style={{
                                                    marginLeft: '0.5rem',
                                                    fontSize: '0.8rem',
                                                    color: 'var(--color-text-muted)'
                                                }}>
                                                    ({file.dataYear})
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                作者：{file.author} | {file.dataCode}
                                            </div>
                                        </div>
                                        {isAdded ? (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>已引用</span>
                                        ) : isSelected ? (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>✓ 已選取</span>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Citation input and add button */}
                    {selectedFile && (
                        <div style={{
                            padding: '1rem',
                            backgroundColor: 'rgba(0, 131, 143, 0.05)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-primary)'
                        }}>
                            <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                                選取的檔案：{selectedFile.dataName}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={newCitation}
                                    onChange={(e) => setNewCitation(e.target.value)}
                                    placeholder="引用說明（選填）"
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.9rem'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddReference}
                                    className="btn btn-primary"
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                >
                                    加入引用
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedFile(null);
                                        setNewCitation('');
                                    }}
                                    className="btn btn-outline"
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <p style={{ color: 'var(--color-danger)', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                    {error}
                </p>
            )}
        </div>
    );
}
