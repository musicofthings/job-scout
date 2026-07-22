import type { ResultViewFilters, SortMode } from '../lib/ranking'

interface Props {
  view: ResultViewFilters
  sources: string[]
  total: number
  shown: number
  onChange: (next: ResultViewFilters) => void
}

export function ResultFilters({ view, sources, total, shown, onChange }: Props) {
  function set<K extends keyof ResultViewFilters>(key: K, value: ResultViewFilters[K]) {
    onChange({ ...view, [key]: value })
  }

  function toggleSource(source: string) {
    const has = view.sources.includes(source)
    set(
      'sources',
      has ? view.sources.filter((s) => s !== source) : [...view.sources, source],
    )
  }

  if (total === 0) return null

  return (
    <div className="result-filters">
      <div className="result-filters-row">
        <label className="field grow">
          <span>Filter results</span>
          <input
            value={view.text}
            onChange={(e) => set('text', e.target.value)}
            placeholder="Company, title, skill…"
          />
        </label>
        <label className="field">
          <span>Sort</span>
          <select
            value={view.sort}
            onChange={(e) => set('sort', e.target.value as SortMode)}
          >
            <option value="relevance">Relevance</option>
            <option value="company">Company A–Z</option>
            <option value="title">Title A–Z</option>
            <option value="source">Source</option>
          </select>
        </label>
      </div>

      <div className="result-filters-row chips-row">
        <button
          type="button"
          className={`chip ${view.requireSalary ? 'active' : ''}`}
          onClick={() => set('requireSalary', !view.requireSalary)}
        >
          Has salary
        </button>
        <button
          type="button"
          className={`chip ${view.remoteOnly ? 'active' : ''}`}
          onClick={() => set('remoteOnly', !view.remoteOnly)}
        >
          Remote only
        </button>
        {view.sources.length > 0 && (
          <button type="button" className="chip" onClick={() => set('sources', [])}>
            Clear sources
          </button>
        )}
        <span className="muted tiny filter-count">
          Showing {shown} of {total}
        </span>
      </div>

      {sources.length > 1 && (
        <div className="chips source-chips">
          {sources.map((source) => (
            <button
              key={source}
              type="button"
              className={`chip ${view.sources.includes(source) ? 'active' : ''}`}
              onClick={() => toggleSource(source)}
              title={source}
            >
              {source}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
