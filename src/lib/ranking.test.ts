import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIEW_FILTERS,
  filterAndSortJobs,
  rankJobs,
  scoreJob,
} from './ranking'
import { DEFAULT_FILTERS, type JobPosting, type SearchFilters } from './types'

function job(partial: Partial<JobPosting> & Pick<JobPosting, 'title' | 'url'>): JobPosting {
  return {
    id: partial.id || 'job_1',
    company: partial.company || 'Acme',
    location: partial.location || 'Remote',
    description: partial.description || '',
    source: partial.source || 'jobs.lever.co',
    tags: partial.tags || [],
    salaryHint: partial.salaryHint,
    ...partial,
  }
}

function filters(partial: Partial<SearchFilters> = {}): SearchFilters {
  return { ...DEFAULT_FILTERS, ...partial }
}

describe('scoreJob / rankJobs', () => {
  it('scores title matches higher than description-only', () => {
    const f = filters({ jobTitles: 'Machine Learning Engineer', keywords: 'PyTorch' })
    const titleHit = job({
      title: 'Machine Learning Engineer',
      description: 'Build models',
      url: 'https://jobs.lever.co/a/1',
    })
    const descHit = job({
      title: 'Software Engineer',
      description: 'Machine Learning Engineer using PyTorch',
      url: 'https://jobs.lever.co/a/2',
    })
    expect(scoreJob(titleHit, f)).toBeGreaterThan(scoreJob(descHit, f))
  })

  it('boosts remote when work mode is remote', () => {
    const f = filters({ workMode: 'remote', jobTitles: 'Engineer' })
    const remote = job({
      title: 'Engineer',
      tags: ['remote'],
      url: 'https://jobs.lever.co/r/1',
    })
    const onsite = job({
      title: 'Engineer',
      tags: [],
      location: 'New York, NY',
      description: 'On-site only',
      url: 'https://jobs.lever.co/r/2',
    })
    expect(scoreJob(remote, f)).toBeGreaterThan(scoreJob(onsite, f))
  })

  it('prefers ATS hosts over generic sources', () => {
    const f = filters({ jobTitles: 'Engineer' })
    const ats = job({
      title: 'Engineer',
      source: 'boards.greenhouse.io',
      url: 'https://boards.greenhouse.io/x/1',
    })
    const generic = job({
      title: 'Engineer',
      source: 'random-blog.com',
      url: 'https://random-blog.com/jobs/1',
    })
    expect(scoreJob(ats, f)).toBeGreaterThan(scoreJob(generic, f))
  })

  it('ranks jobs by descending score', () => {
    const f = filters({ jobTitles: 'Scientist', keywords: 'genomics' })
    const ranked = rankJobs(
      [
        job({
          id: 'low',
          title: 'Office Manager',
          description: 'Admin',
          url: 'https://example.com/1',
          source: 'example.com',
        }),
        job({
          id: 'high',
          title: 'Scientist',
          description: 'genomics research',
          url: 'https://jobs.lever.co/2',
          source: 'jobs.lever.co',
          salaryHint: '$120k',
        }),
      ],
      f,
    )
    expect(ranked[0].id).toBe('high')
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score ?? 0)
  })
})

describe('filterAndSortJobs', () => {
  const jobs = [
    job({
      id: 'a',
      title: 'Senior Engineer',
      company: 'Zebra',
      source: 'jobs.lever.co',
      salaryHint: '$180k',
      tags: ['remote'],
      url: 'https://jobs.lever.co/a',
    }),
    job({
      id: 'b',
      title: 'Junior Analyst',
      company: 'Acme',
      source: 'indeed.com',
      tags: [],
      location: 'Austin, TX',
      url: 'https://indeed.com/b',
    }),
  ]

  it('filters by text and salary', () => {
    const view = {
      ...DEFAULT_VIEW_FILTERS,
      text: 'zebra',
      requireSalary: true,
    }
    const out = filterAndSortJobs(jobs, view, filters({ jobTitles: 'Engineer' }))
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })

  it('filters by active status', () => {
    const withStatus = [
      { ...jobs[0]!, activeStatus: 'active' as const },
      { ...jobs[1]!, activeStatus: 'inactive' as const },
    ]
    const out = filterAndSortJobs(
      withStatus,
      { ...DEFAULT_VIEW_FILTERS, activeFilter: 'active' },
      filters(),
    )
    expect(out.map((j) => j.id)).toEqual(['a'])
  })

  it('filters remote only', () => {
    const out = filterAndSortJobs(
      jobs,
      { ...DEFAULT_VIEW_FILTERS, remoteOnly: true },
      filters(),
    )
    expect(out.map((j) => j.id)).toEqual(['a'])
  })

  it('sorts by company', () => {
    const out = filterAndSortJobs(
      jobs,
      { ...DEFAULT_VIEW_FILTERS, sort: 'company' },
      filters(),
    )
    expect(out.map((j) => j.company)).toEqual(['Acme', 'Zebra'])
  })

  it('filters by source chips', () => {
    const out = filterAndSortJobs(
      jobs,
      { ...DEFAULT_VIEW_FILTERS, sources: ['indeed.com'] },
      filters(),
    )
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('b')
  })
})
