import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildItemTree } from "@/lib/tree-utils";
import { notFound } from "next/navigation";
import ItemSidebarWrapper from "@/components/item/ItemSidebarWrapper";

export default async function ItemLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const itemId = parseInt(id);
    if (isNaN(itemId)) return notFound();

    const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { projectId: true }
    });

    if (!item) return notFound();

    const projectItems = await prisma.item.findMany({
        where: { projectId: item.projectId, isDeleted: false },
        select: { id: true, fullId: true, title: true, parentId: true, projectId: true },
        orderBy: { fullId: 'asc' }
    });

    const rootNodes = buildItemTree(projectItems);

    const session = await getServerSession(authOptions);
    const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "EDITOR" || session?.user?.role === "INSPECTOR";

    return (
        <div style={{ paddingBottom: "4rem", maxWidth: "1400px", margin: "0 auto", padding: "0 2rem" }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                {/* Sidebar Menu */}
                <div style={{
                    width: '280px',
                    flexShrink: 0,
                    position: 'sticky',
                    top: '5rem',
                    maxHeight: 'calc(100vh - 6rem)',
                    overflowY: 'auto',
                    paddingRight: '1rem',
                    borderRight: '1px solid var(--color-border)'
                }}>
                    <h3 style={{
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>項目導覽</h3>
                    <ItemSidebarWrapper nodes={rootNodes} canEdit={canEdit} projectId={item.projectId} />
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
