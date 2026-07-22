import { describe, expect, it } from 'vitest'
import {
  buildSearchQuery,
  getIncludeDomains,
  getLocationParam,
  getTimeTbs,
} from './queryBuilder'
import { DEFAULT_FILTERS, type SearchFilters } from './types'

function filters(partial: Partial<SearchFilters> = {}): SearchFilters {
  return { ...DEFAULT_FILTERS, ...partial }
}

describe('buildSearchQuery', () => {
  it('quotes a single job title and adds hiring bias', () => {
    const q = buildSearchQuery(
      filters({ jobTitles: 'Machine Learning Engineer', roleTypes: [] }),
    )
    expect(q).toContain('"Machine Learning Engineer"')
    expect(q).toContain('(hiring OR "job opening" OR "apply now" OR careers OR "we are hiring")')
  })

  it('ORs multiple job titles', () => {
    const q = buildSearchQuery(
      filters({ jobTitles: 'Staff Scientist, ML Engineer', roleTypes: [] }),
    )
    expect(q).toContain('("Staff Scientist" OR "ML Engineer")')
  })

  it('includes keywords, region, work mode, and experience', () => {
    const q = buildSearchQuery(
      filters({
        jobTitles: 'Engineer',
        keywords: 'TypeScript Kubernetes',
        region: 'Berlin',
        workMode: 'remote',
        experience: 'senior',
        roleTypes: ['Full-time'],
      }),
    )
    expect(q).toContain('TypeScript Kubernetes')
    expect(q).toContain('"Berlin"')
    expect(q).toContain('remote OR "work from home"')
    expect(q).toContain('senior OR sr.')
    expect(q).toContain('"Full-time"')
  })

  it('splits titles on commas and newlines', () => {
    const q = buildSearchQuery(
      filters({ jobTitles: 'A\nB; C', roleTypes: [] }),
    )
    expect(q).toContain('("A" OR "B" OR "C")')
  })
})

describe('getIncludeDomains', () => {
  it('returns undefined when no boards selected', () => {
    expect(getIncludeDomains(filters({ boards: [] }))).toBeUndefined()
  })

  it('maps board ids to hostnames', () => {
    const domains = getIncludeDomains(filters({ boards: ['greenhouse', 'lever'] }))
    expect(domains).toEqual(
      expect.arrayContaining([
        'boards.greenhouse.io',
        'jobs.lever.co',
      ]),
    )
  })
})

describe('getTimeTbs / getLocationParam', () => {
  it('maps time ranges to Firecrawl tbs values', () => {
    expect(getTimeTbs(filters({ timeRange: 'week' }))).toBe('qdr:w')
    expect(getTimeTbs(filters({ timeRange: 'any' }))).toBeUndefined()
  })

  it('returns region as location when present', () => {
    expect(getLocationParam(filters({ region: '  Seattle  ' }))).toBe('Seattle')
    expect(getLocationParam(filters({ region: '   ' }))).toBeUndefined()
  })
})
