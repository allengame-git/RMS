"use client";

import { formatDateTime } from "@/lib/date-utils";

interface RevisionItem {
    revisionNumber: number;
    requestedBy?: { username: string } | null;
    requestedAt: Date;
    requestNote: string;
    resolvedAt?: Date | null;
}

interface TimelineEvent {
    type: "SUBMISSION" | "APPROVAL" | "REJECTION" | "QC_APPROVAL" | "QC_REJECTION" | "PM_APPROVAL" | "REVISION_REQUEST" | "RESUBMISSION";
    user: string;
    date: Date;
    note?: string | null;
    status?: "success" | "warning" | "info" | "danger";
}

interface Props {
    submittedBy: string;
    submittedAt: Date;
    submitReason?: string | null;
    reviewedBy?: string | null;
    reviewedAt?: Date | null;
    reviewNote?: string | null;
    qcApprovedBy?: string | null;
    qcApprovedAt?: Date | null;
    qcNote?: string | null;
    pmApprovedBy?: string | null;
    pmApprovedAt?: Date | null;
    pmNote?: string | null;
    revisions?: RevisionItem[];
    currentStatus?: string;
    reviewChain?: any[]; // For generic change requests
}

export default function ReviewProcessTimeline({
    submittedBy,
    submittedAt,
    submitReason,
    reviewedBy,
    reviewedAt,
    reviewNote,
    qcApprovedBy,
    qcApprovedAt,
    qcNote,
    pmApprovedBy,
    pmApprovedAt,
    pmNote,
    revisions = [],
    currentStatus,
    reviewChain = []
}: Props) {

    // Build rounds
    const rounds: TimelineEvent[][] = [];

    // 1. Process reviewChain if provided (for generic change requests)
    // Each review cycle (submit -> result) gets its own column, labeled 第一次審核, 第二次審核, etc.
    if (reviewChain && reviewChain.length > 0) {
        // chain is [newest, ..., oldest] due to recursive fetch. Reverse to oldest -> newest.
        const sortedChain = [...reviewChain].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // Create separate rounds for each ChangeRequest in the chain
        for (const req of sortedChain) {
            const roundEvents: TimelineEvent[] = [];

            // Submission or Resubmission
            roundEvents.push({
                type: req.previousRequestId ? "RESUBMISSION" : "SUBMISSION",
                user: req.submittedBy?.username || req.submitterName || "提交者",
                date: new Date(req.createdAt),
                note: req.submitReason,
                status: "info"
            });

            // Review result (Approval or Rejection)
            // 邏輯修正：如果申請案狀態為 REJECTED 但有關聯的 ItemHistory，
            // 代表 Reviewer (初審) 其實已經核准了，目前的 REJECTED 是後來被 QC/PM 退回導致的。
            const producedHistory = req.item?.history?.[0];
            const isApprovedByReviewer = req.status === "APPROVED" || !!producedHistory;

            if (isApprovedByReviewer && (req.reviewedBy || producedHistory?.reviewedBy)) {
                roundEvents.push({
                    type: "APPROVAL",
                    user: req.reviewedBy?.username || producedHistory?.reviewedBy?.username || "審核者",
                    date: new Date(producedHistory?.createdAt || req.updatedAt),
                    note: producedHistory?.reviewNote || req.reviewNote,
                    status: "success"
                });
            } else if ((req.status === "REJECTED" || req.status === "RESUBMITTED") && req.reviewedBy) {
                // 只有在真的沒有產生歷史記錄（初審就沒過）的情況下，才在這裡顯示退回
                roundEvents.push({
                    type: "REJECTION",
                    user: req.reviewedBy.username,
                    date: new Date(req.updatedAt),
                    note: req.reviewNote,
                    status: "danger"
                });
            }

            rounds.push(roundEvents);
        }
    } else {
        // Fallback or Initial state
        const initialRound: TimelineEvent[] = [{
            type: "SUBMISSION",
            user: submittedBy,
            date: new Date(submittedAt),
            note: submitReason,
            status: "info"
        }];

        if (reviewedBy && reviewedAt) {
            initialRound.push({
                type: "APPROVAL",
                user: reviewedBy,
                date: new Date(reviewedAt),
                note: reviewNote,
                status: "success"
            });
        }
        rounds.push(initialRound);
    }

    // Append QC/PM approvals to the LAST round (where they belong in the flow)
    const lastRound = rounds[rounds.length - 1] || [];

    // Handle QC: either approval or rejection
    if (qcApprovedBy && qcApprovedAt) {
        // Check if QC rejected (currentStatus is REJECTED and no PM approval yet)
        const isQCRejection = currentStatus === "REJECTED" && !pmApprovedBy;
        if (isQCRejection) {
            lastRound.push({
                type: "QC_REJECTION",
                user: qcApprovedBy,
                date: new Date(qcApprovedAt),
                note: qcNote,
                status: "danger"
            });
        } else {
            lastRound.push({
                type: "QC_APPROVAL",
                user: qcApprovedBy,
                date: new Date(qcApprovedAt),
                note: qcNote,
                status: "success"
            });
        }
    }
    if (pmApprovedBy && pmApprovedAt) {
        lastRound.push({ type: "PM_APPROVAL", user: pmApprovedBy, date: new Date(pmApprovedAt), note: pmNote, status: "success" });
    }

    // 2. Handle Revisions (ISO Documents flow) if any
    // Note: If both reviewChain and revisions exist, we might need more complex merging,
    // but usually it's one or the other based on item type.
    if (revisions.length > 0) {
        for (const rev of revisions) {
            const revRound: TimelineEvent[] = [];
            revRound.push({
                type: "REVISION_REQUEST",
                user: rev.requestedBy?.username || "審核者",
                date: new Date(rev.requestedAt),
                note: rev.requestNote,
                status: "warning"
            });
            if (rev.resolvedAt) {
                revRound.push({
                    type: "RESUBMISSION",
                    user: submittedBy,
                    date: new Date(rev.resolvedAt),
                    note: `完成第 ${rev.revisionNumber} 次修訂`,
                    status: "info"
                });
            }
            rounds.push(revRound);
        }
    }

    const getEventLabel = (type: TimelineEvent["type"]) => {
        switch (type) {
            case "SUBMISSION": return "提交";
            case "APPROVAL": return "核准";
            case "REJECTION": return "退回修改";
            case "QC_APPROVAL": return "QC 簽核";
            case "QC_REJECTION": return "QC 退回";
            case "PM_APPROVAL": return "PM 簽核";
            case "REVISION_REQUEST": return "退回修改";
            case "RESUBMISSION": return "重新提交";
            default: return type;
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case "success": return "#10b981";
            case "warning": return "#f59e0b";
            case "danger": return "#ef4444";
            case "info": return "#3b82f6";
            default: return "#6b7280";
        }
    };

    if (rounds.length === 0) return null;

    return (
        <div style={{ marginTop: "1.5rem" }}>
            <div style={{
                padding: "0.75rem 1rem",
                background: "var(--color-primary)",
                color: "white",
                fontWeight: 600,
                fontSize: "0.9rem",
                borderRadius: "var(--radius-md) var(--radius-md) 0 0"
            }}>
                審核時間軸
            </div>
            <div style={{
                padding: "1.5rem",
                border: "1px solid var(--color-border)",
                borderTop: "none",
                borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                background: "rgba(0,131,143,0.03)",
                overflowX: "auto"
            }}>
                <div style={{ display: "flex", gap: "2rem", minWidth: "max-content" }}>
                    {rounds.map((roundEvents, roundIndex) => (
                        <div key={roundIndex} style={{
                            flex: "0 0 320px",
                            borderRight: roundIndex < rounds.length - 1 ? "1px dashed var(--color-border)" : "none",
                            paddingRight: roundIndex < rounds.length - 1 ? "2rem" : 0
                        }}>
                            <div style={{
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                color: "var(--color-text-muted)",
                                marginBottom: "1rem",
                                textTransform: "uppercase",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem"
                            }}>
                                <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--color-border)", display: "flex", justifyContent: "center", alignItems: "center", color: "var(--color-text-main)", fontSize: "10px" }}>
                                    {roundIndex + 1}
                                </span>
                                第{roundIndex + 1}次審核
                            </div>

                            <div style={{ position: "relative", paddingLeft: "1.5rem" }}>
                                {/* Vertical line for this round */}
                                <div style={{
                                    position: "absolute",
                                    left: "3px",
                                    top: "4px",
                                    bottom: "4px",
                                    width: "2px",
                                    background: "var(--color-border)",
                                    opacity: 0.5
                                }} />

                                {roundEvents.map((event, eventIndex) => (
                                    <div key={eventIndex} style={{
                                        position: "relative",
                                        paddingBottom: eventIndex === roundEvents.length - 1 ? 0 : "1.5rem"
                                    }}>
                                        {/* Dot */}
                                        <div style={{
                                            position: "absolute",
                                            left: "-25px",
                                            top: "4px",
                                            width: "10px",
                                            height: "10px",
                                            borderRadius: "50%",
                                            background: getStatusColor(event.status),
                                            border: "2px solid white",
                                            boxShadow: "0 0 0 1px " + getStatusColor(event.status)
                                        }} />

                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                                                <span style={{
                                                    fontSize: "10px",
                                                    padding: "1px 6px",
                                                    background: getStatusColor(event.status) + "15",
                                                    color: getStatusColor(event.status),
                                                    borderRadius: "10px",
                                                    fontWeight: 600,
                                                    border: `1px solid ${getStatusColor(event.status)}40`
                                                }}>
                                                    {getEventLabel(event.type)}
                                                </span>
                                                <span style={{ fontWeight: 600, fontSize: "13px" }}>{event.user}</span>
                                            </div>
                                            <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                                                {formatDateTime(event.date)}
                                            </div>
                                            {event.note && (
                                                <div style={{
                                                    fontSize: "12px",
                                                    color: "var(--color-text-main)",
                                                    background: "rgba(0,0,0,0.03)",
                                                    padding: "6px 10px",
                                                    borderRadius: "6px",
                                                    marginTop: "4px",
                                                    wordBreak: "break-word",
                                                    lineHeight: "1.4"
                                                }}>
                                                    {(event.type === "SUBMISSION" || event.type === "RESUBMISSION") ? "編輯原因：" : "審查意見："}{event.note}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {(currentStatus === "REVISION_REQUIRED" || currentStatus === "REJECTED") && (
                    <div style={{
                        marginTop: "1.5rem",
                        padding: "10px 14px",
                        background: currentStatus === "REJECTED" ? "rgba(239, 68, 68, 0.05)" : "rgba(249, 168, 37, 0.05)",
                        border: currentStatus === "REJECTED" ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(249, 168, 37, 0.2)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: currentStatus === "REJECTED" ? "#ef4444" : "#d97706",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px"
                    }}>
                        <span style={{ fontSize: "16px" }}>{currentStatus === "REJECTED" ? "❌" : "⏳"}</span>
                        目前狀態：{currentStatus === "REJECTED" ? "已退回修改" : "待修訂"}
                    </div>
                )}
            </div>
        </div>
    );
}
