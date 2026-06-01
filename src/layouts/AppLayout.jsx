import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../features/profile/profile.css'

export default function AppLayout() {
  const { user, profile, displayName, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="nav">
        <Link to="/" className="nav-brand">MyWhipCheck</Link>
        <div className="nav-actions">
          <Link to="/profile" className="nav-user">
            <div className="nav-avatar">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" />
                : initials
              }
            </div>
            <span className="nav-user-name">{displayName}</span>
          </Link>
          <button onClick={handleSignOut} className="btn btn-secondary btn-sm">Sign out</button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
