import { useState } from 'react'
import type { JobPosting } from '../lib/types'
import { LazyImage } from './LazyImage'

interface Props {
  job: JobPosting
  onEnrich?: (job: JobPosting) => Promise<void>
  enriching?: boolean
}

const TONES = ['cream', 'sky', 'blush', 'butter', 'mint'] as const

function toneFor(id: string): (typeof TONES)[number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % TONES.length
  return TONES[h]
}

export function JobCard({ job, onEnrich, enriching }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <article className="job-card">
      <LazyImage
        src={job.imageUrl}
        alt=""
        className="job-card-media"
        aspectRatio="21 / 9"
        tone={toneFor(job.id)}
      />

      <div className="job-card-body">
        <header className="job-card-head">
          <div>
            <h3>{job.title}</h3>
            <p className="company">
              {job.company}
              <span className="dot">·</span>
              <span className="loc">{job.location}</span>
            </p>
          </div>
          <div className="job-card-badges">
            {typeof job.score === 'number' && (
              <span className="score-badge" title="Relevance score">
                {Math.round(job.score)}
              </span>
            )}
            <span className="source-badge" title={job.url}>
              {job.source}
            </span>
          </div>
        </header>

        {(job.tags.length > 0 || job.salaryHint) && (
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
      </div>
    </article>
  )
}
