"use client";

import { approveRequest, rejectRequest } from "@/actions/approval";
import { useState } from "react";

type RelatedItem = {
    id: number;
    fullId: string;
    title: string;
    description?: string | null;
};

type Request = {
    id: number;
    type: string;
    status: string;
    data: string;
    createdAt: Date;
    submittedBy: { username: string } | null;
    submitterName?: string | null;  // Fallback when user is deleted
    targetProject: { title: string; codePrefix: string } | null;
    targetParent: { fullId: string } | null;
    item: {
        fullId: string;
        title: string;
        content: string | null;
        attachments: string | null;
        relationsFrom: Array<{
            description: string | null;
            target: { id: number; fullId: string; title: string };
        }>;
    } | null;
};

// Helper to transform relationsFrom to relatedItems format
const getItemRelatedItems = (item: Request['item']): RelatedItem[] => {
    if (!item?.relationsFrom) return [];
    return item.relationsFrom.map(r => ({
        id: r.target.id,
        fullId: r.target.fullId,
        title: r.target.title,
        description: r.description
    }));
};

const getComparableRelated = (items: RelatedItem[]) => {
    return items
        .map(r => ({ id: r.id, desc: r.description || '' }))
        .sort((a: { id: number }, b: { id: number }) => a.id - b.id);
};

export default function ApprovalList({ requests, currentUsername, currentUserRole }: { requests: Request[]; currentUsername: string; currentUserRole: string }) {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [loading, setLoading] = useState<number | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null);
    const [errorDialog, setErrorDialog] = useState<string | null>(null);

    const handleCardClick = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const handleApproveClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const request = requests.find(r => r.id === id);
        const submitterUsername = request?.submittedBy?.username || request?.submitterName;
        // ADMIN can approve their own requests, others cannot
        if (request && submitterUsername === currentUsername && currentUserRole !== 'ADMIN') {
            setErrorDialog('您不能批准自己提交的申請。請由其他審核人員處理。');
            return;
        }
        setConfirmDialog({ id, action: 'approve' });
    };


    const handleRejectClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        // 允許使用者拒絕自己的申請
        setConfirmDialog({ id, action: 'reject' });
    };

    const handleConfirm = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirmDialog) return;

        const { id, action } = confirmDialog;
        setConfirmDialog(null);
        setLoading(id);

        try {
            if (action === 'approve') {
                await approveRequest(id);
            } else {
                await rejectRequest(id);
            }
            // Success - reload page
            setTimeout(() => {
                window.location.reload();
            }, 100);
        } catch (error: any) {
            console.error(`Failed to ${action} request:`, error);
            setErrorDialog(error.message || 'Unknown error occurred');
            setLoading(null);
        }
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmDialog(null);
    };

    if (requests.length === 0) {
        return <p style={{ color: "var(--color-text-muted)" }}>目前沒有待審核申請。</p>;
    }

    return (
        <>
            {/* Dashboard Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {requests.map(req => {
                    const data = JSON.parse(req.data);
                    const isExpanded = expandedId === req.id;
                    const submitterUsername = req.submittedBy?.username || req.submitterName || '(已刪除)';
                    const isSelf = submitterUsername === currentUsername && currentUserRole !== 'ADMIN';

                    return (
                        <div
                            key={req.id}
                            className="glass"
                            onClick={() => handleCardClick(req.id)}
                            style={{
                                padding: "1.5rem",
                                borderRadius: "var(--radius-md)",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                border: isExpanded
                                    ? "2px solid var(--color-primary)"
                                    : isSelf
                                        ? "2px solid var(--color-warning)"
                                        : "2px solid transparent",
                                transform: isExpanded ? "scale(1.02)" : "scale(1)",
                                boxShadow: isExpanded ? "0 8px 16px rgba(0,0,0,0.1)" : "none",
                                backgroundColor: isSelf && !isExpanded
                                    ? "rgba(234, 179, 8, 0.05)"
                                    : undefined
                            }}
                        >
                            {/* Card Header */}
                            <div style={{ marginBottom: "0.75rem" }}>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    marginBottom: "0.5rem"
                                }}>
                                    <span style={{
                                        fontSize: "1.1rem",
                                        fontWeight: "bold",
                                        color: "var(--color-primary)"
                                    }}>
                                        {req.type === 'CREATE' ? '新增' : req.type === 'UPDATE' ? '編輯' : req.type === 'DELETE' ? '刪除' : req.type === 'PROJECT_UPDATE' ? '專案編輯' : req.type === 'PROJECT_DELETE' ? '專案刪除' : req.type}
                                    </span>
                                </div>
                                <div style={{
                                    fontSize: "1rem",
                                    fontWeight: "600",
                                    marginBottom: "0.25rem",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: isExpanded ? "normal" : "nowrap"
                                }}>
                                    {data.title}
                                </div>
                                <div style={{
                                    fontSize: "0.85rem",
                                    color: "var(--color-text-muted)"
                                }}>
                                    {req.targetProject?.title}
                                    {req.item && ` • ${req.item.fullId}`}
                                </div>
                                {isSelf && (
                                    <div style={{
                                        fontSize: "0.75rem",
                                        marginTop: "0.5rem",
                                        padding: "0.25rem 0.5rem",
                                        backgroundColor: "var(--color-warning-soft)",
                                        color: "var(--color-warning)",
                                        borderRadius: "4px",
                                        display: "inline-block",
                                        fontWeight: "600"
                                    }}>
                                        ⚠️ 您提交的申請
                                    </div>
                                )}
                            </div>

                            {/* Card Footer */}
                            <div style={{
                                fontSize: "0.8rem",
                                color: "var(--color-text-muted)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            }}>
                                <span>編輯者：{submitterUsername}</span>
                                <span>
                                    {new Date(req.createdAt).toLocaleDateString('zh-TW', {
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </span>
                            </div>

                            {/* Expand Indicator */}
                            <div style={{
                                marginTop: "0.75rem",
                                textAlign: "center",
                                fontSize: "0.85rem",
                                color: "var(--color-primary)"
                            }}>
                                {isExpanded ? "▲ 點擊收合" : "▼ 點擊展開"}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Expanded Detail Panel */}
            {expandedId !== null && (() => {
                const req = requests.find(r => r.id === expandedId);
                if (!req) return null;

                const data = JSON.parse(req.data);

                return (
                    <div className="glass" style={{
                        padding: "2rem",
                        borderRadius: "var(--radius-lg)",
                        border: "2px solid var(--color-primary)",
                        marginTop: "2rem"
                    }}>
                        {/* Detail Header */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "1.5rem",
                            paddingBottom: "1rem",
                            borderBottom: "1px solid var(--color-border)"
                        }}>
                            <div>
                                <h2 style={{ margin: 0, marginBottom: "0.5rem" }}>
                                    {req.type === 'CREATE' ? '新增' : req.type === 'UPDATE' ? '編輯' : req.type === 'DELETE' ? '刪除' : req.type === 'PROJECT_UPDATE' ? '專案編輯' : req.type === 'PROJECT_DELETE' ? '專案刪除' : req.type} 申請詳情
                                </h2>
                                <div style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                                    {new Date(req.createdAt).toLocaleString('zh-TW')}
                                </div>
                            </div>
                            <button
                                onClick={() => setExpandedId(null)}
                                style={{
                                    background: "transparent",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: "4px",
                                    padding: "0.5rem 1rem",
                                    cursor: "pointer",
                                    color: "var(--color-text-main)"
                                }}
                            >
                                ✕ 關閉
                            </button>
                        </div>

                        {/* Detail Content */}
                        <div style={{ marginBottom: "2rem" }}>
                            {/* Modified Fields Indicator */}
                            {req.type === "UPDATE" && (
                                <div style={{
                                    padding: "0.75rem 1rem",
                                    backgroundColor: "rgba(234, 179, 8, 0.1)",
                                    border: "1px solid var(--color-warning)",
                                    borderRadius: "var(--radius-sm)",
                                    marginBottom: "1.5rem",
                                    fontSize: "0.9rem"
                                }}>
                                    ⚡ <strong>修改欄位：</strong>{" "}
                                    {(() => {
                                        const modified: string[] = [];
                                        if (req.item?.title !== data.title) modified.push("標題");
                                        if (req.item?.content !== data.content) modified.push("內容");
                                        const currentAttachments = req.item?.attachments ? JSON.parse(req.item.attachments) : [];
                                        const proposedAttachments = data.attachments || [];
                                        if (JSON.stringify(currentAttachments) !== JSON.stringify(proposedAttachments)) modified.push("附件");
                                        const currentRelated = getComparableRelated(getItemRelatedItems(req.item));
                                        const proposedRelated = getComparableRelated(data.relatedItems || []);
                                        if (JSON.stringify(currentRelated) !== JSON.stringify(proposedRelated)) modified.push("關聯項目");
                                        return modified.length > 0 ? modified.join("、") : "無變更";
                                    })()}
                                </div>
                            )}

                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "150px 1fr",
                                gap: "0.75rem",
                                marginBottom: "1.5rem"
                            }}>
                                <strong>專案：</strong>
                                <span>{req.targetProject?.title}</span>

                                {req.targetParent && (
                                    <>
                                        <strong>父項目：</strong>
                                        <span>{req.targetParent.fullId}</span>
                                    </>
                                )}

                                {req.type === "UPDATE" && req.item && (
                                    <>
                                        <strong>項目編號：</strong>
                                        <span>{req.item.fullId}</span>
                                    </>
                                )}

                                <strong>編輯者：</strong>
                                <span>{req.submittedBy?.username || req.submitterName || '(已刪除)'}</span>
                            </div>

                            {/* Title Comparison */}
                            <div style={{ marginBottom: "1.5rem" }}>
                                <strong style={{ display: "block", marginBottom: "0.5rem" }}>
                                    標題 {req.type === "UPDATE" && req.item?.title !== data.title && (
                                        <span style={{ color: "var(--color-warning)", fontSize: "0.85rem" }}>• 已修改</span>
                                    )}
                                </strong>
                                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                    {req.type === "UPDATE" && req.item && (
                                        <div style={{
                                            flex: 1,
                                            minWidth: "200px",
                                            padding: "0.75rem",
                                            backgroundColor: "rgba(0,0,0,0.03)",
                                            borderRadius: "var(--radius-sm)",
                                            border: "1px solid var(--color-border)"
                                        }}>
                                            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>修改前</div>
                                            {req.item.title}
                                        </div>
                                    )}
                                    <div style={{
                                        flex: 1,
                                        minWidth: "200px",
                                        padding: "0.75rem",
                                        backgroundColor: req.type === "UPDATE" && req.item?.title !== data.title
                                            ? "rgba(34, 197, 94, 0.1)"
                                            : "rgba(0,0,0,0.03)",
                                        borderRadius: "var(--radius-sm)",
                                        border: req.type === "UPDATE" && req.item?.title !== data.title
                                            ? "1px solid var(--color-success)"
                                            : "1px solid var(--color-border)"
                                    }}>
                                        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                                            {req.type === "UPDATE" ? "修改後" : "值"}
                                        </div>
                                        <strong>{data.title}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Content Section */}
                            {(data.content || (req.type === "UPDATE" && req.item?.content)) && (
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <strong style={{ display: "block", marginBottom: "0.5rem" }}>
                                        內容 {req.type === "UPDATE" && req.item?.content !== data.content && (
                                            <span style={{ color: "var(--color-warning)", fontSize: "0.85rem" }}>• 已修改</span>
                                        )}
                                    </strong>
                                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                        {req.type === "UPDATE" && req.item && (
                                            <div style={{
                                                flex: 1,
                                                minWidth: "200px",
                                                padding: "1rem",
                                                backgroundColor: "rgba(0,0,0,0.03)",
                                                borderRadius: "var(--radius-md)",
                                                border: "1px solid var(--color-border)",
                                                maxHeight: "300px",
                                                overflowY: "auto"
                                            }}>
                                                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>修改前</div>
                                                <div dangerouslySetInnerHTML={{ __html: req.item.content || "<em>無內容</em>" }} />
                                            </div>
                                        )}
                                        <div style={{
                                            flex: 1,
                                            minWidth: "200px",
                                            padding: "1rem",
                                            backgroundColor: req.type === "UPDATE" && req.item?.content !== data.content
                                                ? "rgba(34, 197, 94, 0.05)"
                                                : "var(--color-bg-base)",
                                            borderRadius: "var(--radius-md)",
                                            border: req.type === "UPDATE" && req.item?.content !== data.content
                                                ? "1px solid var(--color-success)"
                                                : "1px solid var(--color-border)",
                                            maxHeight: "300px",
                                            overflowY: "auto"
                                        }}>
                                            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                                                {req.type === "UPDATE" ? "修改後" : "值"}
                                            </div>
                                            <div dangerouslySetInnerHTML={{ __html: data.content || "<em>無內容</em>" }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Attachments Section */}
                            {(data.attachments?.length > 0 || (req.type === "UPDATE" && req.item?.attachments)) && (
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <strong style={{ display: "block", marginBottom: "0.5rem" }}>
                                        附件 {req.type === "UPDATE" && (() => {
                                            const curr = req.item?.attachments ? JSON.parse(req.item.attachments) : [];
                                            return JSON.stringify(curr) !== JSON.stringify(data.attachments || []);
                                        })() && (
                                                <span style={{ color: "var(--color-warning)", fontSize: "0.85rem" }}>• 已修改</span>
                                            )}
                                    </strong>
                                    <div style={{
                                        padding: "0.75rem",
                                        backgroundColor: "var(--color-bg-base)",
                                        borderRadius: "var(--radius-sm)",
                                        border: "1px solid var(--color-border)"
                                    }}>
                                        {(data.attachments || []).length > 0 ? (
                                            <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
                                                {(data.attachments || []).map((att: { name: string }, idx: number) => (
                                                    <li key={idx}>{att.name}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <em style={{ color: "var(--color-text-muted)" }}>無附件</em>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Related Items Section */}
                            {((data.relatedItems?.length ?? 0) > 0 || (req.type === "UPDATE" && getItemRelatedItems(req.item).length > 0)) && (
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <strong style={{ display: "block", marginBottom: "0.5rem" }}>
                                        關聯項目 {req.type === "UPDATE" && (() => {
                                            const currIds = getComparableRelated(getItemRelatedItems(req.item));
                                            const propIds = getComparableRelated(data.relatedItems || []);
                                            return JSON.stringify(currIds) !== JSON.stringify(propIds);
                                        })() && (
                                                <span style={{ color: "var(--color-warning)", fontSize: "0.85rem" }}>• 已修改</span>
                                            )}
                                    </strong>
                                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                        {req.type === "UPDATE" && getItemRelatedItems(req.item).length > 0 && (
                                            <div style={{
                                                flex: 1,
                                                minWidth: "200px",
                                                padding: "0.75rem",
                                                backgroundColor: "rgba(0,0,0,0.03)",
                                                borderRadius: "var(--radius-sm)",
                                                border: "1px solid var(--color-border)"
                                            }}>
                                                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>修改前 ({getItemRelatedItems(req.item).length})</div>
                                                {getItemRelatedItems(req.item).map((ri: RelatedItem) => (
                                                    <div key={ri.id} style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                                                        <div>
                                                            <span style={{ fontFamily: "var(--font-geist-mono)", color: "var(--color-primary)" }}>{ri.fullId}</span> {ri.title}
                                                        </div>
                                                        {ri.description && (
                                                            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem", paddingLeft: "0.5rem", borderLeft: "2px solid var(--color-border)" }}>
                                                                {ri.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{
                                            flex: 1,
                                            minWidth: "200px",
                                            padding: "0.75rem",
                                            backgroundColor: (() => {
                                                if (req.type !== "UPDATE") return "rgba(0,0,0,0.03)";
                                                const currIds = getComparableRelated(getItemRelatedItems(req.item));
                                                const propIds = getComparableRelated(data.relatedItems || []);
                                                return JSON.stringify(currIds) !== JSON.stringify(propIds) ? "rgba(34, 197, 94, 0.1)" : "rgba(0,0,0,0.03)";
                                            })(),
                                            borderRadius: "var(--radius-sm)",
                                            border: (() => {
                                                if (req.type !== "UPDATE") return "1px solid var(--color-border)";
                                                const currIds = getComparableRelated(getItemRelatedItems(req.item));
                                                const propIds = getComparableRelated(data.relatedItems || []);
                                                return JSON.stringify(currIds) !== JSON.stringify(propIds) ? "1px solid var(--color-success)" : "1px solid var(--color-border)";
                                            })()
                                        }}>
                                            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                                                {req.type === "UPDATE" ? `修改後 (${(data.relatedItems || []).length})` : `數量：${(data.relatedItems || []).length}`}
                                            </div>
                                            {(data.relatedItems || []).length > 0 ? (
                                                (data.relatedItems || []).map((ri: RelatedItem) => (
                                                    <div key={ri.id} style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                                                        <div>
                                                            <span style={{ fontFamily: "var(--font-geist-mono)", color: "var(--color-primary)" }}>{ri.fullId}</span> {ri.title}
                                                        </div>
                                                        {ri.description && (
                                                            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem", paddingLeft: "0.5rem", borderLeft: "2px solid var(--color-border)" }}>
                                                                {ri.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <em style={{ color: "var(--color-text-muted)" }}>無關聯項目</em>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{
                            display: "flex",
                            gap: "1rem",
                            justifyContent: "flex-end",
                            paddingTop: "1rem",
                            borderTop: "1px solid var(--color-border)"
                        }}>
                            <button
                                onClick={(e) => handleRejectClick(e, req.id)}
                                className="btn btn-outline"
                                disabled={loading !== null}
                                style={{
                                    color: "var(--color-danger)",
                                    borderColor: "var(--color-danger)",
                                    padding: "0.75rem 2rem"
                                }}
                            >
                                {loading === req.id ? '處理中...' : '拒絕'}
                            </button>
                            <button
                                onClick={(e) => handleApproveClick(e, req.id)}
                                className="btn btn-primary"
                                disabled={loading !== null}
                                style={{
                                    backgroundColor: "var(--color-success)",
                                    border: "none",
                                    padding: "0.75rem 2rem"
                                }}
                            >
                                {loading === req.id ? '處理中...' : '批准'}
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Confirmation Dialog */}
            {confirmDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass" style={{
                        padding: '2rem',
                        borderRadius: 'var(--radius-md)',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ marginBottom: '1rem' }}>
                            {confirmDialog.action === 'approve' ? '確認批准？' : '確認拒絕？'}
                        </h3>
                        <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
                            {confirmDialog.action === 'approve'
                                ? '此操作將建立/更新項目並將申請標記為已批准。'
                                : '此操作將拒絕申請且無法復原。'}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleCancel}
                                className="btn btn-outline"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="btn btn-primary"
                                style={{
                                    backgroundColor: confirmDialog.action === 'approve' ? 'var(--color-success)' : 'var(--color-danger)',
                                    border: 'none'
                                }}
                            >
                                {confirmDialog.action === 'approve' ? '批准' : '拒絕'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Dialog */}
            {errorDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999
                }}
                    onClick={() => setErrorDialog(null)}
                >
                    <div
                        className="glass"
                        style={{
                            width: '500px',
                            maxWidth: '95vw',
                            borderRadius: 'var(--radius-lg)',
                            padding: '2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--color-bg-surface)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            border: '1px solid var(--color-border)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--color-danger)' }}>
                                權限受限
                            </h2>
                            <button
                                type="button"
                                onClick={() => setErrorDialog(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.5rem',
                                    lineHeight: 1,
                                    color: 'var(--color-text-muted)'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <p style={{ marginBottom: '2rem', lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>
                            {errorDialog}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setErrorDialog(null)}
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '0.6rem 1.5rem' }}
                            >
                                確定
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
