import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDataFiles, getDataFileYears } from '@/actions/data-files';
import DataFileList from '@/components/datafile/DataFileList';

export default async function DataFilesPage({
    searchParams
}: {
    searchParams: Promise<{ year?: string; q?: string }>
}) {
    const resolvedSearchParams = await searchParams;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/auth/signin');

    const selectedYear = resolvedSearchParams.year ? parseInt(resolvedSearchParams.year) : undefined;
    const files = await getDataFiles(selectedYear);
    const years = await getDataFileYears();

    const canUpload = ['EDITOR', 'INSPECTOR', 'ADMIN'].includes(session.user.role);

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                paddingBottom: '1.5rem',
                borderBottom: '1px solid var(--color-border)'
            }}>
                <div>
                    <h1 style={{
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        marginBottom: '0.5rem',
                        color: 'var(--color-text-main)'
                    }}>
                        檔案管理
                    </h1>
                    <p style={{
                        fontSize: '0.9rem',
                        color: 'var(--color-text-muted)',
                        margin: 0
                    }}>
                        管理與檢視所有上傳的檔案資料
                    </p>
                </div>

                {canUpload && (
                    <a
                        href="/datafiles/upload"
                        className="btn btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            textDecoration: 'none',
                            padding: '0.75rem 1.25rem'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        上傳檔案
                    </a>
                )}
            </div>

            {/* Year Filter */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <span style={{
                    fontSize: '0.85rem',
                    color: 'var(--color-text-muted)',
                    marginRight: '0.5rem'
                }}>
                    年份篩選：
                </span>
                <a
                    href="/datafiles"
                    className={`btn ${!selectedYear ? 'btn-primary' : 'btn-outline'}`}
                    style={{ textDecoration: 'none', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                    全部
                </a>
                {years.map(year => (
                    <a
                        key={year}
                        href={`/datafiles?year=${year}`}
                        className={`btn ${selectedYear === year ? 'btn-primary' : 'btn-outline'}`}
                        style={{ textDecoration: 'none', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                    >
                        {year}
                    </a>
                ))}
            </div>

            {/* Search Bar */}
            <form action="/datafiles/search" method="GET" style={{ marginBottom: '2rem' }}>
                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)'
                }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--color-text-muted)"
                            strokeWidth="2"
                            style={{
                                position: 'absolute',
                                left: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)'
                            }}
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            name="q"
                            placeholder="搜尋檔案名稱、編碼、作者..."
                            defaultValue={resolvedSearchParams.q}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem 0.75rem 3rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                        搜尋
                    </button>
                </div>
            </form>

            {/* File List */}
            <DataFileList files={files} canEdit={canUpload} />
        </div>
    );
}
