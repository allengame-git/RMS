import { getItemHistoryByFullId } from "@/actions/history";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function ItemHistoryListPage({ params }: { params: { projectId: string, fullId: string } }) {
    const history = await getItemHistoryByFullId(parseInt(params.projectId), params.fullId);

    if (history.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                找不到歷史記錄： {params.fullId}
            </div>
        )
    }

    const firstRecord = history[0];
    const isDeleted = firstRecord.changeType === "DELETE" || firstRecord.itemId === null;

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {params.fullId}
                    {isDeleted && <span style={{ fontSize: '1rem', background: 'var(--color-error-bg)', color: 'var(--color-error)', padding: '0.25rem 0.75rem', borderRadius: '4px' }}>已刪除</span>}
                </h1>
                <h2 style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>{firstRecord.itemTitle}</h2>
            </div>

            <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>版本</th>
                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>日期</th>
                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>類型</th>
                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>提交者</th>
                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map(record => (
                            <tr key={record.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '0.75rem', fontFamily: 'var(--font-geist-mono)' }}>v{record.version}</td>
                                <td style={{ padding: '0.75rem' }}>{new Date(record.createdAt).toLocaleString()}</td>
                                <td style={{ padding: '0.75rem' }}>
                                    <span style={{
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '1rem',
                                        fontSize: '0.8rem',
                                        backgroundColor: record.changeType === 'CREATE' ? 'var(--color-success-bg)' :
                                            record.changeType === 'UPDATE' ? 'var(--color-info-bg)' :
                                                record.changeType === 'DELETE' ? 'var(--color-error-bg)' : 'var(--color-bg-secondary)',
                                        color: record.changeType === 'CREATE' ? 'var(--color-success)' :
                                            record.changeType === 'UPDATE' ? 'var(--color-info)' :
                                                record.changeType === 'DELETE' ? 'var(--color-error)' : 'var(--color-text)',
                                    }}>
                                        {record.changeType === 'CREATE' ? '建立' :
                                            record.changeType === 'UPDATE' ? '更新' :
                                                record.changeType === 'DELETE' ? '刪除' :
                                                    record.changeType === 'RESTORE' ? '還原' : record.changeType}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem' }}>{record.submittedBy?.username || record.submitterName || '(已刪除)'}</td>
                                <td style={{ padding: '0.75rem' }}>
                                    <Link
                                        href={`/admin/history/detail/${record.id}`}
                                        style={{ color: 'var(--color-primary)', textDecoration: 'none', marginRight: '1rem' }}
                                    >
                                        查看詳情
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
