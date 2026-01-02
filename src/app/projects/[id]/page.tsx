import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CreateItemForm from "@/components/item/CreateItemForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildItemTree } from "@/lib/tree-utils";
import ItemTree from "@/components/item/ItemTree";

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
    const projectId = parseInt(params.id);
    if (isNaN(projectId)) return notFound();

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            items: {
                orderBy: { fullId: 'asc' }
            }
        }
    });

    if (!project) return notFound();

    const session = await getServerSession(authOptions);
    const canEdit = session?.user.role === "ADMIN" || session?.user.role === "EDITOR";

    const rootNodes = buildItemTree(project.items);

    return (
        <div className="container" style={{ paddingBottom: "4rem" }}>
            <div style={{ marginBottom: "2rem" }}>
                <Link href="/projects" style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>&larr; Back to Projects</Link>
                <h1 style={{ marginTop: "0.5rem" }}>{project.title} <span style={{ color: "var(--color-text-muted)", fontSize: "1.5rem" }}>({project.codePrefix})</span></h1>
                <p style={{ color: "var(--color-text-muted)" }}>{project.description}</p>
            </div>

            <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", minHeight: "200px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                    <h2>Items</h2>
                    {canEdit && <CreateItemForm projectId={projectId} />}
                </div>

                <div className="flex-col gap-sm">
                    {project.items.length === 0 ? (
                        <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>No items yet.</p>
                    ) : (
                        <ItemTree nodes={rootNodes} canEdit={canEdit} projectId={projectId} />
                    )}
                </div>
            </div>
        </div>
    );
}
