/**
 * @file RelatedItemsManager.tsx
 * @description 關聯項目管理元件
 *
 * 管理項目之間的關聯關係，支援新增、編輯和刪除關聯。
 *
 * ## 核心功能
 * - 新增關聯項目（輸入項目編號）
 * - 編輯關聯說明
 * - 移除關聯
 * - 顯示已關聯項目列表
 *
 * ## Props
 * - `sourceItemId`：來源項目 ID（若為 undefined 則為新增模式）
 * - `initialRelatedItems`：初始關聯項目列表
 * - `onChange`：關聯變更回調（用於表單模式）
 * - `canEdit`：是否允許編輯（預設 true）
 *
 * ## 操作模式
 * ### 表單模式（sourceItemId 為空）
 * - 用於新增/編輯項目表單
 * - 變更不會立即寫入資料庫
 * - 透過 `onChange` 回調傳遞給父元件
 *
 * ### 即時模式（sourceItemId 存在）
 * - 用於項目詳情頁面
 * - 變更會立即寫入資料庫
 * - 呼叫 Server Actions 執行操作
 *
 * @see /src/actions/item-relations.ts - 關聯項目 Server Actions
 * @see /src/components/item/CreateItemForm.tsx - 在新增表單中使用
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { addRelatedItem, removeRelatedItem, updateRelatedItemDescription } from '@/actions/item-relations';

interface RelatedItem {
    id: number;
    fullId: string;
    title: string;
    projectId: number;
    projectTitle?: string;
    description?: string | null;
}

interface RelatedItemsManagerProps {
    sourceItemId?: number;
    initialRelatedItems: RelatedItem[];
    onChange?: (items: RelatedItem[]) => void;
    canEdit?: boolean;
}

export default function RelatedItemsManager({ sourceItemId, initialRelatedItems, onChange, canEdit = true }: RelatedItemsManagerProps) {
    const [relatedItems, setRelatedItems] = useState<RelatedItem[]>(initialRelatedItems);

    // Search & Add state
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<RelatedItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedItem, setSelectedItem] = useState<RelatedItem | null>(null);

    const [newDescription, setNewDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Edit state
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [editDescription, setEditDescription] = useState('');

    // Debounce search effect
    useState(() => {
        // Init logic if needed
    });

    const handleSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await fetch(`/api/items/search?q=${encodeURIComponent(query)}&exclude=${sourceItemId || ''}`);
            if (res.ok) {
                const data = await res.json();
                // Filter out already added items
                const filtered = data.items.filter((item: RelatedItem) =>
                    !relatedItems.some(existing => existing.id === item.id)
                );
                setSearchResults(filtered);
                setShowResults(true);
            }
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    // Use a simple debounce wrapper or just timeout in useEffect
    const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

    const onSearchChange = (term: string) => {
        setSearchTerm(term);
        setSelectedItem(null); // Clear selection if typing

        if (timer) clearTimeout(timer);

        const newTimer = setTimeout(() => {
            handleSearch(term);
        }, 300);

        setTimer(newTimer);
    };

    const handleSelectItem = (item: RelatedItem) => {
        setSelectedItem(item);
        setSearchTerm(item.fullId); // Show fullId in input
        setShowResults(false);
        setError('');
    };

    const handleAdd = async () => {
        if (!selectedItem) {
            setError('請先從清單中選擇一個項目');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            if (onChange) {
                // Draft mode
                const newItem: RelatedItem = {
                    ...selectedItem,
                    description: newDescription.trim() || null
                };

                const updated = [...relatedItems, newItem];
                setRelatedItems(updated);
                onChange(updated);

                // Reset
                setSearchTerm('');
                setSelectedItem(null);
                setNewDescription('');
                setSearchResults([]);
            } else {
                // Server Action mode
                if (!sourceItemId) return;
                const result = await addRelatedItem(sourceItemId, selectedItem.fullId, newDescription.trim() || undefined);
                if (result.success) {
                    window.location.reload();
                } else {
                    setError(result.error || '新增失敗');
                }
            }
        } catch (err) {
            console.error(err);
            setError('發生錯誤');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemove = async (targetId: number) => {
        if (!confirm('確定要移除此關聯項目嗎？')) return;

        if (onChange) {
            const updated = relatedItems.filter(item => item.id !== targetId);
            setRelatedItems(updated);
            onChange(updated);
        } else {
            if (!sourceItemId) return;
            setIsLoading(true);
            try {
                // ...existing remove logic...
                const result = await removeRelatedItem(sourceItemId, targetId);
                if (result.success) {
                    window.location.reload();
                } else {
                    setError(result.error || '移除失敗');
                }
            } catch {
                setError('發生錯誤');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleStartEdit = (item: RelatedItem) => {
        setEditingItemId(item.id);
        setEditDescription(item.description || '');
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditDescription('');
    };

    const handleSaveEdit = async (targetId: number) => {
        // ...existing edit logic...
        if (onChange) {
            const updated = relatedItems.map(item =>
                item.id === targetId ? { ...item, description: editDescription.trim() || null } : item
            );
            setRelatedItems(updated);
            onChange(updated);
            setEditingItemId(null);
            setEditDescription('');
        } else {
            if (!sourceItemId) return;
            setIsLoading(true);
            try {
                const result = await updateRelatedItemDescription(sourceItemId, targetId, editDescription.trim());
                if (result.success) {
                    window.location.reload();
                } else {
                    setError(result.error || '更新失敗');
                }
            } catch {
                setError('發生錯誤');
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Group by project
    const groupedItems = relatedItems.reduce((acc, item) => {
        const projectTitle = item.projectTitle || `專案 ${item.projectId}`;
        if (!acc[projectTitle]) {
            acc[projectTitle] = [];
        }
        acc[projectTitle].push(item);
        return acc;
    }, {} as Record<string, RelatedItem[]>);

    // Portal related
    const inputRef = useRef<HTMLInputElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        if (showResults && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [showResults, searchResults]);

    return (
        <div style={{ marginTop: '2rem' }} className="glass">
            {/* ... header ... */}
            <h3 style={{
                marginBottom: '1rem',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                關聯項目
                <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 'normal',
                    color: 'var(--color-text-muted)'
                }}>
                    ({relatedItems.length})
                </span>
            </h3>

            {/* ... items list ... */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {relatedItems.length === 0 && (
                    <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        尚無關聯項目
                    </p>
                )}
                {/* ... existing grouped items render ... */}
                {Object.entries(groupedItems).map(([projectTitle, items]) => (
                    <div key={projectTitle}>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-muted)',
                            marginBottom: '0.5rem',
                            fontWeight: 600
                        }}>
                            {projectTitle}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {items.map(item => (
                                <div key={item.id} style={{
                                    padding: '1rem',
                                    backgroundColor: 'var(--color-bg-elevated)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    transition: 'box-shadow 0.2s'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: (item.description || editingItemId === item.id) ? '0.5rem' : 0
                                    }}>
                                        <div>
                                            <Link
                                                href={`/items/${item.id}`}
                                                target="_blank"
                                                style={{
                                                    fontWeight: 'bold',
                                                    fontFamily: 'var(--font-geist-mono)',
                                                    color: 'var(--color-primary)',
                                                    fontSize: '0.95rem',
                                                    textDecoration: 'none'
                                                }}
                                            >
                                                {item.fullId}
                                            </Link>
                                            <span style={{
                                                marginLeft: '0.75rem',
                                                color: 'var(--color-text)'
                                            }}>
                                                {item.title}
                                            </span>
                                        </div>
                                        {canEdit && (
                                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                                {editingItemId !== item.id && (
                                                    <button
                                                        onClick={() => handleStartEdit(item)}
                                                        disabled={isLoading}
                                                        className="btn-text"
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        編輯
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleRemove(item.id)}
                                                    disabled={isLoading}
                                                    className="btn-text-danger"
                                                    style={{ fontSize: '0.75rem' }}
                                                >
                                                    移除
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Editing mode */}
                                    {editingItemId === item.id ? (
                                        <div style={{
                                            marginTop: '0.5rem',
                                            display: 'flex',
                                            gap: '0.5rem',
                                            alignItems: 'center'
                                        }}>
                                            <input
                                                type="text"
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSaveEdit(item.id);
                                                    } else if (e.key === 'Escape') {
                                                        handleCancelEdit();
                                                    }
                                                }}
                                                placeholder="描述說明"
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
                                                onClick={() => handleSaveEdit(item.id)}
                                                disabled={isLoading}
                                                className="btn btn-primary btn-sm"
                                            >
                                                儲存
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="btn btn-outline btn-sm"
                                            >
                                                取消
                                            </button>
                                        </div>
                                    ) : item.description && (
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--color-text-muted)',
                                            paddingLeft: '0.5rem',
                                            borderLeft: '2px solid var(--color-border)',
                                            marginTop: '0.5rem'
                                        }}>
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

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
                        新增關聯項目
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        {/* Search Combobox Area */}
                        <div style={{ width: '300px' }}>
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onFocus={() => searchTerm && setShowResults(true)}
                                // Disable auto-close on blur to allow clicking dropdown items
                                // onBlur={() => setTimeout(() => setShowResults(false), 200)}
                                placeholder="搜尋編號或標題..."
                                style={{
                                    width: '100%',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--color-border)',
                                    fontFamily: 'var(--font-geist-mono)',
                                    fontSize: '0.9rem',
                                    borderColor: selectedItem ? 'var(--color-primary)' : 'var(--color-border)',
                                    backgroundColor: selectedItem ? 'var(--color-bg-elevated)' : 'var(--color-bg)'
                                }}
                            />

                            {/* Search Results Dropdown - Portal to Body */}
                            {showResults && searchResults.length > 0 && typeof document !== 'undefined' && createPortal(
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: dropdownPosition.top,
                                        left: dropdownPosition.left,
                                        width: dropdownPosition.width,
                                        maxHeight: '240px',
                                        overflowY: 'auto',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-sm)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        zIndex: 99999, // Super high z-index
                                        marginTop: '0'
                                    }}
                                >
                                    {searchResults.map(result => (
                                        <div
                                            key={result.id}
                                            onClick={() => handleSelectItem(result)}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid var(--color-border)',
                                                transition: 'background-color 0.15s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.85rem' }}>
                                                {result.fullId}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                                                {result.title}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                {result.projectTitle}
                                            </div>
                                        </div>
                                    ))}
                                    {/* Overlay back to close */}
                                    <div
                                        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}
                                        onClick={() => setShowResults(false)}
                                    />
                                </div>,
                                document.body
                            )}

                            {isSearching && (
                                <div style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '0.75rem',
                                    color: 'var(--color-text-muted)'
                                }}>
                                    搜尋中...
                                </div>
                            )}
                        </div>

                        <input
                            type="text"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (selectedItem) handleAdd();
                                }
                            }}
                            placeholder="描述說明 (選填)"
                            style={{
                                flex: 1,
                                minWidth: '200px',
                                padding: '0.5rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                fontSize: '0.9rem'
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={isLoading || !selectedItem}
                            className="btn btn-primary"
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.9rem',
                                opacity: isLoading || !selectedItem ? 0.6 : 1
                            }}
                        >
                            {isLoading ? '新增中...' : '新增關聯'}
                        </button>
                    </div>
                </div>
            )}
            {error && <p style={{ color: 'var(--color-danger)', marginTop: '0.75rem', fontSize: '0.85rem' }}>{error}</p>}
        </div>
    );
}
