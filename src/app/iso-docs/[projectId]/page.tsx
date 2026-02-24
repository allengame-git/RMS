import { getIsoDocumentsByProject } from '@/actions/history';
import { prisma } from '@/lib/prisma';
import IsoDocList from '@/components/iso-docs/IsoDocList';
import DownloadAllButton from '@/components/iso-docs/DownloadAllButton';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Params = Promise<{ projectId: string }>;

export default async function ProjectIsoDocsPage({ params }: { params: Params }) {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
        notFound();
    }

    // Get project info
    const project = await prisma.project.findUnique({
        where: { id: projectIdNum },
        select: { id: true, title: true, codePrefix: true }
    });

    if (!project) {
        notFound();
    }

    const docs = await getIsoDocumentsByProject(projectIdNum);

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Breadcrumb */}
            <nav style={{
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <Link
                    href="/iso-docs"
                    style={{
                        color: 'var(--color-primary)',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    ISO 品質文件
                </Link>
                <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{project.title}</span>
            </nav>

            {/* Header */}
            <div style={{
                marginBottom: '2rem',
                paddingBottom: '1.5rem',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--color-primary-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>
                    <div>
                        <h1 style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            marginBottom: '0.25rem',
                            color: 'var(--color-text-main)'
                        }}>
                            {project.title}
                        </h1>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span style={{ fontFamily: 'var(--font-geist-mono)' }}>{project.codePrefix}</span>
                            <span>•</span>
                            <span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>{docs.length}</span>
                            <span>份品質文件</span>
                        </div>
                    </div>
                </div>
                <DownloadAllButton projectId={projectIdNum} docCount={docs.length} />
            </div>

            <IsoDocList docs={docs} />
        </div>
    );
}
