"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import RichTextEditor from "../editor/RichTextEditor";
import { submitUpdateItemRequest } from "@/actions/approval";
import FileUploader from "../upload/FileUploader";
import RelatedItemsManager from "./RelatedItemsManager";

interface RelatedItem {
    id: number;
    fullId: string;
    title: string;
    projectId: number;
    projectTitle?: string;
    description?: string | null;
}

interface EditItemButtonProps {
    item: {
        id: number;
        title: string;
        content: string | null;
        attachments: string | null;
        relationsFrom?: Array<{
            description: string | null;
            target: {
                id: number;
                fullId: string;
                title: string;
                projectId: number;
                project: { title: string };
            };
        }>;
    };
    isDisabled?: boolean;
}

export default function EditItemButton({ item, isDisabled = false }: EditItemButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [title, setTitle] = useState(item.title);
    const [content, setContent] = useState(item.content || "");
    const [attachments, setAttachments] = useState<any[]>(
        item.attachments ? JSON.parse(item.attachments) : []
    );
    // Transform relationsFrom to RelatedItem format
    const initialRelatedItems: RelatedItem[] = (item.relationsFrom || []).map(r => ({
        id: r.target.id,
        fullId: r.target.fullId,
        title: r.target.title,
        projectId: r.target.projectId,
        projectTitle: r.target.project.title,
        description: r.description
    }));
    const [relatedItems, setRelatedItems] = useState<RelatedItem[]>(initialRelatedItems);
    const [submitReason, setSubmitReason] = useState("");
    const [status, setStatus] = useState<{ message?: string; error?: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial load check for document (SSR safety)
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset form when modal opens
    useEffect(() => {
        if (isModalOpen) {
            setTitle(item.title);
            setContent(item.content || "");
            setAttachments(item.attachments ? JSON.parse(item.attachments) : []);
            setRelatedItems((item.relationsFrom || []).map(r => ({
                id: r.target.id,
                fullId: r.target.fullId,
                title: r.target.title,
                projectId: r.target.projectId,
                projectTitle: r.target.project.title,
                description: r.description
            })));
            setSubmitReason("");
            setStatus(null);
        }
    }, [isModalOpen, item]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus(null);

        const formData = new FormData();
        formData.append("itemId", item.id.toString());
        formData.append("title", title);
        formData.append("content", content);

        if (attachments.length > 0) {
            formData.append("attachments", JSON.stringify(attachments));
        }

        if (relatedItems.length > 0) {
            formData.append("relatedItems", JSON.stringify(relatedItems));
        }

        formData.append("submitReason", submitReason);

        try {
            const result = await submitUpdateItemRequest({}, formData);
            if (result.error) {
                setStatus({ error: result.error });
            } else {
                setStatus({ message: result.message });
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus(null);
                }, 1500);
            }
        } catch (err) {
            setStatus({ error: "An unexpected error occurred." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const modalContent = (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 99999, // Extremely high z-index
            backdropFilter: "blur(4px)"
        }}>
            <div className="glass" style={{
                width: "900px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto",
                borderRadius: "var(--radius-lg)", padding: "2rem",
                display: "flex", flexDirection: "column",
                backgroundColor: "var(--color-bg-surface)", // Solid background
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                border: "1px solid var(--color-border)"
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1.5rem" }}>
                    <h2 style={{ margin: 0 }}>編輯項目</h2>
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
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
                            overflow: "hidden", background: "white" // Force white background for editor visibility
                        }}>
                            <RichTextEditor content={content} onChange={setContent} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>附件</label>
                        <FileUploader onFilesChange={setAttachments} initialFiles={attachments} />
                    </div>

                    {/* Related Items Section */}
                    <div>
                        <RelatedItemsManager
                            initialRelatedItems={relatedItems}
                            onChange={setRelatedItems}
                            canEdit={true}
                        />
                    </div>

                    {/* Edit Reason */}
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>編輯原因 (必填)</label>
                        <textarea
                            required
                            value={submitReason}
                            onChange={(e) => setSubmitReason(e.target.value)}
                            placeholder="請說明編輯此項目的原因..."
                            style={{
                                width: "100%",
                                padding: "0.75rem",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--color-border)",
                                background: "var(--color-background)",
                                color: "var(--color-text)",
                                minHeight: "80px",
                                resize: "vertical"
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
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
                            {isSubmitting ? "提交中..." : "提交變更申請"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <>
            <button
                className="btn btn-outline"
                onClick={() => setIsModalOpen(true)}
                disabled={isDisabled}
                title={isDisabled ? "Changes pending approval" : "Request changes"}
                style={{ opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
            >
                編輯
            </button>
            {isModalOpen && mounted && typeof document !== 'undefined' && createPortal(modalContent, document.body)}
        </>
    );
}
