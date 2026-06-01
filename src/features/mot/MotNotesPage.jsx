import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../vehicles/vehicleUtils'
import './mot.css'

const TYPE_META = {
  ADVISORY:     { label: 'Advisory',   color: 'amber'  },
  'USER ENTERED': { label: 'Advisory', color: 'amber'  },
  MONITOR:      { label: 'Monitor',    color: 'amber'  },
  MINOR:        { label: 'Minor',      color: 'blue'   },
  MAJOR:        { label: 'Major',      color: 'red'    },
  DANGEROUS:    { label: 'Dangerous',  color: 'red'    },
  FAIL:         { label: 'Fail',       color: 'red'    },
  PRS:          { label: 'PRS',        color: 'orange' },
}

function parseNotes(text, defaultColor) {
  if (!text) return []
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => ({ text: line, color: defaultColor }))
}

export default function MotNotesPage() {
  const { id, motId } = useParams()
  const [mot, setMot] = useState(null)
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [vRes, mRes] = await Promise.all([
        supabase.from('vehicles').select('id, make, model, nickname, registration').eq('id', id).single(),
        supabase.from('mot_records').select('*').eq('id', motId).single(),
      ])
      if (vRes.error || mRes.error) {
        setError(vRes.error?.message ?? mRes.error?.message)
      } else {
        setVehicle(vRes.data)
        setMot(mRes.data)
      }
      setLoading(false)
    }
    load()
  }, [id, motId])

  if (loading) return <div className="page-loading">Loading…</div>
  if (error)   return <div className="page"><div className="alert-error">{error}</div></div>

  const advisories = parseNotes(mot.advisory_notes, 'amber')
  const failures   = parseNotes(mot.failure_reasons, 'red')
  const allItems   = [...failures, ...advisories]

  const vehicleName = vehicle.nickname || `${vehicle.make} ${vehicle.model}`

  return (
    <div className="page">
      <div className="page-header">
        <Link to={`/vehicles/${id}`} className="back-link">← {vehicleName}</Link>
      </div>

      <div className="page-title-row">
        <h1 className="page-title">MOT Notes</h1>
        <div className="mot-notes-page-meta">
          <span className="vehicle-detail-reg">{vehicle.registration}</span>
          <span className={`badge badge-${mot.result}`}>{mot.result}</span>
          <span>{formatDate(mot.test_date)}</span>
          {mot.mileage && <span>{mot.mileage.toLocaleString()} mi</span>}
        </div>
      </div>

      {allItems.length === 0 ? (
        <div className="empty-state">No notes recorded for this MOT test.</div>
      ) : (
        <div className="mot-timeline">
          {allItems.map((item, i) => (
            <div key={i} className={`mot-timeline-item mot-timeline-${item.color}`}>
              <div className="mot-timeline-dot" />
              <div className="mot-timeline-body">
                <p className="mot-timeline-text">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
