
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import RelatedItemsManager from "@/components/item/RelatedItemsManager";
import { buildItemTree } from "@/lib/tree-utils";
import ItemTree from "@/components/item/ItemTree";
import EditItemButton from "@/components/item/EditItemButton";
import DeleteItemButton from "@/components/item/DeleteItemButton";

export const dynamic = 'force-dynamic';

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
    const itemId = parseInt(params.id);
    if (isNaN(itemId)) return notFound();

    const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: {
            project: true,
            parent: true,
            children: true,
            relatedItems: {
                select: {
                    id: true,
                    fullId: true,
                    title: true,
                    projectId: true
                }
            }
        }
    });

    if (!item) return notFound();

    // Fetch all items in the project to build the tree for sidebar
    const projectItems = await prisma.item.findMany({
        where: { projectId: item.projectId },
        select: { id: true, fullId: true, title: true, parentId: true, projectId: true },
        orderBy: { fullId: 'asc' }
    });

    const rootNodes = buildItemTree(projectItems);


    const session = await getServerSession(authOptions);
    const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDITOR" || session?.user?.role === "INSPECTOR";

    // Check for pending Update/Delete requests
    const pendingRequests = await prisma.changeRequest.count({
        where: {
            itemId: item.id,
            status: "PENDING"
        }
    });

    const isPending = pendingRequests > 0;

    return (
        <div style={{ paddingBottom: "4rem", maxWidth: "1400px", margin: "0 auto", padding: "0 2rem" }}>
            <div style={{ marginBottom: "1rem" }}>
                <Link href={`/projects/${item.projectId}`} style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>&larr; Back to Project</Link>
            </div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                {/* Sidebar Menu */}
                <div style={{
                    width: '300px',
                    flexShrink: 0,
                    position: 'sticky',
                    top: '2rem',
                    maxHeight: 'calc(100vh - 4rem)',
                    overflowY: 'auto',
                    paddingRight: '1rem',
                    borderRight: '1px solid var(--color-border)'
                }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--color-text-muted)' }}>Navigation</h3>
                    <ItemTree nodes={rootNodes} projectId={item.projectId} canEdit={canEdit} />
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                            <div>
                                <h1 style={{ marginBottom: "0.5rem" }}>{item.title}</h1>
                                <div style={{ display: "flex", gap: "1rem", color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                                    <span style={{ fontFamily: "var(--font-geist-mono)", fontWeight: "bold", color: "var(--color-primary)" }}>{item.fullId}</span>
                                    <span>Project: <Link href={`/projects/${item.project.id}`} className="hover:underline">{item.project.title}</Link></span>
                                    {item.parent && (
                                        <span>Parent: <Link href={`/items/${item.parent.id}`} className="hover:underline">{item.parent.fullId}</Link></span>
                                    )}
                                </div>
                            </div>
                            {canEdit && (
                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                    {isPending && <span style={{ color: "var(--color-warning)", fontSize: "0.9rem", marginRight: "0.5rem" }}>⚠️ Pending Approval</span>}
                                    <EditItemButton
                                        item={item}
                                        isDisabled={isPending}
                                    />
                                    <DeleteItemButton
                                        itemId={item.id}
                                        childCount={item.children.length}
                                        isDisabled={isPending}
                                    />
                                </div>
                            )}
                        </div>

                        {item.content ? (
                            <div
                                className="rich-text-content"
                                style={{ lineHeight: "1.8" }}
                                dangerouslySetInnerHTML={{ __html: item.content }}
                            />
                        ) : (
                            <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>No content.</p>
                        )}
                    </div>

                    {/* Related Items Section */}
                    <RelatedItemsManager
                        sourceItemId={item.id}
                        initialRelatedItems={item.relatedItems || []}
                        canEdit={canEdit}
                    />

                    {/* Attachments Section */}
                    {item.attachments && JSON.parse(item.attachments).length > 0 && (
                        <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", marginTop: "2rem" }}>
                            <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem" }}>附件檔案</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                {JSON.parse(item.attachments).map((file: any, index: number) => (
                                    <a
                                        key={index}
                                        href={file.path}
                                        download={file.name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "1rem",
                                            border: "1px solid var(--color-border)",
                                            borderRadius: "var(--radius-sm)",
                                            textDecoration: "none",
                                            color: "inherit",
                                            transition: "all 0.2s",
                                        }}
                                        className="attachment-link"
                                    >
                                        <div>
                                            <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>{file.name}</div>
                                            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                                                {(file.size / (1024 * 1024)).toFixed(2)} MB • {new Date(file.uploadedAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <span style={{ color: "var(--color-primary)" }}>下載 ↓</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
