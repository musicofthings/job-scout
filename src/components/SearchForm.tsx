import {
  COUNTRIES,
  JOB_BOARDS,
  ROLE_TYPES,
  type ExperienceLevel,
  type SearchFilters,
  type TimeRange,
  type WorkMode,
} from '../lib/types'
import { buildSearchQuery } from '../lib/queryBuilder'

interface Props {
  filters: SearchFilters
  loading: boolean
  onChange: (next: SearchFilters) => void
  onSubmit: () => void
}

export function SearchForm({ filters, loading, onChange, onSubmit }: Props) {
  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function toggleBoard(id: string) {
    const has = filters.boards.includes(id)
    set(
      'boards',
      has ? filters.boards.filter((b) => b !== id) : [...filters.boards, id],
    )
  }

  function toggleRole(role: string) {
    const has = filters.roleTypes.includes(role)
    set(
      'roleTypes',
      has ? filters.roleTypes.filter((r) => r !== role) : [...filters.roleTypes, role],
    )
  }

  const preview = buildSearchQuery(filters)

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Search criteria</h2>
          <p className="muted">Region, titles, keywords, and public job boards via Firecrawl.</p>
        </div>
      </div>

      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <label className="field span-2">
          <span>Job titles</span>
          <input
            value={filters.jobTitles}
            onChange={(e) => set('jobTitles', e.target.value)}
            placeholder="e.g. Machine Learning Engineer, Staff Scientist"
          />
        </label>

        <label className="field span-2">
          <span>Keywords / skills</span>
          <input
            value={filters.keywords}
            onChange={(e) => set('keywords', e.target.value)}
            placeholder="e.g. PyTorch, genomics, TypeScript, Kubernetes"
          />
        </label>

        <label className="field">
          <span>Region / city</span>
          <input
            value={filters.region}
            onChange={(e) => set('region', e.target.value)}
            placeholder="e.g. San Francisco, Remote Europe, Bangalore"
          />
        </label>

        <label className="field">
          <span>Country (geo)</span>
          <select
            value={filters.country}
            onChange={(e) => set('country', e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Work mode</span>
          <select
            value={filters.workMode}
            onChange={(e) => set('workMode', e.target.value as WorkMode)}
          >
            <option value="any">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </label>

        <label className="field">
          <span>Experience</span>
          <select
            value={filters.experience}
            onChange={(e) => set('experience', e.target.value as ExperienceLevel)}
          >
            <option value="any">Any</option>
            <option value="internship">Internship</option>
            <option value="entry">Entry / junior</option>
            <option value="mid">Mid-level</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead / staff</option>
            <option value="executive">Executive</option>
          </select>
        </label>

        <label className="field">
          <span>Posted within</span>
          <select
            value={filters.timeRange}
            onChange={(e) => set('timeRange', e.target.value as TimeRange)}
          >
            <option value="any">Any time</option>
            <option value="day">Past day</option>
            <option value="week">Past week</option>
            <option value="month">Past month</option>
          </select>
        </label>

        <label className="field">
          <span>Result limit</span>
          <input
            type="number"
            min={1}
            max={30}
            value={filters.limit}
            onChange={(e) => set('limit', Number(e.target.value) || 10)}
          />
        </label>

        <fieldset className="field span-2">
          <legend>Role types</legend>
          <div className="chips">
            {ROLE_TYPES.map((role) => (
              <button
                key={role}
                type="button"
                className={`chip ${filters.roleTypes.includes(role) ? 'active' : ''}`}
                onClick={() => toggleRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field span-2">
          <legend>Job boards / sources</legend>
          <div className="chips">
            {JOB_BOARDS.map((board) => (
              <button
                key={board.id}
                type="button"
                className={`chip ${filters.boards.includes(board.id) ? 'active' : ''}`}
                onClick={() => toggleBoard(board.id)}
              >
                {board.label}
              </button>
            ))}
          </div>
          <p className="hint">
            Leave several selected for broader coverage. Deselect all to search the open web
            (noisier, more credits).
          </p>
        </fieldset>

        <label className="check span-2">
          <input
            type="checkbox"
            checked={filters.scrapeContent}
            onChange={(e) => set('scrapeContent', e.target.checked)}
          />
          <span>
            Deep scrape each result (markdown + structured fields) — uses more Firecrawl credits
          </span>
        </label>

        <div className="query-preview span-2">
          <span className="label">Query preview</span>
          <code>{preview || 'Add titles or keywords to build a query…'}</code>
        </div>

        <div className="actions span-2">
          <button type="submit" className="primary lg" disabled={loading}>
            {loading ? 'Searching…' : 'Search jobs'}
          </button>
        </div>
      </form>
    </section>
  )
}
