"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/editor/RichTextEditor";
import FileUploader from "@/components/upload/FileUploader";
import RelatedItemsManager from "@/components/item/RelatedItemsManager";
import { submitUpdateItemRequest } from "@/actions/approval";
import { markRejectedAsResubmitted } from "@/actions/rejected-requests";

interface Props {
    request: {
        id: number;
        type: string;
        itemId: number | null;
        item: {
            id: number;
            fullId: string;
            title: string;
            content: string | null;
            attachments: string | null;
            relationsFrom?: Array<{
                target: { id: number; fullId: string; title: string; projectId: number };
            }>;
        } | null;
        targetProjectId: number | null;
        targetProject: { id: number; title: string; codePrefix: string } | null;
        data: any;
        reviewNote: string | null;
    };
}

interface FileInfo {
    name: string;
    path: string;
    size: number;
    type?: string;
    uploadedAt: string;
}

interface RelatedItem {
    id: number;
    fullId: string;
    title: string;
    projectId: number;
    projectTitle?: string;
    description?: string | null;
}

export default function RejectedRequestEditForm({ request }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{ message?: string; error?: string } | null>(null);

    // Initialize form: prioritize rejected request data, fallback to current item content
    // request.data contains what was submitted and then rejected
    // request.item contains the current state of the item
    const getInitialData = () => {
        // Always get relatedItems from the item's current state
        const relatedItems = request.item?.relationsFrom?.map(r => ({
            id: r.target.id,
            fullId: r.target.fullId,
            title: r.target.title,
            projectId: r.target.projectId
        })) || [];

        // If request.data has content, use it (this is what was rejected)
        if (request.data && (request.data.title || request.data.content)) {
            // Also check if relatedItems was in the rejected data
            const dataRelatedItems = request.data.relatedItems
                ? (typeof request.data.relatedItems === 'string'
                    ? JSON.parse(request.data.relatedItems)
                    : request.data.relatedItems)
                : relatedItems;

            return {
                title: request.data.title || request.item?.title || "",
                content: request.data.content || request.item?.content || "",
                attachments: request.data.attachments
                    ? (typeof request.data.attachments === 'string'
                        ? JSON.parse(request.data.attachments)
                        : request.data.attachments)
                    : request.item?.attachments
                        ? JSON.parse(request.item.attachments)
                        : [],
                relatedItems: dataRelatedItems
            };
        }
        // Fallback to current item content
        return {
            title: request.item?.title || "",
            content: request.item?.content || "",
            attachments: request.item?.attachments ? JSON.parse(request.item.attachments) : [],
            relatedItems
        };
    };

    const initialData = getInitialData();

    const [title, setTitle] = useState(initialData.title);
    const [content, setContent] = useState(initialData.content);
    const [attachments, setAttachments] = useState<FileInfo[]>(initialData.attachments);
    const [relatedItems, setRelatedItems] = useState<RelatedItem[]>(initialData.relatedItems || []);
    const [submitReason, setSubmitReason] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!request.itemId) {
            setStatus({ error: "無法提交：找不到關聯項目" });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        const formData = new FormData();
        formData.append("itemId", request.itemId.toString());
        formData.append("title", title);
        formData.append("content", content);

        if (attachments.length > 0) {
            formData.append("attachments", JSON.stringify(attachments));
        }

        if (relatedItems.length > 0) {
            formData.append("relatedItems", JSON.stringify(relatedItems));
        }

        formData.append("submitReason", submitReason || "(依審查意見修改後重新提交)");
        formData.append("previousRequestId", request.id.toString());

        try {
            const result = await submitUpdateItemRequest({}, formData);
            if (result.error) {
                setStatus({ error: result.error });
            } else {
                // Mark the original rejected request as resubmitted (deleted)
                await markRejectedAsResubmitted(request.id);

                setStatus({ message: "已成功重新提交審查！" });
                setTimeout(() => {
                    router.push("/admin/rejected-requests");
                    router.refresh();
                }, 1500);
            }
        } catch (err) {
            setStatus({ error: "發生未預期的錯誤" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="glass" style={{ padding: "2rem", borderRadius: "var(--radius-lg)" }}>
            <h3 style={{
                fontSize: "1.2rem",
                fontWeight: 600,
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
            }}>
                ✏️ 修改內容
            </h3>

            <form onSubmit={handleSubmit}>
                {/* Title */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>
                        標題
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        style={{
                            width: "100%",
                            padding: "0.75rem",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                            fontSize: "1rem"
                        }}
                    />
                </div>

                {/* Content */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>
                        內容
                    </label>
                    <RichTextEditor content={content} onChange={setContent} />
                </div>

                {/* Attachments */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>
                        附件
                    </label>
                    <FileUploader
                        initialFiles={attachments as any}
                        onFilesChange={setAttachments as any}
                    />
                </div>

                {/* Related Items */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>
                        關聯項目
                    </label>
                    <RelatedItemsManager
                        sourceItemId={request.itemId || undefined}
                        initialRelatedItems={relatedItems}
                        onChange={setRelatedItems}
                    />
                </div>

                {/* Submit Reason */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}>
                        修改說明
                    </label>
                    <textarea
                        value={submitReason}
                        onChange={(e) => setSubmitReason(e.target.value)}
                        placeholder="請說明依據審查意見所做的修改..."
                        style={{
                            width: "100%",
                            padding: "0.75rem",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                            minHeight: "100px",
                            fontSize: "0.95rem",
                            resize: "vertical"
                        }}
                    />
                </div>

                {/* Status Messages */}
                {status?.error && (
                    <div style={{
                        padding: "1rem",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        color: "#ef4444",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: "1rem"
                    }}>
                        {status.error}
                    </div>
                )}
                {status?.message && (
                    <div style={{
                        padding: "1rem",
                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                        color: "#10b981",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: "1rem"
                    }}>
                        {status.message}
                    </div>
                )}

                {/* Submit Button */}
                <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                    <button
                        type="button"
                        onClick={() => router.back()}
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
                        {isSubmitting ? "提交中..." : "重新提交審查"}
                    </button>
                </div>
            </form>
        </div>
    );
}
