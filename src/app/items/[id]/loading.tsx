export default function Loading() {
    return (
        <div style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            color: 'var(--color-text-muted)'
        }}>
            <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid var(--color-border)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 1rem'
            }} />
            <p style={{ margin: 0, fontSize: '0.95rem' }}>載入中...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
