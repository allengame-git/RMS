import { getHistoryDetail, ItemSnapshot } from "@/actions/history";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReviewProcessTimeline from "@/components/approval/ReviewProcessTimeline";

export const dynamic = 'force-dynamic';

export default async function HistoryDetailPage({ params }: { params: { id: string } }) {
    const historyId = parseInt(params.id);
    if (isNaN(historyId)) return notFound();

    const record = await getHistoryDetail(historyId);
    if (!record) return notFound();

    const snapshot = JSON.parse(record.snapshot) as ItemSnapshot;
    const diff = record.diff ? JSON.parse(record.diff) : null;

    // Reconstruct the previous version snapshot from diff (if UPDATE)
    // snapshot contains the NEW state, diff contains { field: { old, new } }
    // To get the OLD state, we take snapshot and replace changed fields with old values
    const previousSnapshot: ItemSnapshot | null = diff ? {
        ...snapshot,
        title: diff.title?.old ?? snapshot.title,
        content: diff.content?.old ?? snapshot.content,
        attachments: diff.attachments?.old ?? snapshot.attachments,
        relatedItems: diff.relatedItems?.old ?? snapshot.relatedItems,
    } : null;

    // Helper to render attachments as clickable links
    const renderAttachments = (attachmentsJson: string | null) => {
        if (!attachmentsJson) return null;
        try {
            const files = JSON.parse(attachmentsJson) as { name: string; path: string; size: number; uploadedAt: string }[];
            if (files.length === 0) return <span style={{ color: 'gray', fontStyle: 'italic' }}>無參考文獻</span>;
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {files.map((file, index) => (
                        <a
                            key={index}
                            href={file.path}
                            download={file.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                textDecoration: 'none',
                                color: 'inherit',
                                background: 'rgba(255,255,255,0.5)',
                                transition: 'all 0.2s',
                            }}
                        >
                            <span style={{ fontSize: '1.2rem' }}>📎</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500 }}>{file.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </div>
                            </div>
                            <span style={{ color: 'var(--color-primary)', fontSize: '0.85rem' }}>下載 ↓</span>
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
            // For 'content' field, render as rich text HTML
            const isHtmlContent = key === 'content';
            // For 'relatedItems' field, render as card list
            const isRelatedItems = key === 'relatedItems';

            // Helper to render related items list with full content
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
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.3)'
                            }}>
                                <div style={{ marginBottom: '0.25rem' }}>
                                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                        {ri.fullId}
                                    </span>
                                    {ri.title && (
                                        <span style={{ marginLeft: '0.5rem', color: 'var(--color-text)' }}>
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

            return (
                <div key={key} style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--color-info)', paddingLeft: '1rem' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                        {key === 'relatedItems' ? '關聯項目' : key === 'content' ? '內容' : key === 'title' ? '標題' : key === 'attachments' ? '附件' : key}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ background: 'rgba(255,0,0,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.1)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-error)', fontWeight: 'bold', marginBottom: '0.5rem' }}>修改前</div>
                            {isHtmlContent ? (
                                <div
                                    className="rich-text-content"
                                    style={{ fontSize: '0.9rem', maxHeight: '400px', overflow: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: value.old || '<em>空白</em>' }}
                                />
                            ) : isRelatedItems ? (
                                renderRelatedItemsList(value.old)
                            ) : (
                                <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {typeof value.old === 'object' ? JSON.stringify(value.old, null, 2) : String(value.old ?? '')}
                                </pre>
                            )}
                        </div>
                        <div style={{ background: 'rgba(0,255,0,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(0,255,0,0.1)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 'bold', marginBottom: '0.5rem' }}>修改後</div>
                            {isHtmlContent ? (
                                <div
                                    className="rich-text-content"
                                    style={{ fontSize: '0.9rem', maxHeight: '400px', overflow: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: value.new || '<em>空白</em>' }}
                                />
                            ) : isRelatedItems ? (
                                renderRelatedItemsList(value.new)
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

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href={`/items/${record.itemId || ''}`} style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    &larr; 返回項目
                </Link>
            </div>

            {/* Header Card */}
            <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ marginBottom: '0.5rem' }}>
                            歷史版本: v{record.version}
                        </h1>
                        <h2 style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>
                            {record.itemFullId} - {record.itemTitle}
                        </h2>
                    </div>
                    <div style={{ textAlign: 'right' }}>

                        {record.isoDocPath && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <a
                                    href={record.isoDocPath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        fontSize: '0.85rem',
                                        color: 'var(--color-primary)',
                                        textDecoration: 'none',
                                        border: '1px solid var(--color-primary)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px'
                                    }}
                                >
                                    📄 品質文件
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* Review Details Timeline */}
                <ReviewProcessTimeline
                    submittedBy={record.submittedBy?.username || record.submitterName || '(已刪除)'}
                    submittedAt={record.createdAt}
                    submitReason={record.submitReason}
                    reviewedBy={record.reviewedBy?.username || record.reviewerName}
                    reviewedAt={record.createdAt} // Close enough for generic history
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
                <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                        變更內容
                    </h3>
                    <div>
                        {renderDiff(diff)}
                    </div>
                </div>
            )}

            {/* Previous Snapshot View - Show state BEFORE this change */}
            {previousSnapshot && record.changeType === 'UPDATE' && (
                <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                        變更前快照 (v{record.version - 1})
                    </h3>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>標題</label>
                        <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>{previousSnapshot.title}</div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>內容</label>
                        <div className="rich-text-content" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                            dangerouslySetInnerHTML={{ __html: previousSnapshot.content || '<span style="color:gray;font-style:italic">無內容</span>' }}
                        />
                    </div>

                    {previousSnapshot.attachments && (
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>參考文獻</label>
                            {renderAttachments(previousSnapshot.attachments)}
                        </div>
                    )}

                    {previousSnapshot.relatedItems && previousSnapshot.relatedItems.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>關聯項目</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {previousSnapshot.relatedItems.map(ri => (
                                    <div key={ri.id} style={{ padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'rgba(255,255,255,0.3)' }}>
                                        <div style={{ marginBottom: '0.25rem' }}>
                                            <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 'bold', color: 'var(--color-primary)' }}>{ri.fullId}</span>
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

            {/* Current Snapshot View - For CREATE or DELETE, show the snapshot as is */}
            {(record.changeType === 'CREATE' || record.changeType === 'DELETE') && (
                <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                        {record.changeType === 'CREATE' ? '建立時快照' : '刪除前快照'} (v{record.version})
                    </h3>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>標題</label>
                        <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>{snapshot.title}</div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>內容</label>
                        <div className="rich-text-content" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                            dangerouslySetInnerHTML={{ __html: snapshot.content || '<span style="color:gray;font-style:italic">無內容</span>' }}
                        />
                    </div>

                    {snapshot.attachments && (
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>參考文獻</label>
                            {renderAttachments(snapshot.attachments)}
                        </div>
                    )}

                    {snapshot.relatedItems && snapshot.relatedItems.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>關聯項目</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {snapshot.relatedItems.map(ri => (
                                    <div key={ri.id} style={{ padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'rgba(255,255,255,0.3)' }}>
                                        <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 'bold', color: 'var(--color-primary)' }}>{ri.fullId}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
