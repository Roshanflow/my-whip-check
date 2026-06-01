import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate, motStatus } from './vehicleUtils'
import MotNotes from './MotNotes'
import './vehicles.css'

export default function VehicleDetailPage() {
  const { id } = useParams()
  const [vehicle, setVehicle] = useState(null)
  const [motRecords, setMotRecords] = useState([])
  const [serviceRecords, setServiceRecords] = useState([])
  const [tab, setTab] = useState('mot')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // DVSA import flow state
  const [showImport, setShowImport] = useState(false)
  const [importPlate, setImportPlate] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [preview, setPreview] = useState(null)   // { records: [], skipped: [] }
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    async function load() {
      const [vRes, motRes, svcRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('id', id).single(),
        supabase.from('mot_records').select('*').eq('vehicle_id', id).order('test_date', { ascending: false }),
        supabase.from('service_records').select('*').eq('vehicle_id', id).order('service_date', { ascending: false }),
      ])
      if (vRes.error) { setError(vRes.error.message) }
      else {
        setVehicle(vRes.data)
        setMotRecords(motRes.data || [])
        setServiceRecords(svcRes.data || [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  function openImport() {
    setShowImport(true)
    setImportPlate(vehicle?.registration ?? '')
    setFetchError('')
    setPreview(null)
  }

  function closeImport() {
    setShowImport(false)
    setImportPlate('')
    setFetchError('')
    setPreview(null)
  }

  async function handleFetch(e) {
    e.preventDefault()
    if (!importPlate.trim()) return
    setFetching(true)
    setFetchError('')
    setPreview(null)

    const { data, error: fnErr } = await supabase.functions.invoke('lookup-vehicle', {
      body: { registration: importPlate.trim() },
    })

    setFetching(false)
    console.log('[DEBUG] raw first DVSA test record:', JSON.stringify(data?._rawFirstTest, null, 2))

    if (fnErr || data?.error) {
      setFetchError(data?.error ?? fnErr?.message ?? 'Could not fetch MOT history. Check the plate and try again.')
      return
    }

    const history = data?.motHistory ?? []
    if (history.length === 0) {
      setFetchError('No MOT history found for this registration.')
      return
    }

    // Normalise dates to YYYY-MM-DD (DVSA may return full ISO timestamps)
    const toDateStr = (val) => val ? String(val).slice(0, 10) : null
    const normalised = history.map(r => ({ ...r, test_date: toDateStr(r.test_date), expiry_date: toDateStr(r.expiry_date) }))

    // Build lookup maps from existing DB records
    const existingByTestNumber = new Map(
      motRecords.filter(r => r.mot_test_number).map(r => [r.mot_test_number, r])
    )
    const manualDates = new Set(
      motRecords.filter(r => !r.mot_test_number).map(r => toDateStr(r.test_date))
    )

    const toInsert = []   // new records from DVSA not yet in DB
    const toUpdate = []   // existing DVSA records — refresh values from source of truth
    const skipped = []    // manually-added records — leave untouched

    for (const r of normalised) {
      if (r.mot_test_number && existingByTestNumber.has(r.mot_test_number)) {
        toUpdate.push({ ...r, id: existingByTestNumber.get(r.mot_test_number).id })
      } else if (!r.mot_test_number && manualDates.has(r.test_date)) {
        skipped.push(r)
      } else {
        toInsert.push(r)
      }
    }

    setPreview({ toInsert, toUpdate, skipped })
  }

  async function handleConfirm() {
    const hasWork = preview?.toInsert?.length || preview?.toUpdate?.length
    if (!hasWork) return
    setConfirming(true)

    let insertedRows = []
    let confirmError = null

    // Insert brand-new records
    if (preview.toInsert.length) {
      const { data, error: insErr } = await supabase
        .from('mot_records')
        .insert(preview.toInsert.map(r => ({ ...r, vehicle_id: id })))
        .select()
      if (insErr) confirmError = insErr.message
      else insertedRows = data || []
    }

    // Update existing DVSA records with fresh values from source of truth
    if (!confirmError && preview.toUpdate.length) {
      for (const r of preview.toUpdate) {
        const { id: recordId, ...fields } = r
        const { error: updErr } = await supabase
          .from('mot_records')
          .update({ ...fields, vehicle_id: id })
          .eq('id', recordId)
        if (updErr) { confirmError = updErr.message; break }
      }
    }

    setConfirming(false)

    if (confirmError) {
      setFetchError(confirmError)
      return
    }

    // Refresh local state: merge inserts + updated values
    setMotRecords(prev => {
      const updatedIds = new Set(preview.toUpdate.map(r => r.id))
      const kept = prev.filter(r => !updatedIds.has(r.id))
      const updatedRows = preview.toUpdate.map(r => {
        const { id: recordId, ...fields } = r
        return { ...fields, id: recordId, vehicle_id: id }
      })
      return [...insertedRows, ...updatedRows, ...kept].sort(
        (a, b) => new Date(b.test_date) - new Date(a.test_date)
      )
    })
    closeImport()
  }

  async function deleteMot(motId) {
    if (!confirm('Delete this MOT record?')) return
    await supabase.from('mot_records').delete().eq('id', motId)
    setMotRecords(r => r.filter(m => m.id !== motId))
  }

  async function deleteService(svcId) {
    if (!confirm('Delete this service record?')) return
    await supabase.from('service_records').delete().eq('id', svcId)
    setServiceRecords(r => r.filter(s => s.id !== svcId))
  }

  if (loading) return <div className="page-loading">Loading…</div>
  if (error) return <div className="page"><div className="alert-error">{error}</div></div>

  const latest = motRecords[0]
  const status = motStatus(latest)

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/" className="back-link">← My Vehicles</Link>
        <Link to={`/vehicles/${id}/edit`} className="btn btn-secondary">Edit Vehicle</Link>
      </div>

      <div className="vehicle-detail-hero">
        <div>
          <h1 className="page-title">
            {vehicle.nickname || `${vehicle.make} ${vehicle.model}`}
          </h1>
          {vehicle.nickname && (
            <div className="vehicle-detail-sub">{vehicle.make} {vehicle.model}</div>
          )}
          <div className="vehicle-detail-meta">
            <span className={`badge badge-${vehicle.type}`}>{vehicle.type}</span>
            <span className="vehicle-detail-reg">{vehicle.registration}</span>
            <span className="vehicle-detail-year">{vehicle.year}</span>
            {vehicle.color && <span className="vehicle-detail-color">{vehicle.color}</span>}
          </div>
        </div>
        <div className={`mot-status-pill mot-status-${status.color}`}>
          MOT: {status.label}
        </div>
      </div>

      {vehicle.notes && <div className="vehicle-notes">{vehicle.notes}</div>}

      <div className="tabs">
        <button className={`tab${tab === 'mot' ? ' active' : ''}`} onClick={() => setTab('mot')}>
          MOT History ({motRecords.length})
        </button>
        <button className={`tab${tab === 'service' ? ' active' : ''}`} onClick={() => setTab('service')}>
          Service History ({serviceRecords.length})
        </button>
      </div>

      {tab === 'mot' && (
        <div>
          <div className="section-action">
            <button className="btn btn-secondary btn-sm" onClick={openImport}>
              🏛 Import from DVSA
            </button>
            <Link to={`/vehicles/${id}/mot/new`} className="btn btn-primary btn-sm">+ Add MOT</Link>
          </div>

          {/* ── DVSA Import Panel ─────────────────────────────────────── */}
          {showImport && (
            <div className="import-panel">
              <div className="import-panel-header">
                <div className="import-panel-title">Import MOT History from DVSA</div>
                <button className="import-panel-close" onClick={closeImport}>✕</button>
              </div>

              {!preview ? (
                <>
                  <p className="import-panel-desc">
                    Enter the vehicle registration plate to pull its full MOT history from the DVSA government database.
                  </p>
                  <form onSubmit={handleFetch} className="import-plate-form">
                    <input
                      className="lookup-input"
                      value={importPlate}
                      onChange={e => setImportPlate(e.target.value.toUpperCase())}
                      placeholder="e.g. AB12 CDE"
                      maxLength={8}
                      autoFocus
                    />
                    <button type="submit" className="btn btn-primary" disabled={fetching || !importPlate.trim()}>
                      {fetching ? 'Fetching…' : 'Fetch MOT History'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={closeImport}>Cancel</button>
                  </form>
                  {fetchError && <div className="alert-error" style={{ marginTop: 12 }}>{fetchError}</div>}
                </>
              ) : (
                <>
                  <div className="import-preview-title">
                    Review MOT History for <strong>{importPlate}</strong>
                  </div>

                  {preview.toInsert.length === 0 && preview.toUpdate.length === 0 ? (
                    <div className="alert-error" style={{ marginBottom: 12 }}>
                      No changes to make — all DVSA records match what's already stored.
                      {preview.skipped.length > 0 && ` ${preview.skipped.length} manually-added record${preview.skipped.length !== 1 ? 's' : ''} left unchanged.`}
                    </div>
                  ) : (
                    <>
                      <p className="import-panel-desc">
                        {preview.toInsert.length > 0 && <><strong>{preview.toInsert.length} new</strong> record{preview.toInsert.length !== 1 ? 's' : ''} to add. </>}
                        {preview.toUpdate.length > 0 && <><strong>{preview.toUpdate.length}</strong> existing record{preview.toUpdate.length !== 1 ? 's' : ''} will be refreshed from DVSA. </>}
                        {preview.skipped.length > 0 && <>{preview.skipped.length} manually-added record{preview.skipped.length !== 1 ? 's' : ''} left unchanged.</>}
                      </p>
                      <div className="table-wrap" style={{ marginBottom: 16 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Status</th>
                              <th>Test Date</th>
                              <th>Result</th>
                              <th>Expiry</th>
                              <th>Mileage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.toInsert.map((m, i) => (
                              <tr key={`new-${i}`}>
                                <td><span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>New</span></td>
                                <td>{formatDate(m.test_date)}</td>
                                <td><span className={`badge badge-${m.result}`}>{m.result}</span></td>
                                <td>{formatDate(m.expiry_date)}</td>
                                <td>{m.mileage ? m.mileage.toLocaleString() + ' mi' : '—'}</td>
                              </tr>
                            ))}
                            {preview.toUpdate.map((m, i) => (
                              <tr key={`upd-${i}`}>
                                <td><span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Update</span></td>
                                <td>{formatDate(m.test_date)}</td>
                                <td><span className={`badge badge-${m.result}`}>{m.result}</span></td>
                                <td>{formatDate(m.expiry_date)}</td>
                                <td>{m.mileage ? m.mileage.toLocaleString() + ' mi' : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {fetchError && <div className="alert-error" style={{ marginBottom: 12 }}>{fetchError}</div>}

                  <div className="form-actions">
                    {(preview.toInsert.length > 0 || preview.toUpdate.length > 0) && (
                      <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={confirming}
                      >
                        {confirming ? 'Saving…' : `Confirm (${preview.toInsert.length} new, ${preview.toUpdate.length} updated)`}
                      </button>
                    )}
                    <button className="btn btn-secondary" onClick={closeImport}>Cancel</button>
                    <button className="btn btn-secondary" onClick={() => setPreview(null)}>← Change Plate</button>
                  </div>
                </>
              )}
            </div>
          )}

          {motRecords.length === 0 ? (
            <div className="empty-state">No MOT records yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Test Date</th>
                    <th>Result</th>
                    <th>Expiry</th>
                    <th>Mileage</th>
                    <th>Advisory Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {motRecords.map(m => (
                    <tr key={m.id}>
                      <td>{formatDate(m.test_date)}</td>
                      <td><span className={`badge badge-${m.result}`}>{m.result}</span></td>
                      <td>{formatDate(m.expiry_date)}</td>
                      <td>{m.mileage ? m.mileage.toLocaleString() + ' mi' : '—'}</td>
                      <td>
                        <MotNotes notes={m.advisory_notes} label="advisory" />
                        {m.failure_reasons && (
                          <MotNotes notes={m.failure_reasons} label="failure" />
                        )}
                      </td>
                      <td className="cell-actions">
                        <Link to={`/vehicles/${id}/mot/${m.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'service' && (
        <div>
          <div className="section-action">
            <Link to={`/vehicles/${id}/service/new`} className="btn btn-primary btn-sm">+ Add Service</Link>
          </div>
          {serviceRecords.length === 0 ? (
            <div className="empty-state">No service records yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Mileage</th>
                    <th>Cost</th>
                    <th>Provider</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRecords.map(s => (
                    <tr key={s.id}>
                      <td>{formatDate(s.service_date)}</td>
                      <td>{s.service_type}</td>
                      <td>{s.mileage ? s.mileage.toLocaleString() + ' mi' : '—'}</td>
                      <td>{s.cost != null ? `£${Number(s.cost).toFixed(2)}` : '—'}</td>
                      <td>{s.provider || '—'}</td>
                      <td className="cell-actions">
                        <Link to={`/vehicles/${id}/service/${s.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
