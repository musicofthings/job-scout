import type { ActiveFilter, ResultViewFilters, SortMode } from '../lib/ranking'

interface Props {
  view: ResultViewFilters
  sources: string[]
  total: number
  shown: number
  checkingActive?: boolean
  activeCheckedCount?: number
  onChange: (next: ResultViewFilters) => void
  onCheckActive?: () => void
}

export function ResultFilters({
  view,
  sources,
  total,
  shown,
  checkingActive,
  activeCheckedCount = 0,
  onChange,
  onCheckActive,
}: Props) {
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
        <label className="field">
          <span>Still active?</span>
          <select
            value={view.activeFilter}
            onChange={(e) => set('activeFilter', e.target.value as ActiveFilter)}
          >
            <option value="any">Any status</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="unknown">Unchecked / unknown</option>
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
        {onCheckActive && (
          <button
            type="button"
            className="chip chip-action"
            disabled={checkingActive}
            onClick={onCheckActive}
            title="Scrapes each posting (uses Firecrawl credits)"
          >
            {checkingActive
              ? 'Checking active…'
              : activeCheckedCount
                ? `Re-check active (${activeCheckedCount}/${total})`
                : 'Check if still active'}
          </button>
        )}
        {view.sources.length > 0 && (
          <button type="button" className="chip" onClick={() => set('sources', [])}>
            Clear sources
          </button>
        )}
        <span className="muted tiny filter-count">
          Showing {shown} of {total}
        </span>
      </div>

      {view.activeFilter === 'active' && activeCheckedCount === 0 && (
        <p className="hint">
          Run <strong>Check if still active</strong> first — unverified jobs are treated as
          unknown and hidden by this filter.
        </p>
      )}

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
