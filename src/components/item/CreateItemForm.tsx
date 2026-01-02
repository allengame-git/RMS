"use client";

import { useFormStatus, useFormState, createPortal } from "react-dom";
import { submitCreateItemRequest, ApprovalState } from "@/actions/approval";
import { useEffect, useState, CSSProperties, ReactNode } from "react";
import RichTextEditor from "../editor/RichTextEditor";
import FileUploader from "../upload/FileUploader";
import RelatedItemsManager from "./RelatedItemsManager";

// Type definition from RelatedItemsManager
interface RelatedItem {
    id: number;
    fullId: string;
    title: string;
    projectId: number;
}

const initialState: ApprovalState = {
    message: "",
    error: "",
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Submitting..." : "Submit Request"}
        </button>
    );
}

interface FileInfo {
    name: string;
    path: string;
    size: number;
    type: string;
    uploadedAt: string;
}

interface CreateItemFormProps {
    projectId: number;
    parentId?: number;
    style?: CSSProperties;
    className?: string;
    modal?: boolean;
    trigger?: ReactNode;
}

export default function CreateItemForm({ projectId, parentId, style, className, modal = false, trigger }: CreateItemFormProps) {
    const [state, formAction] = useFormState(submitCreateItemRequest, initialState);
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState("");
    const [attachments, setAttachments] = useState<FileInfo[]>([]);
    const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);

    useEffect(() => {
        if (state.message) {
            setIsOpen(false);
            setContent(""); // Reset content
            setAttachments([]); // Reset attachments
            setRelatedItems([]); // Reset related items
            alert(state.message);
        }
    }, [state.message]);

    // Close modal on escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        if (isOpen && modal) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, modal]);

    if (!isOpen) {
        if (trigger) {
            return <div onClick={() => setIsOpen(true)}>{trigger}</div>;
        }
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={`btn btn-outline ${className || ''}`}
                style={{ fontSize: "0.9rem", ...style }}
            >
                {parentId ? "+" : "+ Add Item"}
            </button>
        );
    }

    const FormContent = (
        <form action={formAction} className="flex-col gap-sm">
            <input type="hidden" name="projectId" value={projectId} />
            {parentId && <input type="hidden" name="parentId" value={parentId} />}

            {/* Hidden input to submit rich text content */}
            <input type="hidden" name="content" value={content} />

            {/* Hidden input to submit attachments */}
            <input type="hidden" name="attachments" value={JSON.stringify(attachments)} />

            {state.error && <p style={{ color: "var(--color-danger)" }}>{state.error}</p>}

            <label style={{ fontSize: "0.9rem" }}>Title</label>
            <input
                name="title"
                required
                className="input-field"
                style={{ padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                autoFocus
            />

            <label style={{ fontSize: "0.9rem" }}>Content (Rich Text)</label>
            {/* Hidden input to submit related items */}
            <input type="hidden" name="relatedItems" value={JSON.stringify(relatedItems)} />

            <div style={{ maxHeight: modal ? '300px' : 'none', overflowY: 'auto' }}>
                <RichTextEditor content={content} onChange={setContent} />
            </div>

            <FileUploader onFilesChange={setAttachments} initialFiles={attachments} />

            <RelatedItemsManager
                initialRelatedItems={[]}
                onChange={setRelatedItems}
            />

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <SubmitButton />
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="btn btn-outline"
                >
                    Cancel
                </button>
            </div>
        </form>
    );

    if (modal) {
        if (typeof document === 'undefined') return null;

        return createPortal(
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10000,
                backdropFilter: 'blur(4px)'
            }}>
                <div className="glass" style={{
                    padding: "2rem",
                    borderRadius: "var(--radius-lg)",
                    width: '90%',
                    maxWidth: '800px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    backgroundColor: 'var(--color-background, #ffffff)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--color-border)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
                        <h4 style={{ margin: 0 }}>{parentId ? 'New Child Item Request' : 'New Item Request'}</h4>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                    </div>
                    {FormContent}
                </div>
            </div>,
            document.body
        );
    }

    return (
        <div className="glass" style={{ padding: "1rem", marginTop: "1rem", borderRadius: "var(--radius-md)" }}>
            <h4 style={{ marginBottom: "1rem" }}>{parentId ? 'New Child Item Request' : 'New Item Request'}</h4>
            {FormContent}
        </div>
    );
}
