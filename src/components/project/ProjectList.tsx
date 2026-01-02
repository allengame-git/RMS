"use client";

import { deleteProject } from "@/actions/project";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTransition } from "react";

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
    const [isPending, startTransition] = useTransition();

    const handleDelete = (id: number) => {
        if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
            startTransition(async () => {
                await deleteProject(id);
            });
        }
    };

    if (projects.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-muted)" }}>
                <p>No projects found. Create one to get started.</p>
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
                        {session?.user.role === "ADMIN" && (
                            <button
                                onClick={() => handleDelete(project.id)}
                                disabled={isPending}
                                style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "1.2rem" }}
                                title="Delete Project"
                            >
                                &times;
                            </button>
                        )}
                    </div>

                    <p style={{ color: "var(--color-text-muted)", fontSize: "0.95rem", flex: 1 }}>
                        {project.description || "No description"}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                        <span>{project._count.items} Items</span>
                        <span>{new Date(project.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
