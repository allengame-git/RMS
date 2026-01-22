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
    const rootItemCount = rootNodes.length;
    const totalItemCount = project.items.length;

    return (
        <div className="container" style={{ paddingBottom: "4rem" }}>
            {/* Enhanced Project Header */}
            <div className="project-header">
                <div className="project-header-content">
                    <Link href="/projects" className="back-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        返回專案列表
                    </Link>
                    <h1>
                        {project.title}
                        <span className="code-badge">{project.codePrefix}</span>
                    </h1>
                    {project.description && (
                        <p className="description">{project.description}</p>
                    )}
                    <div className="project-stats">
                        <div className="project-stat">
                            <span className="project-stat-value">{totalItemCount}</span>
                            <span className="project-stat-label">項目總數</span>
                        </div>
                        <div className="project-stat">
                            <span className="project-stat-value">{rootItemCount}</span>
                            <span className="project-stat-label">根項目</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search functionality */}
            <ProjectSearch projectId={projectId} />

            {/* Item List Container */}
            <div className="item-list-container">
                <div className="item-list-header">
                    <h2 className="section-title">
                        <span className="section-title-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                        </span>
                        項目列表
                    </h2>
                    {canEdit && <CreateItemForm projectId={projectId} codePrefix={project.codePrefix} />}
                </div>

                <div className="item-list-body">
                    {project.items.length === 0 ? (
                        <div className="empty-state">
                            <svg
                                className="empty-state-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                            >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <p className="empty-state-title">尚無項目資料</p>
                            {canEdit && (
                                <p className="empty-state-text">
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
