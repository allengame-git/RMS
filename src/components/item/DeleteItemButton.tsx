/**
 * @file DeleteItemButton.tsx
 * @description 刪除項目按鈕元件
 *
 * 提供項目刪除申請功能的按鈕，支援確認對話框。
 *
 * ## 核心功能
 * - 刪除按鈕（紅色警示樣式）
 * - 確認對話框
 * - 子項目檢查
 * - 提交刪除申請
 *
 * ## Props
 * - `itemId`：項目 ID
 * - `childCount`：子項目數量
 * - `isDisabled`：是否禁用（有待審核申請時）
 *
 * ## 刪除限制
 * - 有子項目時無法刪除
 * - 有待審核申請時無法刪除
 * - 有未完成的 QC 流程時無法刪除
 *
 * ## 提交流程
 * 1. 點擊刪除按鈕
 * 2. 顯示確認對話框
 * 3. 確認後呼叫 `submitDeleteItemRequest`
 * 4. 建立 DELETE 類型的 ChangeRequest
 * 5. 等待審核通過後軟刪除
 *
 * @see /src/actions/approval.ts - submitDeleteItemRequest
 */

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
    const [deleteReason, setDeleteReason] = useState("");

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteReason("");
        setShowDialog(true);
    };

    const handleConfirm = async () => {
        if (!deleteReason.trim()) return;
        setShowDialog(false);
        setIsSubmitting(true);
        try {
            const result = await submitDeleteItemRequest(itemId, deleteReason.trim());
            if (result.error) {
                alert(result.error);
            } else {
                alert(result.message);
            }
        } catch {
            alert("發生未預期的錯誤");
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
                    刪除（有子項目）
                </button>
            </div>
        );
    }

    return (
        <>
            <button
                onClick={handleDeleteClick}
                disabled={isDisabled || isSubmitting}
                title={isDisabled ? "有待審核的變更申請" : "申請刪除"}
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
                {isSubmitting ? "提交中..." : "刪除"}
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

                        <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>
                            您確定要申請刪除此項目嗎？此操作需要審核批准。
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                                刪除原因（必填）
                            </label>
                            <textarea
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                placeholder="請說明刪除此項目的原因..."
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-background)',
                                    color: 'var(--color-text)',
                                    minHeight: '80px',
                                    resize: 'vertical',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>

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
                                disabled={!deleteReason.trim()}
                                style={{
                                    padding: '0.6rem 1.5rem',
                                    background: !deleteReason.trim() ? 'var(--color-text-muted)' : 'var(--color-danger)',
                                    border: 'none',
                                    color: 'white',
                                    cursor: !deleteReason.trim() ? 'not-allowed' : 'pointer',
                                    opacity: !deleteReason.trim() ? 0.6 : 1
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
