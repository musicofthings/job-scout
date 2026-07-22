import { useEffect, useState } from 'react'
import { ApiKeyPanel } from './components/ApiKeyPanel'
import { ResultsList } from './components/ResultsList'
import { SearchForm } from './components/SearchForm'
import { downloadText, enrichJob, exportJobsCsv, searchJobs } from './lib/api'
import { FILTERS_KEY, loadApiKey, loadJson, saveApiKey, saveJson } from './lib/storage'
import { DEFAULT_FILTERS, type JobPosting, type SearchFilters } from './lib/types'
import './App.css'

export default function App() {
  const [apiKey, setApiKey] = useState('')
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [warning, setWarning] = useState<string | undefined>()
  const [creditsUsed, setCreditsUsed] = useState<number | undefined>()
  const [rawCount, setRawCount] = useState<number | undefined>()
  const [enrichingId, setEnrichingId] = useState<string | null>(null)

  useEffect(() => {
    setApiKey(loadApiKey())
    setFilters(loadJson(FILTERS_KEY, DEFAULT_FILTERS))
  }, [])

  function handleSaveKey(key: string) {
    saveApiKey(key)
    setApiKey(key)
  }

  function handleFilters(next: SearchFilters) {
    setFilters(next)
    saveJson(FILTERS_KEY, next)
  }

  async function handleSearch() {
    if (!apiKey.trim()) {
      setError('Add your Firecrawl API key first (BYOK).')
      return
    }
    if (!filters.jobTitles.trim() && !filters.keywords.trim()) {
      setError('Enter at least one job title or keyword.')
      return
    }

    setLoading(true)
    setError(undefined)
    setWarning(undefined)
    setJobs([])

    try {
      const res = await searchJobs(apiKey, filters)
      setQuery(res.query)
      setCreditsUsed(res.creditsUsed)
      setRawCount(res.rawCount)
      if (!res.success) {
        setError(res.error || 'Search failed')
        return
      }
      setJobs(res.jobs)
      setWarning(res.warning)
      if (!res.jobs.length) {
        setWarning(
          res.warning ||
            'No postings matched. Try broader titles, fewer board filters, or a wider time range.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnrich(job: JobPosting) {
    if (!apiKey.trim()) {
      setError('API key required to enrich.')
      return
    }
    setEnrichingId(job.id)
    setError(undefined)
    try {
      const res = await enrichJob(apiKey, job.url)
      if (!res.success || !res.job) {
        setError(res.error || 'Enrich failed')
        return
      }
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                title: res.job?.title || j.title,
                company: res.job?.company || j.company,
                location: res.job?.location || j.location,
                description: res.job?.description || j.description,
                salaryHint: res.job?.salaryHint || j.salaryHint,
                markdown: res.job?.markdown || j.markdown,
                tags: [...new Set([...j.tags, ...(res.job?.tags || [])])],
              }
            : j,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrich network error')
    } finally {
      setEnrichingId(null)
    }
  }

  function handleExport() {
    const csv = exportJobsCsv(jobs)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadText(`job-scout-${stamp}.csv`, csv)
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="brand">
          <span className="logo" aria-hidden>
            ⌬
          </span>
          <div>
            <p className="eyebrow">Cloudflare Pages · Firecrawl BYOK</p>
            <h1>Job Scout</h1>
          </div>
        </div>
        <p className="lede">
          Search public job postings across the web with your own Firecrawl API key. No
          LinkedIn automation, no shared secrets — you bring the key, we proxy the search.
        </p>
      </header>

      <main className="layout">
        <div className="col">
          <ApiKeyPanel apiKey={apiKey} onSave={handleSaveKey} />
          <SearchForm
            filters={filters}
            loading={loading}
            onChange={handleFilters}
            onSubmit={handleSearch}
          />
        </div>
        <div className="col">
          <ResultsList
            jobs={jobs}
            query={query}
            loading={loading}
            error={error}
            warning={warning}
            creditsUsed={creditsUsed}
            rawCount={rawCount}
            onEnrich={handleEnrich}
            enrichingId={enrichingId}
            onExport={handleExport}
          />
        </div>
      </main>

      <footer className="footer">
        <p>
          Keys never leave your browser storage except as a request header to this app&apos;s
          API proxy. Respect each board&apos;s terms of use. Built for Cloudflare Pages.
        </p>
      </footer>
    </div>
  )
}
