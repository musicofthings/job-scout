import { describe, expect, it } from 'vitest'
import {
  createSavedSearch,
  deleteSavedSearch,
  parseSavedSearches,
  suggestSearchName,
  upsertSavedSearch,
} from './savedSearches'
import { DEFAULT_FILTERS } from './types'

describe('savedSearches', () => {
  it('creates a deep-ish copy of filters', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      boards: ['lever'],
      roleTypes: ['Full-time'],
      jobTitles: 'Engineer',
    }
    const entry = createSavedSearch('My search', filters)
    expect(entry.name).toBe('My search')
    expect(entry.filters.jobTitles).toBe('Engineer')
    entry.filters.boards.push('ashby')
    expect(filters.boards).toEqual(['lever'])
  })

  it('upserts and deletes', () => {
    const a = createSavedSearch('A', DEFAULT_FILTERS)
    const b = createSavedSearch('B', DEFAULT_FILTERS)
    let list = upsertSavedSearch([], a)
    list = upsertSavedSearch(list, b)
    expect(list).toHaveLength(2)
    list = upsertSavedSearch(list, { ...a, name: 'A2' })
    expect(list.find((s) => s.id === a.id)?.name).toBe('A2')
    list = deleteSavedSearch(list, b.id)
    expect(list.map((s) => s.id)).toEqual([a.id])
  })

  it('suggests a readable name', () => {
    expect(
      suggestSearchName({
        ...DEFAULT_FILTERS,
        jobTitles: 'ML Engineer, Data Scientist',
        region: 'Berlin',
        workMode: 'remote',
      }),
    ).toBe('ML Engineer · Berlin · remote')
  })

  it('parses only valid entries', () => {
    expect(parseSavedSearches(null)).toEqual([])
    expect(
      parseSavedSearches([
        { id: '1', name: 'ok', filters: DEFAULT_FILTERS, createdAt: '', updatedAt: '' },
        { id: 2, name: 'bad' },
      ]),
    ).toHaveLength(1)
  })
})
