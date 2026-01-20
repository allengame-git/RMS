'use client';

import { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import ProjectBackupSection from './ProjectBackupSection';

type BackupType = 'database' | 'uploads' | 'iso-docs';
type TabType = 'system' | 'project';

interface Project {
    id: number;
    title: string;
    codePrefix: string;
}

interface BackupRestoreSectionProps {
    projects?: Project[];
}

interface StatusMap {
    database: 'idle' | 'loading' | 'success' | 'error';
    uploads: 'idle' | 'loading' | 'success' | 'error';
    'iso-docs': 'idle' | 'loading' | 'success' | 'error';
}

export default function BackupRestoreSection({ projects = [] }: BackupRestoreSectionProps) {
    const [activeTab, setActiveTab] = useState<TabType>('system');
    const [backupStatus, setBackupStatus] = useState<StatusMap>({
        database: 'idle',
        uploads: 'idle',
        'iso-docs': 'idle',
    });
    const [restoreStatus, setRestoreStatus] = useState<StatusMap>({
        database: 'idle',
        uploads: 'idle',
        'iso-docs': 'idle',
    });
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ type: BackupType; file: File } | null>(null);
    const [confirmInput, setConfirmInput] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<Record<BackupType, File | null>>({
        database: null,
        uploads: null,
        'iso-docs': null,
    });
    const [restoreProgress, setRestoreProgress] = useState<Record<BackupType, number>>({
        database: 0,
        uploads: 0,
        'iso-docs': 0,
    });
    const [backupProgress, setBackupProgress] = useState<Record<BackupType, number>>({
        database: 0,
        uploads: 0,
        'iso-docs': 0,
    });

    const fileInputRefs = {
        database: useRef<HTMLInputElement>(null),
        uploads: useRef<HTMLInputElement>(null),
        'iso-docs': useRef<HTMLInputElement>(null),
    };

    // ==================== 備份功能 ====================
    const handleBackup = async (type: BackupType) => {
        setError(null);
        setSuccessMessage(null);
        setBackupStatus((prev) => ({ ...prev, [type]: 'loading' }));
        setBackupProgress((prev) => ({ ...prev, [type]: 0 }));

        // 模擬進度更新
        const progressInterval = setInterval(() => {
            setBackupProgress((prev) => {
                const current = prev[type];
                if (current < 95) {
                    const increment = Math.random() * 20 + 10;
                    return { ...prev, [type]: Math.min(current + increment, 95) };
                }
                return prev;
            });
        }, 300);

        try {
            const response = await fetch(`/api/admin/backup/${type}`, {
                method: 'POST',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '備份失敗');
            }

            const contentDisposition = response.headers.get('Content-Disposition');
            // 支援 filename*=UTF-8'' 格式
            const filenameStarMatch = contentDisposition?.match(/filename\*=UTF-8''(.+)/);
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
            let filename = `backup-${type}.zip`;
            if (filenameStarMatch) {
                filename = decodeURIComponent(filenameStarMatch[1]);
            } else if (filenameMatch) {
                filename = filenameMatch[1];
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            clearInterval(progressInterval);
            setBackupProgress((prev) => ({ ...prev, [type]: 100 }));
            setBackupStatus((prev) => ({ ...prev, [type]: 'success' }));
            setTimeout(() => {
                setBackupStatus((prev) => ({ ...prev, [type]: 'idle' }));
                setBackupProgress((prev) => ({ ...prev, [type]: 0 }));
            }, 3000);
        } catch (err) {
            clearInterval(progressInterval);
            setBackupProgress((prev) => ({ ...prev, [type]: 0 }));
            console.error('Backup error:', err);
            setError(err instanceof Error ? err.message : '未知錯誤');
            setBackupStatus((prev) => ({ ...prev, [type]: 'error' }));
        }
    };

    const handleBackupAll = async () => {
        await handleBackup('database');
        await handleBackup('uploads');
        await handleBackup('iso-docs');
    };

    // ==================== 復原功能 ====================
    const handleFileSelect = (type: BackupType, file: File) => {
        setError(null);
        setSuccessMessage(null);
        setConfirmInput('');
        setSelectedFiles(prev => ({ ...prev, [type]: file }));
        setConfirmDialog({ type, file });
    };

    const handleRestore = async () => {
        if (!confirmDialog || confirmInput !== 'RESTORE') return;

        const { type, file } = confirmDialog;
        setConfirmDialog(null);
        setRestoreStatus((prev) => ({ ...prev, [type]: 'loading' }));
        setRestoreProgress((prev) => ({ ...prev, [type]: 0 }));

        // 模擬進度更新
        const progressInterval = setInterval(() => {
            setRestoreProgress((prev) => {
                const current = prev[type];
                // 進度最多到 95%，剩下 5% 等實際完成
                if (current < 95) {
                    const increment = Math.random() * 15 + 5; // 隨機增加 5-20%
                    return { ...prev, [type]: Math.min(current + increment, 95) };
                }
                return prev;
            });
        }, 500);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`/api/admin/restore/${type}`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '復原失敗');
            }

            clearInterval(progressInterval);
            setRestoreProgress((prev) => ({ ...prev, [type]: 100 }));
            setRestoreStatus((prev) => ({ ...prev, [type]: 'success' }));
            setSuccessMessage(data.message);

            // 資料庫復原後強制登出
            if (type === 'database') {
                setTimeout(() => {
                    signOut({ callbackUrl: '/login' });
                }, 2000);
            } else {
                setTimeout(() => {
                    setRestoreStatus((prev) => ({ ...prev, [type]: 'idle' }));
                    setSuccessMessage(null);
                }, 3000);
            }
        } catch (err) {
            clearInterval(progressInterval);
            setRestoreProgress((prev) => ({ ...prev, [type]: 0 }));
            console.error('Restore error:', err);
            setError(err instanceof Error ? err.message : '未知錯誤');
            setRestoreStatus((prev) => ({ ...prev, [type]: 'error' }));
        }

        // 清除 file input 和 selectedFiles
        if (fileInputRefs[type].current) {
            fileInputRefs[type].current.value = '';
        }
        setSelectedFiles(prev => ({ ...prev, [type]: null }));
    };

    // ==================== UI Helpers ====================
    const getButtonStyle = (status: 'idle' | 'loading' | 'success' | 'error'): React.CSSProperties => {
        const base: React.CSSProperties = {
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: status === 'loading' ? 'wait' : 'pointer',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
        };

        switch (status) {
            case 'loading':
                return { ...base, backgroundColor: 'var(--color-warning)', color: 'white' };
            case 'success':
                return { ...base, backgroundColor: 'var(--color-success)', color: 'white' };
            case 'error':
                return { ...base, backgroundColor: 'var(--color-error)', color: 'white' };
            default:
                return { ...base, backgroundColor: 'var(--color-primary)', color: 'white' };
        }
    };

    const getRestoreButtonStyle = (status: 'idle' | 'loading' | 'success' | 'error'): React.CSSProperties => {
        const base: React.CSSProperties = {
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: status === 'loading' ? 'wait' : 'pointer',
            fontWeight: 500,
            transition: 'all 0.2s',
        };

        switch (status) {
            case 'loading':
                return { ...base, backgroundColor: 'var(--color-warning)', color: 'white' };
            case 'success':
                return { ...base, backgroundColor: 'var(--color-success)', color: 'white' };
            case 'error':
                return { ...base, backgroundColor: 'var(--color-error)', color: 'white' };
            default:
                return { ...base, backgroundColor: 'var(--color-warning-soft)', color: 'var(--color-warning)', border: '1px solid var(--color-warning)' };
        }
    };

    const getBackupButtonText = (status: 'idle' | 'loading' | 'success' | 'error') => {
        switch (status) {
            case 'loading': return '備份中...';
            case 'success': return '✓ 完成';
            case 'error': return '✗ 失敗';
            default: return '📥 下載';
        }
    };

    const getRestoreButtonText = (status: 'idle' | 'loading' | 'success' | 'error') => {
        switch (status) {
            case 'loading': return '復原中...';
            case 'success': return '✓ 完成';
            case 'error': return '✗ 失敗';
            default: return '🔄 復原';
        }
    };

    const typeLabels: Record<BackupType, string> = {
        database: '資料庫 (PostgreSQL)',
        uploads: '上傳檔案 (/uploads/)',
        'iso-docs': 'ISO 文件 (/iso_doc/)',
    };

    return (
        <div
            className="glass"
            style={{
                marginTop: '2rem',
                padding: '1.5rem',
                borderRadius: '1rem',
                border: '1px solid var(--color-border)',
            }}
        >
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                系統備份與復原
            </h2>

            {/* Tab 切換 */}
            <div
                style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1.25rem',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '0.75rem',
                }}
            >
                <button
                    onClick={() => setActiveTab('system')}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem 0.5rem 0 0',
                        border: 'none',
                        backgroundColor: activeTab === 'system' ? 'var(--color-primary)' : 'transparent',
                        color: activeTab === 'system' ? 'white' : 'var(--color-text-secondary)',
                        fontWeight: activeTab === 'system' ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    </svg>
                    系統級備份
                </button>
                <button
                    onClick={() => setActiveTab('project')}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem 0.5rem 0 0',
                        border: 'none',
                        backgroundColor: activeTab === 'project' ? 'var(--color-primary)' : 'transparent',
                        color: activeTab === 'project' ? 'white' : 'var(--color-text-secondary)',
                        fontWeight: activeTab === 'project' ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    單一專案
                </button>
            </div>

            {error && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)', borderRadius: '0.5rem', color: 'var(--color-error)', marginBottom: '1rem' }}>
                    ⚠️ {error}
                </div>
            )}

            {successMessage && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--color-success)', borderRadius: '0.5rem', color: 'var(--color-success)', marginBottom: '1rem' }}>
                    ✅ {successMessage}
                </div>
            )}

            {/* 專案備份 Tab 內容 */}
            {activeTab === 'project' && (
                <ProjectBackupSection projects={projects} />
            )}

            {/* 系統備份 Tab 內容 */}
            {activeTab === 'system' && (
                <>
                    {/* 備份區塊 */}
                    <div style={{ backgroundColor: 'var(--color-bg-elevated)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
                            資料備份（分別下載）
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {(['database', 'uploads', 'iso-docs'] as BackupType[]).map((type) => {
                                const status = backupStatus[type];
                                const progress = backupProgress[type];

                                return (
                                    <div
                                        key={type}
                                        style={{
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-sm)',
                                            border: `1px solid ${status === 'success' ? 'var(--color-success)' :
                                                status === 'error' ? 'var(--color-danger)' :
                                                    status === 'loading' ? 'var(--color-primary)' :
                                                        'var(--color-border)'
                                                }`,
                                            backgroundColor: status === 'loading' ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-bg-base)',
                                            transition: 'all 0.3s ease',
                                        }}
                                    >
                                        {/* 標題列 */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: status === 'loading' ? '0.75rem' : '0' }}>
                                            <span style={{ fontWeight: 600 }}>{typeLabels[type]}</span>

                                            {/* 狀態標籤 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span
                                                    style={{
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '9999px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 500,
                                                        backgroundColor:
                                                            status === 'success' ? 'rgba(34, 197, 94, 0.1)' :
                                                                status === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                                                                    status === 'loading' ? 'rgba(59, 130, 246, 0.1)' :
                                                                        'rgba(107, 114, 128, 0.1)',
                                                        color:
                                                            status === 'success' ? 'var(--color-success)' :
                                                                status === 'error' ? 'var(--color-danger)' :
                                                                    status === 'loading' ? 'var(--color-primary)' :
                                                                        'var(--color-text-muted)',
                                                    }}
                                                >
                                                    {status === 'success' ? '✓ 下載完成' :
                                                        status === 'error' ? '✗ 備份失敗' :
                                                            status === 'loading' ? `⏳ ${Math.round(progress)}%` :
                                                                '⏸ 等待備份'}
                                                </span>

                                                {status !== 'loading' && (
                                                    <button
                                                        onClick={() => handleBackup(type)}
                                                        className="btn"
                                                        style={{
                                                            backgroundColor: status === 'success' ? 'var(--color-success)' : 'var(--color-primary)',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '0.5rem 1rem',
                                                            fontSize: '0.875rem',
                                                        }}
                                                    >
                                                        📥 下載
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* 進度條 - 僅在 loading 時顯示 */}
                                        {status === 'loading' && (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                        正在打包備份資料...
                                                    </span>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                                                        {Math.round(progress)}%
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        height: '8px',
                                                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                                        borderRadius: '4px',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            height: '100%',
                                                            width: `${progress}%`,
                                                            backgroundColor: 'var(--color-primary)',
                                                            borderRadius: '4px',
                                                            transition: 'width 0.3s ease-out',
                                                        }}
                                                    />
                                                </div>
                                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                                    下載將在完成後自動開始...
                                                </p>
                                            </div>
                                        )}

                                        {/* 成功訊息 */}
                                        {status === 'success' && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--color-success)' }}>
                                                ✓ 備份檔案已下載至您的電腦
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                                <button
                                    onClick={handleBackupAll}
                                    disabled={Object.values(backupStatus).some((s) => s === 'loading')}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '0.5rem',
                                        border: '2px solid var(--color-primary)',
                                        backgroundColor: 'transparent',
                                        color: 'var(--color-primary)',
                                        fontWeight: 600,
                                        cursor: Object.values(backupStatus).some((s) => s === 'loading') ? 'not-allowed' : 'pointer',
                                        opacity: Object.values(backupStatus).some((s) => s === 'loading') ? 0.5 : 1,
                                    }}
                                >
                                    全部下載（依序下載三個檔案）
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 復原區塊 */}
                    <div style={{ backgroundColor: 'var(--color-bg-elevated)', padding: '1rem', borderRadius: '0.75rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
                            資料復原（分別上傳）
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {(['database', 'uploads', 'iso-docs'] as BackupType[]).map((type) => {
                                const status = restoreStatus[type];
                                const file = selectedFiles[type];

                                return (
                                    <div
                                        key={type}
                                        style={{
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-sm)',
                                            border: `1px solid ${status === 'success' ? 'var(--color-success)' :
                                                status === 'error' ? 'var(--color-danger)' :
                                                    status === 'loading' ? 'var(--color-warning)' :
                                                        'var(--color-border)'
                                                }`,
                                            backgroundColor: status === 'loading' ? 'rgba(234, 179, 8, 0.05)' : 'var(--color-bg-base)',
                                            transition: 'all 0.3s ease',
                                        }}
                                    >
                                        {/* 標題列 */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                            <span style={{ fontWeight: 600 }}>{typeLabels[type]}</span>

                                            {/* 狀態標籤 */}
                                            <span
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 500,
                                                    backgroundColor:
                                                        status === 'success' ? 'rgba(34, 197, 94, 0.1)' :
                                                            status === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                                                                status === 'loading' ? 'rgba(234, 179, 8, 0.1)' :
                                                                    file ? 'rgba(59, 130, 246, 0.1)' :
                                                                        'rgba(107, 114, 128, 0.1)',
                                                    color:
                                                        status === 'success' ? 'var(--color-success)' :
                                                            status === 'error' ? 'var(--color-danger)' :
                                                                status === 'loading' ? 'var(--color-warning)' :
                                                                    file ? 'var(--color-primary)' :
                                                                        'var(--color-text-muted)',
                                                }}
                                            >
                                                {status === 'success' ? '✓ 復原成功' :
                                                    status === 'error' ? '✗ 復原失敗' :
                                                        status === 'loading' ? '⏳ 復原中...' :
                                                            file ? '📄 已選擇檔案' :
                                                                '⏸ 等待選擇'}
                                            </span>
                                        </div>

                                        {/* 檔案選擇與資訊 */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <label
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--color-border)',
                                                    backgroundColor: 'var(--color-bg-surface)',
                                                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.875rem',
                                                    whiteSpace: 'nowrap',
                                                    opacity: status === 'loading' ? 0.5 : 1,
                                                }}
                                            >
                                                選擇檔案
                                                <input
                                                    ref={fileInputRefs[type]}
                                                    type="file"
                                                    accept=".zip,.sql"
                                                    onChange={(e) => e.target.files?.[0] && handleFileSelect(type, e.target.files[0])}
                                                    style={{ display: 'none' }}
                                                    disabled={status === 'loading'}
                                                />
                                            </label>

                                            {/* 檔案資訊 */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {file ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                        <span
                                                            style={{
                                                                fontSize: '0.875rem',
                                                                fontWeight: 500,
                                                                color: 'var(--color-text-main)',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                            title={file.name}
                                                        >
                                                            📦 {file.name}
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                            {(file.size / 1024).toFixed(1)} KB
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                                        尚未選擇任何檔案
                                                    </span>
                                                )}
                                            </div>

                                            {/* 復原按鈕 - 僅在有選擇檔案時顯示 */}
                                            {file && status !== 'loading' && (
                                                <button
                                                    onClick={() => handleFileSelect(type, file)}
                                                    className="btn"
                                                    style={{
                                                        backgroundColor: 'var(--color-warning)',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '0.5rem 1rem',
                                                        fontSize: '0.875rem',
                                                    }}
                                                >
                                                    🔄 復原
                                                </button>
                                            )}
                                        </div>

                                        {/* 進度條 - 僅在 loading 時顯示 */}
                                        {status === 'loading' && (
                                            <div style={{ marginTop: '0.75rem' }}>
                                                {/* 進度百分比顯示 */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                        正在復原資料...
                                                    </span>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-warning)' }}>
                                                        {Math.round(restoreProgress[type])}%
                                                    </span>
                                                </div>
                                                {/* 進度條 */}
                                                <div
                                                    style={{
                                                        height: '8px',
                                                        backgroundColor: 'rgba(234, 179, 8, 0.2)',
                                                        borderRadius: '4px',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            height: '100%',
                                                            width: `${restoreProgress[type]}%`,
                                                            backgroundColor: 'var(--color-warning)',
                                                            borderRadius: '4px',
                                                            transition: 'width 0.3s ease-out',
                                                        }}
                                                    />
                                                </div>
                                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                                    請勿關閉此頁面，復原過程可能需要數秒鐘...
                                                </p>
                                            </div>
                                        )}

                                        {/* 成功訊息 */}
                                        {status === 'success' && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--color-success)' }}>
                                                ✓ 資料已成功復原！{type === 'database' && '即將登出...'}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid var(--color-warning)', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                            ⚠️ <strong>警告</strong>：復原資料庫後將強制登出所有使用者！
                        </div>

                        {/* CSS 動畫 */}
                        <style>{`
                    @keyframes progress-indeterminate {
                        0% { width: 0%; margin-left: 0; }
                        50% { width: 70%; margin-left: 15%; }
                        100% { width: 0%; margin-left: 100%; }
                    }
                `}</style>
                    </div>

                    {/* 確認對話框 */}
                    {confirmDialog && (
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
                                zIndex: 99999,
                                backdropFilter: 'blur(4px)',
                            }}
                            onClick={() => setConfirmDialog(null)}
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
                                    <h2 style={{ margin: 0, color: 'var(--color-danger)' }}>⚠️ 確認復原操作</h2>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDialog(null)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '1.5rem',
                                            lineHeight: 1,
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>

                                {/* Content */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <p style={{ margin: 0, marginBottom: '0.5rem' }}>
                                        您即將復原以下備份：
                                    </p>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontWeight: 600,
                                            fontSize: '1.1rem',
                                            padding: '0.75rem',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--color-danger)',
                                            color: 'var(--color-danger)',
                                        }}
                                    >
                                        {typeLabels[confirmDialog.type]}
                                    </p>
                                    <p
                                        style={{
                                            margin: 0,
                                            marginTop: '1rem',
                                            fontSize: '0.9rem',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        此操作將覆蓋現有資料，且無法還原！
                                        {confirmDialog.type === 'database' && (
                                            <>
                                                <br />
                                                <strong style={{ color: 'var(--color-warning)' }}>🔒 復原資料庫後，所有使用者將被強制登出。</strong>
                                            </>
                                        )}
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
                                                color: 'var(--color-danger)',
                                                fontFamily: 'var(--font-geist-mono)',
                                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                            }}
                                        >
                                            RESTORE
                                        </span>{' '}
                                        以確認復原：
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmInput}
                                        onChange={(e) => setConfirmInput(e.target.value)}
                                        placeholder="輸入 RESTORE 確認"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius-sm)',
                                            border: `1px solid ${confirmInput === 'RESTORE' ? 'var(--color-success)' : 'var(--color-border)'}`,
                                            backgroundColor: 'var(--color-bg-base)',
                                            color: 'var(--color-text-main)',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                        }}
                                    />
                                    {confirmInput && confirmInput !== 'RESTORE' && (
                                        <p
                                            style={{
                                                margin: '0.5rem 0 0 0',
                                                fontSize: '0.85rem',
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            請正確輸入 &quot;RESTORE&quot;
                                        </p>
                                    )}
                                </div>

                                {/* Buttons */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDialog(null)}
                                        className="btn btn-outline"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRestore}
                                        className="btn"
                                        disabled={confirmInput !== 'RESTORE'}
                                        style={{
                                            backgroundColor: confirmInput === 'RESTORE' ? 'var(--color-danger)' : 'gray',
                                            color: 'white',
                                            border: 'none',
                                            cursor: confirmInput === 'RESTORE' ? 'pointer' : 'not-allowed',
                                            opacity: confirmInput === 'RESTORE' ? 1 : 0.6,
                                        }}
                                    >
                                        確認復原
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
