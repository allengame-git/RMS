"use client";

import { useState, useRef } from 'react';

interface FileInfo {
    name: string;
    path: string;
    size: number;
    type: string;
    uploadedAt: string;
}

interface FileUploaderProps {
    onFilesChange: (files: FileInfo[]) => void;
    initialFiles?: FileInfo[];
}

export default function FileUploader({ onFilesChange, initialFiles = [] }: FileUploaderProps) {
    const [files, setFiles] = useState<FileInfo[]>(initialFiles);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        setUploading(true);
        const uploadedFiles: FileInfo[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                const data = await res.json();

                if (data.success) {
                    uploadedFiles.push(data.file);
                } else {
                    alert(`上傳失敗: ${data.error}`);
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('上傳失敗');
            }
        }

        const newFiles = [...files, ...uploadedFiles];
        setFiles(newFiles);
        onFilesChange(newFiles);
        setUploading(false);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    const handleRemove = (index: number) => {
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        onFilesChange(newFiles);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                附件檔案
            </label>

            {/* Drop Zone */}
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: `2px dashed ${dragActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '2rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: dragActive ? 'rgba(var(--color-primary-rgb), 0.05)' : 'transparent',
                    transition: 'all 0.2s',
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files)}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                />
                <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                    {uploading ? '上傳中...' : '點擊或拖放檔案到此處'}
                </p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    支援 PDF, Word, 圖片 (最大 20MB)
                </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                    {files.map((file, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem',
                                marginBottom: '0.5rem',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-bg-secondary)',
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{file.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                    {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleString()}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemove(index)}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--color-danger)',
                                    border: '1px solid var(--color-danger)',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                }}
                            >
                                移除
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
