import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="nav">
        <Link to="/" className="nav-brand">🚗 MyWhipCheck</Link>
        <div className="nav-actions">
          <span className="nav-email">{user?.email}</span>
          <button onClick={handleSignOut} className="btn btn-secondary btn-sm">Sign out</button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
