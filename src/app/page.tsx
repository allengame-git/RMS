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

        {/* Bento Grid Dashboard */}
        <div className="bento-grid">

          {/* Row 1 */}
          {/* Card 1: System Overview (Drone Image) - Span 8 */}
          <div className="bento-card bento-col-8" style={{ backgroundImage: "url('/bento_drone_wide.jpg')" }}>
            {/* Transparent Overlay (No Mask) */}
            <div className="bento-overlay" style={{
              justifyContent: 'flex-end',
              background: 'none',
              padding: '0',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none'
            }}>
              <div style={{ padding: '2rem', width: '100%', backdropFilter: 'blur(0px)' }}>
                <h3 className="bento-title" style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.25rem', textShadow: '0 4px 12px rgba(0,0,0,0.8)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  全區監控概覽
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1rem', marginBottom: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                  System Overview
                </p>

                {/* Consolidated Stats */}
                <div style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap' }}>
                  <div>
                    <div className="stat-value" style={{ color: '#ffffff', fontSize: '3.5rem', marginBottom: '0.25rem', fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>{stats.overview.projectCount}</div>
                    <div className="stat-label" style={{ color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem', fontWeight: 700 }}>執行中專案</div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: '#ffffff', fontSize: '3.5rem', marginBottom: '0.25rem', fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>{stats.overview.itemCount}</div>
                    <div className="stat-label" style={{ color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem', fontWeight: 700 }}>管理項目總數</div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: '#ffffff', fontSize: '3.5rem', marginBottom: '0.25rem', fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>{stats.overview.fileCount}</div>
                    <div className="stat-label" style={{ color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem', fontWeight: 700 }}>已歸檔文件</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Pending Actions (Black & White Image) - Span 4 */}
          <div className="bento-card bento-col-4" style={{ backgroundImage: "url('/bento_pending_muted.png')" }}>
            <div className="bento-overlay" style={{
              justifyContent: 'flex-end',
              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, transparent 80%)',
              padding: '0',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none'
            }}>
              <div style={{ padding: '2rem', width: '100%' }}>
                <h3 className="bento-title" style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  待辦事項
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '1.25rem', fontWeight: 500 }}>
                  PENDING ACTIONS
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Link href="/admin/approval" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem', textDecoration: 'none', color: 'white' }}>
                    <span>項目變更</span>
                    <span style={{ color: stats.pending.items > 0 ? '#ef4444' : 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{stats.pending.items}</span>
                  </Link>
                  <Link href="/admin/approval" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem', textDecoration: 'none', color: 'white' }}>
                    <span>檔案變更</span>
                    <span style={{ color: stats.pending.files > 0 ? '#f59e0b' : 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{stats.pending.files}</span>
                  </Link>
                  <Link href="/admin/approval" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem', textDecoration: 'none', color: 'white' }}>
                    <span>QC/PM 審核</span>
                    <span style={{ color: stats.pending.qc > 0 ? '#06b6d4' : 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{stats.pending.qc}</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 */}
          {/* Card 3: Recent Activity (Black & White Image) - Span 4 */}
          <div className="bento-card bento-col-4" style={{ backgroundImage: "url('/bento_activity_muted.png')" }}>
            <div className="bento-overlay" style={{
              justifyContent: 'flex-end',
              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, transparent 80%)',
              padding: '0',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none'
            }}>
              <div style={{ padding: '2rem', width: '100%' }}>
                <h3 className="bento-title" style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  近期活動
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '1.25rem', fontWeight: 500 }}>
                  RECENT ACTIVITY (7 DAYS)
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem' }}>
                    <span>新增項目</span>
                    <span>{stats.recent.newItems}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem' }}>
                    <span>新增檔案</span>
                    <span>{stats.recent.newFiles}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem' }}>
                    <span>內容變更</span>
                    <span>{stats.recent.edits}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Tunnel Image (Visual Only) - Span 4 */}
          <div className="bento-card bento-col-4" style={{ backgroundImage: "url('/bento_tunnel.jpg')" }}>
            {/* No text/overlay, just clean image */}
          </div>

          {/* Card 5: Coast Image (Visual Only) - Span 4 */}
          <div className="bento-card bento-col-4" style={{ backgroundImage: "url('/bento_coast.jpg')" }}>
            {/* No text/overlay, just clean image */}
          </div>

        </div>

      </main >
    </div >
  );
}
