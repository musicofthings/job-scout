import type { JobPosting, SearchFilters } from '../lib/types'
import type { ResultViewFilters } from '../lib/ranking'
import { filterAndSortJobs, uniqueSources } from '../lib/ranking'
import { JobCard } from './JobCard'
import { ResultFilters } from './ResultFilters'

interface Props {
  jobs: JobPosting[]
  query: string
  queries?: string[]
  loading: boolean
  error?: string
  warning?: string
  creditsUsed?: number
  rawCount?: number
  fanOutCount?: number
  searchFilters: SearchFilters
  viewFilters: ResultViewFilters
  onViewFiltersChange: (next: ResultViewFilters) => void
  onEnrich: (job: JobPosting) => Promise<void>
  enrichingId?: string | null
  onExport: () => void
}

export function ResultsList({
  jobs,
  query,
  queries,
  loading,
  error,
  warning,
  creditsUsed,
  rawCount,
  fanOutCount,
  searchFilters,
  viewFilters,
  onViewFiltersChange,
  onEnrich,
  enrichingId,
  onExport,
}: Props) {
  const visible = filterAndSortJobs(jobs, viewFilters, searchFilters)
  const sources = uniqueSources(jobs)

  return (
    <section className="panel results-panel">
      <div className="panel-head">
        <div>
          <h2>Results</h2>
          <p className="muted">
            {loading
              ? fanOutCount && fanOutCount > 1
                ? `Running fan-out across boards…`
                : 'Running Firecrawl search…'
              : jobs.length
                ? `${jobs.length} posting${jobs.length === 1 ? '' : 's'} found`
                : 'No results yet — set criteria and search.'}
            {typeof creditsUsed === 'number' ? ` · ${creditsUsed} credits used` : ''}
            {typeof rawCount === 'number' && rawCount !== jobs.length
              ? ` · ${rawCount} raw hits`
              : ''}
            {fanOutCount && fanOutCount > 1 && !loading ? ` · ${fanOutCount} board queries` : ''}
          </p>
        </div>
        {jobs.length > 0 && (
          <button type="button" className="ghost" onClick={onExport}>
            Export CSV
          </button>
        )}
      </div>

      {query && !loading && (
        <div className="used-query">
          <span>Used query{queries && queries.length > 1 ? 's' : ''}</span>
          {queries && queries.length > 1 ? (
            <ul className="query-list">
              {queries.slice(0, 6).map((q) => (
                <li key={q}>
                  <code>{q}</code>
                </li>
              ))}
              {queries.length > 6 && (
                <li className="muted tiny">+{queries.length - 6} more board queries</li>
              )}
            </ul>
          ) : (
            <code>{query}</code>
          )}
        </div>
      )}

      {error && <div className="banner error">{error}</div>}
      {warning && <div className="banner warn">{warning}</div>}

      {!loading && jobs.length > 0 && (
        <ResultFilters
          view={viewFilters}
          sources={sources}
          total={jobs.length}
          shown={visible.length}
          onChange={onViewFiltersChange}
        />
      )}

      {loading && (
        <div className="skeleton-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      )}

      {!loading && jobs.length === 0 && !error && (
        <div className="empty">
          <strong>Ready when you are</strong>
          <p>
            Job Scout searches public web job boards with your Firecrawl key. Results are
            ranked by relevance and can be filtered after search.
          </p>
        </div>
      )}

      {!loading && jobs.length > 0 && visible.length === 0 && (
        <div className="empty">
          <strong>No matches for these filters</strong>
          <p>Clear result filters or broaden the text / source chips.</p>
        </div>
      )}

      <div className="job-list">
        {visible.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            enriching={enrichingId === job.id}
            onEnrich={onEnrich}
          />
        ))}
      </div>
    </section>
  )
}
