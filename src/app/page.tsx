import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="container" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
      <main className="flex-col gap-md">
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ marginBottom: '1rem' }}>Project RMS</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem' }}>
            Robust Project Information Management System
          </p>

          {session?.user ? (
            <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-md)', color: 'var(--color-success)' }}>
              Welcome back, <strong>{session.user.username}</strong> ({session.user.role})
            </div>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <Link href="/auth/login" className="btn btn-primary">Login Now</Link>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Card 1 */}
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Documentation</h3>
            <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>
              Manage hierarchical project items with full history tracking.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Approval Workflow</h3>
            <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>
              Strict change request system for data integrity.
            </p>
          </div>
        </div>

        <div className="flex-center" style={{ marginTop: '3rem', gap: '1rem' }}>
          <button className="btn btn-primary">Get Started</button>
          <button className="btn btn-outline">Learn More</button>
        </div>
      </main>
    </div>
  );
}
