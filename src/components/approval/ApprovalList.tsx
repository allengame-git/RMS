"use client";

import { approveRequest, rejectRequest } from "@/actions/approval";
import { useState } from "react";

type Request = {
    id: number;
    type: string;
    status: string;
    data: string;
    createdAt: Date;
    submittedBy: { username: string };
    targetProject: { title: string; codePrefix: string } | null;
    targetParent: { fullId: string } | null;
    item: { fullId: string; title: string } | null;
};

export default function ApprovalList({ requests }: { requests: Request[] }) {
    const [loading, setLoading] = useState<number | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null);

    const handleApproveClick = (id: number) => {
        setConfirmDialog({ id, action: 'approve' });
    };

    const handleRejectClick = (id: number) => {
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
            alert(`Failed to ${action} request: ${error.message || 'Unknown error'}`);
            setLoading(null);
        }
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmDialog(null);
    };

    if (requests.length === 0) {
        return <p style={{ color: "var(--color-text-muted)" }}>No pending requests.</p>;
    }

    return (
        <div className="flex-col gap-md">
            {requests.map(req => {
                const data = JSON.parse(req.data); // { title, content }
                return (
                    <div key={req.id} className="glass" style={{ padding: "1.5rem", borderRadius: "var(--radius-md)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <span style={{ fontWeight: "bold", color: "var(--color-primary)" }}>
                                {req.type} ITEM
                                {req.targetParent ? ` (Child of ${req.targetParent.fullId})` : " (Root)"}
                            </span>
                            <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                                {new Date(req.createdAt).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })} by {req.submittedBy.username}
                            </span>
                        </div>

                        <div style={{ marginBottom: "1rem" }}>
                            <strong>Project:</strong> {req.targetProject?.title} <br />
                            <strong>Proposed Title:</strong> {data.title} <br />
                            {data.content && (
                                <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--color-text-muted)", borderLeft: "2px solid var(--color-border)", paddingLeft: "0.5rem" }}>
                                    <div dangerouslySetInnerHTML={{ __html: data.content }} />
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: "1rem" }}>
                            <button
                                onClick={() => handleApproveClick(req.id)}
                                className="btn btn-primary"
                                disabled={loading !== null}
                                style={{ backgroundColor: "var(--color-success)", border: "none" }}
                            >
                                {loading === req.id ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                                onClick={() => handleRejectClick(req.id)}
                                className="btn btn-outline"
                                disabled={loading !== null}
                                style={{ color: "var(--color-danger)", borderColor: "var(--color-danger)" }}
                            >
                                {loading === req.id ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                );
            })}

            {/* Custom Confirmation Dialog */}
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
                            {confirmDialog.action === 'approve' ? 'Approve Request?' : 'Reject Request?'}
                        </h3>
                        <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
                            {confirmDialog.action === 'approve'
                                ? 'This will create the item and mark the request as approved.'
                                : 'This will reject the request and it cannot be undone.'}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleCancel}
                                className="btn btn-outline"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="btn btn-primary"
                                style={{
                                    backgroundColor: confirmDialog.action === 'approve' ? 'var(--color-success)' : 'var(--color-danger)',
                                    border: 'none'
                                }}
                            >
                                {confirmDialog.action === 'approve' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
