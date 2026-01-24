/**
 * @file ProjectList.tsx
 * @description 專案列表元件
 *
 * 以卡片形式顯示所有專案，支援按分區分組和摺疊。
 *
 * ## 核心功能
 * - 按分區分組顯示專案
 * - 分區可展開/摺疊
 * - 專案卡片顯示基本資訊
 * - 編輯/刪除/複製操作按鈕
 *
 * ## Props
 * - `projects`：專案資料陣列
 * - `categories`：分區資料陣列
 *
 * ## 權限控制
 * - 編輯按鈕：ADMIN 或 PM 可見
 * - 刪除按鈕：僅 ADMIN 可見
 *
 * ## 專案卡片資訊
 * - 專案名稱（連結到專案頁面）
 * - 代碼前綴
 * - 描述
 * - 項目數量
 * - 更新日期
 *
 * @see /src/app/projects/page.tsx - 專案列表頁面
 * @see /src/components/project/EditProjectButton.tsx - 編輯按鈕
 * @see /src/components/project/DeleteProjectButton.tsx - 刪除按鈕
 */

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import EditProjectButton from "./EditProjectButton";
import DeleteProjectButton from "./DeleteProjectButton";
import CopyProjectButton from "./CopyProjectButton";
import { formatDate } from "@/lib/date-utils";

interface Category {
    id: number;
    name: string;
    description: string | null;
    sortOrder: number;
}

type Project = {
    id: number;
    title: string;
    description: string | null;
    codePrefix: string;
    createdAt: Date;
    updatedAt: Date;
    categoryId: number | null;
    _count: {
        items: number;
    }
};

interface ProjectListProps {
    projects: Project[];
    categories: Category[];
}

export default function ProjectList({ projects, categories }: ProjectListProps) {
    const { data: session } = useSession();
    const [collapsedCategories, setCollapsedCategories] = useState<Set<number | null>>(new Set());

    const canEdit = session?.user.role === "ADMIN" || session?.user.isPM === true;

    // Group projects by category
    const groupedProjects = new Map<number | null, Project[]>();

    // Initialize groups for each category
    categories.forEach(cat => {
        groupedProjects.set(cat.id, []);
    });
    groupedProjects.set(null, []); // Uncategorized

    // Distribute projects into groups
    projects.forEach(project => {
        const categoryId = project.categoryId;
        const existing = groupedProjects.get(categoryId) || [];
        existing.push(project);
        groupedProjects.set(categoryId, existing);
    });

    const toggleCategory = (categoryId: number | null) => {
        setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };

    const renderProjectCard = (project: Project) => (
        <div key={project.id} className="glass" style={{ padding: "1.5rem", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <h3 style={{ fontSize: "1.25rem" }}>
                        <Link href={`/projects/${project.id}`} style={{ textDecoration: "none", color: "var(--color-primary)" }} className="hover:underline">
                            {project.title}
                        </Link>
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", backgroundColor: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: "4px" }}>
                        {project.codePrefix}
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {canEdit && (
                        <>
                            <CopyProjectButton project={project} categories={categories} />
                            <EditProjectButton project={project} categories={categories} />
                        </>
                    )}
                    {session?.user.role === "ADMIN" && (
                        <DeleteProjectButton project={project} />
                    )}
                </div>
            </div>

            <p style={{ color: "var(--color-text-muted)", fontSize: "0.95rem", flex: 1 }}>
                {project.description || "無描述"}
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                <span>{project._count.items} 個項目</span>
                <span>{formatDate(project.updatedAt)}</span>
            </div>
        </div>
    );

    const renderCategorySection = (categoryId: number | null, categoryName: string, projectsList: Project[]) => {
        // Only hide empty uncategorized section
        if (categoryId === null && projectsList.length === 0) return null;

        const isCollapsed = collapsedCategories.has(categoryId);

        return (
            <div key={categoryId ?? 'uncategorized'} style={{ marginBottom: "2rem" }}>
                <div
                    onClick={() => toggleCategory(categoryId)}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        cursor: "pointer",
                        padding: "0.5rem 0",
                        marginBottom: "1rem",
                        borderBottom: "1px solid var(--color-border)"
                    }}
                >
                    <span style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                        ▼
                    </span>
                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>{categoryName}</h2>
                    <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                        ({projectsList.length})
                    </span>
                </div>

                {!isCollapsed && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
                        {projectsList.map(renderProjectCard)}
                    </div>
                )}
            </div>
        );
    };

    if (projects.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-muted)" }}>
                <p>找不到專案。請建立一個新專案以開始。</p>
            </div>
        );
    }

    return (
        <div>
            {/* Render categories in order */}
            {categories.map(cat =>
                renderCategorySection(cat.id, cat.name, groupedProjects.get(cat.id) || [])
            )}

            {/* Render uncategorized projects */}
            {renderCategorySection(null, "未分類", groupedProjects.get(null) || [])}
        </div>
    );
}

