'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { previewReorder, reorderItems } from '@/actions/item-reorder';

interface ReorderItem {
    id: number;
    fullId: string;
    title: string;
}

interface ReorderDialogProps {
    items: ReorderItem[];
    parentId: number | null;
    projectId: number;
    onClose: () => void;
}

interface PreviewChange {
    itemId: number;
    oldFullId: string;
    newFullId: string;
}

export default function ReorderDialog({ items, parentId, projectId, onClose }: ReorderDialogProps) {
    const router = useRouter();
    const [orderedItems, setOrderedItems] = useState<ReorderItem[]>([...items]);
    const [preview, setPreview] = useState<PreviewChange[] | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const moveItem = useCallback((fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= orderedItems.length) return;
        setOrderedItems(prev => {
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
        });
        setPreview(null);
        setError('');
    }, [orderedItems.length]);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDragEnd = () => {
        if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
            moveItem(dragIndex, dragOverIndex);
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const handlePreview = async () => {
        setIsLoadingPreview(true);
        setError('');
        try {
            const itemIds = orderedItems.map(item => item.id);
            const result = await previewReorder(parentId, projectId, itemIds);
            if (!result.success) {
                setError(result.error || '預覽失敗');
            } else {
                setPreview(result.data?.changes || []);
            }
        } catch {
            setError('預覽時發生錯誤');
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const handleConfirm = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const itemIds = orderedItems.map(item => item.id);
            const result = await reorderItems(parentId, projectId, itemIds);
            if (!result.success) {
                setError(result.error || '排序失敗');
            } else {
                router.refresh();
                onClose();
            }
        } catch {
            setError('排序時發生錯誤');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isLoading = isLoadingPreview || isSubmitting;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 99999,
                backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="glass"
                style={{
                    width: '600px',
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    borderRadius: 'var(--radius-lg, 12px)',
                    padding: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--color-bg-surface)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    border: '1px solid var(--color-border)',
                    overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem' }}>管理順序</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            lineHeight: 1,
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                        拖曳項目或使用箭頭按鈕調整順序，完成後點擊「預覽變更」確認。
                    </p>

                    {/* Error */}
                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--color-danger)',
                            border: '1px solid var(--color-danger)',
                            fontSize: '0.9rem',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Sortable List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {orderedItems.map((item, index) => (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.6rem 0.75rem',
                                    backgroundColor: dragOverIndex === index && dragIndex !== index
                                        ? 'rgba(20, 184, 166, 0.1)'
                                        : 'var(--color-bg-elevated, var(--color-bg-base))',
                                    borderRadius: 'var(--radius-sm)',
                                    border: dragOverIndex === index && dragIndex !== index
                                        ? '1px solid var(--color-primary)'
                                        : '1px solid var(--color-border)',
                                    cursor: 'grab',
                                    opacity: dragIndex === index ? 0.5 : 1,
                                    transition: 'background-color 0.15s, border-color 0.15s',
                                    userSelect: 'none',
                                }}
                            >
                                {/* Drag handle */}
                                <span style={{
                                    fontSize: '1.1rem',
                                    color: 'var(--color-text-muted)',
                                    cursor: 'grab',
                                    flexShrink: 0,
                                }}>
                                    &#9776;
                                </span>

                                {/* fullId badge */}
                                <span style={{
                                    fontFamily: 'var(--font-geist-mono, monospace)',
                                    fontSize: '0.85rem',
                                    color: 'var(--color-primary)',
                                    backgroundColor: 'rgba(20, 184, 166, 0.1)',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    flexShrink: 0,
                                    fontWeight: 600,
                                }}>
                                    {item.fullId}
                                </span>

                                {/* Title */}
                                <span style={{
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontSize: '0.9rem',
                                }}>
                                    {item.title}
                                </span>

                                {/* Arrow buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', flexShrink: 0 }}>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); moveItem(index, index - 1); }}
                                        disabled={index === 0 || isLoading}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: index === 0 || isLoading ? 'not-allowed' : 'pointer',
                                            padding: '0 0.25rem',
                                            fontSize: '0.8rem',
                                            lineHeight: 1,
                                            color: index === 0 ? 'var(--color-text-muted)' : 'var(--color-text)',
                                            opacity: index === 0 ? 0.3 : 1,
                                        }}
                                        title="上移"
                                    >
                                        &#9650;
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); moveItem(index, index + 1); }}
                                        disabled={index === orderedItems.length - 1 || isLoading}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: index === orderedItems.length - 1 || isLoading ? 'not-allowed' : 'pointer',
                                            padding: '0 0.25rem',
                                            fontSize: '0.8rem',
                                            lineHeight: 1,
                                            color: index === orderedItems.length - 1 ? 'var(--color-text-muted)' : 'var(--color-text)',
                                            opacity: index === orderedItems.length - 1 ? 0.3 : 1,
                                        }}
                                        title="下移"
                                    >
                                        &#9660;
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Preview Table */}
                    {preview !== null && (
                        <div style={{ marginTop: '1rem' }}>
                            {preview.length === 0 ? (
                                <p style={{
                                    textAlign: 'center',
                                    color: 'var(--color-text-muted)',
                                    padding: '1rem',
                                    backgroundColor: 'var(--color-bg-elevated, var(--color-bg-base))',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--color-border)',
                                    fontSize: '0.9rem',
                                }}>
                                    順序未改變
                                </p>
                            ) : (
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: '0.9rem',
                                }}>
                                    <thead>
                                        <tr>
                                            <th style={{
                                                textAlign: 'left',
                                                padding: '0.5rem 0.75rem',
                                                borderBottom: '2px solid var(--color-border)',
                                                color: 'var(--color-text-muted)',
                                                fontWeight: 600,
                                            }}>
                                                原 ID
                                            </th>
                                            <th style={{
                                                textAlign: 'center',
                                                padding: '0.5rem',
                                                borderBottom: '2px solid var(--color-border)',
                                                color: 'var(--color-text-muted)',
                                            }}>
                                            </th>
                                            <th style={{
                                                textAlign: 'left',
                                                padding: '0.5rem 0.75rem',
                                                borderBottom: '2px solid var(--color-border)',
                                                color: 'var(--color-text-muted)',
                                                fontWeight: 600,
                                            }}>
                                                新 ID
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.map((change) => (
                                            <tr key={change.itemId}>
                                                <td style={{
                                                    padding: '0.5rem 0.75rem',
                                                    borderBottom: '1px solid var(--color-border)',
                                                    fontFamily: 'var(--font-geist-mono, monospace)',
                                                }}>
                                                    {change.oldFullId}
                                                </td>
                                                <td style={{
                                                    padding: '0.5rem',
                                                    borderBottom: '1px solid var(--color-border)',
                                                    textAlign: 'center',
                                                    color: 'var(--color-text-muted)',
                                                }}>
                                                    &rarr;
                                                </td>
                                                <td style={{
                                                    padding: '0.5rem 0.75rem',
                                                    borderBottom: '1px solid var(--color-border)',
                                                    fontFamily: 'var(--font-geist-mono, monospace)',
                                                    color: 'var(--color-primary)',
                                                    fontWeight: 600,
                                                }}>
                                                    {change.newFullId}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-outline"
                        disabled={isLoading}
                        style={{ padding: '0.6rem 1.5rem' }}
                    >
                        取消
                    </button>
                    {preview === null || preview.length === 0 ? (
                        <button
                            type="button"
                            onClick={handlePreview}
                            className="btn btn-primary"
                            disabled={isLoading}
                            style={{ padding: '0.6rem 1.5rem' }}
                        >
                            {isLoadingPreview ? '計算中...' : '預覽變更'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="btn btn-primary"
                            disabled={isLoading}
                            style={{ padding: '0.6rem 1.5rem' }}
                        >
                            {isSubmitting ? '處理中...' : '確認排序'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
