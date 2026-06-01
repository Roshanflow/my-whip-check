import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './service.css'

const SERVICE_TYPES = ['Full Service', 'Interim Service', 'Oil & Filter Change', 'Tyres', 'Brakes', 'Clutch', 'Timing Belt', 'Battery', 'Other']
const EMPTY = { service_date: '', mileage: '', service_type: 'Full Service', description: '', cost: '', provider: '' }

export default function AddServicePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.from('service_records').insert({
      vehicle_id: id,
      service_date: form.service_date,
      mileage: form.mileage ? parseInt(form.mileage, 10) : null,
      service_type: form.service_type,
      description: form.description || null,
      cost: form.cost !== '' ? parseFloat(form.cost) : null,
      provider: form.provider || null,
    })
    setLoading(false)
    if (err) setError(err.message)
    else navigate(`/vehicles/${id}?tab=service`)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Add Service Record</h1>
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
              <input id="mileage" type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} placeholder="e.g. 45000" min="0" />
            </div>
            <div className="form-group">
              <label htmlFor="cost">Cost (£)</label>
              <input id="cost" type="number" step="0.01" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="e.g. 180.00" min="0" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="provider">Garage / Provider</label>
            <input id="provider" value={form.provider} onChange={e => set('provider', e.target.value)} placeholder="e.g. Kwik Fit" />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description / Notes</label>
            <textarea id="description" value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="What was done…" />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Service Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
