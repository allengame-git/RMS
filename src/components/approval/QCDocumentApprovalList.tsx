/**
 * @file QCDocumentApprovalList.tsx
 * @description 品質管制文件審核列表元件
 *
 * 顯示待審核的 QC 文件（QCDocumentApproval），
 * 供具有 QC/PM 資格的使用者進行審核。
 *
 * ## 核心功能
 * - 顯示待審核的 QC 文件列表
 * - 根據使用者資格過濾顯示內容
 * - QC 審核操作（通過/拒絕）
 * - PM 核定操作（通過/要求修訂）
 * - 審查意見輸入
 *
 * ## 審核狀態
 * - `PENDING_QC`：等待 QC 審核
 * - `PENDING_PM`：等待 PM 核定
 * - `REVISION_REQUESTED`：已要求修訂
 *
 * ## 權限控制
 * - QC 審核：需要 `isQC = true`
 * - PM 核定：需要 `isPM = true`
 *
 * ## 修訂流程
 * PM 可要求修訂，編輯者需提交修訂版本後重新進入審核流程。
 *
 * @see /src/actions/qc-approval.ts - QC 審核相關 Server Actions
 * @see /src/app/admin/approval - 審核頁面（包含此元件）
 */

"use client";

import React, { useState } from "react";
import {
    approveAsQC,
    approveAsPM,
    rejectQCDocument,
} from "@/actions/qc-approval";

interface QCDocumentApproval {
    id: number;
    status: string;
    createdAt: string;
    qcApprovedAt?: string;
    qcNote?: string;
    pmApprovedAt?: string;
    pmNote?: string;
    revisionCount: number;
    itemHistory: {
        id: number;
        version: number;
        changeType: string;
        itemFullId: string;
        itemTitle: string;
        isoDocPath?: string;
        createdAt: string;
        project: {
            title: string;
        };
        submittedBy: {
            username: string;
        };
        reviewedBy?: {
            username: string;
        };
    };
    qcApprovedBy?: {
        username: string;
    };
    pmApprovedBy?: {
        username: string;
    };
}

interface Props {
    approvals: QCDocumentApproval[];
    userQualifications: {
        isQC: boolean;
        isPM: boolean;
    };
    onRefresh: () => void;
}

export default function QCDocumentApprovalList({
    approvals,
    userQualifications,
    onRefresh,
}: Props) {
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        type: 'APPROVE' | 'REJECT';
        approval: QCDocumentApproval | null;
        note: string;
    }>({
        isOpen: false,
        type: 'APPROVE',
        approval: null,
        note: ''
    });

    const handleActionClick = (approval: QCDocumentApproval, type: 'APPROVE' | 'REJECT') => {
        setConfirmDialog({
            isOpen: true,
            type,
            approval,
            note: ''
        });
    };

    const handleConfirm = async () => {
        const { type, approval, note } = confirmDialog;
        if (!approval) return;

        if (type === 'REJECT' && !note.trim()) {
            alert('請填寫駁回原因');
            return;
        }

        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setProcessingId(approval.id);

        try {
            let result;
            if (type === 'APPROVE') {
                if (approval.status === "PENDING_QC" && userQualifications.isQC) {
                    result = await approveAsQC(approval.id, note);
                } else if (approval.status === "PENDING_PM" && userQualifications.isPM) {
                    result = await approveAsPM(approval.id, note);
                }
            } else {
                result = await rejectQCDocument(approval.id, note);
            }

            if (result?.error) {
                alert(result.error);
            } else {
                onRefresh();
            }
        } catch (err) {
            console.error("Operation failed:", err);
            alert("操作失敗");
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "PENDING_QC":
                return { text: "待 QC 審核", color: "#3b82f6" };
            case "PENDING_PM":
                return { text: "待 PM 核定", color: "#f59e0b" };
            case "COMPLETED":
                return { text: "已完成", color: "#10b981" };
            case "REJECTED":
                return { text: "已駁回", color: "#ef4444" };
            case "REVISION_REQUIRED":
                return { text: "待修訂", color: "#d97706" };
            default:
                return { text: status, color: "#6b7280" };
        }
    };

    const canApprove = (approval: QCDocumentApproval) => {
        if (approval.status === "PENDING_QC" && userQualifications.isQC) return true;
        if (approval.status === "PENDING_PM" && userQualifications.isPM) return true;
        return false;
    };

    if (approvals.length === 0) {
        return (
            <div
                style={{
                    padding: "3rem",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                }}
            >
                <p>目前沒有待審核的品質文件</p>
            </div>
        );
    }

    return (
        <>
            <div className="glass" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr
                            style={{
                                borderBottom: "1px solid var(--color-border)",
                                backgroundColor: "rgba(0,0,0,0.02)",
                            }}
                        >
                            <th style={{ padding: "1rem", textAlign: "left" }}>QC 編號</th>
                            <th style={{ padding: "1rem", textAlign: "left" }}>項目</th>
                            <th style={{ padding: "1rem", textAlign: "left" }}>版本</th>
                            <th style={{ padding: "1rem", textAlign: "left" }}>提交者 / 核准者</th>
                            <th style={{ padding: "1rem", textAlign: "center" }}>狀態</th>
                            <th style={{ padding: "1rem", textAlign: "center" }}>文件</th>
                            <th style={{ padding: "1rem", textAlign: "right" }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {approvals.map((approval) => {
                            const status = getStatusLabel(approval.status);
                            const history = approval.itemHistory;

                            return (
                                <tr
                                    key={approval.id}
                                    style={{ borderBottom: "1px solid var(--color-border)" }}
                                >
                                    <td style={{ padding: "1rem", fontWeight: "bold" }}>
                                        <div>QC-{String(history.id).padStart(4, "0")}</div>
                                        {approval.revisionCount > 0 ? (
                                            <div style={{
                                                fontSize: "10px",
                                                color: "#d97706",
                                                backgroundColor: "rgba(249, 168, 37, 0.1)",
                                                padding: "2px 4px",
                                                borderRadius: "4px",
                                                display: "inline-block",
                                                marginTop: "4px"
                                            }}>
                                                重新核修 ({approval.revisionCount})
                                            </div>
                                        ) : (
                                            <div style={{
                                                fontSize: "10px",
                                                color: "var(--color-primary)",
                                                backgroundColor: "var(--color-primary-soft)",
                                                padding: "2px 4px",
                                                borderRadius: "4px",
                                                display: "inline-block",
                                                marginTop: "4px"
                                            }}>
                                                首次審核
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: "1rem" }}>
                                        <div style={{ fontWeight: "500" }}>{history.itemFullId}</div>
                                        <div
                                            style={{
                                                fontSize: "0.85rem",
                                                color: "var(--color-text-muted)",
                                            }}
                                        >
                                            {history.itemTitle}
                                        </div>
                                    </td>
                                    <td style={{ padding: "1rem" }}>v{history.version}</td>
                                    <td style={{ padding: "1rem", fontSize: "0.9rem" }}>
                                        <div>提交: {history.submittedBy.username}</div>
                                        <div style={{ color: "var(--color-text-muted)" }}>
                                            核准: {history.reviewedBy?.username || "-"}
                                        </div>
                                        {approval.qcApprovedBy && (
                                            <div style={{ color: "#3b82f6", fontSize: "0.85rem" }}>
                                                QC: {approval.qcApprovedBy.username}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: "1rem", textAlign: "center" }}>
                                        <span
                                            style={{
                                                padding: "4px 10px",
                                                borderRadius: "12px",
                                                fontSize: "0.85rem",
                                                fontWeight: "500",
                                                backgroundColor: `${status.color}15`,
                                                color: status.color,
                                                border: `1px solid ${status.color}30`,
                                            }}
                                        >
                                            {status.text}
                                        </span>
                                    </td>
                                    <td style={{ padding: "1rem", textAlign: "center" }}>
                                        {history.isoDocPath ? (
                                            <a
                                                href={history.isoDocPath}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: "var(--color-primary)",
                                                    textDecoration: "none",
                                                }}
                                            >
                                                📄 檢視
                                            </a>
                                        ) : (
                                            <span style={{ color: "var(--color-text-muted)" }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "1rem", textAlign: "right" }}>
                                        {canApprove(approval) ? (
                                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                                                <button
                                                    onClick={() => handleActionClick(approval, 'APPROVE')}
                                                    disabled={processingId === approval.id}
                                                    className="btn btn-primary"
                                                    style={{ padding: "0.25rem 1rem", fontSize: "0.9rem" }}
                                                >
                                                    {processingId === approval.id ? "處理中..." : "核准"}
                                                </button>
                                                <button
                                                    onClick={() => handleActionClick(approval, 'REJECT')}
                                                    disabled={processingId === approval.id}
                                                    className="btn btn-outline"
                                                    style={{
                                                        padding: "0.25rem 1rem",
                                                        fontSize: "0.9rem",
                                                        color: "#ef4444",
                                                        borderColor: "#ef4444",
                                                    }}
                                                >
                                                    駁回
                                                </button>
                                            </div>
                                        ) : (
                                            <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                                                等待其他審核者
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {confirmDialog.isOpen && confirmDialog.approval && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass" style={{
                        padding: "2rem",
                        borderRadius: "var(--radius-lg)",
                        width: '90%',
                        maxWidth: '500px',
                        backgroundColor: 'var(--color-background, #ffffff)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--color-border)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: "1rem", color: confirmDialog.type === 'APPROVE' ? 'var(--color-text-main)' : '#ef4444' }}>
                            {confirmDialog.type === 'APPROVE' ? '確認核准品質文件' : '確認駁回品質文件'}
                        </h3>

                        <div style={{ marginBottom: "1.5rem" }}>
                            <p style={{ marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                                項目: <strong>{confirmDialog.approval.itemHistory.itemFullId}</strong>
                            </p>
                            <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                                標題: {confirmDialog.approval.itemHistory.itemTitle}
                            </p>

                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                                {confirmDialog.type === 'APPROVE' ? '審查意見 (選填)' : '駁回原因 (必填)'}
                            </label>
                            <textarea
                                value={confirmDialog.note}
                                onChange={(e) => setConfirmDialog(prev => ({ ...prev, note: e.target.value }))}
                                placeholder={confirmDialog.type === 'APPROVE' ? "請輸入審查意見..." : "請輸入駁回原因..."}
                                style={{
                                    width: "100%",
                                    padding: "0.75rem",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--color-border)",
                                    minHeight: "100px",
                                    fontSize: "0.95rem",
                                    resize: "vertical"
                                }}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                                className="btn btn-outline"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="btn btn-primary"
                                style={{
                                    backgroundColor: confirmDialog.type === 'REJECT' ? '#ef4444' : undefined,
                                    borderColor: confirmDialog.type === 'REJECT' ? '#ef4444' : undefined,
                                }}
                            >
                                確認{confirmDialog.type === 'APPROVE' ? '核准' : '駁回'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
