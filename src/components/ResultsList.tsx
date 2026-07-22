import type { JobPosting } from '../lib/types'
import { JobCard } from './JobCard'

interface Props {
  jobs: JobPosting[]
  query: string
  loading: boolean
  error?: string
  warning?: string
  creditsUsed?: number
  rawCount?: number
  onEnrich: (job: JobPosting) => Promise<void>
  enrichingId?: string | null
  onExport: () => void
}

export function ResultsList({
  jobs,
  query,
  loading,
  error,
  warning,
  creditsUsed,
  rawCount,
  onEnrich,
  enrichingId,
  onExport,
}: Props) {
  return (
    <section className="panel results-panel">
      <div className="panel-head">
        <div>
          <h2>Results</h2>
          <p className="muted">
            {loading
              ? 'Running Firecrawl search…'
              : jobs.length
                ? `${jobs.length} posting${jobs.length === 1 ? '' : 's'} found`
                : 'No results yet — set criteria and search.'}
            {typeof creditsUsed === 'number' ? ` · ${creditsUsed} credits used` : ''}
            {typeof rawCount === 'number' && rawCount !== jobs.length
              ? ` · ${rawCount} raw hits`
              : ''}
          </p>
        </div>
        {jobs.length > 0 && (
          <button type="button" className="ghost" onClick={onExport}>
            Export CSV
          </button>
        )}
      </div>

      {query && !loading && (
        <p className="used-query">
          <span>Used query</span>
          <code>{query}</code>
        </p>
      )}

      {error && <div className="banner error">{error}</div>}
      {warning && <div className="banner warn">{warning}</div>}

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
            normalized into cards you can open or export.
          </p>
        </div>
      )}

      <div className="job-list">
        {jobs.map((job) => (
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
