import type {
  ActiveCheckResponse,
  DigestSubscribeResponse,
  JobPosting,
  ScrapeJobResponse,
  SearchFilters,
  SearchResponse,
} from './types'
import { JOB_BOARDS } from './types'
import { buildSearchQuery, getIncludeDomains, getLocationParam, getTimeTbs } from './queryBuilder'
import { rankJobs } from './ranking'

interface SearchRequestBody {
  query: string
  limit: number
  country: string
  location?: string
  tbs?: string
  includeDomains?: string[]
  scrapeContent: boolean
}

async function postSearch(
  apiKey: string,
  body: SearchRequestBody,
): Promise<SearchResponse> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firecrawl-Key': apiKey,
    },
    body: JSON.stringify(body),
  })

  const data = (await res.json()) as SearchResponse
  if (!res.ok) {
    return {
      success: false,
      query: body.query,
      jobs: [],
      error: data.error || `Request failed (${res.status})`,
      creditsUsed: data.creditsUsed,
    }
  }
  return data
}

function dedupeJobs(jobs: JobPosting[]): JobPosting[] {
  const seen = new Set<string>()
  const out: JobPosting[] = []
  for (const job of jobs) {
    const key = job.url || job.id
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(job)
  }
  return out
}

/**
 * Search jobs. When fanOutBoards is on and multiple boards are selected,
 * runs one Firecrawl search per board (or open web if none), merges, ranks, and slices.
 */
export async function searchJobs(
  apiKey: string,
  filters: SearchFilters,
): Promise<SearchResponse> {
  const query = buildSearchQuery(filters)
  const base = {
    query,
    country: filters.country || 'US',
    location: getLocationParam(filters),
    tbs: getTimeTbs(filters),
    scrapeContent: filters.scrapeContent,
  }

  const shouldFanOut = filters.fanOutBoards && filters.boards.length > 1

  if (!shouldFanOut) {
    const res = await postSearch(apiKey, {
      ...base,
      limit: filters.limit,
      includeDomains: getIncludeDomains(filters),
    })
    if (!res.success) return res
    const ranked = rankJobs(res.jobs, filters).slice(0, filters.limit)
    return {
      ...res,
      query,
      queries: [query],
      jobs: ranked,
      fanOutCount: 1,
    }
  }

  // Cap concurrent fan-out to avoid burning credits on huge board sets
  const boardIds = filters.boards.slice(0, 8)
  const perBoardLimit = Math.min(
    15,
    Math.max(4, Math.ceil(filters.limit / Math.min(boardIds.length, 3))),
  )

  const results = await Promise.all(
    boardIds.map(async (boardId) => {
      const board = JOB_BOARDS.find((b) => b.id === boardId)
      const domains = board?.domains
      const labeledQuery = query
      const res = await postSearch(apiKey, {
        ...base,
        query: labeledQuery,
        limit: perBoardLimit,
        includeDomains: domains,
      })
      return { boardId, boardLabel: board?.label ?? boardId, res }
    }),
  )

  const jobs: JobPosting[] = []
  const queries: string[] = []
  let creditsUsed = 0
  let rawCount = 0
  const warnings: string[] = []
  const errors: string[] = []
  let successCount = 0

  for (const { boardLabel, res } of results) {
    queries.push(`[${boardLabel}] ${query}`)
    if (typeof res.creditsUsed === 'number') creditsUsed += res.creditsUsed
    if (typeof res.rawCount === 'number') rawCount += res.rawCount
    if (res.warning) warnings.push(`${boardLabel}: ${res.warning}`)
    if (!res.success) {
      errors.push(`${boardLabel}: ${res.error || 'failed'}`)
      continue
    }
    successCount += 1
    jobs.push(...res.jobs)
  }

  if (successCount === 0) {
    return {
      success: false,
      query,
      queries,
      jobs: [],
      error: errors.join(' · ') || 'All board searches failed',
      creditsUsed: creditsUsed || undefined,
      fanOutCount: boardIds.length,
    }
  }

  const merged = rankJobs(dedupeJobs(jobs), filters).slice(0, filters.limit)
  const fanOutNote =
    boardIds.length < filters.boards.length
      ? `Fan-out used first ${boardIds.length} of ${filters.boards.length} boards.`
      : `Fan-out: ${successCount}/${boardIds.length} boards returned results.`

  return {
    success: true,
    query,
    queries,
    jobs: merged,
    rawCount: rawCount || jobs.length,
    creditsUsed: creditsUsed || undefined,
    warning: [...warnings, fanOutNote, ...errors.map((e) => `Partial: ${e}`)]
      .filter(Boolean)
      .join(' '),
    fanOutCount: boardIds.length,
  }
}

export async function enrichJob(
  apiKey: string,
  url: string,
): Promise<ScrapeJobResponse> {
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firecrawl-Key': apiKey,
    },
    body: JSON.stringify({ url }),
  })
  const data = (await res.json()) as ScrapeJobResponse
  if (!res.ok) {
    return { success: false, error: data.error || `Scrape failed (${res.status})` }
  }
  return data
}

export async function checkJobActive(
  apiKey: string,
  url: string,
): Promise<ActiveCheckResponse> {
  const res = await fetch('/api/active', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firecrawl-Key': apiKey,
    },
    body: JSON.stringify({ url }),
  })
  const data = (await res.json()) as ActiveCheckResponse
  if (!res.ok) {
    return { success: false, error: data.error || `Active check failed (${res.status})` }
  }
  return data
}

/** Run active checks with limited concurrency (uses Firecrawl credits). */
export async function checkJobsActive(
  apiKey: string,
  jobs: JobPosting[],
  concurrency = 3,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, ActiveCheckResponse>> {
  const out = new Map<string, ActiveCheckResponse>()
  let done = 0
  const total = jobs.length
  let cursor = 0

  async function worker() {
    while (cursor < jobs.length) {
      const idx = cursor++
      const job = jobs[idx]!
      const res = await checkJobActive(apiKey, job.url)
      out.set(job.id, res)
      done += 1
      onProgress?.(done, total)
    }
  }

  const n = Math.min(concurrency, Math.max(1, jobs.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return out
}

export async function subscribeDigest(input: {
  email: string
  label?: string
  filters: SearchFilters
  firecrawlKey: string
  hourLocal: number
  timezoneOffsetMinutes: number
  timezone?: string
}): Promise<DigestSubscribeResponse> {
  const res = await fetch('/api/digest/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as DigestSubscribeResponse
  if (!res.ok) {
    return { success: false, error: data.error || `Subscribe failed (${res.status})` }
  }
  return data
}

export async function unsubscribeDigest(
  email: string,
  token: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  const res = await fetch('/api/digest/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token }),
  })
  return (await res.json()) as { success: boolean; error?: string; message?: string }
}

export function exportJobsCsv(jobs: JobPosting[]): string {
  const headers = [
    'title',
    'company',
    'location',
    'url',
    'source',
    'score',
    'activeStatus',
    'description',
  ]
  const rows = jobs.map((j) =>
    headers
      .map((h) => {
        const val = String((j as unknown as Record<string, unknown>)[h] ?? '')
        return `"${val.replace(/"/g, '""')}"`
      })
      .join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

export function downloadText(filename: string, content: string, mime = 'text/csv'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
