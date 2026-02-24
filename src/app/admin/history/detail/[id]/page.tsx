import { getHistoryDetail, ItemSnapshot } from "@/actions/history";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReviewProcessTimeline from "@/components/approval/ReviewProcessTimeline";
import DOMPurify from "isomorphic-dompurify";

export const dynamic = 'force-dynamic';

// SVG Icons (consistent with Item Detail page)
const ChevronLeftIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
    </svg>
);

const HistoryIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <path d="M12 7v5l4 2" />
    </svg>
);

const FileTextIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10,9 9,9 8,9" />
    </svg>
);

const DiffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18" />
        <rect x="3" y="8" width="6" height="8" rx="1" />
        <rect x="15" y="8" width="6" height="8" rx="1" />
    </svg>
);

const SnapshotIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);

const PaperclipIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7,10 12,15 17,10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

export default async function HistoryDetailPage({ params }: { params: { id: string } }) {
    const historyId = parseInt(params.id);
    if (isNaN(historyId)) return notFound();

    const record = await getHistoryDetail(historyId);
    if (!record) return notFound();

    const snapshot = JSON.parse(record.snapshot) as ItemSnapshot;
    const diff = record.diff ? JSON.parse(record.diff) : null;

    // Reconstruct the previous version snapshot from diff (if UPDATE)
    const previousSnapshot: ItemSnapshot | null = diff ? {
        ...snapshot,
        title: diff.title?.old ?? snapshot.title,
        content: diff.content?.old ?? snapshot.content,
        attachments: diff.attachments?.old ?? snapshot.attachments,
        relatedItems: diff.relatedItems?.old ?? snapshot.relatedItems,
        references: diff.references?.old ?? snapshot.references,
    } : null;

    // Consistent section styles
    const sectionStyle = {
        padding: "1.75rem",
        borderRadius: "var(--radius-lg)",
        marginBottom: "1.5rem",
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
        color: "var(--color-text-main)",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid var(--color-border)"
    };

    // Helper to render attachments as clickable links
    const renderAttachments = (attachmentsJson: string | null) => {
        if (!attachmentsJson) return null;
        try {
            const files = JSON.parse(attachmentsJson) as { name: string; path: string; size: number; uploadedAt: string }[];
            if (files.length === 0) return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>無附件</span>;
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {files.map((file, index) => (
                        <a
                            key={index}
                            href={encodeURI(file.path)}
                            download={file.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="attachment-card"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                border: '1px solid var(--color-border)',
                                borderLeft: '3px solid var(--color-info)',
                                borderRadius: 'var(--radius-md)',
                                textDecoration: 'none',
                                color: 'inherit',
                                backgroundColor: 'var(--color-bg-elevated)',
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                            }}
                        >
                            <span style={{ color: 'var(--color-info)' }}><PaperclipIcon /></span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500 }}>{file.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </div>
                            </div>
                            <span style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <DownloadIcon /> 下載
                            </span>
                        </a>
                    ))}
                </div>
            );
        } catch {
            return <pre style={{ fontSize: '0.85rem' }}>{attachmentsJson}</pre>;
        }
    };

    // Helper for Diff Visualization
    const renderDiff = (diffData: any) => {
        return Object.entries(diffData).map(([key, value]: [string, any]) => {
            const isHtmlContent = key === 'content';
            const isRelatedItems = key === 'relatedItems';
            const isReferences = key === 'references';

            const renderRelatedItemsList = (items: { id: number; fullId: string; title?: string; description?: string }[] | null) => {
                if (!items || items.length === 0) {
                    return <em style={{ color: 'var(--color-text-muted)' }}>無關聯項目</em>;
                }
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {items.map((ri) => (
                            <div key={ri.id} style={{
                                padding: '0.75rem',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--color-bg-elevated)'
                            }}>
                                <div style={{ marginBottom: '0.25rem' }}>
                                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                                        {ri.fullId}
                                    </span>
                                    {ri.title && (
                                        <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-main)' }}>
                                            {ri.title}
                                        </span>
                                    )}
                                </div>
                                {ri.description && (
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--color-text-muted)',
                                        paddingLeft: '0.5rem',
                                        borderLeft: '2px solid var(--color-border)',
                                        marginTop: '0.25rem'
                                    }}>
                                        {ri.description}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            };

            const renderReferencesList = (refs: { fileId: number; dataCode: string; dataName: string; dataYear: number; author: string; citation?: string }[] | null) => {
                if (!refs || refs.length === 0) {
                    return <em style={{ color: 'var(--color-text-muted)' }}>無參考文獻</em>;
                }
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {refs.map((ref) => (
                            <div key={ref.fileId} style={{
                                padding: '0.75rem',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--color-bg-elevated)'
                            }}>
                                <div style={{ marginBottom: '0.25rem' }}>
                                    <div style={{ fontWeight: 600 }}>{ref.dataName} ({ref.dataYear})</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                                        作者: {ref.author}
                                    </div>
                                </div>
                                {ref.citation && (
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--color-text-muted)',
                                        paddingLeft: '0.5rem',
                                        borderLeft: '2px solid var(--color-border)',
                                        marginTop: '0.25rem'
                                    }}>
                                        {ref.citation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            };

            const fieldLabels: Record<string, string> = {
                'relatedItems': '關聯項目',
                'references': '參考文獻',
                'content': '內容',
                'title': '標題',
                'attachments': '附件'
            };

            return (
                <div key={key} style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        marginBottom: '0.75rem',
                        letterSpacing: '0.05em'
                    }}>
                        {fieldLabels[key] || key}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Before */}
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.04)',
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            borderLeft: '3px solid #ef4444'
                        }}>
                            <div style={{
                                fontSize: '0.7rem',
                                color: '#dc2626',
                                fontWeight: 700,
                                marginBottom: '0.5rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>修改前</div>
                            {isHtmlContent ? (
                                <div
                                    className="rich-text-content"
                                    style={{ fontSize: '0.9rem', maxHeight: '400px', overflow: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value.old || '<em style="color:var(--color-text-muted)">空白</em>') }}
                                />
                            ) : isRelatedItems ? (
                                renderRelatedItemsList(value.old)
                            ) : isReferences ? (
                                renderReferencesList(value.old)
                            ) : (
                                <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {typeof value.old === 'object' ? JSON.stringify(value.old, null, 2) : String(value.old ?? '')}
                                </pre>
                            )}
                        </div>
                        {/* After */}
                        <div style={{
                            background: 'rgba(34, 197, 94, 0.04)',
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(34, 197, 94, 0.15)',
                            borderLeft: '3px solid #22c55e'
                        }}>
                            <div style={{
                                fontSize: '0.7rem',
                                color: '#16a34a',
                                fontWeight: 700,
                                marginBottom: '0.5rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>修改後</div>
                            {isHtmlContent ? (
                                <div
                                    className="rich-text-content"
                                    style={{ fontSize: '0.9rem', maxHeight: '400px', overflow: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value.new || '<em style="color:var(--color-text-muted)">空白</em>') }}
                                />
                            ) : isRelatedItems ? (
                                renderRelatedItemsList(value.new)
                            ) : isReferences ? (
                                renderReferencesList(value.new)
                            ) : (
                                <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {typeof value.new === 'object' ? JSON.stringify(value.new, null, 2) : String(value.new ?? '')}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            );
        });
    };

    // Change type badge
    const getChangeTypeBadge = (changeType: string) => {
        const styles: Record<string, { bg: string; color: string; label: string }> = {
            'CREATE': { bg: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', label: '建立' },
            'UPDATE': { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', label: '更新' },
            'DELETE': { bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', label: '刪除' }
        };
        const style = styles[changeType] || { bg: 'var(--color-bg-secondary)', color: 'var(--color-text)', label: changeType };
        return (
            <span style={{
                padding: '0.3rem 0.7rem',
                borderRadius: '1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                backgroundColor: style.bg,
                color: style.color
            }}>
                {style.label}
            </span>
        );
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            {/* Breadcrumb */}
            <div style={{ marginBottom: '1.5rem' }}>
                <Link
                    href={`/items/${record.itemId || ''}`}
                    className="breadcrumb-link"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        color: 'var(--color-text-muted)',
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'all 0.2s'
                    }}
                >
                    <ChevronLeftIcon />
                    返回項目
                </Link>
            </div>

            {/* Header Card */}
            <div style={{
                ...sectionStyle,
                marginBottom: '1.5rem'
            }}>
                {/* Top Row: Version Badge + Actions */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {/* Version Badge */}
                        <span style={{
                            fontFamily: 'var(--font-geist-mono)',
                            fontWeight: 700,
                            fontSize: '1rem',
                            color: 'var(--color-primary)',
                            backgroundColor: 'var(--color-primary-soft)',
                            padding: '0.4rem 0.8rem',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}>
                            <HistoryIcon />
                            v{record.version}
                        </span>
                        {getChangeTypeBadge(record.changeType)}
                    </div>
                    {record.isoDocPath && (
                        <a
                            href={encodeURI(record.isoDocPath)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="iso-doc-btn"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.85rem',
                                color: 'var(--color-primary)',
                                textDecoration: 'none',
                                border: '1px solid var(--color-primary)',
                                padding: '0.5rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                            }}
                        >
                            <FileTextIcon /> 品質文件
                        </a>
                    )}
                </div>

                {/* Item Title */}
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                    lineHeight: 1.3,
                    color: 'var(--color-text-main)'
                }}>
                    {record.itemTitle}
                </h1>

                {/* Metadata Row */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.9rem',
                    padding: '0.75rem 0',
                    borderTop: '1px solid var(--color-border)'
                }}>
                    <span style={{
                        fontFamily: 'var(--font-geist-mono)',
                        fontWeight: 600,
                        color: 'var(--color-primary)'
                    }}>
                        {record.itemFullId}
                    </span>
                    <span>•</span>
                    <span>
                        建立於 {new Date(record.createdAt).toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Review Timeline */}
            <div style={sectionStyle}>
                <ReviewProcessTimeline
                    submittedBy={record.submittedBy?.username || record.submitterName || '(已刪除)'}
                    submittedAt={record.createdAt}
                    submitReason={record.submitReason}
                    reviewedBy={record.reviewedBy?.username || record.reviewerName}
                    reviewedAt={record.createdAt}
                    reviewNote={record.reviewNote}
                    qcApprovedBy={record.qcApproval?.qcApprovedBy?.username}
                    qcApprovedAt={record.qcApproval?.qcApprovedAt}
                    qcNote={record.qcApproval?.qcNote}
                    pmApprovedBy={record.qcApproval?.pmApprovedBy?.username}
                    pmApprovedAt={record.qcApproval?.pmApprovedAt}
                    pmNote={record.qcApproval?.pmNote}
                    revisions={(record.qcApproval as any)?.revisions}
                    currentStatus={record.qcApproval?.status}
                    reviewChain={(record as any).reviewChain}
                />
            </div>

            {/* Diff View */}
            {diff && (
                <div style={sectionStyle}>
                    <h3 style={sectionHeaderStyle}>
                        <span style={{ color: 'var(--color-primary)' }}><DiffIcon /></span>
                        變更內容
                    </h3>
                    <div>
                        {renderDiff(diff)}
                    </div>
                </div>
            )}

            {/* Previous Snapshot View - Show state BEFORE this change */}
            {previousSnapshot && record.changeType === 'UPDATE' && (
                <div style={sectionStyle}>
                    <h3 style={sectionHeaderStyle}>
                        <span style={{ color: 'var(--color-primary)' }}><SnapshotIcon /></span>
                        變更前快照
                        <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 'normal',
                            color: 'var(--color-text-muted)',
                            marginLeft: '0.25rem'
                        }}>
                            (v{record.version - 1})
                        </span>
                    </h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            fontWeight: 600,
                            marginBottom: '0.5rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>標題</label>
                        <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>{previousSnapshot.title}</div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            fontWeight: 600,
                            marginBottom: '0.5rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>內容</label>
                        <div
                            className="rich-text-content"
                            style={{
                                padding: '1.5rem',
                                backgroundColor: 'var(--color-bg-elevated)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)'
                            }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previousSnapshot.content || '<span style="color:var(--color-text-muted);font-style:italic">無內容</span>') }}
                        />
                    </div>

                    {previousSnapshot.attachments && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>附件</label>
                            {renderAttachments(previousSnapshot.attachments)}
                        </div>
                    )}

                    {previousSnapshot.relatedItems && previousSnapshot.relatedItems.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>關聯項目</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {previousSnapshot.relatedItems.map(ri => (
                                    <div key={ri.id} style={{
                                        padding: '0.75rem',
                                        border: '1px solid var(--color-border)',
                                        borderLeft: '3px solid var(--color-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--color-bg-elevated)'
                                    }}>
                                        <div style={{ marginBottom: '0.25rem' }}>
                                            <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>{ri.fullId}</span>
                                            {(ri as any).title && <span style={{ marginLeft: '0.5rem' }}>{(ri as any).title}</span>}
                                        </div>
                                        {(ri as any).description && (
                                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', paddingLeft: '0.5rem', borderLeft: '2px solid var(--color-border)', marginTop: '0.25rem' }}>
                                                {(ri as any).description}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Current Snapshot View - For CREATE or DELETE */}
            {(record.changeType === 'CREATE' || record.changeType === 'DELETE') && (
                <div style={sectionStyle}>
                    <h3 style={sectionHeaderStyle}>
                        <span style={{ color: 'var(--color-primary)' }}><SnapshotIcon /></span>
                        {record.changeType === 'CREATE' ? '建立時快照' : '刪除前快照'}
                        <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 'normal',
                            color: 'var(--color-text-muted)',
                            marginLeft: '0.25rem'
                        }}>
                            (v{record.version})
                        </span>
                    </h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            fontWeight: 600,
                            marginBottom: '0.5rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>標題</label>
                        <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>{snapshot.title}</div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            fontWeight: 600,
                            marginBottom: '0.5rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>內容</label>
                        <div
                            className="rich-text-content"
                            style={{
                                padding: '1.5rem',
                                backgroundColor: 'var(--color-bg-elevated)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)'
                            }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(snapshot.content || '<span style="color:var(--color-text-muted);font-style:italic">無內容</span>') }}
                        />
                    </div>

                    {snapshot.attachments && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>附件</label>
                            {renderAttachments(snapshot.attachments)}
                        </div>
                    )}

                    {snapshot.relatedItems && snapshot.relatedItems.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>關聯項目</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {snapshot.relatedItems.map(ri => (
                                    <div key={ri.id} style={{
                                        padding: '0.75rem',
                                        border: '1px solid var(--color-border)',
                                        borderLeft: '3px solid var(--color-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--color-bg-elevated)'
                                    }}>
                                        <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>{ri.fullId}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .breadcrumb-link:hover {
                    background-color: var(--color-bg-elevated);
                    color: var(--color-primary);
                }
                .attachment-card:hover {
                    border-color: var(--color-primary);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }
                .iso-doc-btn:hover {
                    background-color: var(--color-primary);
                    color: white;
                }
            `}</style>
        </div>
    );
}
