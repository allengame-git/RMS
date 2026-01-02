import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getDataFile } from '@/actions/data-files';
import Link from 'next/link';
import DeleteDataFileButton from '@/components/datafile/DeleteDataFileButton';
import EditDataFileButton from '@/components/datafile/EditDataFileButton';

export default async function DataFileDetailPage({
    params
}: {
    params: { id: string }
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/auth/signin');

    const file = await getDataFile(parseInt(params.id));
    if (!file || file.isDeleted) notFound();

    const canEdit = ['EDITOR', 'INSPECTOR', 'ADMIN'].includes(session.user.role);

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '📦';
        if (mimeType.includes('video')) return '🎬';
        if (mimeType.includes('audio')) return '🎵';
        return '📁';
    };

    // Get uploader and approver from first CREATE history record
    const createRecord = file.history?.find((h: any) => h.changeType === 'CREATE');
    const uploader = createRecord?.submittedBy?.username || '-';
    const approver = createRecord?.reviewedBy?.username || '-';

    return (
        <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
            {/* Breadcrumb */}
            <div style={{ marginBottom: '1.5rem' }}>
                <Link
                    href="/datafiles"
                    style={{
                        color: 'var(--color-primary)',
                        textDecoration: 'none'
                    }}
                >
                    ← 返回檔案列表
                </Link>
            </div>

            {/* Main Card */}
            <div className="glass" style={{
                padding: '2rem',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '2rem'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '3rem' }}>{getFileIcon(file.mimeType)}</span>
                        <div>
                            <h1 style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                marginBottom: '0.25rem'
                            }}>
                                {file.dataName}
                            </h1>
                            <div style={{
                                fontFamily: 'monospace',
                                color: 'var(--color-text-muted)'
                            }}>
                                {file.dataCode}
                            </div>
                        </div>
                    </div>
                    <span style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--color-primary-soft)',
                        color: 'var(--color-primary)',
                        borderRadius: '999px',
                        fontWeight: 600
                    }}>
                        {file.dataYear}
                    </span>
                </div>

                {/* Metadata Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '1.5rem',
                    padding: '1.5rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius-md)'
                }}>
                    <div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-muted)',
                            marginBottom: '0.25rem'
                        }}>作者</div>
                        <div style={{ fontWeight: 600 }}>{file.author}</div>
                    </div>
                    <div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-muted)',
                            marginBottom: '0.25rem'
                        }}>檔案大小</div>
                        <div style={{ fontWeight: 600 }}>{formatFileSize(file.fileSize)}</div>
                    </div>
                    <div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-muted)',
                            marginBottom: '0.25rem'
                        }}>檔案類型</div>
                        <div style={{ fontWeight: 600 }}>{file.mimeType}</div>
                    </div>
                    <div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-muted)',
                            marginBottom: '0.25rem'
                        }}>版本</div>
                        <div style={{ fontWeight: 600 }}>v{file.currentVersion}</div>
                    </div>
                    <div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-muted)',
                            marginBottom: '0.25rem'
                        }}>上傳者</div>
                        <div style={{ fontWeight: 600 }}>{uploader}</div>
                    </div>
                    <div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-muted)',
                            marginBottom: '0.25rem'
                        }}>審核者</div>
                        <div style={{ fontWeight: 600 }}>{approver}</div>
                    </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        marginBottom: '0.75rem'
                    }}>
                        內容簡介
                    </h3>
                    <p style={{
                        lineHeight: 1.7,
                        color: 'var(--color-text-secondary)',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {file.description}
                    </p>
                </div>

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '1.5rem'
                }}>
                    <a
                        href={file.filePath}
                        download={file.fileName}
                        className="btn btn-primary"
                        style={{ textDecoration: 'none' }}
                    >
                        ⬇️ 下載檔案
                    </a>

                    {canEdit && (
                        <>
                            <EditDataFileButton file={file} />
                            <DeleteDataFileButton fileId={file.id} fileName={file.dataName} />
                        </>
                    )}
                </div>
            </div>

            {/* History */}
            {file.history && file.history.length > 0 && (
                <div className="glass" style={{
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-lg)'
                }}>
                    <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        marginBottom: '1rem'
                    }}>
                        📜 變更歷史
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {file.history.map((h: any) => (
                            <div
                                key={h.id}
                                style={{
                                    padding: '0.75rem 1rem',
                                    backgroundColor: 'var(--color-bg-elevated)',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <span style={{
                                        padding: '0.25rem 0.5rem',
                                        backgroundColor: h.changeType === 'CREATE' ? 'var(--color-success-soft)' :
                                            h.changeType === 'UPDATE' ? 'var(--color-warning-soft)' :
                                                'var(--color-danger-soft)',
                                        color: h.changeType === 'CREATE' ? 'var(--color-success)' :
                                            h.changeType === 'UPDATE' ? 'var(--color-warning)' :
                                                'var(--color-danger)',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        marginRight: '0.75rem'
                                    }}>
                                        {h.changeType}
                                    </span>
                                    <span style={{ fontSize: '0.9rem' }}>版本 {h.version}</span>
                                </div>
                                <span style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-muted)'
                                }}>
                                    {new Date(h.createdAt).toLocaleString('zh-TW')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
