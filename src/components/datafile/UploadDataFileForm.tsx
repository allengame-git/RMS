/**
 * @file UploadDataFileForm.tsx
 * @description 上傳資料檔案表單元件
 *
 * 提供資料檔案新增功能，包含檔案上傳和元資料輸入。
 *
 * ## 核心功能
 * - 拖放式檔案上傳
 * - 元資料表單輸入
 * - 驗證必填欄位
 * - 提交審核流程
 *
 * ## 表單欄位
 * - 資料年份（必填）
 * - 資料名稱（必填）
 * - 資料編碼（選填，格式驗證）
 * - 作者（必填）
 * - 內容簡介（選填）
 * - 檔案（必填）
 *
 * ## 上傳流程
 * 1. 先上傳檔案到 `/api/datafiles/upload`
 * 2. 取得檔案路徑後呼叫 `submitCreateDataFileRequest`
 * 3. 建立待審核的變更申請
 *
 * ## 檔案限制
 * - 最大 100MB
 *
 * @see /src/actions/data-files.ts - submitCreateDataFileRequest
 * @see /src/app/api/datafiles/upload - 檔案上傳 API
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitCreateDataFileRequest } from '@/actions/data-files';

export default function UploadDataFileForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const currentYear = new Date().getFullYear();

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            setFile(droppedFile);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const formData = new FormData(e.currentTarget);

            if (!file) {
                throw new Error('請選擇要上傳的檔案');
            }

            const dataYear = parseInt(formData.get('dataYear') as string);
            const dataName = formData.get('dataName') as string;
            const dataCode = formData.get('dataCode') as string;
            const author = formData.get('author') as string;
            const description = formData.get('description') as string;

            // Validate - 資料年份、資料名稱、作者是必填
            if (!dataYear || !dataName || !author) {
                throw new Error('請填寫所有必填欄位');
            }

            // Upload file first
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadFormData.append('dataYear', dataYear.toString());
            uploadFormData.append('dataCode', dataCode);

            const uploadRes = await fetch('/api/datafiles/upload', {
                method: 'POST',
                body: uploadFormData
            });

            if (!uploadRes.ok) {
                const uploadError = await uploadRes.json();
                throw new Error(uploadError.error || '檔案上傳失敗');
            }

            const uploadData = await uploadRes.json();

            // Submit create request
            await submitCreateDataFileRequest({
                dataYear,
                dataName,
                dataCode,
                author,
                description: description || '',
                fileName: uploadData.fileName,
                filePath: uploadData.filePath,
                fileSize: uploadData.fileSize,
                mimeType: uploadData.mimeType
            });

            alert('申請已提交，等待審核後將上架');
            router.push('/datafiles');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                {error && (
                    <div style={{
                        padding: '1rem',
                        backgroundColor: 'var(--color-danger-soft)',
                        color: 'var(--color-danger)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1.5rem'
                    }}>
                        {error}
                    </div>
                )}

                {/* 資料年份 */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 600
                    }}>
                        資料年份 <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                        type="number"
                        name="dataYear"
                        defaultValue={currentYear}
                        min={1950}
                        max={2200}
                        required
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text)'
                        }}
                    />
                </div>

                {/* 資料名稱 */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 600
                    }}>
                        資料名稱 <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                        type="text"
                        name="dataName"
                        placeholder="輸入資料名稱"
                        required
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text)'
                        }}
                    />
                </div>

                {/* 資料編碼 */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 600
                    }}>
                        資料編碼
                    </label>
                    <input
                        type="text"
                        name="dataCode"
                        placeholder="輸入唯一資料編碼 (例: DOC-2026-001)"
                        pattern="[A-Za-z0-9\-_]*"
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text)',
                            fontFamily: 'monospace'
                        }}
                    />
                    <small style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                        僅允許英數字、連字號和底線
                    </small>
                </div>

                {/* 作者 */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 600
                    }}>
                        作者 <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                        type="text"
                        name="author"
                        placeholder="輸入作者名稱"
                        required
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text)'
                        }}
                    />
                </div>

                {/* 內容簡介 */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 600
                    }}>
                        內容簡介
                    </label>
                    <textarea
                        name="description"
                        placeholder="輸入內容簡介"
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text)',
                            resize: 'vertical'
                        }}
                    />
                </div>

                {/* 檔案選擇 */}
                <div style={{ marginBottom: '2rem' }}>
                    <label style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 600
                    }}>
                        選擇檔案 <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{
                            border: isDragging
                                ? '2px solid var(--color-primary)'
                                : '2px dashed var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '2rem',
                            textAlign: 'center',
                            backgroundColor: isDragging
                                ? 'rgba(59, 130, 246, 0.1)'
                                : 'var(--color-bg-elevated)',
                            transition: 'all 0.2s ease',
                            transform: isDragging ? 'scale(1.02)' : 'scale(1)'
                        }}
                    >
                        <input
                            type="file"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            style={{ display: 'none' }}
                            id="file-input"
                        />
                        <label
                            htmlFor="file-input"
                            style={{ cursor: 'pointer', display: 'block' }}
                        >
                            {file ? (
                                <div>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                                    <div style={{ fontWeight: 600 }}>{file.name}</div>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                                    </div>
                                    <div style={{
                                        color: 'var(--color-primary)',
                                        fontSize: '0.85rem',
                                        marginTop: '0.5rem',
                                        textDecoration: 'underline'
                                    }}>
                                        點擊更換檔案
                                    </div>
                                </div>
                            ) : isDragging ? (
                                <div>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📥</div>
                                    <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                                        放開以上傳檔案
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
                                    <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                                        拖放檔案至此處，或點擊選擇
                                    </div>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                        最大 100MB
                                    </div>
                                </div>
                            )}
                        </label>
                    </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="btn btn-outline"
                        disabled={loading}
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || !file}
                    >
                        {loading ? '上傳中...' : '提交審核'}
                    </button>
                </div>
            </div>
        </form>
    );
}
