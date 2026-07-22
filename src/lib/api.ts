import type { JobPosting, ScrapeJobResponse, SearchFilters, SearchResponse } from './types'
import { buildSearchQuery, getIncludeDomains, getLocationParam, getTimeTbs } from './queryBuilder'

export async function searchJobs(
  apiKey: string,
  filters: SearchFilters,
): Promise<SearchResponse> {
  const query = buildSearchQuery(filters)
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firecrawl-Key': apiKey,
    },
    body: JSON.stringify({
      query,
      limit: filters.limit,
      country: filters.country || 'US',
      location: getLocationParam(filters),
      tbs: getTimeTbs(filters),
      includeDomains: getIncludeDomains(filters),
      scrapeContent: filters.scrapeContent,
    }),
  })

  const data = (await res.json()) as SearchResponse
  if (!res.ok) {
    return {
      success: false,
      query,
      jobs: [],
      error: data.error || `Request failed (${res.status})`,
    }
  }
  return data
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

export function exportJobsCsv(jobs: JobPosting[]): string {
  const headers = ['title', 'company', 'location', 'url', 'source', 'description']
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
