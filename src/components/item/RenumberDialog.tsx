'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { previewRenumber, renumberItems } from '@/actions/item-reorder';

interface RenumberDialogProps {
    parentId: number | null;
    parentFullId: string | null;
    projectId: number;
    onClose: () => void;
}

interface Change {
    itemId: number;
    oldFullId: string;
    newFullId: string;
}

export default function RenumberDialog({ parentId, parentFullId, projectId, onClose }: RenumberDialogProps) {
    const router = useRouter();
    const [recursive, setRecursive] = useState(false);
    const [preview, setPreview] = useState<Change[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset preview when recursive changes
    useEffect(() => {
        setPreview(null);
        setError(null);
    }, [recursive]);

    const scopeLabel = parentFullId
        ? `${parentFullId} 的子項目`
        : '根層級項目';

    // Filter to only show actual changes
    const actualChanges = preview?.filter(c => c.oldFullId !== c.newFullId) ?? null;

    const handlePreview = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await previewRenumber(parentId, projectId, recursive);
            if (result.success && result.data) {
                setPreview(result.data.changes);
            } else {
                setError(result.error || '預覽失敗');
            }
        } catch {
            setError('發生未預期的錯誤');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        setConfirming(true);
        setError(null);
        try {
            const result = await renumberItems(parentId, projectId, recursive);
            if (result.success) {
                router.refresh();
                onClose();
            } else {
                setError(result.error || '重新編號失敗');
            }
        } catch {
            setError('發生未預期的錯誤');
        } finally {
            setConfirming(false);
        }
    };

    const isProcessing = loading || confirming;
    const hasChanges = actualChanges !== null && actualChanges.length > 0;
    const noChangesNeeded = preview !== null && (actualChanges === null || actualChanges.length === 0);

    const modalContent = (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: 99999,
                backdropFilter: 'blur(4px)'
            }}
            onClick={() => !isProcessing && onClose()}
        >
            <div
                className="glass"
                style={{
                    width: '550px', maxWidth: '95vw',
                    borderRadius: 'var(--radius-lg)', padding: '2rem',
                    display: 'flex', flexDirection: 'column',
                    backgroundColor: 'var(--color-bg-surface)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    border: '1px solid var(--color-border)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem' }}>重新編號</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            fontSize: '1.5rem',
                            lineHeight: 1,
                            color: 'var(--color-text-muted)',
                            opacity: isProcessing ? 0.5 : 1
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div style={{ marginBottom: '1.5rem' }}>
                    {/* Scope label */}
                    <p style={{ margin: '0 0 1rem 0', color: 'var(--color-text-secondary)' }}>
                        範圍：<strong>{scopeLabel}</strong>
                    </p>

                    {/* Recursive checkbox */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                            type="checkbox"
                            checked={recursive}
                            onChange={(e) => setRecursive(e.target.checked)}
                            disabled={isProcessing}
                        />
                        包含所有子層級
                    </label>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)',
                        border: '1px solid var(--color-danger)', fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                {/* No changes message */}
                {noChangesNeeded && (
                    <div style={{
                        padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)',
                        border: '1px solid var(--color-success)', fontSize: '0.9rem'
                    }}>
                        編號已經是連續的，無需變更。
                    </div>
                )}

                {/* Preview table */}
                {hasChanges && actualChanges && (
                    <div style={{ marginBottom: '1rem' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                            共 {actualChanges.length} 項變更：
                        </p>
                        <div style={{
                            maxHeight: '300px', overflowY: 'auto',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--color-bg-base)', position: 'sticky', top: 0 }}>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                                            原 ID
                                        </th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)', width: '2rem' }}>
                                            →
                                        </th>
                                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                                            新 ID
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {actualChanges.map((change) => (
                                        <tr key={change.itemId}>
                                            <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-geist-mono)' }}>
                                                {change.oldFullId}
                                            </td>
                                            <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                →
                                            </td>
                                            <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-geist-mono)', fontWeight: 600 }}>
                                                {change.newFullId}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-outline"
                        disabled={isProcessing}
                        style={{ padding: '0.6rem 1.5rem' }}
                    >
                        取消
                    </button>
                    {hasChanges ? (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="btn"
                            disabled={isProcessing}
                            style={{
                                padding: '0.6rem 1.5rem',
                                backgroundColor: 'var(--color-primary)',
                                border: 'none',
                                color: 'white'
                            }}
                        >
                            {confirming ? '處理中...' : '確認重新編號'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handlePreview}
                            className="btn"
                            disabled={isProcessing}
                            style={{
                                padding: '0.6rem 1.5rem',
                                backgroundColor: 'var(--color-primary)',
                                border: 'none',
                                color: 'white'
                            }}
                        >
                            {loading ? '載入中...' : '預覽變更'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    if (!mounted || typeof document === 'undefined') return null;

    return createPortal(modalContent, document.body);
}
