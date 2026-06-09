'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            color: 'var(--color-text-main)'
        }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="1.5" style={{ marginBottom: '1rem' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                審批頁面載入失敗
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {error.message || '發生未預期的錯誤'}
            </p>
            <button
                onClick={reset}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.5rem' }}
            >
                重試
            </button>
        </div>
    );
}
