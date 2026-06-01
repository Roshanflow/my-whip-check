import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { motStatus } from './vehicleUtils'
import './vehicles.css'

export default function VehiclesPage() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from('vehicles')
        .select('*, mot_records(test_date, expiry_date, result)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (err) {
        setError(err.message)
      } else {
        setVehicles(data)
      }
      setLoading(false)
    }
    load()
  }, [user.id])

  if (loading) return <div className="page-loading">Loading vehicles…</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Vehicles</h1>
        <Link to="/vehicles/new" className="btn btn-primary">+ Add Vehicle</Link>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {vehicles.length === 0 ? (
        <div className="empty-state">
          <p>No vehicles yet.</p>
          <Link to="/vehicles/new" className="btn btn-primary" style={{ marginTop: 12 }}>Add your first vehicle</Link>
        </div>
      ) : (
        <div className="vehicles-grid">
          {vehicles.map(v => {
            const latest = [...(v.mot_records || [])].sort(
              (a, b) => new Date(b.test_date) - new Date(a.test_date)
            )[0]
            const status = motStatus(latest)
            return (
              <Link to={`/vehicles/${v.id}`} key={v.id} className="vehicle-card">
                <div className="vehicle-card-header">
                  <div>
                    <div className="vehicle-card-title">
                      {v.nickname || `${v.make} ${v.model}`}
                    </div>
                    {v.nickname && (
                      <div className="vehicle-card-sub">{v.make} {v.model}</div>
                    )}
                  </div>
                  <span className={`badge badge-${v.type}`}>{v.type}</span>
                </div>
                <div className="vehicle-card-body">
                  <div className="vehicle-card-reg">{v.registration}</div>
                  <div className="vehicle-card-year">{v.year}</div>
                </div>
                <div className="vehicle-card-footer">
                  <span className={`badge badge-mot-${status.color}`}>MOT: {status.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
