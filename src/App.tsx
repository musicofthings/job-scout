import { useEffect, useMemo, useState } from 'react'
import { ApiKeyPanel } from './components/ApiKeyPanel'
import { ResultsList } from './components/ResultsList'
import { SavedSearches } from './components/SavedSearches'
import { SearchForm } from './components/SearchForm'
import { ThemeToggle } from './components/ThemeToggle'
import {
  checkJobActive,
  checkJobsActive,
  downloadText,
  enrichJob,
  exportJobsCsv,
  searchJobs,
} from './lib/api'
import { ClearDataPanel } from './components/ClearDataPanel'
import {
  DEFAULT_VIEW_FILTERS,
  filterAndSortJobs,
  type ResultViewFilters,
} from './lib/ranking'
import {
  createSavedSearch,
  deleteSavedSearch,
  loadSavedSearches,
  persistSavedSearches,
  type SavedSearch,
  upsertSavedSearch,
} from './lib/savedSearches'
import {
  clearLocalStorage,
  FILTERS_KEY,
  loadApiKey,
  loadJson,
  saveApiKey,
  saveJson,
} from './lib/storage'
import { applyTheme, DEFAULT_THEME, loadTheme, saveTheme, type Theme } from './lib/theme'
import { DEFAULT_FILTERS, type JobPosting, type SearchFilters } from './lib/types'
import { LazyImage } from './components/LazyImage'
import './App.css'

export default function App() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [apiKey, setApiKey] = useState('')
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [saved, setSaved] = useState<SavedSearch[]>([])
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [query, setQuery] = useState('')
  const [queries, setQueries] = useState<string[] | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [warning, setWarning] = useState<string | undefined>()
  const [creditsUsed, setCreditsUsed] = useState<number | undefined>()
  const [rawCount, setRawCount] = useState<number | undefined>()
  const [fanOutCount, setFanOutCount] = useState<number | undefined>()
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [viewFilters, setViewFilters] = useState<ResultViewFilters>(DEFAULT_VIEW_FILTERS)
  const [checkingActive, setCheckingActive] = useState(false)
  const [checkingActiveId, setCheckingActiveId] = useState<string | null>(null)

  useEffect(() => {
    const t = loadTheme()
    setTheme(t)
    applyTheme(t)
    setApiKey(loadApiKey())
    setFilters(loadJson(FILTERS_KEY, DEFAULT_FILTERS))
    setSaved(loadSavedSearches())
  }, [])

  function handleTheme(next: Theme) {
    setTheme(next)
    saveTheme(next)
    applyTheme(next)
  }

  function handleSaveKey(key: string) {
    saveApiKey(key)
    setApiKey(key)
  }

  function handleFilters(next: SearchFilters) {
    setFilters(next)
    saveJson(FILTERS_KEY, next)
  }

  async function runSearch(active: SearchFilters) {
    if (!apiKey.trim()) {
      setError('Add your Firecrawl API key first (BYOK).')
      return
    }
    if (!active.jobTitles.trim() && !active.keywords.trim()) {
      setError('Enter at least one job title or keyword.')
      return
    }

    setLoading(true)
    setError(undefined)
    setWarning(undefined)
    setJobs([])
    setQueries(undefined)
    setViewFilters(DEFAULT_VIEW_FILTERS)
    setFanOutCount(
      active.fanOutBoards && active.boards.length > 1
        ? Math.min(active.boards.length, 8)
        : 1,
    )

    try {
      const res = await searchJobs(apiKey, active)
      setQuery(res.query)
      setQueries(res.queries)
      setCreditsUsed(res.creditsUsed)
      setRawCount(res.rawCount)
      setFanOutCount(res.fanOutCount)
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

  function handleSearch() {
    void runSearch(filters)
  }

  function handleSaveSearch(name: string) {
    const entry = createSavedSearch(name, filters)
    const next = upsertSavedSearch(saved, entry)
    setSaved(next)
    persistSavedSearches(next)
  }

  function handleLoadSearch(entry: SavedSearch) {
    handleFilters({ ...DEFAULT_FILTERS, ...entry.filters })
  }

  function handleDeleteSearch(id: string) {
    const next = deleteSavedSearch(saved, id)
    setSaved(next)
    persistSavedSearches(next)
  }

  function handleRunSaved(entry: SavedSearch) {
    const next = { ...DEFAULT_FILTERS, ...entry.filters }
    handleFilters(next)
    void runSearch(next)
  }

  async function handleCheckOneActive(job: JobPosting) {
    if (!apiKey.trim()) {
      setError('API key required to check if a job is still active.')
      return
    }
    setCheckingActiveId(job.id)
    setError(undefined)
    try {
      const res = await checkJobActive(apiKey, job.url)
      if (!res.success || !res.status) {
        setError(res.error || 'Active check failed')
        return
      }
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                activeStatus: res.status,
                activeReason: res.reason,
                activeCheckedAt: new Date().toISOString(),
              }
            : j,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Active check network error')
    } finally {
      setCheckingActiveId(null)
    }
  }

  async function handleCheckAllActive() {
    if (!apiKey.trim()) {
      setError('API key required to check active status.')
      return
    }
    if (!jobs.length) return
    setCheckingActive(true)
    setError(undefined)
    try {
      const map = await checkJobsActive(apiKey, jobs, 3)
      setJobs((prev) =>
        prev.map((j) => {
          const res = map.get(j.id)
          if (!res?.success || !res.status) return j
          return {
            ...j,
            activeStatus: res.status,
            activeReason: res.reason,
            activeCheckedAt: new Date().toISOString(),
          }
        }),
      )
      const failed = [...map.values()].filter((r) => !r.success).length
      if (failed) {
        setWarning(`${failed} active check${failed === 1 ? '' : 's'} failed (see credits / key).`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk active check failed')
    } finally {
      setCheckingActive(false)
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

  const exportable = useMemo(
    () => filterAndSortJobs(jobs, viewFilters, filters),
    [jobs, viewFilters, filters],
  )

  function handleExport() {
    const csv = exportJobsCsv(exportable)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadText(`job-scout-${stamp}.csv`, csv)
  }

  function resetResultState() {
    setJobs([])
    setQuery('')
    setQueries(undefined)
    setError(undefined)
    setWarning(undefined)
    setCreditsUsed(undefined)
    setRawCount(undefined)
    setFanOutCount(undefined)
    setViewFilters(DEFAULT_VIEW_FILTERS)
    setEnrichingId(null)
    setCheckingActive(false)
    setCheckingActiveId(null)
    setLoading(false)
  }

  function handleClearResults() {
    resetResultState()
  }

  function handleClearHistory() {
    resetResultState()
    setFilters(DEFAULT_FILTERS)
    saveJson(FILTERS_KEY, DEFAULT_FILTERS)
    setSaved([])
    persistSavedSearches([])
  }

  function handleClearAll() {
    clearLocalStorage({ keepTheme: true })
    resetResultState()
    setApiKey('')
    setFilters(DEFAULT_FILTERS)
    setSaved([])
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-brand">
          <span className="topbar-mark">job scout</span>
          <span className="topbar-tag">strategy + craft</span>
        </div>
        <div className="topbar-actions">
          <ThemeToggle theme={theme} onChange={handleTheme} />
        </div>
      </div>

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Cloudflare Pages · Firecrawl BYOK</p>
          <h1>
            Find roles
            <br />
            with <span className="hero-title-accent">your</span> key
          </h1>
          <p className="lede">
            Search public job postings across the web with your own Firecrawl API key. No
            LinkedIn automation, no shared secrets — you bring the key, we proxy the search.
          </p>
        </div>
        <LazyImage
          alt=""
          className="hero-media"
          aspectRatio="4 / 3"
          tone="butter"
        />
      </header>

      <main className="layout">
        <div className="col">
          <ApiKeyPanel apiKey={apiKey} onSave={handleSaveKey} />
          <SavedSearches
            filters={filters}
            saved={saved}
            onSave={handleSaveSearch}
            onLoad={handleLoadSearch}
            onDelete={handleDeleteSearch}
            onSearch={handleRunSaved}
          />
          <SearchForm
            filters={filters}
            loading={loading}
            onChange={handleFilters}
            onSubmit={handleSearch}
          />
          <ClearDataPanel
            hasResults={jobs.length > 0 || Boolean(query) || Boolean(error)}
            hasSavedSearches={saved.length > 0}
            onClearResults={handleClearResults}
            onClearHistory={handleClearHistory}
            onClearAll={handleClearAll}
          />
        </div>
        <div className="col">
          <ResultsList
            jobs={jobs}
            query={query}
            queries={queries}
            loading={loading}
            error={error}
            warning={warning}
            creditsUsed={creditsUsed}
            rawCount={rawCount}
            fanOutCount={fanOutCount}
            searchFilters={filters}
            viewFilters={viewFilters}
            onViewFiltersChange={setViewFilters}
            onEnrich={handleEnrich}
            enrichingId={enrichingId}
            onExport={handleExport}
            onCheckActive={() => void handleCheckAllActive()}
            onCheckOneActive={(job) => void handleCheckOneActive(job)}
            checkingActive={checkingActive}
            checkingActiveId={checkingActiveId}
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
