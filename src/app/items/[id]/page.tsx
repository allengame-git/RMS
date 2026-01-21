
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

// SVG Icons
const FolderIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);

const LinkIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);

const PaperclipIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
);

const BookIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
);

const HistoryIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <path d="M12 7v5l4 2" />
    </svg>
);

const ChevronLeftIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
    </svg>
);

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

    // Section styles
    const sectionStyle = {
        padding: "1.75rem",
        borderRadius: "var(--radius-lg)",
        marginTop: "1.5rem",
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)"
    };

    const sectionHeaderStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        marginBottom: "1.25rem",
        fontSize: "1.1rem",
        fontWeight: 600,
        color: "var(--color-text-main)"
    };

    const cardHoverStyle = `
        .item-card {
            transition: all 0.2s ease;
            cursor: pointer;
        }
        .item-card:hover {
            border-color: var(--color-primary);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            transform: translateY(-1px);
        }
        .attachment-link:hover {
            background-color: var(--color-bg-elevated);
            border-color: var(--color-primary);
        }
        .history-row:hover {
            background-color: var(--color-bg-elevated);
        }
        .history-row:nth-child(even) {
            background-color: rgba(0, 0, 0, 0.02);
        }
    `;

    return (
        <div style={{ paddingBottom: "4rem", maxWidth: "1400px", margin: "0 auto", padding: "0 2rem" }}>
            {/* Breadcrumb */}
            <div style={{ marginBottom: "1.5rem" }}>
                <Link
                    href={`/projects/${item.projectId}`}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        color: "var(--color-text-muted)",
                        fontSize: "0.9rem",
                        textDecoration: 'none',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'all 0.2s'
                    }}
                    className="breadcrumb-link"
                >
                    <ChevronLeftIcon />
                    返回專案
                </Link>
            </div>

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
                    <SidebarNav nodes={rootNodes} currentItemId={itemId} canEdit={canEdit} projectId={item.projectId} />
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header Card */}
                    <div style={{
                        padding: "2rem",
                        borderRadius: "var(--radius-lg)",
                        backgroundColor: "var(--color-bg-surface)",
                        border: "1px solid var(--color-border)",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)"
                    }}>
                        {/* Top Row: ID Badge + Actions */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "1rem"
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {/* ID Badge */}
                                <span style={{
                                    fontFamily: "var(--font-geist-mono)",
                                    fontWeight: 700,
                                    fontSize: "1.1rem",
                                    color: "var(--color-primary)",
                                    backgroundColor: "var(--color-primary-soft)",
                                    padding: "0.4rem 0.8rem",
                                    borderRadius: "var(--radius-sm)"
                                }}>
                                    {item.fullId}
                                </span>
                                {isPending && (
                                    <span style={{
                                        color: "var(--color-warning)",
                                        fontSize: "0.85rem",
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        padding: "0.3rem 0.6rem",
                                        backgroundColor: "rgba(234, 179, 8, 0.1)",
                                        borderRadius: "var(--radius-sm)"
                                    }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                                        審核中
                                    </span>
                                )}
                                {item.isDeleted && (
                                    <span style={{
                                        padding: "0.3rem 0.6rem",
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
                            {canEdit && !item.isDeleted && (
                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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

                        {/* Title */}
                        <h1 style={{
                            fontSize: "1.75rem",
                            fontWeight: 700,
                            marginBottom: "1rem",
                            lineHeight: 1.3,
                            color: "var(--color-text-main)"
                        }}>
                            {item.title}
                        </h1>

                        {/* Metadata Row */}
                        <div style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "1.5rem",
                            color: "var(--color-text-muted)",
                            fontSize: "0.9rem",
                            padding: "0.75rem 0",
                            borderTop: "1px solid var(--color-border)"
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <FolderIcon />
                                <span>專案:</span>
                                <Link
                                    href={`/projects/${item.project.id}`}
                                    style={{
                                        color: 'var(--color-primary)',
                                        textDecoration: 'none',
                                        fontWeight: 500
                                    }}
                                >
                                    {item.project.title}
                                </Link>
                            </span>
                            {item.parent && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                    <span>父項目:</span>
                                    <Link
                                        href={`/items/${item.parent.id}`}
                                        style={{
                                            color: 'var(--color-primary)',
                                            textDecoration: 'none',
                                            fontFamily: 'var(--font-geist-mono)',
                                            fontWeight: 500
                                        }}
                                    >
                                        {item.parent.fullId}
                                    </Link>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Content Section */}
                    <div style={sectionStyle}>
                        {item.content ? (
                            <div
                                className="rich-text-content"
                                style={{ lineHeight: "1.8" }}
                                dangerouslySetInnerHTML={{ __html: item.content }}
                            />
                        ) : (
                            <p style={{ color: "var(--color-text-muted)", fontStyle: "italic", textAlign: 'center', padding: '2rem 0' }}>
                                尚無內容
                            </p>
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
                            <div style={sectionStyle}>
                                <h3 style={sectionHeaderStyle}>
                                    <span style={{ color: 'var(--color-primary)' }}><LinkIcon /></span>
                                    關聯項目
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
                                        ({relatedItems.length})
                                    </span>
                                </h3>
                                {sortedProjects.map((projectTitle) => (
                                    <div key={projectTitle} style={{ marginBottom: "1.25rem" }}>
                                        <div style={{
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                            color: "var(--color-text-muted)",
                                            marginBottom: "0.6rem",
                                            paddingBottom: "0.25rem",
                                            borderBottom: "1px solid var(--color-border)",
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.03em'
                                        }}>
                                            {projectTitle}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                            {grouped[projectTitle].map((related: RelatedItemType) => (
                                                <a
                                                    key={related.id}
                                                    href={`/items/${related.id}`}
                                                    className="item-card"
                                                    style={{
                                                        display: "block",
                                                        padding: "1rem",
                                                        backgroundColor: "var(--color-bg-elevated)",
                                                        borderRadius: "var(--radius-md)",
                                                        border: "1px solid var(--color-border)",
                                                        borderLeft: "3px solid var(--color-primary)",
                                                        textDecoration: "none",
                                                        color: "inherit"
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            fontFamily: "var(--font-geist-mono)",
                                                            color: "var(--color-primary)",
                                                            fontSize: '0.9rem'
                                                        }}>
                                                            {related.fullId}
                                                        </span>
                                                        <span style={{ color: 'var(--color-text-main)' }}>{related.title}</span>
                                                    </div>
                                                    {related.description && (
                                                        <div style={{
                                                            marginTop: '0.5rem',
                                                            fontSize: '0.85rem',
                                                            color: 'var(--color-text-muted)',
                                                            paddingLeft: '0.75rem',
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
                        <div style={sectionStyle}>
                            <h3 style={sectionHeaderStyle}>
                                <span style={{ color: 'var(--color-primary)' }}><PaperclipIcon /></span>
                                附件檔案
                                <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
                                    ({JSON.parse(item.attachments).length})
                                </span>
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                {JSON.parse(item.attachments).map((file: any, index: number) => (
                                    <a
                                        key={index}
                                        href={file.path}
                                        download={file.name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="attachment-link item-card"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "1rem",
                                            border: "1px solid var(--color-border)",
                                            borderLeft: "3px solid var(--color-info)",
                                            borderRadius: "var(--radius-md)",
                                            textDecoration: "none",
                                            color: "inherit",
                                            backgroundColor: "var(--color-bg-elevated)"
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{file.name}</div>
                                            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                                                {(file.size / (1024 * 1024)).toFixed(2)} MB • {new Date(file.uploadedAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <span style={{
                                            color: "var(--color-primary)",
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                            </svg>
                                            下載
                                        </span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* References Section */}
                    {item.references && item.references.length > 0 && (
                        <div style={sectionStyle}>
                            <h3 style={sectionHeaderStyle}>
                                <span style={{ color: 'var(--color-primary)' }}><BookIcon /></span>
                                參考文獻
                                <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
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
                                    <div key={year} style={{ marginBottom: "1.25rem" }}>
                                        <div style={{
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                            color: "var(--color-text-muted)",
                                            marginBottom: "0.6rem",
                                            paddingBottom: "0.25rem",
                                            borderBottom: "1px solid var(--color-border)"
                                        }}>
                                            {year}年
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                            {grouped[year].map((ref: RefType) => (
                                                <a
                                                    key={ref.file.id}
                                                    href={`/datafiles/${ref.file.id}`}
                                                    className="item-card"
                                                    style={{
                                                        display: "block",
                                                        padding: "1rem",
                                                        backgroundColor: "var(--color-bg-elevated)",
                                                        borderRadius: "var(--radius-md)",
                                                        border: "1px solid var(--color-border)",
                                                        borderLeft: "3px solid var(--color-success)",
                                                        textDecoration: "none",
                                                        color: "inherit"
                                                    }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{ref.file.dataName}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                                            作者: {ref.file.author}
                                                        </div>
                                                    </div>
                                                    {ref.citation && (
                                                        <div style={{
                                                            marginTop: '0.5rem',
                                                            fontSize: '0.85rem',
                                                            color: 'var(--color-text-muted)',
                                                            paddingLeft: '0.75rem',
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
                        <div style={sectionStyle}>
                            <h3 style={sectionHeaderStyle}>
                                <span style={{ color: 'var(--color-primary)' }}><HistoryIcon /></span>
                                變更歷史
                                <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
                                    (最近 10 筆)
                                </span>
                            </h3>
                            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{
                                            backgroundColor: 'var(--color-bg-elevated)',
                                            textAlign: 'left'
                                        }}>
                                            <th style={{ padding: '0.85rem 1rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>版本</th>
                                            <th style={{ padding: '0.85rem 1rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>日期</th>
                                            <th style={{ padding: '0.85rem 1rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>類型</th>
                                            <th style={{ padding: '0.85rem 1rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>提交者</th>
                                            <th style={{ padding: '0.85rem 1rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {item.history.map((record, idx) => (
                                            <tr
                                                key={record.id}
                                                className="history-row"
                                                style={{
                                                    borderTop: '1px solid var(--color-border)',
                                                    backgroundColor: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.015)' : 'transparent'
                                                }}
                                            >
                                                <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-geist-mono)', fontWeight: 600 }}>v{record.version}</td>
                                                <td style={{ padding: '0.85rem 1rem', color: 'var(--color-text-muted)' }}>{new Date(record.createdAt).toLocaleString()}</td>
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.6rem',
                                                        borderRadius: '1rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        backgroundColor: record.changeType === 'CREATE' ? 'rgba(34, 197, 94, 0.1)' :
                                                            record.changeType === 'UPDATE' ? 'rgba(59, 130, 246, 0.1)' :
                                                                record.changeType === 'DELETE' ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg-secondary)',
                                                        color: record.changeType === 'CREATE' ? '#16a34a' :
                                                            record.changeType === 'UPDATE' ? '#2563eb' :
                                                                record.changeType === 'DELETE' ? '#dc2626' : 'var(--color-text)',
                                                    }}>
                                                        {record.changeType === 'CREATE' ? '建立' : record.changeType === 'UPDATE' ? '更新' : record.changeType === 'DELETE' ? '刪除' : record.changeType}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem' }}>{record.submittedBy?.username || record.submitterName || '(已刪除)'}</td>
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <Link
                                                        href={`/admin/history/detail/${record.id}`}
                                                        style={{
                                                            color: 'var(--color-primary)',
                                                            textDecoration: 'none',
                                                            fontWeight: 500,
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        查看詳情 →
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

            <style>{cardHoverStyle}</style>
            <style>{`
                .breadcrumb-link:hover {
                    background-color: var(--color-bg-elevated);
                    color: var(--color-primary);
                }
            `}</style>
        </div>
    );
}
