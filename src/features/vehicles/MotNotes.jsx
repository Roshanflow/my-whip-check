import { Link } from 'react-router-dom'
import '../mot/mot.css'

const PREVIEW_COUNT = 3

export default function MotNotes({ notes, label = 'advisory', detailPath = null }) {
  if (!notes) return <span className="mot-notes-empty">—</span>

  const lines = notes.split('\n').map(l => l.trim()).filter(Boolean)

  if (lines.length === 0) return <span className="mot-notes-empty">—</span>

  const overflow = lines.length > PREVIEW_COUNT
  const visible = overflow ? lines.slice(0, PREVIEW_COUNT) : lines
  const hidden = lines.length - PREVIEW_COUNT

  return (
    <div className="mot-notes">
      <ul className="mot-notes-list">
        {visible.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {overflow && detailPath && (
        <Link className="mot-notes-toggle" to={detailPath}>
          + {hidden} more {label}{hidden !== 1 ? 's' : ''} — view all →
        </Link>
      )}
      {overflow && !detailPath && (
        <span className="mot-notes-more">+ {hidden} more {label}{hidden !== 1 ? 's' : ''}</span>
      )}
    </div>
  )
}
