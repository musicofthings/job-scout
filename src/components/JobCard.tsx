import { useState } from 'react'
import type { JobPosting } from '../lib/types'

interface Props {
  job: JobPosting
  onEnrich?: (job: JobPosting) => Promise<void>
  enriching?: boolean
}

export function JobCard({ job, onEnrich, enriching }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <article className="job-card">
      <header className="job-card-head">
        <div>
          <h3>{job.title}</h3>
          <p className="company">
            {job.company}
            <span className="dot">·</span>
            <span className="loc">{job.location}</span>
          </p>
        </div>
        <span className="source-badge" title={job.url}>
          {job.source}
        </span>
      </header>

      {job.tags.length > 0 && (
        <div className="tags">
          {job.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
          {job.salaryHint && <span className="tag salary">{job.salaryHint}</span>}
        </div>
      )}

      <p className="desc">{job.description || 'No snippet available.'}</p>

      {open && job.markdown && (
        <pre className="md-preview">{job.markdown.slice(0, 4000)}</pre>
      )}

      <footer className="job-actions">
        <a className="primary sm" href={job.url} target="_blank" rel="noreferrer">
          Open posting
        </a>
        {job.markdown && (
          <button type="button" className="ghost sm" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide content' : 'Show scraped content'}
          </button>
        )}
        {onEnrich && (
          <button
            type="button"
            className="ghost sm"
            disabled={enriching}
            onClick={() => onEnrich(job)}
          >
            {enriching ? 'Enriching…' : 'Enrich details'}
          </button>
        )}
      </footer>
    </article>
  )
}
