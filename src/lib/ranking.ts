import type { JobPosting, SearchFilters } from './types'

export type SortMode = 'relevance' | 'company' | 'title' | 'source'

export interface ResultViewFilters {
  text: string
  sources: string[]
  requireSalary: boolean
  remoteOnly: boolean
  sort: SortMode
}

export const DEFAULT_VIEW_FILTERS: ResultViewFilters = {
  text: '',
  sources: [],
  requireSalary: false,
  remoteOnly: false,
  sort: 'relevance',
}

function splitTerms(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 1)
}

function haystack(job: JobPosting): string {
  return `${job.title} ${job.company} ${job.location} ${job.description} ${job.tags.join(' ')} ${job.source}`.toLowerCase()
}

/** Score a posting against the active search criteria (higher = better). */
export function scoreJob(job: JobPosting, filters: SearchFilters): number {
  let score = 0
  const text = haystack(job)
  const title = job.title.toLowerCase()

  const titles = splitTerms(filters.jobTitles.replace(/,/g, ' '))
  for (const t of titles) {
    if (title.includes(t)) score += 25
    else if (text.includes(t)) score += 10
  }

  const keywords = splitTerms(filters.keywords)
  for (const k of keywords) {
    if (title.includes(k)) score += 14
    else if (text.includes(k)) score += 6
  }

  if (filters.region.trim()) {
    const region = filters.region.trim().toLowerCase()
    if (job.location.toLowerCase().includes(region) || text.includes(region)) score += 12
  }

  if (filters.workMode === 'remote') {
    if (job.tags.includes('remote') || /remote|wfh|work from home/i.test(text)) score += 18
    else score -= 8
  } else if (filters.workMode === 'hybrid') {
    if (job.tags.includes('hybrid') || /hybrid/i.test(text)) score += 14
  } else if (filters.workMode === 'onsite') {
    if (/onsite|on-site|in[- ]office|in[- ]person/i.test(text)) score += 10
    if (job.tags.includes('remote') && !/hybrid/i.test(text)) score -= 6
  }

  const expSignals: Record<string, RegExp> = {
    internship: /\bintern(ship)?\b/i,
    entry: /\b(junior|entry[- ]level|early career|graduat)/i,
    mid: /\b(mid[- ]level|intermediate)\b/i,
    senior: /\b(senior|sr\.?)\b/i,
    lead: /\b(lead|staff|principal)\b/i,
    executive: /\b(director|vp|head of|chief|c-level|executive)\b/i,
  }
  if (filters.experience !== 'any' && expSignals[filters.experience]) {
    if (expSignals[filters.experience].test(job.title)) score += 16
    else if (expSignals[filters.experience].test(text)) score += 8
  }

  for (const role of filters.roleTypes) {
    const re = new RegExp(role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (re.test(text)) score += 5
  }

  // Prefer curated ATS hosts over generic aggregators
  const host = job.source.toLowerCase()
  if (/greenhouse|lever\.co|ashbyhq|workable|smartrecruiters/.test(host)) score += 12
  else if (/wellfound|remoteok|weworkremotely|remotive/.test(host)) score += 8
  else if (/indeed|linkedin|google/.test(host)) score += 3

  if (job.salaryHint) score += 8
  if (job.location && job.location !== 'Not specified') score += 4
  if (job.description && job.description.length > 80) score += 3
  if (job.company && job.company !== job.source) score += 3

  // Light penalty for vague / non-job pages
  if (/untitled|page not found|404/i.test(job.title)) score -= 30
  if (job.title.length < 4) score -= 10

  return score
}

export function rankJobs(jobs: JobPosting[], filters: SearchFilters): JobPosting[] {
  return [...jobs]
    .map((job) => ({ job, score: scoreJob(job, filters) }))
    .sort((a, b) => b.score - a.score || a.job.title.localeCompare(b.job.title))
    .map(({ job, score }) => ({ ...job, score }))
}

export function uniqueSources(jobs: JobPosting[]): string[] {
  return [...new Set(jobs.map((j) => j.source))].sort((a, b) => a.localeCompare(b))
}

export function filterAndSortJobs(
  jobs: JobPosting[],
  view: ResultViewFilters,
  searchFilters: SearchFilters,
): JobPosting[] {
  const q = view.text.trim().toLowerCase()
  let list = jobs.filter((job) => {
    if (view.requireSalary && !job.salaryHint) return false
    if (view.remoteOnly) {
      const text = haystack(job)
      if (!job.tags.includes('remote') && !/remote|wfh|work from home/i.test(text)) return false
    }
    if (view.sources.length && !view.sources.includes(job.source)) return false
    if (q) {
      const text = haystack(job)
      if (!text.includes(q)) return false
    }
    return true
  })

  switch (view.sort) {
    case 'company':
      list = [...list].sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title))
      break
    case 'title':
      list = [...list].sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'source':
      list = [...list].sort((a, b) => a.source.localeCompare(b.source) || a.title.localeCompare(b.title))
      break
    case 'relevance':
    default:
      list = rankJobs(list, searchFilters)
      break
  }

  return list
}
