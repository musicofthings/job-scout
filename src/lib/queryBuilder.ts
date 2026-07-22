import { JOB_BOARDS, type SearchFilters } from './types'

const EXPERIENCE_TERMS: Record<string, string> = {
  internship: 'internship OR intern',
  entry: '"entry level" OR junior OR "early career"',
  mid: '"mid level" OR "mid-level" OR intermediate',
  senior: 'senior OR sr.',
  lead: 'lead OR staff OR principal',
  executive: 'director OR VP OR "head of" OR C-level OR executive',
}

const WORK_MODE_TERMS: Record<string, string> = {
  remote: 'remote OR "work from home" OR wfh OR distributed',
  hybrid: 'hybrid',
  onsite: 'onsite OR "on-site" OR "in office" OR "in-person"',
}

const TIME_TBS: Record<string, string | undefined> = {
  any: undefined,
  day: 'qdr:d',
  week: 'qdr:w',
  month: 'qdr:m',
}

/**
 * Build a Firecrawl /search query from user filters.
 * Focuses on job postings rather than generic web noise.
 */
export function buildSearchQuery(filters: SearchFilters): string {
  const parts: string[] = []

  const titles = splitCsv(filters.jobTitles)
  if (titles.length === 1) {
    parts.push(`"${titles[0]}"`)
  } else if (titles.length > 1) {
    parts.push(`(${titles.map((t) => `"${t}"`).join(' OR ')})`)
  }

  if (filters.keywords.trim()) {
    parts.push(filters.keywords.trim())
  }

  if (filters.roleTypes.length > 0) {
    parts.push(`(${filters.roleTypes.map((r) => `"${r}"`).join(' OR ')})`)
  }

  if (filters.workMode !== 'any') {
    parts.push(WORK_MODE_TERMS[filters.workMode] ?? '')
  }

  if (filters.experience !== 'any') {
    parts.push(EXPERIENCE_TERMS[filters.experience] ?? '')
  }

  if (filters.region.trim()) {
    parts.push(`"${filters.region.trim()}"`)
  }

  // Bias toward actual openings
  parts.push('(hiring OR "job opening" OR "apply now" OR careers OR "we are hiring")')

  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

export function getIncludeDomains(filters: SearchFilters): string[] | undefined {
  if (!filters.boards.length) return undefined
  const domains = new Set<string>()
  for (const id of filters.boards) {
    const board = JOB_BOARDS.find((b) => b.id === id)
    board?.domains.forEach((d) => domains.add(d))
  }
  return domains.size ? [...domains] : undefined
}

export function getTimeTbs(filters: SearchFilters): string | undefined {
  return TIME_TBS[filters.timeRange]
}

export function getLocationParam(filters: SearchFilters): string | undefined {
  const region = filters.region.trim()
  if (!region) return undefined
  // Firecrawl location examples: "Germany", "San Francisco,California,United States"
  return region
}

function splitCsv(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
