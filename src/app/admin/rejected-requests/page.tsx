import { getRejectedRequests } from "@/actions/rejected-requests";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RejectedRequestsPage() {
    const requests = await getRejectedRequests();

    return (
        <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ marginBottom: "2rem" }}>
                <h1 style={{
                    fontSize: "1.8rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                }}>
                    🔄 待修改申請
                </h1>
                <p style={{ color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                    以下是被退回的變更申請，請檢視審查意見後重新提交
                </p>
            </div>

            {requests.length === 0 ? (
                <div className="glass" style={{
                    textAlign: "center",
                    padding: "4rem 2rem",
                    color: "var(--color-text-muted)",
                    borderRadius: "var(--radius-lg)"
                }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
                    <p>目前沒有被退回的變更申請</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className="glass"
                            style={{
                                padding: "1.5rem",
                                borderRadius: "var(--radius-lg)",
                                borderLeft: "4px solid #ef4444"
                            }}
                        >
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: "1rem"
                            }}>
                                <div>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        marginBottom: "0.5rem"
                                    }}>
                                        <span style={{
                                            padding: "2px 8px",
                                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                                            color: "#ef4444",
                                            borderRadius: "12px",
                                            fontSize: "0.75rem",
                                            fontWeight: 600
                                        }}>
                                            已退回
                                        </span>
                                        <span style={{
                                            fontFamily: "var(--font-geist-mono)",
                                            color: "var(--color-primary)",
                                            fontWeight: 600
                                        }}>
                                            {request.item?.fullId || request.targetProject?.codePrefix}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                                        {request.item?.title || request.targetProject?.title}
                                    </h3>
                                    <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                                        類型：{request.type === "CREATE" ? "新增"
                                            : request.type === "UPDATE" ? "修改"
                                                : request.type === "DELETE" ? "刪除" : request.type}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                                        退回時間
                                    </div>
                                    <div style={{ fontSize: "0.9rem" }}>
                                        {new Date(request.updatedAt).toLocaleString("zh-TW")}
                                    </div>
                                </div>
                            </div>

                            {/* Reviewer Info */}
                            <div style={{
                                background: "rgba(239, 68, 68, 0.05)",
                                padding: "1rem",
                                borderRadius: "var(--radius-sm)",
                                marginBottom: "1rem"
                            }}>
                                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem", fontWeight: 600 }}>
                                    審查者：{request.reviewedBy?.username || "(未知)"}
                                </div>
                                <div style={{ fontSize: "0.9rem" }}>
                                    <strong>審查意見：</strong>
                                    <span style={{ marginLeft: "0.5rem" }}>
                                        {request.reviewNote || "(無審查意見)"}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                                <Link
                                    href={`/admin/rejected-requests/${request.id}`}
                                    className="btn btn-primary"
                                    style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
                                >
                                    檢視詳情並修改
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
