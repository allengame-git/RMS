import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

async function getEnhancedStats() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));

  const [
    projectCount,
    itemCount,
    fileCount,
    pendingChangeRequests,
    pendingFileRequests,
    pendingQC,
    recentItems,
    recentFiles,
    totalItemEdits,
    totalFileEdits,
    recentItemEdits
  ] = await Promise.all([
    prisma.project.count(),
    prisma.item.count({ where: { isDeleted: false } }),
    prisma.dataFile.count({ where: { isDeleted: false } }),
    prisma.changeRequest.count({ where: { status: "PENDING" } }),
    prisma.dataFileChangeRequest.count({ where: { status: "PENDING" } }),
    prisma.qCDocumentApproval.count({ where: { status: { in: ["PENDING_QC", "PENDING_PM"] } } }),
    prisma.item.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.dataFile.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.itemHistory.count(),
    prisma.dataFileHistory.count(),
    prisma.itemHistory.count({ where: { createdAt: { gte: sevenDaysAgo } } })
  ]);

  return {
    overview: {
      projectCount,
      itemCount,
      fileCount
    },
    recent: {
      newItems: recentItems,
      newFiles: recentFiles,
      edits: recentItemEdits
    },
    pending: {
      items: pendingChangeRequests,
      files: pendingFileRequests,
      qc: pendingQC,
      total: pendingChangeRequests + pendingFileRequests + pendingQC
    },
    totalEdits: totalItemEdits + totalFileEdits
  };
}

export default async function Home() {
  const session = await getServerSession(authOptions);
  const stats = await getEnhancedStats();

  return (
    <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
      <main className="flex-col gap-md">
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              padding: '1.5rem',
              borderRadius: '50%',
              backgroundColor: 'white',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              display: 'inline-flex'
            }}>
              <Image src="/taipower_logo.png" alt="Taipower Logo" width={80} height={80} style={{ objectFit: 'contain' }} />
            </div>
          </div>
          <h1 style={{ marginBottom: '1rem', fontSize: '2.5rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--color-primary)' }}>
            低放射性廢棄物處置管理系統
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', fontWeight: 500, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span>Low-level Radiowaste Disposal Management System</span>
            <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>(LLRWD Management System)</span>
          </p>

          {session?.user ? (
            <div style={{
              marginTop: '2rem',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '9999px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)', marginRight: '0.75rem' }}></div>
              <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
                歡迎回來，<strong style={{ color: 'var(--color-text-main)' }}>{session.user.username}</strong>
              </span>
              <span style={{
                marginLeft: '1rem',
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: 'var(--color-bg-base)',
                color: 'var(--color-text-secondary)',
                borderRadius: '9999px',
                border: '1px solid var(--color-border)',
                textTransform: 'uppercase'
              }}>
                {session.user.role}
              </span>
            </div>
          ) : (
            <div style={{ marginTop: '2.5rem' }}>
              <Link href="/auth/login" className="btn btn-primary" style={{ padding: '0.875rem 2.5rem', fontSize: '1.1rem', borderRadius: '9999px', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)' }}>
                登入系統
              </Link>
            </div>
          )}
        </div>

        {/* Infographic Dashboard */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem'
        }}>

          {/* Card 1: System Overview - Teal Theme */}
          <div className="glass" style={{
            padding: '2.5rem',
            borderRadius: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'var(--color-bg-surface)',
            borderTop: '6px solid var(--chart-1)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.01em' }}>
              <span style={{ fontSize: '1.5rem' }}>📊</span> 系統數據概覽
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--chart-1)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {stats.overview.projectCount}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem' }}>
                  Active Projects
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--chart-5)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {stats.overview.itemCount}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem' }}>
                  Total Items
                </div>
              </div>
            </div>

            <div style={{ paddingTop: '1.5rem', borderTop: '1px dashed var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>資料檔案 (Files)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--chart-2)' }}>{stats.overview.fileCount}</div>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '65%', height: '100%', background: 'linear-gradient(90deg, var(--chart-2), var(--color-brand-yellow))', borderRadius: '4px' }}></div>
              </div>
            </div>
          </div>

          {/* Card 2: Recent Activity - Orange Theme */}
          <div className="glass" style={{
            padding: '2.5rem',
            borderRadius: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'var(--color-bg-surface)',
            borderTop: '6px solid var(--chart-2)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.01em' }}>
              <span style={{ fontSize: '1.5rem' }}>⚡️</span> 近期活動 (7 Days)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(0, 188, 212, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--chart-1)', fontWeight: 'bold' }}>+</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>新增項目</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>New Items</div>
                  </div>
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--chart-1)' }}>{stats.recent.newItems}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255, 152, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--chart-2)', fontWeight: 'bold' }}>+</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>新增檔案</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>New Files</div>
                  </div>
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--chart-2)' }}>{stats.recent.newFiles}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(156, 39, 176, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--chart-4)', fontWeight: 'bold' }}>✎</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>內容變更</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Edits</div>
                  </div>
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--chart-4)' }}>{stats.recent.edits}</span>
              </div>
            </div>
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>
              Total system edits: <strong>{stats.totalEdits}</strong>
            </div>
          </div>

          {/* Card 3: Pending Actions - Red/Yellow Theme */}
          <div className="glass" style={{
            padding: '2.5rem',
            borderRadius: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'var(--color-bg-surface)',
            borderTop: '6px solid var(--color-danger)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.01em' }}>
                <span style={{ fontSize: '1.5rem' }}>⏳</span> 待辦事項
              </h3>
              {stats.pending.total > 0 ? (
                <span style={{ backgroundColor: 'var(--color-danger)', color: 'white', padding: '0.35rem 1rem', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 4px 6px rgba(198, 40, 40, 0.3)' }}>
                  {stats.pending.total} Pending
                </span>
              ) : (
                <span style={{ backgroundColor: 'var(--color-success)', color: 'white', padding: '0.35rem 1rem', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 700 }}>
                  All Clear
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {/* Item Requests */}
              <Link href="/admin/approval" style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.03)',
                  borderLeft: `4px solid ${stats.pending.items > 0 ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>項目變更</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.2rem', color: stats.pending.items > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {stats.pending.items}
                    </span>
                  </div>
                </div>
              </Link>

              {/* File Requests */}
              <Link href="/admin/approval" style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  backgroundColor: 'rgba(249, 168, 37, 0.03)',
                  borderLeft: `4px solid ${stats.pending.files > 0 ? 'var(--color-warning)' : 'var(--color-border)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>檔案變更</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.2rem', color: stats.pending.files > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                      {stats.pending.files}
                    </span>
                  </div>
                </div>
              </Link>

              {/* QC Requests */}
              <Link href="/admin/approval" style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  backgroundColor: 'rgba(0, 131, 143, 0.03)',
                  borderLeft: `4px solid ${stats.pending.qc > 0 ? 'var(--color-brand-teal)' : 'var(--color-border)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>QC/PM 審核</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.2rem', color: stats.pending.qc > 0 ? 'var(--color-brand-teal)' : 'var(--color-text-muted)' }}>
                      {stats.pending.qc}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

      </main >
    </div >
  );
}
