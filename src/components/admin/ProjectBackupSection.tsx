/**
 * @file ProjectBackupSection.tsx
 * @description 單一專案匯出與匯入元件
 *
 * 提供針對單一專案的資料遷移功能，包含完整的項目結構與關聯檔案。
 *
 * ## 核心功能
 * - **單一專案匯出**：選擇專案並打包成 ZIP，包含元資料、附件、及關聯參考。
 * - **單一專案匯入**：上傳專案 ZIP 檔，自動掃描衝突並重建專案樹。
 * - **安全校驗**：匯入前需手動輸入「IMPORT」確認，系統會自動先建立資料庫備份。
 * - **統計回報**：匯入成功後顯示導入的項目總數與還原的檔案數。
 *
 * ## 使用場景
 * - 專案版本歸檔。
 * - 跨環境專案遷移。
 *
 * @see /src/app/api/admin/backup/project/[id]/route.ts - 匯出 API
 * @see /src/app/api/admin/restore/project/route.ts - 匯入 API
 */

'use client';

import { useState, useRef } from 'react';

interface Project {
    id: number;
    title: string;
    codePrefix: string;
}

interface ProjectBackupSectionProps {
    projects: Project[];
}

export default function ProjectBackupSection({ projects }: ProjectBackupSectionProps) {
    // 備份狀態
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [backupProgress, setBackupProgress] = useState(0);
    const [backupError, setBackupError] = useState<string | null>(null);

    // 復原狀態
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [restoreResult, setRestoreResult] = useState<{
        projectId?: number;
        codePrefix?: string;
        stats?: { itemsImported: number; filesRestored: number };
    } | null>(null);
    const [restoreError, setRestoreError] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmInput, setConfirmInput] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // 處理專案備份
    const handleBackup = async () => {
        if (!selectedProjectId) return;

        setBackupError(null);
        setBackupStatus('loading');
        setBackupProgress(0);

        // 模擬進度
        const progressInterval = setInterval(() => {
            setBackupProgress((prev) => {
                if (prev < 90) return prev + Math.random() * 15 + 5;
                return prev;
            });
        }, 300);

        try {
            const response = await fetch(`/api/admin/backup/project/${selectedProjectId}`, {
                method: 'POST',
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '備份失敗');
            }

            // 下載檔案
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `project_backup_${new Date().toISOString().split('T')[0]}.zip`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) filename = match[1];
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setBackupProgress(100);
            setBackupStatus('success');
        } catch (error) {
            clearInterval(progressInterval);
            setBackupStatus('error');
            setBackupError(error instanceof Error ? error.message : '備份失敗');
        }
    };

    // 處理檔案選擇
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setRestoreFile(file);
            setRestoreError(null);
            setRestoreResult(null);
        }
    };

    // 開啟確認對話框
    const handleRestoreClick = () => {
        if (!restoreFile) return;
        setConfirmInput('');
        setShowConfirmDialog(true);
    };

    // 執行專案復原
    const handleRestore = async () => {
        if (!restoreFile || confirmInput !== 'IMPORT') return;

        setShowConfirmDialog(false);
        setRestoreError(null);
        setRestoreStatus('loading');

        try {
            const formData = new FormData();
            formData.append('file', restoreFile);
            formData.append('onConflict', 'rename');

            const response = await fetch('/api/admin/restore/project', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '復原失敗');
            }

            setRestoreStatus('success');
            setRestoreResult({
                projectId: data.projectId,
                codePrefix: data.codePrefix,
                stats: data.stats,
            });
            setRestoreFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            setRestoreStatus('error');
            setRestoreError(error instanceof Error ? error.message : '復原失敗');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* 專案備份區塊 */}
            <div
                style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--color-border)',
                }}
            >
                <h4
                    style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    匯出專案備份
                </h4>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label
                            style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.875rem',
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            選擇專案
                        </label>
                        <select
                            value={selectedProjectId ?? ''}
                            onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : null)}
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.875rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-bg-base)',
                                color: 'var(--color-text-main)',
                                fontSize: '0.875rem',
                            }}
                        >
                            <option value="">-- 請選擇專案 --</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.codePrefix} - {project.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleBackup}
                        disabled={!selectedProjectId || backupStatus === 'loading'}
                        className="btn"
                        style={{
                            backgroundColor: backupStatus === 'success' ? 'var(--color-success)' : 'var(--color-primary)',
                            color: 'white',
                            border: 'none',
                            padding: '0.625rem 1.25rem',
                            cursor: !selectedProjectId || backupStatus === 'loading' ? 'not-allowed' : 'pointer',
                            opacity: !selectedProjectId || backupStatus === 'loading' ? 0.6 : 1,
                        }}
                    >
                        {backupStatus === 'loading' ? (
                            <>⏳ 備份中 ({Math.round(backupProgress)}%)</>
                        ) : backupStatus === 'success' ? (
                            '✓ 下載完成'
                        ) : (
                            '📦 匯出備份'
                        )}
                    </button>
                </div>

                {/* 進度條 */}
                {backupStatus === 'loading' && (
                    <div style={{ marginTop: '1rem' }}>
                        <div
                            style={{
                                height: '6px',
                                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    height: '100%',
                                    width: `${backupProgress}%`,
                                    backgroundColor: 'var(--color-primary)',
                                    transition: 'width 0.3s ease-out',
                                }}
                            />
                        </div>
                    </div>
                )}

                {backupError && (
                    <div
                        style={{
                            marginTop: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid var(--color-danger)',
                            borderRadius: '0.375rem',
                            color: 'var(--color-danger)',
                            fontSize: '0.875rem',
                        }}
                    >
                        ⚠️ {backupError}
                    </div>
                )}

                <p
                    style={{
                        margin: '1rem 0 0 0',
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                    }}
                >
                    💡 備份包含：專案資料、所有項目、附件、QC 文件、引用的資料檔案
                </p>
            </div>

            {/* 專案復原區塊 */}
            <div
                style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--color-border)',
                }}
            >
                <h4
                    style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    匯入專案備份
                </h4>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="btn btn-outline"
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                            }}
                        >
                            📁 選擇備份檔案
                        </button>
                        {restoreFile && (
                            <p
                                style={{
                                    margin: '0.5rem 0 0 0',
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-secondary)',
                                }}
                            >
                                已選擇: {restoreFile.name} ({(restoreFile.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handleRestoreClick}
                        disabled={!restoreFile || restoreStatus === 'loading'}
                        className="btn"
                        style={{
                            backgroundColor: restoreStatus === 'success' ? 'var(--color-success)' : 'var(--color-warning)',
                            color: 'white',
                            border: 'none',
                            padding: '0.625rem 1.25rem',
                            cursor: !restoreFile || restoreStatus === 'loading' ? 'not-allowed' : 'pointer',
                            opacity: !restoreFile || restoreStatus === 'loading' ? 0.6 : 1,
                        }}
                    >
                        {restoreStatus === 'loading' ? '⏳ 匯入中...' : restoreStatus === 'success' ? '✓ 匯入完成' : '🔄 開始匯入'}
                    </button>
                </div>

                {restoreError && (
                    <div
                        style={{
                            marginTop: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid var(--color-danger)',
                            borderRadius: '0.375rem',
                            color: 'var(--color-danger)',
                            fontSize: '0.875rem',
                        }}
                    >
                        ⚠️ {restoreError}
                    </div>
                )}

                {restoreResult && (
                    <div
                        style={{
                            marginTop: '0.75rem',
                            padding: '0.75rem',
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid var(--color-success)',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                        }}
                    >
                        <p style={{ margin: 0, color: 'var(--color-success)', fontWeight: 600 }}>
                            ✅ 專案匯入成功
                        </p>
                        <p style={{ margin: '0.5rem 0 0 0', color: 'var(--color-text-secondary)' }}>
                            專案代碼: <strong>{restoreResult.codePrefix}</strong>
                            <br />
                            匯入項目: {restoreResult.stats?.itemsImported ?? 0} 個
                            <br />
                            還原檔案: {restoreResult.stats?.filesRestored ?? 0} 個
                        </p>
                    </div>
                )}

                <div
                    style={{
                        marginTop: '1rem',
                        padding: '0.625rem 0.875rem',
                        backgroundColor: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid var(--color-warning)',
                        borderRadius: '0.375rem',
                        fontSize: '0.8rem',
                        color: 'var(--color-warning)',
                    }}
                >
                    ⚠️ 匯入前會自動備份現有資料。若專案代碼重複，將自動重新命名。
                </div>
            </div>

            {/* 確認對話框 */}
            {showConfirmDialog && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={() => setShowConfirmDialog(false)}
                >
                    <div
                        className="glass"
                        style={{
                            width: '500px',
                            maxWidth: '95vw',
                            borderRadius: 'var(--radius-lg)',
                            padding: '2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--color-bg-surface)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            border: '1px solid var(--color-border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                確認匯入專案
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowConfirmDialog(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.5rem',
                                    lineHeight: 1,
                                    color: 'var(--color-text-muted)',
                                    padding: '0.25rem',
                                    borderRadius: '0.25rem',
                                    transition: 'color 0.2s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-main)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                            >
                                ×
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <p style={{ margin: 0, marginBottom: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                您即將匯入以下備份檔案：
                            </p>
                            <p
                                style={{
                                    margin: 0,
                                    fontWeight: 600,
                                    fontSize: '1rem',
                                    padding: '0.75rem 1rem',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--color-primary)',
                                    color: 'var(--color-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                {restoreFile?.name}
                            </p>
                            <p
                                style={{
                                    margin: 0,
                                    marginTop: '1rem',
                                    padding: '0.75rem 1rem',
                                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--color-warning)',
                                    fontSize: '0.875rem',
                                    color: 'var(--color-warning)',
                                }}
                            >
                                <strong>⚠️ 注意事項：</strong>
                                <br />
                                • 匯入前會自動建立系統完整備份
                                <br />
                                • 若專案代碼或資料編碼重複，將自動重新命名
                            </p>
                        </div>

                        {/* Confirmation Input */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                }}
                            >
                                請輸入{' '}
                                <span
                                    style={{
                                        color: 'var(--color-warning)',
                                        fontFamily: 'var(--font-geist-mono)',
                                        backgroundColor: 'rgba(234, 179, 8, 0.1)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                    }}
                                >
                                    IMPORT
                                </span>{' '}
                                以確認匯入：
                            </label>
                            <input
                                type="text"
                                value={confirmInput}
                                onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                                placeholder="輸入 IMPORT"
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: `2px solid ${confirmInput === 'IMPORT' ? 'var(--color-success)' : 'var(--color-border)'}`,
                                    backgroundColor: 'var(--color-bg-base)',
                                    color: 'var(--color-text-main)',
                                    fontSize: '1rem',
                                    fontFamily: 'var(--font-geist-mono)',
                                    textAlign: 'center',
                                    letterSpacing: '0.1em',
                                    transition: 'border-color 0.2s',
                                }}
                            />
                        </div>

                        {/* Footer Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setShowConfirmDialog(false)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                }}
                            >
                                取消
                            </button>
                            <button
                                className="btn"
                                onClick={handleRestore}
                                disabled={confirmInput !== 'IMPORT'}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: confirmInput === 'IMPORT' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: confirmInput === 'IMPORT' ? 'pointer' : 'not-allowed',
                                    opacity: confirmInput === 'IMPORT' ? 1 : 0.6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                確認匯入
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
