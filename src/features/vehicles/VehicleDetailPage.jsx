import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate, motStatus } from './vehicleUtils'
import './vehicles.css'

export default function VehicleDetailPage() {
  const { id } = useParams()
  const [vehicle, setVehicle] = useState(null)
  const [motRecords, setMotRecords] = useState([])
  const [serviceRecords, setServiceRecords] = useState([])
  const [tab, setTab] = useState('mot')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

      {vehicle.notes && (
        <div className="vehicle-notes">{vehicle.notes}</div>
      )}

      <div className="tabs">
        <button
          className={`tab${tab === 'mot' ? ' active' : ''}`}
          onClick={() => setTab('mot')}
        >
          MOT History ({motRecords.length})
        </button>
        <button
          className={`tab${tab === 'service' ? ' active' : ''}`}
          onClick={() => setTab('service')}
        >
          Service History ({serviceRecords.length})
        </button>
      </div>

      {tab === 'mot' && (
        <div>
          <div className="section-action">
            <Link to={`/vehicles/${id}/mot/new`} className="btn btn-primary btn-sm">+ Add MOT</Link>
          </div>
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
                      <td className="cell-notes">{m.advisory_notes || '—'}</td>
                      <td className="cell-actions">
                        <Link to={`/vehicles/${id}/mot/${m.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                        <button onClick={() => deleteMot(m.id)} className="btn btn-danger btn-sm">Del</button>
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
                        <button onClick={() => deleteService(s.id)} className="btn btn-danger btn-sm">Del</button>
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
