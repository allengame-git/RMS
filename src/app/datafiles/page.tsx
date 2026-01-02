import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDataFiles, getDataFileYears } from '@/actions/data-files';
import DataFileList from '@/components/datafile/DataFileList';

export default async function DataFilesPage({
    searchParams
}: {
    searchParams: { year?: string; q?: string }
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/auth/signin');

    const selectedYear = searchParams.year ? parseInt(searchParams.year) : undefined;
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
                marginBottom: '2rem'
            }}>
                <h1 style={{
                    fontSize: '1.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    📁 檔案管理
                </h1>

                {canUpload && (
                    <a
                        href="/datafiles/upload"
                        className="btn btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            textDecoration: 'none'
                        }}
                    >
                        ➕ 上傳檔案
                    </a>
                )}
            </div>

            {/* Year Filter */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap'
            }}>
                <a
                    href="/datafiles"
                    className={`btn ${!selectedYear ? 'btn-primary' : 'btn-outline'}`}
                    style={{ textDecoration: 'none' }}
                >
                    全部
                </a>
                {years.map(year => (
                    <a
                        key={year}
                        href={`/datafiles?year=${year}`}
                        className={`btn ${selectedYear === year ? 'btn-primary' : 'btn-outline'}`}
                        style={{ textDecoration: 'none' }}
                    >
                        {year}
                    </a>
                ))}
            </div>

            {/* Search Bar */}
            <form action="/datafiles/search" method="GET" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        name="q"
                        placeholder="搜尋檔案名稱、編碼、作者..."
                        defaultValue={searchParams.q}
                        style={{
                            flex: 1,
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text)'
                        }}
                    />
                    <button type="submit" className="btn btn-outline">
                        🔍 搜尋
                    </button>
                </div>
            </form>

            {/* File List */}
            <DataFileList files={files} canEdit={canUpload} />
        </div>
    );
}
