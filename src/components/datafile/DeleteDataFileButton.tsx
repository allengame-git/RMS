'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitDeleteDataFileRequest } from '@/actions/data-files';

export default function DeleteDataFileButton({
    fileId,
    fileName
}: {
    fileId: number;
    fileName: string;
}) {
    const router = useRouter();
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            await submitDeleteDataFileRequest(fileId);
            alert('刪除申請已提交，等待審核');
            router.push('/datafiles');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
            setShowConfirm(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowConfirm(true)}
                className="btn"
                style={{
                    backgroundColor: 'var(--color-danger-soft)',
                    color: 'var(--color-danger)',
                    border: '1px solid var(--color-danger)'
                }}
            >
                🗑️ 刪除
            </button>

            {showConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div
                        className="glass"
                        style={{
                            width: '100%',
                            maxWidth: '400px',
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            textAlign: 'center'
                        }}
                    >
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                        <h3 style={{
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            marginBottom: '1rem',
                            color: 'var(--color-danger)'
                        }}>
                            確定要刪除嗎？
                        </h3>
                        <p style={{
                            marginBottom: '1.5rem',
                            color: 'var(--color-text-secondary)'
                        }}>
                            您即將刪除「{fileName}」<br />
                            此操作需經審核後才會生效
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="btn btn-outline"
                                disabled={loading}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDelete}
                                className="btn"
                                disabled={loading}
                                style={{
                                    backgroundColor: 'var(--color-danger)',
                                    color: 'white'
                                }}
                            >
                                {loading ? '處理中...' : '確認刪除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
