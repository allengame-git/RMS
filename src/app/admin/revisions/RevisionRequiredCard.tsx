"use client";

import Link from "next/link";

interface RevisionDocument {
    id: number;
    revisionCount: number;
    itemHistory: {
        id: number;
        itemId: number;
        itemFullId: string;
        itemTitle: string;
        version: number;
        changeType: string;
        createdAt: Date;
    };
    revisions: Array<{
        revisionNumber: number;
        requestedAt: Date;
        requestNote: string;
        requestedBy: { username: string } | null;
    }>;
}

interface RevisionRequiredCardProps {
    document: RevisionDocument;
}

export default function RevisionRequiredCard({ document }: RevisionRequiredCardProps) {
    const latestRevision = document.revisions[0];

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getChangeTypeLabel = (type: string) => {
        switch (type) {
            case "CREATE": return "新增";
            case "UPDATE": return "修改";
            case "DELETE": return "刪除";
            default: return type;
        }
    };

    return (
        <div style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            padding: "20px",
            borderLeft: "4px solid var(--color-warning)",
        }}>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px"
            }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{
                            backgroundColor: "var(--color-warning)",
                            color: "white",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 600
                        }}>
                            需要修改
                        </span>
                        <span style={{
                            backgroundColor: "var(--color-primary-soft)",
                            color: "var(--color-primary)",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 600
                        }}>
                            {getChangeTypeLabel(document.itemHistory.changeType)}
                        </span>
                        {document.revisionCount > 1 && (
                            <span style={{
                                backgroundColor: "rgba(198, 40, 40, 0.1)",
                                color: "var(--color-danger)",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                fontWeight: 600
                            }}>
                                第 {document.revisionCount} 次修訂
                            </span>
                        )}
                    </div>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                        {document.itemHistory.itemFullId} - {document.itemHistory.itemTitle}
                    </h3>
                    <p style={{
                        margin: "4px 0 0",
                        fontSize: "13px",
                        color: "var(--color-text-muted)"
                    }}>
                        版本 {document.itemHistory.version} •
                        提交於 {formatDate(document.itemHistory.createdAt)}
                    </p>
                </div>
            </div>

            {latestRevision && (
                <div style={{
                    backgroundColor: "rgba(249, 168, 37, 0.1)",
                    border: "1px solid rgba(249, 168, 37, 0.3)",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "16px"
                }}>
                    <div style={{
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                        marginBottom: "8px"
                    }}>
                        <strong>{latestRevision.requestedBy?.username || "審核者"}</strong> 於 {formatDate(latestRevision.requestedAt)} 要求修改：
                    </div>
                    <p style={{
                        margin: 0,
                        fontSize: "14px",
                        color: "var(--color-text-main)",
                        lineHeight: 1.6
                    }}>
                        {latestRevision.requestNote}
                    </p>
                </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
                <Link
                    href={`/admin/history/detail/${document.itemHistory.id}`}
                    style={{
                        padding: "10px 16px",
                        backgroundColor: "var(--color-bg-base)",
                        color: "var(--color-text-main)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        textDecoration: "none",
                        fontSize: "14px",
                        fontWeight: 500,
                    }}
                >
                    檢視原始版本
                </Link>
                <Link
                    href={`/items/${document.itemHistory.itemId}?edit=true&revisionId=${document.id}`}
                    style={{
                        padding: "10px 16px",
                        backgroundColor: "var(--color-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        textDecoration: "none",
                        fontSize: "14px",
                        fontWeight: 500,
                    }}
                >
                    修改內容
                </Link>
            </div>
        </div>
    );
}
