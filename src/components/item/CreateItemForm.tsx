"use client";

import { useFormStatus, useFormState } from "react-dom";
import { createPortal } from "react-dom";
import { submitCreateItemRequest, ApprovalState } from "@/actions/approval";
import { useEffect, useState, CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "../editor/RichTextEditor";
import RelatedItemsManager from "./RelatedItemsManager";
import ReferencesManager from "./ReferencesManager";

// Type definition from RelatedItemsManager
interface RelatedItem {
    id: number;
    fullId: string;
    title: string;
    projectId: number;
}

// Type definition for References
interface Reference {
    fileId: number;
    dataCode: string;
    dataName: string;
    dataYear: number;
    author: string;
    fileName: string;
    citation: string | null;
}

const initialState: ApprovalState = {
    message: "",
    error: "",
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            className="btn btn-primary"
            disabled={pending}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.6rem 1.25rem"
            }}
        >
            {pending ? (
                <>
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ animation: "spin 1s linear infinite" }}
                    >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    提交中...
                </>
            ) : (
                <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13" />
                        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                    提交申請
                </>
            )}
        </button>
    );
}

interface _FileInfo {
    name: string;
    path: string;
    size: number;
    type: string;
    uploadedAt: string;
}

interface CreateItemFormProps {
    projectId: number;
    parentId?: number;
    parentFullId?: string;  // 父項目的 fullId，例如 "DAREN-1"
    codePrefix?: string;    // 專案的 codePrefix，例如 "DAREN"
    style?: CSSProperties;
    className?: string;
    modal?: boolean;
    trigger?: ReactNode;
}

export default function CreateItemForm({ projectId, parentId, parentFullId, codePrefix, style, className, modal = false, trigger }: CreateItemFormProps) {
    const router = useRouter();
    const [state, formAction] = useFormState(submitCreateItemRequest, initialState);
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState("");
    const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
    const [references, setReferences] = useState<Reference[]>([]);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (state.message) {
            setSuccessMessage(state.message);
            // 延遲關閉 modal 讓用戶看到成功訊息
            setTimeout(() => {
                setIsOpen(false);
                setContent("");
                setRelatedItems([]);
                setReferences([]);
                setSuccessMessage(null);
                router.refresh(); // 強制刷新頁面資料
            }, 1500);
        }
    }, [state.message, router]);

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
                style={{
                    fontSize: "0.9rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    ...style
                }}
            >
                {parentId ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                ) : (
                    <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        新增項目
                    </>
                )}
            </button>
        );
    }

    const FormContent = (
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="hidden" name="projectId" value={projectId} />
            {parentId && <input type="hidden" name="parentId" value={parentId} />}

            {/* Hidden input to submit rich text content */}
            <input type="hidden" name="content" value={content} />

            {successMessage && (
                <div style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "var(--radius-sm)",
                    color: "#10b981",
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    {successMessage}
                </div>
            )}

            {state.error && (
                <div style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "var(--radius-sm)",
                    color: "#ef4444",
                    fontSize: "0.9rem"
                }}>
                    {state.error}
                </div>
            )}

            <div>
                <label style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "0.4rem",
                    color: "var(--color-text-muted)"
                }}>
                    標題 <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                    name="title"
                    required
                    className="input-field"
                    placeholder="請輸入項目標題"
                    style={{
                        width: "100%",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)",
                        fontSize: "0.95rem"
                    }}
                    autoFocus
                />
            </div>

            <div>
                <label style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "0.4rem",
                    color: "var(--color-text-muted)"
                }}>
                    內容
                </label>
                {/* Hidden input to submit related items */}
                <input type="hidden" name="relatedItems" value={JSON.stringify(relatedItems)} />
                {/* Hidden input to submit references */}
                <input type="hidden" name="references" value={JSON.stringify(references)} />

                <div style={{
                    maxHeight: modal ? '300px' : 'none',
                    overflowY: 'auto',
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)"
                }}>
                    <RichTextEditor content={content} onChange={setContent} />
                </div>
            </div>

            <RelatedItemsManager
                initialRelatedItems={[]}
                onChange={setRelatedItems}
            />

            <ReferencesManager
                initialReferences={[]}
                onChange={setReferences}
            />

            <div>
                <label style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "0.4rem",
                    color: "var(--color-text-muted)"
                }}>
                    編輯原因 <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                    name="submitReason"
                    required
                    placeholder="請說明新增此項目的原因..."
                    className="input-field"
                    style={{
                        width: "100%",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)",
                        minHeight: "80px",
                        resize: "vertical",
                        fontSize: "0.95rem"
                    }}
                />
            </div>

            <div style={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "0.5rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--color-border)"
            }}>
                <SubmitButton />
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="btn btn-outline"
                    style={{ padding: "0.6rem 1.25rem" }}
                >
                    取消
                </button>
            </div>
        </form>
    );

    if (modal) {
        if (typeof document === 'undefined') return null;

        return createPortal(
            <div
                style={{
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
                    backdropFilter: 'blur(4px)',
                    animation: 'fadeIn 0.2s ease'
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget) setIsOpen(false);
                }}
            >
                <div
                    className="glass"
                    style={{
                        padding: "1.75rem",
                        borderRadius: "var(--radius-lg)",
                        width: '90%',
                        maxWidth: '800px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        backgroundColor: 'var(--color-bg-surface)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                        border: '1px solid var(--color-border)',
                        animation: 'slideUp 0.25s ease'
                    }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: "1.25rem",
                        paddingBottom: "1rem",
                        borderBottom: "1px solid var(--color-border)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "8px",
                                backgroundColor: "var(--color-primary-soft)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="12" y1="18" x2="12" y2="12" />
                                    <line x1="9" y1="15" x2="15" y2="15" />
                                </svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600 }}>
                                    {parentId ? '新增子項目' : '新增項目'}
                                </h3>
                                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                                    {parentFullId
                                        ? `將在 ${parentFullId} 下新增子項目`
                                        : codePrefix
                                            ? `將在 ${codePrefix} 下新增項目`
                                            : '填寫以下資訊後提交審核'
                                    }
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'var(--color-bg-elevated)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-text-muted)',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                                e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                e.currentTarget.style.color = 'var(--color-text-muted)';
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    {FormContent}
                </div>
                <style jsx>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>,
            document.body
        );
    }

    return (
        <div className="glass" style={{
            padding: "1.5rem",
            marginTop: "1rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)"
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "1.25rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid var(--color-border)"
            }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <h4 style={{ margin: 0 }}>{parentId ? '新增子項目' : '新增項目'}</h4>
            </div>
            {FormContent}
        </div>
    );
}
