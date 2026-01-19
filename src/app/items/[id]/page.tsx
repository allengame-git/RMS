
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildItemTree } from "@/lib/tree-utils";
import SidebarNav from "@/components/item/SidebarNav";
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
            relationsFrom: {
                include: {
                    target: {
                        select: {
                            id: true,
                            fullId: true,
                            title: true,
                            projectId: true,
                            project: {
                                select: {
                                    title: true,
                                    codePrefix: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            },
            references: {
                include: {
                    file: {
                        select: {
                            id: true,
                            dataCode: true,
                            dataName: true,
                            dataYear: true,
                            author: true,
                            fileName: true
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            },
            history: {
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    submittedBy: { select: { username: true } },
                    reviewedBy: { select: { username: true } }
                }
            }
        }
    });

    if (!item) return notFound();

    // Transform relations to include description
    const relatedItems = item.relationsFrom.map(r => ({
        id: r.target.id,
        fullId: r.target.fullId,
        title: r.target.title,
        projectId: r.target.projectId,
        projectTitle: r.target.project.title,
        description: r.description
    }));

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
                <Link href={`/projects/${item.projectId}`} style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>&larr; 返回專案</Link>
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
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--color-text-muted)' }}>導覽</h3>
                    <SidebarNav nodes={rootNodes} currentItemId={itemId} canEdit={canEdit} projectId={item.projectId} />
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                            <div>
                                <h1 style={{ marginBottom: "0.5rem" }}>{item.title}</h1>
                                <div style={{ display: "flex", gap: "1rem", color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                                    <span style={{ fontFamily: "var(--font-geist-mono)", fontWeight: "bold", color: "var(--color-primary)" }}>{item.fullId}</span>
                                    <span>專案: <Link href={`/projects/${item.project.id}`} className="hover:underline">{item.project.title}</Link></span>
                                    {item.parent && (
                                        <span>父項目: <Link href={`/items/${item.parent.id}`} className="hover:underline">{item.parent.fullId}</Link></span>
                                    )}
                                </div>
                            </div>
                            {canEdit && !item.isDeleted && (
                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                    {isPending && <span style={{ color: "var(--color-warning)", fontSize: "0.9rem", marginRight: "0.5rem" }}>⚠️ 審核中</span>}
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
                            {item.isDeleted && (
                                <span style={{
                                    padding: "0.4rem 0.8rem",
                                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                                    color: "#ef4444",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "0.85rem",
                                    fontWeight: 500
                                }}>
                                    已刪除
                                </span>
                            )}
                        </div>

                        {item.content ? (
                            <div
                                className="rich-text-content"
                                style={{ lineHeight: "1.8" }}
                                dangerouslySetInnerHTML={{ __html: item.content }}
                            />
                        ) : (
                            <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>尚無內容</p>
                        )}
                    </div>

                    {/* Related Items Section with Description */}
                    {relatedItems.length > 0 && (() => {
                        // Group by project
                        type RelatedItemType = { id: number; fullId: string; title: string; projectId: number; projectTitle: string; description: string | null };
                        const grouped = relatedItems.reduce((acc: Record<string, RelatedItemType[]>, ri: RelatedItemType) => {
                            const key = ri.projectTitle;
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(ri);
                            return acc;
                        }, {} as Record<string, RelatedItemType[]>);

                        // Natural sort function for fullId
                        const naturalSort = (a: string, b: string) => {
                            const aParts = a.split('-').map(p => isNaN(Number(p)) ? p : Number(p));
                            const bParts = b.split('-').map(p => isNaN(Number(p)) ? p : Number(p));
                            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                                const aVal = aParts[i] ?? '';
                                const bVal = bParts[i] ?? '';
                                if (aVal < bVal) return -1;
                                if (aVal > bVal) return 1;
                            }
                            return 0;
                        };

                        // Sort items within each group
                        Object.values(grouped).forEach((items: RelatedItemType[]) => {
                            items.sort((a, b) => naturalSort(a.fullId, b.fullId));
                        });

                        // Sort project groups alphabetically
                        const sortedProjects = Object.keys(grouped).sort();

                        return (
                            <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", marginTop: "2rem" }}>
                                <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    關聯項目
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>
                                        ({relatedItems.length})
                                    </span>
                                </h3>
                                {sortedProjects.map((projectTitle) => (
                                    <div key={projectTitle} style={{ marginBottom: "1.5rem" }}>
                                        <div style={{
                                            fontSize: "0.85rem",
                                            fontWeight: 600,
                                            color: "var(--color-text-muted)",
                                            marginBottom: "0.5rem",
                                            paddingBottom: "0.25rem",
                                            borderBottom: "1px solid var(--color-border)"
                                        }}>
                                            {projectTitle}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                            {grouped[projectTitle].map((related: RelatedItemType) => (
                                                <a
                                                    key={related.id}
                                                    href={`/items/${related.id}`}
                                                    style={{
                                                        display: "block",
                                                        padding: "1rem",
                                                        backgroundColor: "var(--color-bg-elevated)",
                                                        borderRadius: "var(--radius-md)",
                                                        border: "1px solid var(--color-border)",
                                                        textDecoration: "none",
                                                        color: "inherit",
                                                        transition: "all 0.2s"
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{ fontWeight: "bold", fontFamily: "var(--font-geist-mono)", color: "var(--color-primary)" }}>
                                                            {related.fullId}
                                                        </span>
                                                        <span>{related.title}</span>
                                                    </div>
                                                    {related.description && (
                                                        <div style={{
                                                            marginTop: '0.5rem',
                                                            fontSize: '0.85rem',
                                                            color: 'var(--color-text-muted)',
                                                            paddingLeft: '0.5rem',
                                                            borderLeft: '2px solid var(--color-border)'
                                                        }}>
                                                            {related.description}
                                                        </div>
                                                    )}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

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

                    {/* References Section */}
                    {item.references && item.references.length > 0 && (
                        <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", marginTop: "2rem" }}>
                            <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                參考文獻
                                <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>
                                    ({item.references.length})
                                </span>
                            </h3>
                            {(() => {
                                // Group by year
                                type RefType = { fileId: number; citation: string | null; file: { id: number; dataCode: string; dataName: string; dataYear: number; author: string } };
                                const grouped = item.references.reduce((acc: Record<number, RefType[]>, ref: RefType) => {
                                    const year = ref.file.dataYear;
                                    if (!acc[year]) acc[year] = [];
                                    acc[year].push(ref);
                                    return acc;
                                }, {} as Record<number, RefType[]>);

                                const sortedYears = Object.keys(grouped).map(Number).sort((a, b) => b - a);

                                return sortedYears.map((year) => (
                                    <div key={year} style={{ marginBottom: "1.5rem" }}>
                                        <div style={{
                                            fontSize: "0.85rem",
                                            fontWeight: 600,
                                            color: "var(--color-text-muted)",
                                            marginBottom: "0.5rem",
                                            paddingBottom: "0.25rem",
                                            borderBottom: "1px solid var(--color-border)"
                                        }}>
                                            {year}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                            {grouped[year].map((ref: RefType) => (
                                                <a
                                                    key={ref.file.id}
                                                    href={`/datafiles/${ref.file.id}`}
                                                    style={{
                                                        display: "block",
                                                        padding: "1rem",
                                                        backgroundColor: "var(--color-bg-elevated)",
                                                        borderRadius: "var(--radius-md)",
                                                        border: "1px solid var(--color-border)",
                                                        textDecoration: "none",
                                                        color: "inherit",
                                                        transition: "all 0.2s"
                                                    }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: "bold" }}>{ref.file.dataName}</div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                                            作者: {ref.file.author}
                                                        </div>
                                                    </div>
                                                    {ref.citation && (
                                                        <div style={{
                                                            marginTop: '0.5rem',
                                                            fontSize: '0.85rem',
                                                            color: 'var(--color-text-muted)',
                                                            paddingLeft: '0.5rem',
                                                            borderLeft: '2px solid var(--color-border)'
                                                        }}>
                                                            引用說明: {ref.citation}
                                                        </div>
                                                    )}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}

                    {/* History Section */}
                    {item.history && item.history.length > 0 && (
                        <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", marginTop: "2rem" }}>
                            <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem" }}>變更歷史 (最近 10 筆)</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>版本</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>日期</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>類型</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>提交者</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {item.history.map((record) => (
                                            <tr key={record.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '0.75rem', fontFamily: 'var(--font-geist-mono)' }}>v{record.version}</td>
                                                <td style={{ padding: '0.75rem' }}>{new Date(record.createdAt).toLocaleString()}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <span style={{
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '1rem',
                                                        fontSize: '0.8rem',
                                                        backgroundColor: record.changeType === 'CREATE' ? 'var(--color-success-bg)' :
                                                            record.changeType === 'UPDATE' ? 'var(--color-info-bg)' :
                                                                record.changeType === 'DELETE' ? 'var(--color-error-bg)' : 'var(--color-bg-secondary)',
                                                        color: record.changeType === 'CREATE' ? 'var(--color-success)' :
                                                            record.changeType === 'UPDATE' ? 'var(--color-info)' :
                                                                record.changeType === 'DELETE' ? 'var(--color-error)' : 'var(--color-text)',
                                                    }}>
                                                        {record.changeType}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>{record.submittedBy?.username || record.submitterName || '(已刪除)'}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <Link
                                                        href={`/admin/history/detail/${record.id}`} // Or item specific URL?
                                                        style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                                                    >
                                                        查看詳情
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
