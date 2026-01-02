'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitUpdateDataFileRequest } from '@/actions/data-files';

type DataFile = {
    id: number;
    dataYear: number;
    dataName: string;
    dataCode: string;
    author: string;
    description: string;
};

export default function EditDataFileButton({ file }: { file: DataFile }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const formData = new FormData(e.currentTarget);

            await submitUpdateDataFileRequest(file.id, {
                dataYear: parseInt(formData.get('dataYear') as string),
                dataName: formData.get('dataName') as string,
                dataCode: formData.get('dataCode') as string,
                author: formData.get('author') as string,
                description: formData.get('description') as string
            });

            alert('修改申請已提交，等待審核');
            setShowModal(false);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="btn btn-outline"
            >
                ✏️ 編輯
            </button>

            {showModal && (
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
                            maxWidth: '500px',
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)'
                        }}
                    >
                        <h2 style={{
                            fontSize: '1.3rem',
                            fontWeight: 700,
                            marginBottom: '1.5rem'
                        }}>
                            編輯檔案資料
                        </h2>

                        {error && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: 'var(--color-danger-soft)',
                                color: 'var(--color-danger)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '1rem'
                            }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                    資料年份
                                </label>
                                <input
                                    type="number"
                                    name="dataYear"
                                    defaultValue={file.dataYear}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg-surface)'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                    資料名稱
                                </label>
                                <input
                                    type="text"
                                    name="dataName"
                                    defaultValue={file.dataName}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg-surface)'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                    資料編碼
                                </label>
                                <input
                                    type="text"
                                    name="dataCode"
                                    defaultValue={file.dataCode}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        fontFamily: 'monospace'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                    作者
                                </label>
                                <input
                                    type="text"
                                    name="author"
                                    defaultValue={file.author}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg-surface)'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                    內容簡介
                                </label>
                                <textarea
                                    name="description"
                                    defaultValue={file.description}
                                    rows={3}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="btn btn-outline"
                                    disabled={loading}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? '提交中...' : '提交審核'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
