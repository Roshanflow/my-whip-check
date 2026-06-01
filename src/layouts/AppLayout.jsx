export default function AppLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>App</span>
      </header>
      <main style={{ padding: '32px 24px' }}>
        {children}
      </main>
    </div>
  )
}
