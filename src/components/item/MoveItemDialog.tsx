'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { previewMove, moveItem } from '@/actions/item-reorder';
import type { ItemNode } from '@/lib/tree-utils';

interface MoveItemDialogProps {
    itemId: number;
    itemFullId: string;
    itemTitle: string;
    projectId: number;
    treeNodes: ItemNode[];
    onClose: () => void;
}

interface FlatOption {
    id: number | null;
    fullId: string;
    title: string;
    depth: number;
}

interface ChangeEntry {
    itemId: number;
    oldFullId: string;
    newFullId: string;
}

function flattenExcluding(nodes: ItemNode[], excludeId: number): FlatOption[] {
    const result: FlatOption[] = [{ id: null, fullId: '（根層級）', title: '', depth: 0 }];

    function walk(list: ItemNode[], depth: number) {
        for (const node of list) {
            if (node.id === excludeId) continue;
            result.push({ id: node.id, fullId: node.fullId, title: node.title, depth });
            walk(node.children, depth + 1);
        }
    }

    walk(nodes, 1);
    return result;
}

export default function MoveItemDialog({
    itemId,
    itemFullId,
    itemTitle,
    projectId: _projectId,
    treeNodes,
    onClose,
}: MoveItemDialogProps) {
    const router = useRouter();
    const [selectedParentId, setSelectedParentId] = useState<string>('__root__');
    const [position, setPosition] = useState<number>(0);
    const [preview, setPreview] = useState<ChangeEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const options = flattenExcluding(treeNodes, itemId);

    const parentIdValue = selectedParentId === '__root__' ? null : Number(selectedParentId);

    // Reset preview when parent or position changes
    useEffect(() => {
        setPreview(null);
        setError(null);
    }, [selectedParentId, position]);

    const handlePreview = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await previewMove(itemId, parentIdValue, position);
            if (result.success && result.data) {
                const actualChanges = result.data.changes.filter(c => c.oldFullId !== c.newFullId);
                setPreview(actualChanges);
            } else {
                setError(result.error || '預覽失敗');
            }
        } catch {
            setError('預覽時發生錯誤');
        } finally {
            setLoading(false);
        }
    }, [itemId, parentIdValue, position]);

    const handleConfirm = useCallback(async () => {
        setConfirming(true);
        setError(null);
        try {
            const result = await moveItem(itemId, parentIdValue, position);
            if (result.success) {
                router.refresh();
                onClose();
            } else {
                setError(result.error || '移動失敗');
            }
        } catch {
            setError('移動時發生錯誤');
        } finally {
            setConfirming(false);
        }
    }, [itemId, parentIdValue, position, router, onClose]);

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
            }}
            onClick={handleOverlayClick}
        >
            <div
                className="glass"
                style={{
                    width: '600px',
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--color-bg-surface)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1.25rem 1.5rem',
                        borderBottom: '1px solid var(--color-border)',
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: '1.3rem' }}>移動項目</h2>
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
                        ×
                    </button>
                </div>

                {/* Body */}
                <div
                    style={{
                        padding: '1.5rem',
                        overflowY: 'auto',
                        flex: 1,
                    }}
                >
                    {/* Item info */}
                    <p style={{ margin: '0 0 1.25rem 0', color: 'var(--color-text-secondary)' }}>
                        正在移動：<strong>{itemFullId}</strong> - {itemTitle}
                    </p>

                    {/* Target selector */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label
                            htmlFor="move-target"
                            style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontWeight: 500,
                            }}
                        >
                            目標父項目
                        </label>
                        <select
                            id="move-target"
                            value={selectedParentId}
                            onChange={(e) => setSelectedParentId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text)',
                                fontSize: '0.95rem',
                            }}
                        >
                            {options.map((opt) => (
                                <option
                                    key={opt.id === null ? '__root__' : opt.id}
                                    value={opt.id === null ? '__root__' : String(opt.id)}
                                >
                                    {opt.id === null
                                        ? '（根層級）'
                                        : `${'　'.repeat(opt.depth)}${opt.fullId} - ${opt.title}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Position input */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label
                            htmlFor="move-position"
                            style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontWeight: 500,
                            }}
                        >
                            插入位置（第幾個，從 0 開始）
                        </label>
                        <input
                            id="move-position"
                            type="number"
                            min={0}
                            value={position}
                            onChange={(e) => setPosition(Math.max(0, parseInt(e.target.value) || 0))}
                            style={{
                                width: '120px',
                                padding: '0.5rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text)',
                                fontSize: '0.95rem',
                            }}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            style={{
                                padding: '0.75rem 1rem',
                                marginBottom: '1rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                                color: 'var(--color-danger)',
                                border: '1px solid var(--color-danger)',
                                fontSize: '0.9rem',
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {/* Preview table */}
                    {preview && preview.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>
                                編號變更預覽（共 {preview.length} 項變更）
                            </h3>
                            <div
                                style={{
                                    overflowX: 'auto',
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-sm)',
                                }}
                            >
                                <table
                                    style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    <thead>
                                        <tr
                                            style={{
                                                backgroundColor: 'var(--color-bg-elevated)',
                                                position: 'sticky',
                                                top: 0,
                                            }}
                                        >
                                            <th
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    textAlign: 'left',
                                                    borderBottom: '1px solid var(--color-border)',
                                                }}
                                            >
                                                原編號
                                            </th>
                                            <th
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    textAlign: 'center',
                                                    borderBottom: '1px solid var(--color-border)',
                                                    width: '2rem',
                                                }}
                                            >
                                                →
                                            </th>
                                            <th
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    textAlign: 'left',
                                                    borderBottom: '1px solid var(--color-border)',
                                                }}
                                            >
                                                新編號
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.map((change) => (
                                            <tr key={change.itemId}>
                                                <td
                                                    style={{
                                                        padding: '0.5rem 0.75rem',
                                                        borderBottom: '1px solid var(--color-border)',
                                                        fontFamily: 'var(--font-geist-mono, monospace)',
                                                    }}
                                                >
                                                    {change.oldFullId}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '0.5rem 0.75rem',
                                                        borderBottom: '1px solid var(--color-border)',
                                                        textAlign: 'center',
                                                        color: 'var(--color-text-muted)',
                                                    }}
                                                >
                                                    →
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '0.5rem 0.75rem',
                                                        borderBottom: '1px solid var(--color-border)',
                                                        fontFamily: 'var(--font-geist-mono, monospace)',
                                                        fontWeight: 600,
                                                        color: 'var(--color-primary)',
                                                    }}
                                                >
                                                    {change.newFullId}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {preview && preview.length === 0 && (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                            沒有編號變更。
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex',
                        gap: '0.75rem',
                        justifyContent: 'flex-end',
                        padding: '1rem 1.5rem',
                        borderTop: '1px solid var(--color-border)',
                    }}
                >
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={onClose}
                        style={{ padding: '0.6rem 1.5rem' }}
                    >
                        取消
                    </button>
                    {preview === null ? (
                        <button
                            type="button"
                            className="btn"
                            onClick={handlePreview}
                            disabled={loading}
                            style={{
                                padding: '0.6rem 1.5rem',
                                background: 'var(--color-primary)',
                                border: 'none',
                                color: 'white',
                                opacity: loading ? 0.6 : 1,
                                cursor: loading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {loading ? '載入中...' : '預覽變更'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="btn"
                            onClick={handleConfirm}
                            disabled={confirming}
                            style={{
                                padding: '0.6rem 1.5rem',
                                background: 'var(--color-primary)',
                                border: 'none',
                                color: 'white',
                                opacity: confirming ? 0.6 : 1,
                                cursor: confirming ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {confirming ? '移動中...' : '確認移動'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
