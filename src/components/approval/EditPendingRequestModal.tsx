"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import RichTextEditor from "../editor/RichTextEditor";
import RelatedItemsManager from "../item/RelatedItemsManager";
import ReferencesManager from "../item/ReferencesManager";
import { updatePendingRequest } from "@/actions/approval";

interface RelatedItem {
    id: number;
    fullId: string;
    title: string;
    projectId: number;
    projectTitle?: string;
    description?: string | null;
}

interface Reference {
    fileId: number;
    dataCode: string;
    dataName: string;
    dataYear: number;
    author: string;
    fileName: string;
    filePath?: string;
    citation: string | null;
}

interface EditPendingRequestModalProps {
    requestId: number;
    requestType: string;
    data: string; // JSON string from ChangeRequest.data
    submitReason: string | null;
    onClose: () => void;
}

export default function EditPendingRequestModal({
    requestId,
    requestType,
    data,
    submitReason: initialSubmitReason,
    onClose,
}: EditPendingRequestModalProps) {
    const router = useRouter();
    const parsed = JSON.parse(data);

    const [title, setTitle] = useState(parsed.title || "");
    const [content, setContent] = useState(parsed.content || "");
    const [relatedItems, setRelatedItems] = useState<RelatedItem[]>(parsed.relatedItems || []);
    const [references, setReferences] = useState<Reference[]>(parsed.references || []);
    const [submitReason, setSubmitReason] = useState(initialSubmitReason || "");
    const [status, setStatus] = useState<{ message?: string; error?: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmittingRef.current || isSubmitting) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setStatus(null);

        const formData = new FormData();
        formData.append("title", title);
        formData.append("content", content);
        formData.append("submitReason", submitReason);

        if (relatedItems.length > 0) {
            formData.append("relatedItems", JSON.stringify(relatedItems));
        }
        if (references.length > 0) {
            formData.append("references", JSON.stringify(references));
        }

        try {
            const result = await updatePendingRequest(requestId, formData);
            if (result.error) {
                setStatus({ error: result.error });
                setIsSubmitting(false);
                isSubmittingRef.current = false;
            } else {
                setStatus({ message: result.message });
                router.refresh();
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
        } catch {
            setStatus({ error: "發生未預期的錯誤" });
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const typeLabel = requestType === "CREATE" ? "新增" : "編輯";

    const modalContent = (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 99999,
            backdropFilter: "blur(4px)"
        }}>
            <div className="glass" style={{
                width: "900px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto",
                borderRadius: "var(--radius-lg)", padding: "2rem",
                display: "flex", flexDirection: "column",
                backgroundColor: "var(--color-bg-surface)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                border: "1px solid var(--color-border)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--color-border)" }}>
                    <h2 style={{ margin: 0 }}>
                        編輯{typeLabel}申請
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", lineHeight: 1 }}
                    >
                        ×
                    </button>
                </div>

                {status?.message && (
                    <div style={{
                        padding: "1rem", marginBottom: "1rem", borderRadius: "var(--radius-sm)",
                        backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--color-success)",
                        border: "1px solid var(--color-success)"
                    }}>
                        {status.message}
                    </div>
                )}

                {status?.error && (
                    <div style={{
                        padding: "1rem", marginBottom: "1rem", borderRadius: "var(--radius-sm)",
                        backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--color-danger)",
                        border: "1px solid var(--color-danger)"
                    }}>
                        {status.error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem", flex: 1 }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>標題</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={{
                                width: "100%", padding: "0.75rem", borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--color-border)", background: "var(--color-background)",
                                color: "var(--color-text)"
                            }}
                        />
                    </div>

                    <div style={{ flex: 1, minHeight: "300px", display: "flex", flexDirection: "column" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>內容</label>
                        <div style={{
                            flex: 1, border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
                            overflow: "hidden", background: "white"
                        }}>
                            <RichTextEditor content={content} onChange={setContent} />
                        </div>
                    </div>

                    <div>
                        <RelatedItemsManager
                            initialRelatedItems={relatedItems}
                            onChange={setRelatedItems}
                            canEdit={true}
                        />
                    </div>

                    <div>
                        <ReferencesManager
                            initialReferences={references}
                            onChange={setReferences}
                            canEdit={true}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                            {requestType === "CREATE" ? "提交原因" : "編輯原因"}
                        </label>
                        <textarea
                            value={submitReason}
                            onChange={(e) => setSubmitReason(e.target.value)}
                            placeholder="請說明原因..."
                            style={{
                                width: "100%", padding: "0.75rem", borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--color-border)", background: "var(--color-background)",
                                color: "var(--color-text)", minHeight: "80px", resize: "vertical"
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-outline"
                            disabled={isSubmitting}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "提交中..." : "重新提交"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    if (!mounted || typeof document === "undefined") return null;
    return createPortal(modalContent, document.body);
}
