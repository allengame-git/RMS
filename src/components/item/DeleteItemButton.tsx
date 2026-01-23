"use client";

import { useState } from "react";
import { submitDeleteItemRequest } from "@/actions/approval";

interface DeleteItemButtonProps {
    itemId: number;
    childCount: number;
    isDisabled?: boolean;
}

export default function DeleteItemButton({ itemId, childCount, isDisabled = false }: DeleteItemButtonProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDialog, setShowDialog] = useState(false);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowDialog(true);
    };

    const handleConfirm = async () => {
        setShowDialog(false);
        setIsSubmitting(true);
        try {
            const result = await submitDeleteItemRequest(itemId);
            if (result.error) {
                alert(result.error);
            } else {
                alert(result.message);
            }
        } catch {
            alert("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowDialog(false);
    };

    if (childCount > 0) {
        return (
            <div title="Cannot delete item with children" style={{ display: 'inline-block' }}>
                <button
                    className="btn"
                    disabled
                    style={{
                        opacity: 0.5,
                        cursor: 'not-allowed',
                        color: 'var(--color-danger)',
                        borderColor: 'var(--color-danger)',
                        background: 'transparent',
                        border: '1px solid var(--color-danger)',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-sm)'
                    }}
                >
                    Delete (Has Children)
                </button>
            </div>
        );
    }

    return (
        <>
            <button
                onClick={handleDeleteClick}
                disabled={isDisabled || isSubmitting}
                title={isDisabled ? "Changes pending approval" : "Request deletion"}
                type="button"
                style={{
                    color: 'var(--color-danger)',
                    borderColor: 'var(--color-danger)',
                    background: 'transparent',
                    border: '1px solid var(--color-danger)',
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: (isDisabled || isSubmitting) ? 'not-allowed' : 'pointer',
                    opacity: (isDisabled || isSubmitting) ? 0.5 : 1
                }}
            >
                {isSubmitting ? "Requesting..." : "Delete"}
            </button>

            {showDialog && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999
                    }}
                    onClick={handleCancel}
                >
                    <div
                        className="glass"
                        style={{
                            width: '500px',
                            maxWidth: '95vw',
                            borderRadius: 'var(--radius-lg)',
                            padding: '2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--color-bg-surface)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            border: '1px solid var(--color-border)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>確認刪除</h2>
                            <button
                                type="button"
                                onClick={handleCancel}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.5rem',
                                    lineHeight: 1,
                                    color: 'var(--color-text-muted)'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <p style={{ marginBottom: '2rem', lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>
                            您確定要申請刪除此項目嗎？此操作需要審核批准。
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleCancel}
                                type="button"
                                className="btn btn-outline"
                                style={{
                                    padding: '0.6rem 1.5rem'
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirm}
                                type="button"
                                className="btn"
                                style={{
                                    padding: '0.6rem 1.5rem',
                                    background: 'var(--color-danger)',
                                    border: 'none',
                                    color: 'white'
                                }}
                            >
                                確認刪除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
