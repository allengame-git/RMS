"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import EditProjectButton from "./EditProjectButton";
import DeleteProjectButton from "./DeleteProjectButton";
import { formatDate } from "@/lib/date-utils";

type Project = {
    id: number;
    title: string;
    description: string | null;
    codePrefix: string;
    createdAt: Date;
    updatedAt: Date;
    _count: {
        items: number;
    }
};

export default function ProjectList({ projects }: { projects: Project[] }) {
    const { data: session } = useSession();

    const canEdit = session?.user.role === "ADMIN" || session?.user.role === "INSPECTOR";

    if (projects.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-muted)" }}>
                <p>找不到專案。請建立一個新專案以開始。</p>
            </div>
        );
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
            {projects.map((project) => (
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
                                <EditProjectButton project={project} />
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
            ))}
        </div>
    );
}
