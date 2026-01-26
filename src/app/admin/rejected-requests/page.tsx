import { getRejectedRequests } from "@/data/rejected-requests";
import Link from "next/link";
import CancelRequestButton from "@/components/approval/CancelRequestButton";

export const dynamic = "force-dynamic";

// 類型標籤配置
const typeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    'CREATE': { label: '新增項目', color: '#16a34a', bgColor: 'rgba(22, 163, 74, 0.1)' },
    'UPDATE': { label: '修改項目', color: '#ca8a04', bgColor: 'rgba(202, 138, 4, 0.1)' },
    'DELETE': { label: '刪除項目', color: '#dc2626', bgColor: 'rgba(220, 38, 38, 0.1)' },
    'FILE_CREATE': { label: '新增檔案', color: '#0891b2', bgColor: 'rgba(8, 145, 178, 0.1)' },
    'FILE_UPDATE': { label: '修改檔案', color: '#0d9488', bgColor: 'rgba(13, 148, 136, 0.1)' },
    'FILE_DELETE': { label: '刪除檔案', color: '#be185d', bgColor: 'rgba(190, 24, 93, 0.1)' },
    'REVISION_REQUIRED': { label: '品管修訂', color: '#d97706', bgColor: 'rgba(217, 119, 6, 0.1)' }
};

export default async function RejectedRequestsPage() {
    const requests = await getRejectedRequests();

    return (
        <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
            {/* Header */}
            <div style={{
                marginBottom: "2rem",
                paddingBottom: "1.5rem",
                borderBottom: "1px solid var(--color-border)"
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "0.5rem"
                }}>
                    <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                    </div>
                    <h1 style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "var(--color-text-main)",
                        margin: 0
                    }}>
                        待修改申請
                    </h1>
                </div>
                <p style={{
                    color: "var(--color-text-muted)",
                    margin: 0,
                    fontSize: "0.9rem",
                    paddingLeft: "52px"
                }}>
                    以下是被退回的變更申請，請檢視審查意見後重新提交
                </p>
            </div>

            {requests.length === 0 ? (
                <div className="glass" style={{
                    textAlign: "center",
                    padding: "4rem 2rem",
                    color: "var(--color-text-muted)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px dashed var(--color-border)"
                }}>
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ marginBottom: "1rem", opacity: 0.4 }}
                    >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <p style={{ margin: 0, fontSize: "0.95rem" }}>目前沒有被退回的變更申請</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {requests.map((request) => {
                        const typeInfo = typeConfig[request.type] || { label: request.type, color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' };

                        return (
                            <div
                                key={request.id}
                                className="glass"
                                style={{
                                    padding: "1.5rem",
                                    borderRadius: "var(--radius-lg)",
                                    borderLeft: "4px solid #ef4444",
                                    border: "1px solid var(--color-border)",
                                    borderLeftWidth: "4px",
                                    borderLeftColor: "#ef4444"
                                }}
                            >
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    marginBottom: "1rem",
                                    flexWrap: "wrap",
                                    gap: "1rem"
                                }}>
                                    <div>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            marginBottom: "0.5rem",
                                            flexWrap: "wrap"
                                        }}>
                                            <span style={{
                                                padding: "0.2rem 0.6rem",
                                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                                color: "#ef4444",
                                                borderRadius: "4px",
                                                fontSize: "0.7rem",
                                                fontWeight: 600
                                            }}>
                                                已退回
                                            </span>
                                            <span style={{
                                                padding: "0.2rem 0.6rem",
                                                backgroundColor: typeInfo.bgColor,
                                                color: typeInfo.color,
                                                borderRadius: "4px",
                                                fontSize: "0.7rem",
                                                fontWeight: 600
                                            }}>
                                                {typeInfo.label}
                                            </span>
                                            <span style={{
                                                fontFamily: "var(--font-geist-mono)",
                                                color: "var(--color-primary)",
                                                fontWeight: 600,
                                                fontSize: "0.85rem"
                                            }}>
                                                {request.item?.fullId || (request as any).targetProject?.codePrefix || "N/A"}
                                            </span>
                                        </div>
                                        <h3 style={{
                                            fontSize: "1.05rem",
                                            fontWeight: 600,
                                            margin: 0,
                                            color: "var(--color-text-main)"
                                        }}>
                                            {request.item?.title || request.targetProject?.title}
                                        </h3>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{
                                            fontSize: "0.7rem",
                                            color: "var(--color-text-muted)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.025em",
                                            marginBottom: "0.25rem"
                                        }}>
                                            退回時間
                                        </div>
                                        <div style={{ fontSize: "0.85rem", color: "var(--color-text)" }}>
                                            {new Date(request.updatedAt).toLocaleString("zh-TW")}
                                        </div>
                                    </div>
                                </div>

                                {/* Reviewer Info */}
                                <div style={{
                                    background: "var(--color-bg-elevated)",
                                    padding: "1rem",
                                    borderRadius: "var(--radius-md)",
                                    marginBottom: "1rem",
                                    border: "1px solid var(--color-border)"
                                }}>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        fontSize: "0.75rem",
                                        color: "var(--color-text-muted)",
                                        marginBottom: "0.5rem"
                                    }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                        <span style={{ fontWeight: 600 }}>審查者：</span>
                                        <span>{request.reviewedBy?.username || "(未知)"}</span>
                                    </div>
                                    <div style={{
                                        display: "flex",
                                        gap: "0.5rem",
                                        fontSize: "0.85rem"
                                    }}>
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="var(--color-text-muted)"
                                            strokeWidth="2"
                                            style={{ marginTop: "3px", flexShrink: 0 }}
                                        >
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        </svg>
                                        <div>
                                            <span style={{ fontWeight: 600, color: "var(--color-text-muted)", fontSize: "0.75rem" }}>審查意見：</span>
                                            <p style={{ margin: "0.25rem 0 0 0", lineHeight: 1.5 }}>
                                                {request.reviewNote || "(無審查意見)"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                                    <CancelRequestButton
                                        requestId={request.id}
                                        itemTitle={request.item?.title || request.targetProject?.title || "此項目"}
                                    />
                                    <Link
                                        href={(request as any).category === 'FILE'
                                            ? `/datafiles/${(request as any).fileId}`
                                            : (request as any).category === 'QC'
                                                ? `/admin/history/detail/${(request as any).itemHistoryId}`
                                                : `/admin/rejected-requests/${request.id}`}
                                        className="btn btn-primary"
                                        style={{
                                            padding: "0.5rem 1rem",
                                            fontSize: "0.85rem",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.4rem",
                                            textDecoration: "none"
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                        檢視並修改
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
