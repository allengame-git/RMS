import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CreateItemForm from "@/components/item/CreateItemForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildItemTree } from "@/lib/tree-utils";
import ItemTree from "@/components/item/ItemTree";
import ProjectSearch from "@/components/search/ProjectSearch";

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
    const projectId = parseInt(params.id);
    if (isNaN(projectId)) return notFound();

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            items: {
                where: { isDeleted: false },
                orderBy: { fullId: 'asc' }
            }
        }
    });

    if (!project) return notFound();

    const session = await getServerSession(authOptions);
    const canEdit = session?.user.role === "ADMIN" || session?.user.role === "EDITOR" || session?.user.role === "INSPECTOR";

    const rootNodes = buildItemTree(project.items);

    return (
        <div className="container" style={{ paddingBottom: "4rem" }}>
            <div style={{ marginBottom: "2rem" }}>
                <Link
                    href="/projects"
                    style={{
                        color: "var(--color-text-muted)",
                        fontSize: "0.9rem",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem"
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    返回專案列表
                </Link>
                <h1 style={{ marginTop: "0.75rem", marginBottom: "0.5rem" }}>
                    {project.title}
                    <span style={{ color: "var(--color-text-muted)", fontSize: "1.25rem", marginLeft: "0.75rem" }}>
                        ({project.codePrefix})
                    </span>
                </h1>
                {project.description && (
                    <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: "0.95rem" }}>
                        {project.description}
                    </p>
                )}
            </div>

            {/* Search functionality */}
            <ProjectSearch projectId={projectId} />

            <div className="glass" style={{
                padding: "2rem",
                borderRadius: "var(--radius-lg)",
                minHeight: "200px",
                border: "1px solid var(--color-border)"
            }}>
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1.5rem"
                }}>
                    <h2 style={{ margin: 0, fontSize: "1.25rem" }}>項目列表</h2>
                    {canEdit && <CreateItemForm projectId={projectId} codePrefix={project.codePrefix} />}
                </div>

                <div className="flex-col gap-sm">
                    {project.items.length === 0 ? (
                        <div style={{
                            textAlign: "center",
                            padding: "3rem 2rem",
                            color: "var(--color-text-muted)",
                            backgroundColor: "var(--color-bg-elevated)",
                            borderRadius: "var(--radius-md)",
                            border: "1px dashed var(--color-border)"
                        }}>
                            <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                style={{ marginBottom: "0.75rem", opacity: 0.4 }}
                            >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <p style={{ margin: 0, fontSize: "0.9rem" }}>尚無項目資料</p>
                            {canEdit && (
                                <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
                                    點擊右上角「+ 新增項目」開始建立
                                </p>
                            )}
                        </div>
                    ) : (
                        <ItemTree nodes={rootNodes} canEdit={canEdit} projectId={projectId} />
                    )}
                </div>
            </div>
        </div>
    );
}
