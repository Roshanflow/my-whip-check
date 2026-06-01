import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './service.css'

const SERVICE_TYPES = ['Full Service', 'Interim Service', 'Oil & Filter Change', 'Tyres', 'Brakes', 'Clutch', 'Timing Belt', 'Battery', 'Other']

export default function EditServicePage() {
  const { id, serviceId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('service_records').select('*').eq('id', serviceId).single().then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setForm({
        service_date: data.service_date || '',
        mileage: data.mileage ?? '',
        service_type: data.service_type || 'Full Service',
        description: data.description || '',
        cost: data.cost ?? '',
        provider: data.provider || '',
      })
    })
  }, [serviceId])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleDelete() {
    if (!confirm('Delete this service record? This cannot be undone.')) return
    await supabase.from('service_records').delete().eq('id', serviceId)
    navigate(`/vehicles/${id}`)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.from('service_records').update({
      service_date: form.service_date,
      mileage: form.mileage !== '' ? parseInt(form.mileage, 10) : null,
      service_type: form.service_type,
      description: form.description || null,
      cost: form.cost !== '' ? parseFloat(form.cost) : null,
      provider: form.provider || null,
    }).eq('id', serviceId)
    setLoading(false)
    if (err) setError(err.message)
    else navigate(`/vehicles/${id}`)
  }

  if (!form) return <div className="page-loading">Loading…</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Edit Service Record</h1>
        <Link to={`/vehicles/${id}`} className="btn btn-secondary">Cancel</Link>
      </div>

      <div className="form-card">
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="service_date">Service Date *</label>
              <input id="service_date" type="date" value={form.service_date} onChange={e => set('service_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="service_type">Service Type *</label>
              <select id="service_type" value={form.service_type} onChange={e => set('service_type', e.target.value)}>
                {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mileage">Mileage</label>
              <input id="mileage" type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} min="0" />
            </div>
            <div className="form-group">
              <label htmlFor="cost">Cost (£)</label>
              <input id="cost" type="number" step="0.01" value={form.cost} onChange={e => set('cost', e.target.value)} min="0" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="provider">Garage / Provider</label>
            <input id="provider" value={form.provider} onChange={e => set('provider', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description / Notes</label>
            <textarea id="description" value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              Delete Record
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
