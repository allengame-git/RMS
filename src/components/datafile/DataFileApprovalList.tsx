/**
 * @file DataFileApprovalList.tsx
 * @description 資料檔案審核列表元件
 *
 * 顯示待審核的資料檔案變更申請（DataFileChangeRequest），
 * 供 INSPECTOR/ADMIN 進行審核操作。
 *
 * ## 核心功能
 * - 卡片式申請列表
 * - 申請詳情展開
 * - 新舊內容比對
 * - 審核通過/拒絕操作
 * - 確認對話框
 *
 * ## 申請類型
 * - `FILE_CREATE`：新增資料檔案
 * - `FILE_UPDATE`：修改資料檔案
 * - `FILE_DELETE`：刪除資料檔案
 *
 * ## 比對欄位
 * - 資料名稱 (dataName)
 * - 資料編碼 (dataCode)
 * - 資料年份 (dataYear)
 * - 作者 (author)
 * - 簡介 (description)
 *
 * ## 權限控制
 * - 不能審核自己的申請（除非 ADMIN）
 * - 可拒絕自己的申請
 *
 * @see /src/actions/data-files.ts - approveDataFileRequest, rejectDataFileRequest
 * @see /src/app/admin/approval - 審核頁面
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveDataFileRequest, rejectDataFileRequest } from '@/actions/data-files';
import { formatDate, formatDateTime } from '@/lib/date-utils';

type DataFile = {
    id: number;
    dataName: string;
    dataCode: string;
    dataYear: number;
    author: string;
    description: string;
    fileName: string;
    filePath: string;
    fileSize: number;
} | null;

type FileRequest = {
    id: number;
    type: string;
    status: string;
    data: string;
    fileId: number | null;
    file: DataFile;
    submittedBy: {
        id: string;
        username: string;
    } | null;
    submitterName?: string | null;  // Fallback when user is deleted
    createdAt: Date;
};

// Helper component for comparison
function CompareField({
    label,
    current,
    proposed,
    isUpdate,
    multiline = false
}: {
    label: string;
    current?: string;
    proposed?: string;
    isUpdate: boolean;
    multiline?: boolean;
}) {
    const hasChange = isUpdate && current !== proposed && proposed !== undefined;

    if (!proposed && !current) return null;

    return (
        <div>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                {label} {hasChange && (
                    <span style={{ color: 'var(--color-warning)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>• 已修改</span>
                )}
            </strong>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {isUpdate && current !== undefined && (
                    <div style={{
                        flex: 1,
                        minWidth: '150px',
                        padding: '0.75rem',
                        backgroundColor: 'rgba(0,0,0,0.03)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)'
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>修改前</div>
                        <div style={{
                            whiteSpace: multiline ? 'pre-wrap' : 'normal',
                            textDecoration: hasChange ? 'line-through' : 'none',
                            opacity: hasChange ? 0.6 : 1
                        }}>
                            {current || <em style={{ color: 'var(--color-text-muted)' }}>空白</em>}
                        </div>
                    </div>
                )}
                <div style={{
                    flex: 1,
                    minWidth: '150px',
                    padding: '0.75rem',
                    backgroundColor: hasChange ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 'var(--radius-sm)',
                    border: hasChange ? '1px solid var(--color-success)' : '1px solid var(--color-border)'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                        {isUpdate ? '修改後' : '值'}
                    </div>
                    <div style={{
                        whiteSpace: multiline ? 'pre-wrap' : 'normal',
                        fontWeight: hasChange ? 600 : 'normal'
                    }}>
                        {proposed || <em style={{ color: 'var(--color-text-muted)' }}>空白</em>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Format file size
function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DataFileApprovalList({
    requests,
    currentUsername,
    currentUserRole
}: {
    requests: FileRequest[];
    currentUsername: string;
    currentUserRole: string;
}) {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null);
    const [errorDialog, setErrorDialog] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'FILE_CREATE': return { label: '新增', color: 'var(--color-success)' };
            case 'FILE_UPDATE': return { label: '編輯', color: 'var(--color-warning)' };
            case 'FILE_DELETE': return { label: '刪除', color: 'var(--color-danger)' };
            default: return { label: type, color: 'var(--color-text-muted)' };
        }
    };

    const handleApprove = async (id: number) => {
        const request = requests.find(r => r.id === id);
        const submitterUsername = request?.submittedBy?.username || request?.submitterName;
        if (request && submitterUsername === currentUsername && currentUserRole !== 'ADMIN') {
            setErrorDialog('您不能審核自己提交的申請');
            return;
        }
        setConfirmDialog({ id, action: 'approve' });
    };

    const handleReject = async (id: number) => {
        // 允許使用者拒絕自己的申請
        setConfirmDialog({ id, action: 'reject' });
    };

    const handleConfirm = async () => {
        if (!confirmDialog) return;
        setLoading(true);
        try {
            if (confirmDialog.action === 'approve') {
                await approveDataFileRequest(confirmDialog.id);
            } else {
                await rejectDataFileRequest(confirmDialog.id);
            }
            router.refresh();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
            setConfirmDialog(null);
        }
    };

    const isModified = (current: any, proposed: any) => {
        return current !== proposed && proposed !== undefined;
    };

    if (requests.length === 0) return null;

    return (
        <>
            {/* Dashboard Grid - same layout as ApprovalList */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {requests.map(req => {
                    const typeInfo = getTypeLabel(req.type);
                    const data = JSON.parse(req.data);
                    const isExpanded = expandedId === req.id;
                    const submitterUsername = req.submittedBy?.username || req.submitterName || '(已刪除)';
                    const isSelf = submitterUsername === currentUsername && currentUserRole !== 'ADMIN';
                    const file = req.file;

                    return (
                        <div
                            key={req.id}
                            className="glass"
                            onClick={() => setExpandedId(isExpanded ? null : req.id)}
                            style={{
                                padding: '1.5rem',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: isExpanded
                                    ? '2px solid var(--color-primary)'
                                    : isSelf
                                        ? '2px solid var(--color-warning)'
                                        : '2px solid transparent',
                                transform: isExpanded ? 'scale(1.02)' : 'scale(1)',
                                boxShadow: isExpanded ? '0 8px 16px rgba(0,0,0,0.1)' : 'none',
                                backgroundColor: isSelf && !isExpanded
                                    ? 'rgba(234, 179, 8, 0.05)'
                                    : undefined
                            }}
                        >
                            {/* Card Header */}
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '0.5rem'
                                }}>
                                    <span style={{
                                        fontSize: '1.1rem',
                                        fontWeight: 'bold',
                                        color: 'var(--color-primary)'
                                    }}>
                                        {typeInfo.label}
                                    </span>
                                    <span style={{
                                        fontSize: '0.85rem',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        backgroundColor: `${typeInfo.color}20`,
                                        color: typeInfo.color
                                    }}>
                                        檔案
                                    </span>
                                </div>
                                <div style={{
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    marginBottom: '0.25rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: isExpanded ? 'normal' : 'nowrap'
                                }}>
                                    {file?.dataName || data.dataName || '新檔案'}
                                </div>
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--color-text-muted)'
                                }}>
                                    {file?.dataCode || data.dataCode} • {file?.dataYear || data.dataYear}
                                </div>
                                {isSelf && (
                                    <div style={{
                                        fontSize: '0.75rem',
                                        marginTop: '0.5rem',
                                        padding: '0.25rem 0.5rem',
                                        backgroundColor: 'var(--color-warning-soft)',
                                        color: 'var(--color-warning)',
                                        borderRadius: '4px',
                                        display: 'inline-block',
                                        fontWeight: '600'
                                    }}>
                                        ⚠️ 您提交的申請
                                    </div>
                                )}
                            </div>

                            {/* Card Footer */}
                            <div style={{
                                fontSize: '0.8rem',
                                color: 'var(--color-text-muted)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span>編輯者：{submitterUsername}</span>
                                <span>
                                    {formatDate(req.createdAt)}
                                </span>
                            </div>

                            {/* Expand Indicator */}
                            <div style={{
                                marginTop: '0.75rem',
                                textAlign: 'center',
                                fontSize: '0.85rem',
                                color: 'var(--color-primary)'
                            }}>
                                {isExpanded ? '▲ 點擊收合' : '▼ 點擊展開'}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Expanded Detail Panel */}
            {expandedId !== null && (() => {
                const req = requests.find(r => r.id === expandedId);
                if (!req) return null;

                const typeInfo = getTypeLabel(req.type);
                const data = JSON.parse(req.data);
                const isUpdate = req.type === 'FILE_UPDATE';
                const file = req.file;

                return (
                    <div className="glass" style={{
                        padding: '2rem',
                        borderRadius: 'var(--radius-lg)',
                        border: '2px solid var(--color-primary)',
                        marginBottom: '2rem'
                    }}>
                        {/* Detail Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '1.5rem',
                            paddingBottom: '1rem',
                            borderBottom: '1px solid var(--color-border)'
                        }}>
                            <div>
                                <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>
                                    {typeInfo.label} 申請詳情
                                </h2>
                                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                    {formatDateTime(req.createdAt)}
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    padding: '0.5rem 1rem',
                                    cursor: 'pointer',
                                    color: 'var(--color-text-main)'
                                }}
                            >
                                ✕ 關閉
                            </button>
                        </div>

                        {/* Modified Fields Indicator for UPDATE */}
                        {isUpdate && file && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                                border: '1px solid var(--color-warning)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: '1.5rem',
                                fontSize: '0.9rem'
                            }}>
                                ⚡ <strong>修改欄位：</strong>{' '}
                                {(() => {
                                    const modified: string[] = [];
                                    if (isModified(file.dataName, data.dataName)) modified.push('名稱');
                                    if (isModified(file.dataCode, data.dataCode)) modified.push('編碼');
                                    if (isModified(file.dataYear, data.dataYear)) modified.push('年份');
                                    if (isModified(file.author, data.author)) modified.push('作者');
                                    if (isModified(file.description, data.description)) modified.push('簡介');
                                    return modified.length > 0 ? modified.join('、') : '無變更';
                                })()}
                            </div>
                        )}

                        {/* Detail Content */}
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '150px 1fr',
                                gap: '0.75rem',
                                marginBottom: '1.5rem'
                            }}>
                                <strong>資料編碼：</strong>
                                <span style={{ fontFamily: 'monospace' }}>{file?.dataCode || data.dataCode}</span>

                                <strong>資料年份：</strong>
                                <span>{file?.dataYear || data.dataYear}</span>

                                <strong>編輯者：</strong>
                                <span>{req.submittedBy?.username || req.submitterName || '(已刪除)'}</span>
                            </div>

                            {/* Comparison Fields */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <CompareField
                                    label="資料名稱"
                                    current={file?.dataName}
                                    proposed={data.dataName}
                                    isUpdate={isUpdate}
                                />

                                <CompareField
                                    label="作者"
                                    current={file?.author}
                                    proposed={data.author}
                                    isUpdate={isUpdate}
                                />

                                <CompareField
                                    label="內容簡介"
                                    current={file?.description}
                                    proposed={data.description}
                                    isUpdate={isUpdate}
                                    multiline
                                />

                                {/* File info for CREATE */}
                                {req.type === 'FILE_CREATE' && data.fileName && (
                                    <div>
                                        <strong style={{ display: 'block', marginBottom: '0.5rem' }}>檔案資訊</strong>
                                        <div style={{
                                            padding: '0.75rem',
                                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--color-success)'
                                        }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>新檔案</div>
                                            <div>📁 {data.fileName}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                                {formatFileSize(data.fileSize)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Delete warning */}
                                {req.type === 'FILE_DELETE' && (
                                    <div style={{
                                        padding: '1rem',
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid var(--color-danger)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}>
                                        <strong style={{ color: 'var(--color-danger)' }}>⚠️ 此操作將刪除檔案</strong>
                                        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                            檔案名稱：{file?.fileName || '未知'}<br />
                                            刪除後資料將無法恢復
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'flex-end',
                            paddingTop: '1rem',
                            borderTop: '1px solid var(--color-border)'
                        }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleReject(req.id); }}
                                className="btn btn-outline"
                                disabled={loading}
                                style={{
                                    color: 'var(--color-danger)',
                                    borderColor: 'var(--color-danger)',
                                    padding: '0.75rem 2rem'
                                }}
                            >
                                {loading ? '處理中...' : '拒絕'}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleApprove(req.id); }}
                                className="btn btn-primary"
                                disabled={loading}
                                style={{
                                    backgroundColor: 'var(--color-success)',
                                    border: 'none',
                                    padding: '0.75rem 2rem'
                                }}
                            >
                                {loading ? '處理中...' : '批准'}
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Confirm Dialog */}
            {confirmDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }} onClick={() => setConfirmDialog(null)}>
                    <div className="glass" style={{
                        padding: '2rem',
                        borderRadius: 'var(--radius-lg)',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid var(--color-border)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ margin: 0, marginBottom: '1rem' }}>
                            {confirmDialog.action === 'approve' ? '確認批准' : '確認拒絕'}
                        </h3>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                            您確定要{confirmDialog.action === 'approve' ? '批准' : '拒絕'}此檔案申請嗎？
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="btn btn-outline"
                                disabled={loading}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="btn btn-primary"
                                disabled={loading}
                                style={{
                                    backgroundColor: confirmDialog.action === 'approve'
                                        ? 'var(--color-success)'
                                        : 'var(--color-danger)'
                                }}
                            >
                                {loading ? '處理中...' : '確認'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Dialog */}
            {errorDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }} onClick={() => setErrorDialog(null)}>
                    <div className="glass" style={{
                        padding: '2rem',
                        borderRadius: 'var(--radius-lg)',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid var(--color-border)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ margin: 0, marginBottom: '1rem', color: 'var(--color-danger)' }}>
                            權限受限
                        </h3>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                            {errorDialog}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setErrorDialog(null)}
                                className="btn btn-primary"
                            >
                                確定
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
