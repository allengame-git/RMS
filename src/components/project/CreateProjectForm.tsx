/**
 * @file CreateProjectForm.tsx
 * @description 新增專案表單元件
 *
 * 用於建立新專案的表單，包含專案基本資訊輸入。
 *
 * ## 核心功能
 * - 專案名稱輸入（必填）
 * - 代碼前綴輸入（必填，格式驗證）
 * - 分區選擇
 * - 描述輸入
 *
 * ## 代碼前綴規則
 * - 僅允許大寫英文字母、數字
 * - 可使用連字號分隔
 * - 範例：`WEB`, `Q4`, `DAREN-SI`
 *
 * ## 表單行為
 * - 初始為收合的「新增專案」按鈕
 * - 點擊後展開表單
 * - 提交成功後自動收合
 *
 * ## 權限控制
 * 此表單僅對 ADMIN/EDITOR 以上角色顯示（由父元件控制）
 *
 * @see /src/actions/project.ts - createProject Server Action
 * @see /src/app/projects/page.tsx - 專案列表頁面
 */

"use client";

import { useFormStatus, useFormState } from "react-dom";
import { createProject, ProjectState } from "@/actions/project";
import { useEffect, useState } from "react";

interface Category {
    id: number;
    name: string;
}

interface CreateProjectFormProps {
    categories: Category[];
}

const initialState: ProjectState = {
    message: "",
    error: "",
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "建立中..." : "建立專案"}
        </button>
    );
}

export default function CreateProjectForm({ categories }: CreateProjectFormProps) {
    const [state, formAction] = useFormState(createProject, initialState);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (state.message) {
            setIsOpen(false);
        }
    }, [state.message]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="btn btn-primary"
            >
                + 新增專案
            </button>
        );
    }

    return (
        <div className="glass" style={{ padding: "1.5rem", borderRadius: "var(--radius-md)", marginBottom: "2rem" }}>
            <div className="flex-center" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
                <h3>建立新專案</h3>
                <button
                    onClick={() => setIsOpen(false)}
                    className="btn btn-outline"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                >
                    取消
                </button>
            </div>

            <form action={formAction} className="flex-col gap-md">
                {state.error && (
                    <div style={{ color: "var(--color-danger)", padding: "0.5rem", background: "rgba(255,0,0,0.1)", borderRadius: "var(--radius-sm)" }}>
                        {state.error}
                    </div>
                )}

                <div className="flex-col gap-sm">
                    <label htmlFor="title" style={{ fontSize: "0.9rem", fontWeight: 500 }}>專案名稱</label>
                    <input
                        id="title"
                        name="title"
                        type="text"
                        required
                        placeholder="例如：網站改版"
                        className="input-field"
                        style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                    />
                </div>

                <div className="flex-col gap-sm">
                    <label htmlFor="codePrefix" style={{ fontSize: "0.9rem", fontWeight: 500 }}>代碼前綴 (大寫英文、數字、連字號)</label>
                    <input
                        id="codePrefix"
                        name="codePrefix"
                        type="text"
                        required
                        pattern="[A-Z0-9]+(-[A-Z0-9]+)*"
                        placeholder="例如：WEB, Q4, DAREN-SI"
                        className="input-field"
                        style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                    />
                </div>

                <div className="flex-col gap-sm">
                    <label htmlFor="categoryId" style={{ fontSize: "0.9rem", fontWeight: 500 }}>分區</label>
                    <select
                        id="categoryId"
                        name="categoryId"
                        style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                    >
                        <option value="">未分類</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-col gap-sm">
                    <label htmlFor="description" style={{ fontSize: "0.9rem", fontWeight: 500 }}>描述</label>
                    <textarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="專案簡述..."
                        style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontFamily: "inherit" }}
                    />
                </div>

                <div style={{ alignSelf: "flex-end" }}>
                    <SubmitButton />
                </div>
            </form>
        </div>
    );
}

