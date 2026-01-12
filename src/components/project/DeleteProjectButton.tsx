"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { submitDeleteProjectRequest } from "@/actions/approval";

interface DeleteProjectButtonProps {
    project: {
        id: number;
        title: string;
    };
    onSuccess?: () => void;
}

export default function DeleteProjectButton({ project, onSuccess }: DeleteProjectButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [status, setStatus] = useState<{ message?: string; error?: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // SSR safety
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset form when modal opens
    useEffect(() => {
        if (isModalOpen) {
            setStatus(null);
            setConfirmText("");
        }
    }, [isModalOpen]);

    const isConfirmValid = confirmText.toLowerCase() === "delete";

    const handleSubmit = async () => {
        if (!isConfirmValid) return;

        setIsSubmitting(true);
        setStatus(null);

        try {
            const result = await submitDeleteProjectRequest(project.id);
            if (result.error) {
                setStatus({ error: result.error });
            } else {
                setStatus({ message: result.message || "刪除申請已送出" });
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus(null);
                    if (onSuccess) {
                        onSuccess();
                    } else {
                        window.location.reload();
                    }
                }, 1500);
            }
        } catch (err) {
            setStatus({ error: "發生未預期的錯誤" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const modalContent = (
        <div
            style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(0,0,0,0.6)",
                display: "flex", justifyContent: "center", alignItems: "center",
                zIndex: 99999,
                backdropFilter: "blur(4px)"
            }}
            onClick={() => !isSubmitting && setIsModalOpen(false)}
        >
            <div
                className="glass"
                style={{
                    width: "500px", maxWidth: "95vw",
                    borderRadius: "var(--radius-lg)", padding: "2rem",
                    display: "flex", flexDirection: "column",
                    backgroundColor: "var(--color-bg-surface)",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                    border: "1px solid var(--color-border)"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1.5rem" }}>
                    <h2 style={{ margin: 0, color: "var(--color-danger)" }}>刪除專案</h2>
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        disabled={isSubmitting}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            fontSize: '1.5rem',
                            lineHeight: 1,
                            opacity: isSubmitting ? 0.5 : 1
                        }}
                    >
                        ×
                    </button>
                </div>

                {status?.message && (
                    <div style={{
                        padding: "1rem", marginBottom: "1rem", borderRadius: "var(--radius-sm)",
                        backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--color-success)",
                        border: "1px solid var(--color-success)"
                    }}>
                        {status.message}
                    </div>
                )}

                {status?.error && (
                    <div style={{
                        padding: "1rem", marginBottom: "1rem", borderRadius: "var(--radius-sm)",
                        backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--color-danger)",
                        border: "1px solid var(--color-danger)"
                    }}>
                        {status.error}
                    </div>
                )}

                <div style={{ marginBottom: "1.5rem" }}>
                    <p style={{ margin: 0, marginBottom: "0.5rem" }}>
                        您確定要申請刪除以下專案嗎？
                    </p>
                    <p style={{
                        margin: 0,
                        fontWeight: 600,
                        fontSize: "1.1rem",
                        padding: "0.75rem",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-danger)",
                        color: "var(--color-danger)"
                    }}>
                        「{project.title}」
                    </p>
                    <p style={{
                        margin: 0,
                        marginTop: "1rem",
                        fontSize: "0.9rem",
                        color: "var(--color-text-muted)"
                    }}>
                        此操作將送出刪除申請，需經審核批准後才會執行。
                        <br />
                        <strong>注意：</strong>已包含項目的專案無法被刪除。
                    </p>
                </div>

                {/* Confirmation Input */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontWeight: 600,
                        fontSize: "0.95rem"
                    }}>
                        請輸入 <span style={{
                            color: "var(--color-danger)",
                            fontFamily: "var(--font-geist-mono)",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            padding: "2px 6px",
                            borderRadius: "4px"
                        }}>delete</span> 以確認刪除：
                    </label>
                    <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="輸入 delete 確認"
                        disabled={isSubmitting}
                        style={{
                            width: "100%",
                            padding: "0.75rem",
                            borderRadius: "var(--radius-sm)",
                            border: `1px solid ${isConfirmValid ? "var(--color-success)" : "var(--color-border)"}`,
                            backgroundColor: "var(--color-bg-base)",
                            color: "var(--color-text-main)",
                            fontSize: "1rem",
                            outline: "none",
                            transition: "border-color 0.2s"
                        }}
                    />
                    {confirmText && !isConfirmValid && (
                        <p style={{
                            margin: "0.5rem 0 0 0",
                            fontSize: "0.85rem",
                            color: "var(--color-text-muted)"
                        }}>
                            請正確輸入 "delete"
                        </p>
                    )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="btn btn-outline"
                        disabled={isSubmitting}
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="btn"
                        disabled={isSubmitting || !isConfirmValid}
                        style={{
                            backgroundColor: isConfirmValid ? "var(--color-danger)" : "gray",
                            color: "white",
                            border: "none",
                            cursor: isConfirmValid ? "pointer" : "not-allowed",
                            opacity: isConfirmValid ? 1 : 0.6
                        }}
                    >
                        {isSubmitting ? "處理中..." : "確認刪除"}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <button
                onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
                style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-danger)",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    transition: "all 0.2s"
                }}
                title="申請刪除專案"
            >
                刪除
            </button>
            {isModalOpen && mounted && typeof document !== 'undefined' && createPortal(modalContent, document.body)}
        </>
    );
}
