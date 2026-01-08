"use client";

interface RevisionItem {
    revisionNumber: number;
    requestedBy?: { username: string } | null;
    requestedAt: Date;
    requestNote: string;
    resolvedAt?: Date | null;
}

interface TimelineEvent {
    type: "SUBMISSION" | "APPROVAL" | "REJECTION" | "QC_APPROVAL" | "PM_APPROVAL" | "REVISION_REQUEST" | "RESUBMISSION";
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
    const formatDate = (date: Date) => {
        const d = new Date(date);
        const Y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, "0");
        const D = String(d.getDate()).padStart(2, "0");
        const H = String(d.getHours()).padStart(2, "0");
        const m = String(d.getMinutes()).padStart(2, "0");
        return `${Y}/${M}/${D} ${H}:${m}`;
    };

    // Build timeline events
    const events: TimelineEvent[] = [];

    // 1. Process reviewChain if provided (for generic change requests)
    if (reviewChain && reviewChain.length > 0) {
        for (const req of reviewChain) {
            // Submission event
            events.push({
                type: req.previousRequestId ? "RESUBMISSION" : "SUBMISSION",
                user: req.submittedBy?.username || "提交者",
                date: req.createdAt,
                note: req.submitReason,
                status: "info"
            });

            // Review result event
            if (req.status === "APPROVED" && req.reviewedBy) {
                events.push({
                    type: "APPROVAL",
                    user: req.reviewedBy.username,
                    date: req.updatedAt,
                    note: req.reviewNote,
                    status: "success"
                });
            } else if ((req.status === "REJECTED" || req.status === "RESUBMITTED") && req.reviewedBy) {
                events.push({
                    type: "REJECTION",
                    user: req.reviewedBy.username,
                    date: req.updatedAt,
                    note: req.reviewNote,
                    status: "danger"
                });
            }
        }
    } else {
        // Fallback to legacy single-step props (or QC Document data)
        // 1. Initial submission
        events.push({
            type: "SUBMISSION",
            user: submittedBy,
            date: submittedAt,
            note: submitReason,
            status: "info"
        });

        // 2. Approval
        if (reviewedBy && reviewedAt) {
            events.push({
                type: "APPROVAL",
                user: reviewedBy,
                date: reviewedAt,
                note: reviewNote,
                status: "success"
            });
        }
    }

    // 3. QC Approval (Standalone or adds to chain)
    if (qcApprovedBy && qcApprovedAt) {
        events.push({
            type: "QC_APPROVAL",
            user: qcApprovedBy,
            date: qcApprovedAt,
            note: qcNote,
            status: "success"
        });
    }

    // 4. PM Approval
    if (pmApprovedBy && pmApprovedAt) {
        events.push({
            type: "PM_APPROVAL",
            user: pmApprovedBy,
            date: pmApprovedAt,
            note: pmNote,
            status: "success"
        });
    }

    // 5. Revisions (for ISO Documents flow specifically)
    for (const rev of revisions) {
        events.push({
            type: "REVISION_REQUEST",
            user: rev.requestedBy?.username || "審核者",
            date: rev.requestedAt,
            note: rev.requestNote,
            status: "warning"
        });

        if (rev.resolvedAt) {
            events.push({
                type: "RESUBMISSION",
                user: submittedBy,
                date: rev.resolvedAt,
                note: `完成第 ${rev.revisionNumber} 次修訂`,
                status: "info"
            });
        }
    }

    // Sort by date (Oldest first for timeline)
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const getEventLabel = (type: TimelineEvent["type"]) => {
        switch (type) {
            case "SUBMISSION": return "提交";
            case "APPROVAL": return "核准";
            case "REJECTION": return "退回修改";
            case "QC_APPROVAL": return "QC 簽核";
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

    if (events.length === 0) {
        return null;
    }

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
                📋 審核時間軸
            </div>
            <div style={{
                padding: "1.5rem",
                border: "1px solid var(--color-border)",
                borderTop: "none",
                borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                background: "rgba(0,131,143,0.03)"
            }}>
                <div style={{ position: "relative", paddingLeft: "24px" }}>
                    {/* Vertical line */}
                    <div style={{
                        position: "absolute",
                        left: "8px",
                        top: "4px",
                        bottom: "4px",
                        width: "2px",
                        background: "var(--color-border)"
                    }} />

                    {events.map((event, index) => (
                        <div key={index} style={{
                            position: "relative",
                            paddingBottom: index === events.length - 1 ? 0 : "1.5rem"
                        }}>
                            {/* Dot */}
                            <div style={{
                                position: "absolute",
                                left: "-20px",
                                top: "4px",
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                background: getStatusColor(event.status),
                                border: "2px solid white",
                                boxShadow: "0 0 0 2px " + getStatusColor(event.status)
                            }} />

                            <div style={{ marginLeft: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                    <span style={{
                                        fontSize: "12px",
                                        padding: "2px 8px",
                                        background: getStatusColor(event.status) + "20",
                                        color: getStatusColor(event.status),
                                        borderRadius: "12px",
                                        fontWeight: 600
                                    }}>
                                        {getEventLabel(event.type)}
                                    </span>
                                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{event.user}</span>
                                </div>
                                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>
                                    {formatDate(event.date)}
                                </div>
                                {event.note && (
                                    <div style={{
                                        fontSize: "13px",
                                        color: "var(--color-text-main)",
                                        background: "rgba(0,0,0,0.03)",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        marginTop: "4px"
                                    }}>
                                        {event.note}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {currentStatus === "REVISION_REQUIRED" && (
                    <div style={{
                        marginTop: "1rem",
                        padding: "10px 14px",
                        background: "rgba(249, 168, 37, 0.1)",
                        border: "1px solid rgba(249, 168, 37, 0.3)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "#d97706"
                    }}>
                        ⏳ 目前狀態：待修訂
                    </div>
                )}
            </div>
        </div>
    );
}
