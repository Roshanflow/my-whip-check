import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './mot.css'

export default function EditMotPage() {
  const { id, motId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('mot_records').select('*').eq('id', motId).single().then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setForm({
        test_date: data.test_date || '',
        expiry_date: data.expiry_date || '',
        result: data.result || 'pass',
        mileage: data.mileage ?? '',
        advisory_notes: data.advisory_notes || '',
        failure_reasons: data.failure_reasons || '',
      })
    })
  }, [motId])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.from('mot_records').update({
      test_date: form.test_date,
      expiry_date: form.result === 'pass' ? (form.expiry_date || null) : null,
      result: form.result,
      mileage: form.mileage !== '' ? parseInt(form.mileage, 10) : null,
      advisory_notes: form.advisory_notes || null,
      failure_reasons: form.result === 'fail' ? (form.failure_reasons || null) : null,
    }).eq('id', motId)
    setLoading(false)
    if (err) setError(err.message)
    else navigate(`/vehicles/${id}`)
  }

  if (!form) return <div className="page-loading">Loading…</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Edit MOT Record</h1>
        <Link to={`/vehicles/${id}`} className="btn btn-secondary">Cancel</Link>
      </div>

      <div className="form-card">
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="test_date">Test Date *</label>
              <input id="test_date" type="date" value={form.test_date} onChange={e => set('test_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="result">Result *</label>
              <select id="result" value={form.result} onChange={e => set('result', e.target.value)}>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            </div>
          </div>

          {form.result === 'pass' && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="expiry_date">Expiry Date</label>
                <input id="expiry_date" type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="mileage">Mileage</label>
                <input id="mileage" type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} min="0" />
              </div>
            </div>
          )}

          {form.result === 'fail' && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="mileage">Mileage</label>
                <input id="mileage" type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} min="0" />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="advisory_notes">Advisory Notes</label>
            <textarea id="advisory_notes" value={form.advisory_notes} onChange={e => set('advisory_notes', e.target.value)} rows={3} />
          </div>

          {form.result === 'fail' && (
            <div className="form-group">
              <label htmlFor="failure_reasons">Failure Reasons</label>
              <textarea id="failure_reasons" value={form.failure_reasons} onChange={e => set('failure_reasons', e.target.value)} rows={3} />
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
