'use client';

import { useState } from 'react';
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
    const [newItemId, setNewItemId] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    // Edit state
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [editDescription, setEditDescription] = useState('');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemId.trim()) return;

        setIsLoading(true);
        setError('');

        try {
            if (onChange) {
                // Draft mode - validate via API
                const response = await fetch(`/api/items/lookup?fullId=${newItemId.trim()}`);
                if (!response.ok) {
                    const data = await response.json();
                    setError(data.error || '項目不存在');
                    return;
                }
                const itemData = await response.json();

                if (relatedItems.some(i => i.id === itemData.id)) {
                    setError('項目已經是關聯項目');
                    return;
                }

                const newItem: RelatedItem = {
                    id: itemData.id,
                    fullId: itemData.fullId,
                    title: itemData.title,
                    projectId: itemData.projectId,
                    description: newDescription.trim() || null
                };

                const updated = [...relatedItems, newItem];
                setRelatedItems(updated);
                onChange(updated);
                setNewItemId('');
                setNewDescription('');
            } else {
                // Server Action mode
                if (!sourceItemId) return;
                const result = await addRelatedItem(sourceItemId, newItemId.trim(), newDescription.trim() || undefined);
                if (result.success) {
                    setNewItemId('');
                    setNewDescription('');
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
        if (onChange) {
            // Draft mode - update locally
            const updated = relatedItems.map(item =>
                item.id === targetId ? { ...item, description: editDescription.trim() || null } : item
            );
            setRelatedItems(updated);
            onChange(updated);
            setEditingItemId(null);
            setEditDescription('');
        } else {
            // Server Action mode
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {relatedItems.length === 0 && (
                    <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        尚無關聯項目
                    </p>
                )}

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
                                                    fontSize: '0.95rem'
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
                                                )}
                                                <button
                                                    onClick={() => handleRemove(item.id)}
                                                    disabled={isLoading}
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
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            value={newItemId}
                            onChange={(e) => setNewItemId(e.target.value)}
                            placeholder="項目編號 (如 SI-1-2)"
                            style={{
                                width: '160px',
                                padding: '0.5rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                fontFamily: 'var(--font-geist-mono)',
                                fontSize: '0.9rem'
                            }}
                        />
                        <input
                            type="text"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (newItemId.trim()) handleAdd({ preventDefault: () => { } } as React.FormEvent);
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
                            onClick={(e) => handleAdd(e as unknown as React.FormEvent)}
                            disabled={isLoading || !newItemId.trim()}
                            className="btn btn-primary"
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.9rem',
                                opacity: isLoading || !newItemId.trim() ? 0.6 : 1
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
