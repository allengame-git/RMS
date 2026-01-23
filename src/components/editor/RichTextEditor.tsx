"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageResize from 'tiptap-extension-resize-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useState, useRef, useEffect } from 'react';
import { ItemLink } from './extensions/ItemLink';
import { Indent } from './extensions/Indent';
import { FontSize } from './extensions/FontSize';

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

// Link Dialog Component
const LinkDialog = ({
    isOpen,
    onConfirm,
    onCancel
}: {
    isOpen: boolean;
    onConfirm: (text: string, url: string) => void;
    onCancel: () => void;
}) => {
    const [text, setText] = useState('');
    const [url, setUrl] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (url.trim()) {
            onConfirm(text.trim() || url, url.trim());
            setText('');
            setUrl('');
        } else {
            alert('請輸入有效的 URL');
        }
    };

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
                minWidth: '400px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                color: 'var(--color-text-main, #333)'
            }} onClick={(e) => e.stopPropagation()}>
                <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Insert Link</h4>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        顯示文字 (Display Text)
                    </label>
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="點擊這裡"
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--color-border, #ccc)',
                            borderRadius: 'var(--radius-sm, 4px)',
                            fontSize: '1rem',
                            background: 'var(--color-bg-surface, #fff)',
                            color: 'var(--color-text-main, #333)'
                        }}
                    />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        連結 URL (Link URL)
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleConfirm();
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
                            background: 'var(--color-bg-surface, #fff)',
                            color: 'var(--color-text-main, #333)'
                        }}
                    />
                </div>

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
                        onClick={handleConfirm}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: 'var(--radius-sm, 4px)',
                            background: 'var(--color-primary, #3b82f6)',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Insert
                    </button>
                </div>
            </div>
        </div>
    );
};

// Table Size Dialog Component
const TableSizeDialog = ({
    isOpen,
    onConfirm,
    onCancel
}: {
    isOpen: boolean;
    onConfirm: (rows: number, cols: number) => void;
    onCancel: () => void;
}) => {
    const [rows, setRows] = useState('3');
    const [cols, setCols] = useState('3');

    if (!isOpen) return null;

    const handleConfirm = () => {
        const rowsNum = parseInt(rows);
        const colsNum = parseInt(cols);

        if (rowsNum > 0 && rowsNum <= 20 && colsNum > 0 && colsNum <= 20) {
            onConfirm(rowsNum, colsNum);
        } else {
            alert('請輸入 1-20 之間的數字');
        }
    };

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
                <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Insert Table</h4>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                            行數 (Rows)
                        </label>
                        <input
                            type="number"
                            value={rows}
                            onChange={(e) => setRows(e.target.value)}
                            min="1"
                            max="20"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid var(--color-border, #ccc)',
                                borderRadius: 'var(--radius-sm, 4px)',
                                fontSize: '1rem',
                                background: 'var(--color-bg-surface, #fff)',
                                color: 'var(--color-text-main, #333)'
                            }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                            列數 (Columns)
                        </label>
                        <input
                            type="number"
                            value={cols}
                            onChange={(e) => setCols(e.target.value)}
                            min="1"
                            max="20"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleConfirm();
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
                                background: 'var(--color-bg-surface, #fff)',
                                color: 'var(--color-text-main, #333)'
                            }}
                        />
                    </div>
                </div>

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
                        onClick={handleConfirm}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: 'var(--radius-sm, 4px)',
                            background: 'var(--color-primary, #3b82f6)',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Insert
                    </button>
                </div>
            </div>
        </div>
    );
};

const MenuBar = ({ editor, onUploadImage: _onUploadImage }: { editor: any; onUploadImage: (file: File) => void }) => {
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        type: 'image' | 'table' | null;
        defaultValue?: string;
    }>({ isOpen: false, type: null });

    const [linkDialogOpen, setLinkDialogOpen] = useState(false);

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!editor) {
        return null;
    }

    const _openImageDialog = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDialogState({ isOpen: true, type: 'image' });
    };

    const openLinkDialog = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLinkDialogOpen(true);
    };

    const openTableDialog = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDialogState({ isOpen: true, type: 'table' });
    };

    const handleDialogConfirm = (value: string) => {
        if (dialogState.type === 'image') {
            if (value) {
                editor.chain().focus().setImage({ src: value }).run();
            }
        }
        setDialogState({ isOpen: false, type: null });
    };

    const handleLinkConfirm = (text: string, url: string) => {
        editor.chain().focus().insertContent({
            type: 'text',
            text: text,
            marks: [{ type: 'link', attrs: { href: url } }]
        }).run();
        setLinkDialogOpen(false);
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
                // Use setTimeout to ensure editor regains focus after file dialog closes
                setTimeout(() => {
                    if (editor) {
                        editor.chain().focus().setImage({ src: uploadedUrl }).run();
                    }
                }, 100);
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
                    onClick={() => editor.chain().focus().toggleSubscript().run()}
                    className={editor.isActive('subscript') ? 'is-active' : ''}
                    type="button"
                    title="下標 (Subscript)"
                >
                    X₂
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleSuperscript().run()}
                    className={editor.isActive('superscript') ? 'is-active' : ''}
                    type="button"
                    title="上標 (Superscript)"
                >
                    X²
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

                {/* List buttons */}
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'is-active' : ''}
                    type="button"
                    title="項目符號"
                >
                    • 列表
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'is-active' : ''}
                    type="button"
                    title="編號列表"
                >
                    1. 編號
                </button>
                <button
                    onClick={() => {
                        if (editor.isActive('listItem')) {
                            editor.chain().focus().sinkListItem('listItem').run();
                        } else {
                            editor.chain().focus().indent().run();
                        }
                    }}
                    type="button"
                    title="增加縮排 (Tab)"
                >
                    ⇥ 縮排
                </button>
                <button
                    onClick={() => {
                        if (editor.isActive('listItem')) {
                            editor.chain().focus().liftListItem('listItem').run();
                        } else {
                            editor.chain().focus().outdent().run();
                        }
                    }}
                    type="button"
                    title="減少縮排 (Shift+Tab)"
                >
                    ⇤ 凸排
                </button>

                <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 0.5rem', height: '20px' }}></div>

                {/* Text alignment buttons */}
                <button
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
                    type="button"
                    title="靠左對齊"
                >
                    ⬅
                </button>
                <button
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
                    type="button"
                    title="置中對齊"
                >
                    ⬌
                </button>
                <button
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
                    type="button"
                    title="靠右對齊"
                >
                    ➡
                </button>

                <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 0.5rem', height: '20px' }}></div>

                <button onClick={openLinkDialog} className={editor.isActive('link') ? 'is-active' : ''} type="button">
                    Link
                </button>
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

                <button onClick={openTableDialog} type="button">
                    Table
                </button>
                <button onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().deleteTable()} type="button">
                    Del Table
                </button>

                <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 0.5rem', height: '20px' }}></div>

                {/* Color picker */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '0.85rem' }}>字色</span>
                    <input
                        type="color"
                        value={editor.getAttributes('textStyle').color || '#000000'}
                        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                        style={{ width: '24px', height: '24px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                    />
                </label>

                {/* Font size selector */}
                <select
                    onChange={(e) => {
                        const size = e.target.value;
                        if (size === 'default') {
                            editor.chain().focus().unsetFontSize().run();
                        } else {
                            editor.chain().focus().setFontSize(size).run();
                        }
                    }}
                    style={{
                        padding: '4px 8px',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        background: 'var(--color-bg-surface)',
                        color: 'var(--color-text)',
                        cursor: 'pointer'
                    }}
                    defaultValue="default"
                >
                    <option value="default">字型大小</option>
                    <option value="12px">12px</option>
                    <option value="14px">14px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                    <option value="24px">24px</option>
                    <option value="28px">28px</option>
                    <option value="32px">32px</option>
                </select>

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
                isOpen={dialogState.isOpen && dialogState.type === 'image'}
                title="Insert Image URL"
                placeholder="https://..."
                defaultValue={dialogState.defaultValue}
                onConfirm={handleDialogConfirm}
                onCancel={handleDialogCancel}
            />
            <LinkDialog
                isOpen={linkDialogOpen}
                onConfirm={handleLinkConfirm}
                onCancel={() => setLinkDialogOpen(false)}
            />
            <TableSizeDialog
                isOpen={dialogState.isOpen && dialogState.type === 'table'}
                onConfirm={(rows, cols) => {
                    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
                    setDialogState({ isOpen: false, type: null });
                }}
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
    const [_isUploading, setIsUploading] = useState(false);
    const editorRef = useRef<any>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            ImageResize,
            Subscript,
            Superscript,
            TextStyle,
            Color,
            FontSize,
            Link.configure({
                openOnClick: true,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            ItemLink,
            Indent,
        ],
        content: content,
        editable: editable,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none rich-text-content',
                style: 'padding: 1rem; min-height: 150px;'
            },
            // Handle paste events for images - direct upload
            handlePaste: (view, event) => {
                const items = event.clipboardData?.items;
                if (!items) return false;

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.startsWith('image/')) {
                        event.preventDefault();
                        const file = item.getAsFile();
                        if (file) {
                            // Upload and use editor ref to insert
                            uploadFile(file).then((uploadedUrl) => {
                                if (uploadedUrl && editorRef.current) {
                                    editorRef.current.chain().focus().setImage({ src: uploadedUrl }).run();
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
                    // Upload and use editor ref to insert
                    uploadFile(file).then((uploadedUrl) => {
                        if (uploadedUrl && editorRef.current) {
                            editorRef.current.chain().focus().setImage({ src: uploadedUrl }).run();
                        }
                    });
                    return true;
                }
                return false;
            }
        }
    });

    // Sync editor to ref for use in event handlers
    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);

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
            <div className="rich-text-content">
                <EditorContent editor={editor} />
            </div>

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
        /* Image resize styles */
        .ProseMirror img {
            cursor: pointer;
        }
        .ProseMirror img.ProseMirror-selectednode {
            outline: 3px solid var(--color-primary, #3b82f6);
            outline-offset: 2px;
        }
        .ProseMirror .image-resizer {
            display: inline-flex;
            position: relative;
            flex-grow: 0;
        }
        .ProseMirror .image-resizer .resize-trigger {
            position: absolute;
            right: -6px;
            bottom: -6px;
            opacity: 0;
            transition: opacity 0.2s;
            color: var(--color-primary, #3b82f6);
            cursor: nwse-resize;
        }
        .ProseMirror .image-resizer:hover .resize-trigger {
            opacity: 1;
        }
      `}</style>
        </div>
    );
};

export default RichTextEditor;
