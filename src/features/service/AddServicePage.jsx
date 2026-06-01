import { useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import './service.css'

const SERVICE_TYPES = ['Full Service', 'Interim Service', 'Oil & Filter Change', 'Tyres', 'Brakes', 'Clutch', 'Timing Belt', 'Battery', 'MOT', 'Other']
const EMPTY = { service_date: '', mileage: '', service_type: 'Full Service', description: '', cost: '', provider: '' }
const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.webp'
const MAX_FILE_MB = 10

export default function AddServicePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fileInputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleFileChange(e) {
    const selected = Array.from(e.target.files)
    const oversized = selected.filter(f => f.size > MAX_FILE_MB * 1024 * 1024)
    if (oversized.length) {
      setFileError(`${oversized.map(f => f.name).join(', ')} exceed the ${MAX_FILE_MB}MB limit.`)
      return
    }
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...selected.filter(f => !names.has(f.name))]
    })
    setFileError('')
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    handleFileChange({ target: { files: dropped, value: '' } })
  }

  function removeFile(name) {
    setFiles(f => f.filter(x => x.name !== name))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: record, error: recErr } = await supabase
      .from('service_records')
      .insert({
        vehicle_id: id,
        service_date: form.service_date,
        mileage: form.mileage ? parseInt(form.mileage, 10) : null,
        service_type: form.service_type,
        description: form.description || null,
        cost: form.cost !== '' ? parseFloat(form.cost) : null,
        provider: form.provider || null,
      })
      .select()
      .single()

    if (recErr) {
      setError(recErr.message)
      setLoading(false)
      return
    }

    if (files.length) {
      await Promise.all(files.map(async file => {
        const path = `${user.id}/${id}/${record.id}/${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage
          .from('service-documents')
          .upload(path, file)

        if (!upErr) {
          await supabase.from('service_files').insert({
            service_record_id: record.id,
            file_name: file.name,
            storage_path: path,
            file_type: file.type,
            file_size: file.size,
          })
        }
      }))
    }

    setLoading(false)
    navigate(`/vehicles/${id}`)
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

          {/* ── File attachments ───────────────────────────────────────── */}
          <div className="form-group">
            <label>Attachments <span className="label-hint">(PDF, JPG, PNG, WEBP — max {MAX_FILE_MB}MB each)</span></label>
            <div
              className="upload-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <span className="upload-dropzone-icon">📎</span>
              <span>Drop files here or <span className="upload-link">browse</span></span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {fileError && <div className="alert-error" style={{ marginTop: 8 }}>{fileError}</div>}

            {files.length > 0 && (
              <ul className="upload-file-list">
                {files.map(f => (
                  <li key={f.name} className="upload-file-item">
                    <span className="upload-file-icon">{f.type === 'application/pdf' ? '📋' : '🖼️'}</span>
                    <span className="upload-file-name">{f.name}</span>
                    <span className="upload-file-size">({(f.size / 1024).toFixed(0)} KB)</span>
                    <button type="button" className="upload-file-remove" onClick={() => removeFile(f.name)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? files.length ? 'Saving & uploading…' : 'Saving…'
                : files.length
                  ? `Save + Upload ${files.length} File${files.length !== 1 ? 's' : ''}`
                  : 'Save Service Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
