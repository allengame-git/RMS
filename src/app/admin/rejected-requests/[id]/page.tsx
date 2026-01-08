import { getRejectedRequestDetail } from "@/actions/rejected-requests";
import { notFound } from "next/navigation";
import Link from "next/link";
import RejectedRequestEditForm from "./RejectedRequestEditForm";

export const dynamic = "force-dynamic";

export default async function RejectedRequestDetailPage({ params }: { params: { id: string } }) {
    const requestId = parseInt(params.id);
    if (isNaN(requestId)) return notFound();

    const request = await getRejectedRequestDetail(requestId);
    if (!request) return notFound();

    // Parse the request data
    const requestData = request.data ? JSON.parse(request.data as string) : {};

    if (request.status === "RESUBMITTED") {
        return (
            <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
                <div style={{ marginBottom: "1.5rem" }}>
                    <Link href="/admin/rejected-requests" style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                        &larr; 返回待修改清單
                    </Link>
                </div>
                <div className="glass" style={{ padding: "3rem", borderRadius: "var(--radius-lg)", textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
                    <h1 style={{ marginBottom: "1rem" }}>此申請已完成修訂</h1>
                    <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
                        您已經為此項退回申請提交了新的變更請求。
                    </p>
                    <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
                        <Link href={`/items/${request.itemId || ''}`} className="btn btn-primary">
                            前往項目詳情
                        </Link>
                        <Link href="/admin/history" className="btn btn-outline">
                            查看歷程記錄
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ marginBottom: "1.5rem" }}>
                <Link href="/admin/rejected-requests" style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                    &larr; 返回待修改清單
                </Link>
            </div>

            {/* Header */}
            <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", marginBottom: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <h1 style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <span style={{
                                padding: "4px 12px",
                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                color: "#ef4444",
                                borderRadius: "12px",
                                fontSize: "0.85rem",
                                fontWeight: 600
                            }}>
                                已退回
                            </span>
                            修改申請
                        </h1>
                        <h2 style={{ fontSize: "1.2rem", color: "var(--color-text-muted)", fontWeight: "normal" }}>
                            {request.item?.fullId || request.targetProject?.codePrefix} - {request.item?.title || request.targetProject?.title}
                        </h2>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                        <div>提交者：{request.submittedBy?.username}</div>
                        <div>退回時間：{new Date(request.updatedAt).toLocaleString("zh-TW")}</div>
                    </div>
                </div>

                {/* Rejection Details */}
                <div style={{
                    marginTop: "1.5rem",
                    background: "rgba(239, 68, 68, 0.05)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "var(--radius-md)",
                    padding: "1.25rem"
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.75rem",
                        fontWeight: 600,
                        color: "#ef4444"
                    }}>
                        ❌ 審查結果：退回
                    </div>
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: "0.5rem 1rem",
                        fontSize: "0.9rem"
                    }}>
                        <div style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>審查者：</div>
                        <div>{request.reviewedBy?.username || "(未知)"}</div>
                        <div style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>審查意見：</div>
                        <div style={{
                            backgroundColor: "rgba(0,0,0,0.03)",
                            padding: "0.75rem",
                            borderRadius: "var(--radius-sm)",
                            whiteSpace: "pre-wrap"
                        }}>
                            {request.reviewNote || "(無審查意見)"}
                        </div>
                    </div>
                </div>

                {/* Submitted Content Preview */}
                {requestData && (requestData.title || requestData.content) && (
                    <div style={{
                        marginTop: "1.5rem",
                        background: "rgba(59, 130, 246, 0.05)",
                        border: "1px solid rgba(59, 130, 246, 0.2)",
                        borderRadius: "var(--radius-md)",
                        padding: "1.25rem"
                    }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginBottom: "1rem",
                            fontWeight: 600,
                            color: "#3b82f6"
                        }}>
                            📄 上次提交的內容
                        </div>
                        {requestData.title && (
                            <div style={{ marginBottom: "1rem" }}>
                                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600, marginBottom: "0.25rem" }}>
                                    標題
                                </div>
                                <div style={{ fontSize: "1rem", fontWeight: 500 }}>
                                    {requestData.title}
                                </div>
                            </div>
                        )}
                        {requestData.content && (
                            <div>
                                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600, marginBottom: "0.25rem" }}>
                                    內容
                                </div>
                                <div
                                    style={{
                                        backgroundColor: "rgba(255,255,255,0.5)",
                                        padding: "1rem",
                                        borderRadius: "var(--radius-sm)",
                                        fontSize: "0.9rem",
                                        maxHeight: "300px",
                                        overflow: "auto"
                                    }}
                                    dangerouslySetInnerHTML={{ __html: requestData.content }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Form */}
            <RejectedRequestEditForm
                request={{
                    id: request.id,
                    type: request.type,
                    itemId: request.itemId,
                    item: request.item,
                    targetProjectId: request.targetProjectId,
                    targetProject: request.targetProject,
                    data: requestData,
                    reviewNote: request.reviewNote
                }}
            />
        </div>
    );
}
