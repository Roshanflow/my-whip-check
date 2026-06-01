import { useState } from 'react'
import '../mot/mot.css'

const PREVIEW_COUNT = 2

export default function MotNotes({ notes, label = 'advisory' }) {
  const [expanded, setExpanded] = useState(false)

  if (!notes) return <span className="mot-notes-empty">—</span>

  const lines = notes.split('\n').map(l => l.trim()).filter(Boolean)

  if (lines.length === 0) return <span className="mot-notes-empty">—</span>

  const visible = expanded ? lines : lines.slice(0, PREVIEW_COUNT)
  const hidden = lines.length - PREVIEW_COUNT

  return (
    <div className="mot-notes">
      <ul className="mot-notes-list">
        {visible.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {lines.length > PREVIEW_COUNT && (
        <button
          className="mot-notes-toggle"
          onClick={() => setExpanded(e => !e)}
          type="button"
        >
          {expanded
            ? 'Show less'
            : `+ ${hidden} more ${label}${hidden !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}
