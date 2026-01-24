/**
 * @file CategoryManager.tsx
 * @description 專案分區管理元件
 *
 * 提供專案分區的完整 CRUD 管理功能。
 *
 * ## 核心功能
 * - 顯示分區列表
 * - 新增分區
 * - 編輯分區名稱和描述
 * - 刪除分區
 * - 顯示各分區專案數量
 *
 * ## Props
 * - `categories`：分區資料陣列
 * - `onUpdate`：更新完成後回調
 *
 * ## 刪除行為
 * 刪除分區時，該分區內的專案會變為「未分類」，不會被刪除。
 *
 * ## Modal 設計
 * - Portal 渲染到 body
 * - 可點擊背景關閉
 * - 表單內聯於分區列表下方
 *
 * ## 權限控制
 * 此元件僅對 INSPECTOR/ADMIN 角色顯示（由父元件控制）
 *
 * @see /src/actions/project-category.ts - 分區管理 Server Actions
 * @see /src/app/projects/page.tsx - 專案列表頁面
 */

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
    createCategory,
    updateCategory,
    deleteCategory
} from "@/actions/project-category";

interface Category {
    id: number;
    name: string;
    description: string | null;
    sortOrder: number;
    _count: { projects: number };
}

interface CategoryManagerProps {
    categories: Category[];
    onUpdate: () => void;
}

export default function CategoryManager({ categories, onUpdate }: CategoryManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ name: "", description: "" });
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreate = async () => {
        setError("");
        setIsSubmitting(true);
        try {
            const result = await createCategory(formData.name, formData.description);
            if (result.error) {
                setError(result.error);
            } else {
                setFormData({ name: "", description: "" });
                setIsCreating(false);
                onUpdate();
            }
        } catch (e: any) {
            setError(e.message || "建立失敗");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingCategory) return;
        setError("");
        setIsSubmitting(true);
        try {
            const result = await updateCategory(editingCategory.id, formData.name, formData.description);
            if (result.error) {
                setError(result.error);
            } else {
                setEditingCategory(null);
                setFormData({ name: "", description: "" });
                onUpdate();
            }
        } catch (e: any) {
            setError(e.message || "更新失敗");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (category: Category) => {
        if (!confirm(`確定要刪除「${category.name}」分區嗎？\n\n此分區內的 ${category._count.projects} 個專案將變為「未分類」。`)) {
            return;
        }
        try {
            const result = await deleteCategory(category.id);
            if (result.error) {
                alert(result.error);
            } else {
                onUpdate();
            }
        } catch (e: any) {
            alert(e.message || "刪除失敗");
        }
    };

    const openEdit = (category: Category) => {
        setEditingCategory(category);
        setFormData({ name: category.name, description: category.description || "" });
        setIsCreating(false);
        setError("");
    };

    const openCreate = () => {
        setEditingCategory(null);
        setFormData({ name: "", description: "" });
        setIsCreating(true);
        setError("");
    };

    const modalContent = (
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
                if (e.target === e.currentTarget) setIsOpen(false);
            }}
        >
            <div
                className="glass"
                style={{
                    width: "600px",
                    maxWidth: "95vw",
                    maxHeight: "90vh",
                    borderRadius: "var(--radius-lg)",
                    padding: "2rem",
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "var(--color-bg-surface)",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                    border: "1px solid var(--color-border)",
                    overflowY: "auto"
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1.5rem" }}>
                    <h2 style={{ margin: 0 }}>管理專案分區</h2>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
                    >
                        ×
                    </button>
                </div>

                {/* Category List */}
                <div style={{ marginBottom: "1.5rem" }}>
                    {categories.length === 0 ? (
                        <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "1rem" }}>
                            尚無分區，請新增分區
                        </p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {categories.map((cat) => (
                                <div
                                    key={cat.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "0.75rem 1rem",
                                        backgroundColor: editingCategory?.id === cat.id ? "rgba(20, 184, 166, 0.1)" : "var(--color-bg-base)",
                                        borderRadius: "var(--radius-sm)",
                                        border: editingCategory?.id === cat.id ? "1px solid var(--color-primary)" : "1px solid var(--color-border)"
                                    }}
                                >
                                    <div>
                                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                                        <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                                            ({cat._count.projects} 個專案)
                                        </span>
                                        {cat.description && (
                                            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0.25rem 0 0 0" }}>
                                                {cat.description}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <button
                                            onClick={() => openEdit(cat)}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "var(--color-primary)",
                                                cursor: "pointer",
                                                fontSize: "0.9rem"
                                            }}
                                        >
                                            編輯
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat)}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "var(--color-danger)",
                                                cursor: "pointer",
                                                fontSize: "0.9rem"
                                            }}
                                        >
                                            刪除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Create/Edit Form */}
                {(isCreating || editingCategory) && (
                    <div style={{
                        padding: "1rem",
                        backgroundColor: "var(--color-bg-base)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)",
                        marginBottom: "1rem"
                    }}>
                        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>
                            {editingCategory ? "編輯分區" : "新增分區"}
                        </h3>

                        {error && (
                            <div style={{
                                padding: "0.75rem",
                                marginBottom: "1rem",
                                borderRadius: "var(--radius-sm)",
                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                color: "var(--color-danger)",
                                border: "1px solid var(--color-danger)",
                                fontSize: "0.9rem"
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
                                分區名稱 *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="例如：進行中專案"
                                style={{
                                    width: "100%",
                                    padding: "0.5rem",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--color-border)"
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
                                描述
                            </label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="選填"
                                style={{
                                    width: "100%",
                                    padding: "0.5rem",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--color-border)"
                                }}
                            />
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditingCategory(null);
                                    setFormData({ name: "", description: "" });
                                    setError("");
                                }}
                                className="btn btn-outline"
                                style={{ padding: "0.5rem 1rem" }}
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={editingCategory ? handleUpdate : handleCreate}
                                className="btn btn-primary"
                                disabled={isSubmitting || !formData.name.trim()}
                                style={{ padding: "0.5rem 1rem" }}
                            >
                                {isSubmitting ? "儲存中..." : (editingCategory ? "更新" : "建立")}
                            </button>
                        </div>
                    </div>
                )}

                {/* Add Button */}
                {!isCreating && !editingCategory && (
                    <button
                        type="button"
                        onClick={openCreate}
                        className="btn btn-outline"
                        style={{ width: "100%" }}
                    >
                        + 新增分區
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="btn btn-outline"
                style={{ fontSize: "0.9rem" }}
            >
                管理分區
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(modalContent, document.body)}
        </>
    );
}
