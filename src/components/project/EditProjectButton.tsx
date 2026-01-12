"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { submitUpdateProjectRequest } from "@/actions/approval";

interface EditProjectButtonProps {
    project: {
        id: number;
        title: string;
        description: string | null;
    };
}

export default function EditProjectButton({ project }: EditProjectButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [title, setTitle] = useState(project.title);
    const [description, setDescription] = useState(project.description || "");
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
            setTitle(project.title);
            setDescription(project.description || "");
            setStatus(null);
        }
    }, [isModalOpen, project]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus(null);

        const formData = new FormData();
        formData.append("projectId", project.id.toString());
        formData.append("title", title);
        formData.append("description", description);

        try {
            const result = await submitUpdateProjectRequest({}, formData);
            if (result.error) {
                setStatus({ error: result.error });
            } else {
                setStatus({ message: result.message });
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus(null);
                    window.location.reload();
                }, 1500);
            }
        } catch (err) {
            setStatus({ error: "發生未預期的錯誤。" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const modalContent = (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 99999,
            backdropFilter: "blur(4px)"
        }}>
            <div className="glass" style={{
                width: "600px", maxWidth: "95vw",
                borderRadius: "var(--radius-lg)", padding: "2rem",
                display: "flex", flexDirection: "column",
                backgroundColor: "var(--color-bg-surface)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                border: "1px solid var(--color-border)"
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1.5rem" }}>
                    <h2 style={{ margin: 0 }}>編輯專案</h2>
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
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

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>專案名稱 *</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={{
                                width: "100%", padding: "0.75rem", borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--color-border)", background: "var(--color-bg-base)",
                                color: "var(--color-text-main)"
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>描述</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            style={{
                                width: "100%", padding: "0.75rem", borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--color-border)", background: "var(--color-bg-base)",
                                color: "var(--color-text-main)", resize: "vertical"
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.5rem" }}>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="btn btn-outline"
                            disabled={isSubmitting}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "送出中..." : "申請變更"}
                        </button>
                    </div>
                </form>
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
                    color: "var(--color-primary)",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    transition: "all 0.2s"
                }}
                title="編輯專案"
            >
                編輯
            </button>
            {isModalOpen && mounted && typeof document !== 'undefined' && createPortal(modalContent, document.body)}
        </>
    );
}
