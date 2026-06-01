import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import './vehicles.css'

const EMPTY = { nickname: '', make: '', model: '', year: '', type: 'car', registration: '', color: '', notes: '' }

export default function AddVehiclePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Plate lookup state
  const [plate, setPlate] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [importingMot, setImportingMot] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleLookup(e) {
    e.preventDefault()
    if (!plate.trim()) return
    setLookupError('')
    setLookupResult(null)
    setLookupLoading(true)

    const { data, error: err } = await supabase.functions.invoke('lookup-vehicle', {
      body: { registration: plate.trim() },
    })

    setLookupLoading(false)

    if (err || data?.error) {
      setLookupError(data?.error ?? err?.message ?? 'Lookup failed. Check the plate and try again.')
      return
    }

    setLookupResult(data)

    const v = data.vehicle
    if (!v) return  // DVLA not configured — MOT history may still have loaded

    // Derive vehicle type from DVLA typeApproval or DVSA vehicleType
    const approval = String(v.typeApproval ?? '').toUpperCase()
    const wp = String(v.wheelplan ?? '').toUpperCase()
    const derivedType = v.vehicleType ?? (approval.startsWith('L') || wp.includes('2 WHEEL') ? 'bike' : 'car')

    setForm(f => ({
      ...f,
      make: v.make || f.make,
      model: v.model || f.model,
      color: v.colour || f.color,
      year: v.year ? String(v.year) : f.year,
      registration: v.registration || f.registration,
      type: derivedType,
    }))
  }

  async function handleImportMot(vehicleId) {
    const records = lookupResult?.motHistory ?? []
    if (records.length === 0) return
    setImportingMot(true)
    await supabase.from('mot_records').insert(
      records.map(r => ({ ...r, vehicle_id: vehicleId }))
    )
    setImportingMot(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Prevent duplicate vehicles by registration plate
    const { data: existing } = await supabase
      .from('vehicles')
      .select('id')
      .eq('user_id', user.id)
      .eq('registration', form.registration.toUpperCase())
      .maybeSingle()

    if (existing) {
      setError('A vehicle with this registration is already in your garage.')
      setLoading(false)
      return
    }

    const { data, error: err } = await supabase.from('vehicles').insert({
      user_id: user.id,
      nickname: form.nickname || null,
      make: form.make,
      model: form.model,
      year: parseInt(form.year, 10),
      type: form.type,
      registration: form.registration.toUpperCase(),
      color: form.color || null,
      notes: form.notes || null,
    }).select().single()

    if (err) {
      setLoading(false)
      setError(err.message)
      return
    }

    // Import MOT history if available
    if (lookupResult?.motHistory?.length) {
      await handleImportMot(data.id)
    }

    setLoading(false)
    navigate(`/vehicles/${data.id}`)
  }

  const motCount = lookupResult?.motHistory?.length ?? 0

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Add Vehicle</h1>
        <Link to="/" className="btn btn-secondary">Cancel</Link>
      </div>

      {/* ── Plate Lookup ──────────────────────────────────────────────── */}
      <div className="lookup-card">
        <div className="lookup-title">Look up from registration plate</div>
        <div className="lookup-subtitle">
          Auto-fills vehicle details from the DVLA database.
          {motCount > 0 && ' MOT history will be imported automatically.'}
        </div>
        <form onSubmit={handleLookup} className="lookup-form">
          <input
            className="lookup-input"
            value={plate}
            onChange={e => setPlate(e.target.value.toUpperCase())}
            placeholder="e.g. AB12 CDE"
            maxLength={8}
          />
          <button type="submit" className="btn btn-primary" disabled={lookupLoading || !plate.trim()}>
            {lookupLoading ? 'Looking up…' : 'Lookup'}
          </button>
        </form>

        {lookupError && <div className="alert-error" style={{ marginTop: 12 }}>{lookupError}</div>}

        {lookupResult && (
          <div className="lookup-result">
            <span className="lookup-result-icon">✓</span>
            <div>
              {lookupResult.vehicle ? (
                <>
                  <strong>{lookupResult.vehicle.make}{lookupResult.vehicle.model ? ` ${lookupResult.vehicle.model}` : ''}</strong>
                  {lookupResult.vehicle.year && ` · ${lookupResult.vehicle.year}`}
                  {lookupResult.vehicle.colour && ` · ${lookupResult.vehicle.colour}`}
                  {lookupResult.vehicle.fuelType && ` · ${lookupResult.vehicle.fuelType}`}
                </>
              ) : (
                <span>Registration found</span>
              )}
              {motCount > 0 && (
                <span className="lookup-mot-count"> · {motCount} MOT record{motCount !== 1 ? 's' : ''} found</span>
              )}
              {motCount === 0 && <span className="lookup-mot-none"> · No MOT history found</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── Vehicle Form ──────────────────────────────────────────────── */}
      <div className="form-card" style={{ marginTop: 20 }}>
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="make">Make *</label>
              <input id="make" value={form.make} onChange={e => set('make', e.target.value)} placeholder="e.g. Ford" required />
            </div>
            <div className="form-group">
              <label htmlFor="model">Model *</label>
              <input id="model" value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g. Focus" required autoFocus={!!lookupResult} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="year">Year *</label>
              <input id="year" type="number" value={form.year} onChange={e => set('year', e.target.value)} placeholder="e.g. 2018" min="1900" max="2100" required />
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
              <input id="registration" value={form.registration} onChange={e => set('registration', e.target.value)} placeholder="e.g. AB12 CDE" required />
            </div>
            <div className="form-group">
              <label htmlFor="color">Colour</label>
              <input id="color" value={form.color} onChange={e => set('color', e.target.value)} placeholder="e.g. Midnight Blue" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="nickname">Nickname (optional)</label>
            <input id="nickname" value={form.nickname} onChange={e => set('nickname', e.target.value)} placeholder="e.g. The Daily Driver" />
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any additional notes…" />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading || importingMot}>
              {loading || importingMot
                ? importingMot ? 'Importing MOT history…' : 'Saving…'
                : motCount > 0
                  ? `Add Vehicle + Import ${motCount} MOT Record${motCount !== 1 ? 's' : ''}`
                  : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
