import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './vehicles.css'

export default function EditVehiclePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('vehicles').select('*').eq('id', id).single().then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setForm(data)
    })
  }, [id])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.from('vehicles').update({
      nickname: form.nickname || null,
      make: form.make,
      model: form.model,
      year: parseInt(form.year, 10),
      type: form.type,
      registration: form.registration.toUpperCase(),
      color: form.color || null,
      notes: form.notes || null,
    }).eq('id', id)
    setLoading(false)
    if (err) setError(err.message)
    else navigate(`/vehicles/${id}`)
  }

  async function handleDelete() {
    if (!confirm('Delete this vehicle and all its history? This cannot be undone.')) return
    await supabase.from('vehicles').delete().eq('id', id)
    navigate('/')
  }

  if (!form) return <div className="page-loading">Loading…</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Edit Vehicle</h1>
        <Link to={`/vehicles/${id}`} className="btn btn-secondary">Cancel</Link>
      </div>

      <div className="form-card">
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="make">Make *</label>
              <input id="make" value={form.make} onChange={e => set('make', e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="model">Model *</label>
              <input id="model" value={form.model} onChange={e => set('model', e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="year">Year *</label>
              <input id="year" type="number" value={form.year} onChange={e => set('year', e.target.value)} min="1900" max="2100" required />
            </div>
            <div className="form-group">
              <label htmlFor="type">Type *</label>
              <select id="type" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="car">Car</option>
                <option value="bike">Bike</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="registration">Registration *</label>
              <input id="registration" value={form.registration} onChange={e => set('registration', e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="color">Colour</label>
              <input id="color" value={form.color || ''} onChange={e => set('color', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="nickname">Nickname</label>
            <input id="nickname" value={form.nickname || ''} onChange={e => set('nickname', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              Delete Vehicle
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
