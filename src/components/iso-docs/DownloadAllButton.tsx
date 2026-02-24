'use client';

import { useState } from 'react';

export default function DownloadAllButton({ projectId, docCount }: { projectId: number; docCount: number }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (docCount === 0) return null;

    const handleDownload = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/iso-docs/${projectId}/download-all`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || '下載失敗');
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            // 從 Content-Disposition 取得檔名
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename\*=UTF-8''(.+)/);
            const filename = match ? decodeURIComponent(match[1]) : 'WQ-ISO.zip';

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : '未知錯誤');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
            <button
                onClick={handleDownload}
                disabled={loading}
                className="btn btn-primary"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1.1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                }}
            >
                {loading ? (
                    <>
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ animation: 'spin 1s linear infinite' }}
                        >
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        打包中...
                    </>
                ) : (
                    <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        下載全部 PDF
                    </>
                )}
            </button>
            {error && (
                <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{error}</span>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
