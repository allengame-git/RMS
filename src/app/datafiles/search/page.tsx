import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { searchDataFiles } from '@/actions/data-files';
import DataFileList from '@/components/datafile/DataFileList';
import Link from 'next/link';

export default async function DataFilesSearchPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; year?: string }>
}) {
    const resolvedSearchParams = await searchParams;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/auth/signin');

    const query = resolvedSearchParams.q || '';
    const year = resolvedSearchParams.year ? parseInt(resolvedSearchParams.year) : undefined;

    if (!query) {
        redirect('/datafiles');
    }

    const files = await searchDataFiles(query, year);
    const canUpload = ['EDITOR', 'INSPECTOR', 'ADMIN'].includes(session.user.role);

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <Link
                    href="/datafiles"
                    style={{
                        color: 'var(--color-primary)',
                        textDecoration: 'none',
                        marginBottom: '1rem',
                        display: 'inline-block'
                    }}
                >
                    ← 返回檔案列表
                </Link>
                <h1 style={{
                    fontSize: '1.8rem',
                    fontWeight: 700,
                    marginTop: '1rem'
                }}>
                    🔍 搜尋結果：「{query}」
                </h1>
                <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                    找到 {files.length} 個檔案
                </p>
            </div>

            {/* Search Again */}
            <form action="/datafiles/search" method="GET" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        name="q"
                        placeholder="搜尋檔案名稱、編碼、作者..."
                        defaultValue={query}
                        style={{
                            flex: 1,
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text)'
                        }}
                    />
                    <button type="submit" className="btn btn-primary">
                        🔍 搜尋
                    </button>
                </div>
            </form>

            {/* Results */}
            <DataFileList files={files} canEdit={canUpload} />
        </div>
    );
}
