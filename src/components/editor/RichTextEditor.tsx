"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useState, useRef, useEffect } from 'react';
import { ItemLink } from './extensions/ItemLink';

// Helper function to upload a file to the server
const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (result.success && result.file?.path) {
            return result.file.path;
        } else {
            console.error('Upload failed:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Upload error:', error);
        return null;
    }
};

// Custom Input Dialog Component
const InputDialog = ({
    isOpen,
    title,
    placeholder,
    defaultValue,
    onConfirm,
    onCancel
}: {
    isOpen: boolean;
    title: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
}) => {
    const [value, setValue] = useState(defaultValue || '');

    // Reset value when dialog opens with new defaultValue
    useEffect(() => {
        setValue(defaultValue || '');
    }, [isOpen, defaultValue]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 100000
        }} onClick={(e) => { e.stopPropagation(); onCancel(); }}>
            <div style={{
                backgroundColor: 'var(--color-bg-surface, #fff)',
                padding: '1.5rem',
                borderRadius: 'var(--radius-md, 8px)',
                minWidth: '350px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }} onClick={(e) => e.stopPropagation()}>
                <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>{title}</h4>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder || 'Enter URL...'}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onConfirm(value);
                        } else if (e.key === 'Escape') {
                            onCancel();
                        }
                    }}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--color-border, #ccc)',
                        borderRadius: 'var(--radius-sm, 4px)',
                        fontSize: '1rem',
                        marginBottom: '1rem',
                        background: 'var(--color-bg-surface, #fff)',
                        color: 'var(--color-text-main, #333)'
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{
                            padding: '0.5rem 1rem',
                            border: '1px solid var(--color-border, #ccc)',
                            borderRadius: 'var(--radius-sm, 4px)',
                            background: 'transparent',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(value)}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: 'var(--radius-sm, 4px)',
                            background: 'var(--color-primary, #3b82f6)',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

const MenuBar = ({ editor, onUploadImage }: { editor: any; onUploadImage: (file: File) => void }) => {
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        type: 'link' | 'image' | null;
        defaultValue?: string;
    }>({ isOpen: false, type: null });

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!editor) {
        return null;
    }

    const openImageDialog = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDialogState({ isOpen: true, type: 'image' });
    };

    const openLinkDialog = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const previousUrl = editor.getAttributes('link').href || '';
        setDialogState({ isOpen: true, type: 'link', defaultValue: previousUrl });
    };

    const handleDialogConfirm = (value: string) => {
        if (dialogState.type === 'image') {
            if (value) {
                editor.chain().focus().setImage({ src: value }).run();
            }
        } else if (dialogState.type === 'link') {
            if (value === '') {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
            } else {
                editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
            }
        }
        setDialogState({ isOpen: false, type: null });
    };

    const handleDialogCancel = () => {
        setDialogState({ isOpen: false, type: null });
    };

    // Handle file upload - direct upload without editing
    const handleUploadClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('只允許上傳圖片檔案 (JPG, PNG, GIF, WebP)');
            return;
        }

        // Validate file size (max 20MB)
        if (file.size > 20 * 1024 * 1024) {
            alert('檔案大小不能超過 20MB');
            return;
        }

        setIsUploading(true);

        try {
            const uploadedUrl = await uploadFile(file);
            if (uploadedUrl) {
                editor.chain().focus().setImage({ src: uploadedUrl }).run();
            } else {
                alert('上傳失敗');
            }
        } finally {
            setIsUploading(false);
            // Reset the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <>
            <div className="editor-menu-bar" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active' : ''}
                    type="button"
                >
                    Bold
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'is-active' : ''}
                    type="button"
                >
                    Italic
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                    type="button"
                >
                    H2
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
                    type="button"
                >
                    H3
                </button>

                <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 0.5rem', height: '20px' }}></div>

                <button onClick={openLinkDialog} className={editor.isActive('link') ? 'is-active' : ''} type="button">
                    Link
                </button>
                <button onClick={openImageDialog} type="button">Image URL</button>
                <button
                    onClick={handleUploadClick}
                    type="button"
                    disabled={isUploading}
                    style={{
                        background: 'var(--color-primary-soft)',
                        fontWeight: 500
                    }}
                >
                    {isUploading ? '⏳ 上傳中...' : '📷 上傳圖片'}
                </button>
                {/* Hidden file input for image upload */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />

                <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 0.5rem', height: '20px' }}></div>

                <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} type="button">
                    Table
                </button>
                <button onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().deleteTable()} type="button">
                    Del Table
                </button>

                <style jsx>{`
            button {
                background: none;
                border: 1px solid transparent;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                color: var(--color-text);
                font-size: 0.85rem;
            }
            button:hover {
                background: rgba(0,0,0,0.05);
            }
            button.is-active {
                background: var(--color-primary-soft);
                color: var(--color-primary);
                font-weight: bold;
            }
            button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
          `}</style>
            </div>

            <InputDialog
                isOpen={dialogState.isOpen}
                title={dialogState.type === 'image' ? 'Insert Image URL' : 'Insert Link URL'}
                placeholder="https://..."
                defaultValue={dialogState.defaultValue}
                onConfirm={handleDialogConfirm}
                onCancel={handleDialogCancel}
            />
        </>
    );
};

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    editable?: boolean;
}

const RichTextEditor = ({ content, onChange, editable = true }: RichTextEditorProps) => {
    const [isUploading, setIsUploading] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Image,
            Link.configure({
                openOnClick: true,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            ItemLink,
        ],
        content: content,
        editable: editable,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none',
                style: 'padding: 1rem; min-height: 150px;'
            },
            // Handle paste events for images - direct upload
            handlePaste: (view, event, slice) => {
                const items = event.clipboardData?.items;
                if (!items) return false;

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.startsWith('image/')) {
                        event.preventDefault();
                        const file = item.getAsFile();
                        if (file) {
                            // Direct upload without editing
                            uploadFile(file).then((uploadedUrl) => {
                                if (uploadedUrl && view.state) {
                                    const { state, dispatch } = view;
                                    const node = state.schema.nodes.image.create({ src: uploadedUrl });
                                    const transaction = state.tr.replaceSelectionWith(node);
                                    dispatch(transaction);
                                }
                            });
                        }
                        return true;
                    }
                }
                return false;
            },
            // Handle drop events for images - direct upload
            handleDrop: (view, event, slice, moved) => {
                if (moved) return false;

                const files = event.dataTransfer?.files;
                if (!files || files.length === 0) return false;

                const file = files[0];
                if (file.type.startsWith('image/')) {
                    event.preventDefault();
                    // Direct upload without editing
                    uploadFile(file).then((uploadedUrl) => {
                        if (uploadedUrl && view.state) {
                            const { state, dispatch } = view;
                            const node = state.schema.nodes.image.create({ src: uploadedUrl });
                            const transaction = state.tr.replaceSelectionWith(node);
                            dispatch(transaction);
                        }
                    });
                    return true;
                }
                return false;
            }
        }
    });

    const handleUploadImage = async (file: File) => {
        if (!editor) return;

        setIsUploading(true);
        try {
            const uploadedUrl = await uploadFile(file);
            if (uploadedUrl) {
                editor.chain().focus().setImage({ src: uploadedUrl }).run();
            }
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="rich-text-editor" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {editable && <MenuBar editor={editor} onUploadImage={handleUploadImage} />}
            <EditorContent editor={editor} />

            {/* Basic output styles for tables and images within the editor content */}
            <style global jsx>{`
        .ProseMirror {
            outline: none;
        }
        .ProseMirror table {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
            margin: 0;
            overflow: hidden;
        }
        .ProseMirror td,
        .ProseMirror th {
            min-width: 1em;
            border: 2px solid var(--color-border);
            padding: 3px 5px;
            vertical-align: top;
            box-sizing: border-box;
            position: relative;
        }
        .ProseMirror th {
            font-weight: bold;
            text-align: left;
            background-color: rgba(0,0,0,0.02);
        }
        .ProseMirror img {
            max-width: 100%;
            height: auto;
            border-radius: var(--radius-sm);
        }
        .ProseMirror blockquote {
            border-left: 3px solid var(--color-border);
            padding-left: 1rem;
            margin-left: 0;
            font-style: italic;
        }
      `}</style>
        </div>
    );
};

export default RichTextEditor;
