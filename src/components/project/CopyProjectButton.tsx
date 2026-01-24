/**
 * @file CopyProjectButton.tsx
 * @description 複製專案按鈕元件
 *
 * 提供專案複製功能，將現有專案（含所有項目）複製到新專案。
 *
 * ## 核心功能
 * - 複製按鈕觸發 Modal
 * - 新專案標題輸入
 * - 新專案代碼輸入
 * - 分區選擇
 * - 描述輸入
 *
 * ## Props
 * - `project`：來源專案資料
 * - `categories`：可選分區列表
 *
 * ## 複製內容
 * - 專案基本資訊
 * - 所有項目（Item）結構
 * - 項目內容和附件
 * - 項目階層關係
 *
 * ## 複製限制
 * - 新專案代碼不可重複
 * - 複製後的項目 fullId 會以新代碼為前綴
 *
 * ## 使用場景
 * - 建立年度版本
 * - 建立範本專案
 * - 快速建立相似專案
 *
 * @see /src/actions/project.ts - copyProject
 * @see /src/components/project/ProjectList.tsx - 專案列表
 */

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { copyProject } from "@/actions/project";

interface Category {
    id: number;
    name: string;
}

interface CopyProjectButtonProps {
    project: {
        id: number;
        title: string;
        description: string | null;
        codePrefix: string;
        categoryId: number | null;
    };
    categories: Category[];
}

export default function CopyProjectButton({ project, categories }: CopyProjectButtonProps) {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    // SSR safety
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const [formData, setFormData] = useState({
        title: "",
        codePrefix: "",
        description: "",
        categoryId: project.categoryId?.toString() || ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const result = await copyProject(
                project.id,
                formData.title,
                formData.codePrefix,
                formData.description,
                formData.categoryId ? parseInt(formData.categoryId, 10) : null
            );

            if (result.error) {
                setError(result.error);
            } else {
                setIsModalOpen(false);
                router.refresh();
            }
        } catch (err: any) {
            setError(err.message || "複製失敗");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpen = () => {
        setFormData({
            title: "",
            codePrefix: "",
            description: "",
            categoryId: project.categoryId?.toString() || ""
        });
        setError("");
        setIsModalOpen(true);
    };

    return (
        <>
            <button
                onClick={handleOpen}
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
                title="複製專案"
            >
                複製
            </button>

            {isModalOpen && mounted && typeof document !== 'undefined' && createPortal(
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 99999,
                        backdropFilter: "blur(4px)"
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsModalOpen(false);
                    }}
                >
                    <div
                        className="glass"
                        style={{
                            width: "600px",
                            maxWidth: "95vw",
                            borderRadius: "var(--radius-lg)",
                            padding: "2rem",
                            display: "flex",
                            flexDirection: "column",
                            backgroundColor: "var(--color-bg-surface)",
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                            border: "1px solid var(--color-border)"
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1.5rem" }}>
                            <h2 style={{ margin: 0 }}>複製專案</h2>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
                            >
                                ×
                            </button>
                        </div>

                        <p style={{
                            marginBottom: "1.5rem",
                            color: "var(--color-text-muted)",
                            fontSize: "0.9rem"
                        }}>
                            複製「{project.title}」({project.codePrefix}) 到新專案
                        </p>

                        {error && (
                            <div style={{
                                padding: "1rem",
                                marginBottom: "1rem",
                                borderRadius: "var(--radius-sm)",
                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                color: "var(--color-danger)",
                                border: "1px solid var(--color-danger)"
                            }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                                    新專案標題 *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    style={{
                                        width: "100%",
                                        padding: "0.75rem",
                                        borderRadius: "var(--radius-sm)",
                                        border: "1px solid var(--color-border)",
                                        background: "var(--color-bg-base)",
                                        color: "var(--color-text-main)"
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                                    新專案代碼 *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例如：ABC, DAREN-SI"
                                    value={formData.codePrefix}
                                    onChange={(e) => setFormData({ ...formData, codePrefix: e.target.value.toUpperCase() })}
                                    style={{
                                        width: "100%",
                                        padding: "0.75rem",
                                        borderRadius: "var(--radius-sm)",
                                        border: "1px solid var(--color-border)",
                                        background: "var(--color-bg-base)",
                                        color: "var(--color-text-main)",
                                        textTransform: "uppercase"
                                    }}
                                />
                                <p style={{
                                    fontSize: "0.8rem",
                                    color: "var(--color-text-muted)",
                                    marginTop: "0.5rem"
                                }}>
                                    大寫英文、數字與連字號(-)
                                </p>
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                                    分區
                                </label>
                                <select
                                    value={formData.categoryId}
                                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                    style={{
                                        width: "100%",
                                        padding: "0.75rem",
                                        borderRadius: "var(--radius-sm)",
                                        border: "1px solid var(--color-border)",
                                        background: "var(--color-bg-base)",
                                        color: "var(--color-text-main)"
                                    }}
                                >
                                    <option value="">未分類</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                                    描述
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={4}
                                    style={{
                                        width: "100%",
                                        padding: "0.75rem",
                                        borderRadius: "var(--radius-sm)",
                                        border: "1px solid var(--color-border)",
                                        background: "var(--color-bg-base)",
                                        color: "var(--color-text-main)",
                                        resize: "vertical"
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
                                    {isSubmitting ? "複製中..." : "複製專案"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
