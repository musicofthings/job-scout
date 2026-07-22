import { useMemo, useState } from 'react'
import type { JobPosting } from '../lib/types'
import { buildJobImageCandidates, jobMediaVariant } from '../lib/companyMedia'
import { LazyImage } from './LazyImage'

interface Props {
  job: JobPosting
  onEnrich?: (job: JobPosting) => Promise<void>
  enriching?: boolean
  onCheckActive?: (job: JobPosting) => void
  checkingActive?: boolean
}

const TONES = ['cream', 'sky', 'blush', 'butter', 'mint'] as const

function toneFor(id: string): (typeof TONES)[number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % TONES.length
  return TONES[h]
}

export function JobCard({
  job,
  onEnrich,
  enriching,
  onCheckActive,
  checkingActive,
}: Props) {
  const [open, setOpen] = useState(false)
  const sources = useMemo(() => buildJobImageCandidates(job), [job])
  const variant = useMemo(() => {
    if (job.imageUrl && jobMediaVariant(job) === 'cover') return 'cover' as const
    return 'logo' as const
  }, [job])

  return (
    <article className="job-card">
      <LazyImage
        sources={sources}
        alt={`${job.company} logo`}
        className="job-card-media"
        aspectRatio="21 / 9"
        tone={toneFor(job.id)}
        variant={variant}
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
            {job.activeStatus && (
              <span
                className={`active-badge status-${job.activeStatus}`}
                title={job.activeReason || job.activeStatus}
              >
                {job.activeStatus === 'active'
                  ? 'Active'
                  : job.activeStatus === 'inactive'
                    ? 'Inactive'
                    : 'Unknown'}
              </span>
            )}
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
          {onCheckActive && (
            <button
              type="button"
              className="ghost sm"
              disabled={checkingActive}
              onClick={() => onCheckActive(job)}
            >
              {checkingActive
                ? 'Checking…'
                : job.activeStatus
                  ? 'Re-check active'
                  : 'Is it active?'}
            </button>
          )}
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
