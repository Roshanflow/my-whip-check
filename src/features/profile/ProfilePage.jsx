import { useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import './profile.css'

export default function ProfilePage() {
  const { user, profile, updateProfile, reloadProfile } = useAuth()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name:  profile?.last_name  || '',
    phone:      profile?.phone      || '',
    dob:        profile?.dob        || '',
  })
  const [email, setEmail] = useState(user?.email || '')
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess]   = useState('')
  const [error, setError]       = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (upErr) {
      setError(upErr.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: profErr } = await updateProfile({ avatar_url: publicUrl })
    if (profErr) setError(profErr.message)
    else await reloadProfile()
    setUploading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const { error: profErr } = await updateProfile({
      first_name: form.first_name || null,
      last_name:  form.last_name  || null,
      phone:      form.phone      || null,
      dob:        form.dob        || null,
    })

    if (profErr) {
      setError(profErr.message)
      setSaving(false)
      return
    }

    // Update email if changed
    if (email !== user.email) {
      const { error: emailErr } = await supabase.auth.updateUser({ email })
      if (emailErr) {
        setError(emailErr.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setSuccess('Profile updated successfully.')
  }

  const avatarUrl = profile?.avatar_url
  const initials = [form.first_name, form.last_name].filter(Boolean).map(n => n[0].toUpperCase()).join('') || user?.email?.[0]?.toUpperCase() || '?'

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
      </div>

      {/* ── Avatar ──────────────────────────────────────────────────── */}
      <div className="profile-avatar-section">
        <div className="profile-avatar" onClick={() => fileInputRef.current?.click()}>
          {avatarUrl
            ? <img src={avatarUrl} alt="Avatar" className="profile-avatar-img" />
            : <span className="profile-avatar-initials">{initials}</span>
          }
          <div className="profile-avatar-overlay">{uploading ? 'Uploading…' : 'Change'}</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />
        <div className="profile-avatar-hint">Click to upload a profile picture</div>
      </div>

      {/* ── Form ────────────────────────────────────────────────────── */}
      <div className="form-card" style={{ marginTop: 24 }}>
        {error   && <div className="alert-error">{error}</div>}
        {success && <div className="alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">First Name</label>
              <input id="first_name" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" />
            </div>
            <div className="form-group">
              <label htmlFor="last_name">Last Name</label>
              <input id="last_name" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input id="phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 7700 000000" />
            </div>
            <div className="form-group">
              <label htmlFor="dob">Date of Birth</label>
              <input id="dob" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
