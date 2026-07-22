import { useState } from 'react'
import type { SearchFilters } from '../lib/types'
import type { SavedSearch } from '../lib/savedSearches'
import { suggestSearchName } from '../lib/savedSearches'

interface Props {
  filters: SearchFilters
  saved: SavedSearch[]
  onSave: (name: string) => void
  onLoad: (entry: SavedSearch) => void
  onDelete: (id: string) => void
  onSearch: (entry: SavedSearch) => void
}

export function SavedSearches({
  filters,
  saved,
  onSave,
  onLoad,
  onDelete,
  onSearch,
}: Props) {
  const [name, setName] = useState('')
  const [open, setOpen] = useState(true)

  function handleSave() {
    const label = name.trim() || suggestSearchName(filters)
    onSave(label)
    setName('')
  }

  return (
    <section className="panel saved-panel">
      <div className="panel-head">
        <div>
          <h2>Saved searches</h2>
          <p className="muted">Store filter sets locally and re-run them later.</p>
        </div>
        <button type="button" className="ghost sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <>
          <div className="saved-save-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggestSearchName(filters)}
              aria-label="Saved search name"
            />
            <button type="button" className="primary sm" onClick={handleSave}>
              Save current
            </button>
          </div>

          {saved.length === 0 ? (
            <p className="hint">No saved searches yet.</p>
          ) : (
            <ul className="saved-list">
              {saved.map((entry) => (
                <li key={entry.id} className="saved-item">
                  <div className="saved-meta">
                    <strong>{entry.name}</strong>
                    <span className="muted tiny">
                      {entry.filters.jobTitles || entry.filters.keywords || 'Custom filters'}
                      {entry.filters.boards.length
                        ? ` · ${entry.filters.boards.length} boards`
                        : ' · open web'}
                      {entry.filters.fanOutBoards ? ' · fan-out' : ''}
                    </span>
                  </div>
                  <div className="saved-actions">
                    <button type="button" className="ghost sm" onClick={() => onLoad(entry)}>
                      Load
                    </button>
                    <button type="button" className="primary sm" onClick={() => onSearch(entry)}>
                      Run
                    </button>
                    <button
                      type="button"
                      className="ghost sm danger-text"
                      onClick={() => onDelete(entry.id)}
                      aria-label={`Delete ${entry.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
