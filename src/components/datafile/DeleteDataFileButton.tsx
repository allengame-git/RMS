'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleDelete = async () => {
        setLoading(true);
        try {
            const result = await submitDeleteDataFileRequest(fileId);
            if ('error' in result && result.error) {
                alert(result.error);
                return;
            }
            alert('刪除申請已提交，等待審核');
            router.push('/datafiles');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
            setShowConfirm(false);
        }
    };

    const modalContent = (
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
            zIndex: 99999,
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div
                className="glass"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '2rem',
                    borderRadius: 'var(--radius-lg)',
                    textAlign: 'center',
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-danger-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem'
                }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                </div>
                <h3 style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                    color: 'var(--color-text-main)'
                }}>
                    確定要刪除嗎？
                </h3>
                <p style={{
                    marginBottom: '1.5rem',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6
                }}>
                    您即將刪除「{fileName}」<br />
                    此操作需經審核後才會生效
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    <button
                        onClick={() => setShowConfirm(false)}
                        className="btn btn-outline"
                        disabled={loading}
                        style={{ minWidth: '100px' }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleDelete}
                        className="btn"
                        disabled={loading}
                        style={{
                            backgroundColor: 'var(--color-danger)',
                            color: 'white',
                            minWidth: '100px'
                        }}
                    >
                        {loading ? '處理中...' : '確認刪除'}
                    </button>
                </div>
                <style jsx>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        </div>
    );

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
                刪除
            </button>

            {showConfirm && mounted && createPortal(modalContent, document.body)}
        </>
    );
}
