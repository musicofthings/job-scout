import type { SearchFilters } from './types'
import { saveJson } from './storage'

export const SAVED_SEARCHES_KEY = 'job-scout:saved-searches'
export const MAX_SAVED_SEARCHES = 20

export interface SavedSearch {
  id: string
  name: string
  filters: SearchFilters
  createdAt: string
  updatedAt: string
}

export function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(SAVED_SEARCHES_KEY)
    if (!raw) return []
    return parseSavedSearches(JSON.parse(raw))
  } catch {
    return []
  }
}

export function persistSavedSearches(list: SavedSearch[]): void {
  saveJson(SAVED_SEARCHES_KEY, list.slice(0, MAX_SAVED_SEARCHES))
}

export function parseSavedSearches(raw: unknown): SavedSearch[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s): s is SavedSearch =>
      !!s &&
      typeof s === 'object' &&
      typeof (s as SavedSearch).id === 'string' &&
      typeof (s as SavedSearch).name === 'string' &&
      !!(s as SavedSearch).filters,
  )
}

function newId(): string {
  return `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createSavedSearch(name: string, filters: SearchFilters): SavedSearch {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: name.trim() || 'Untitled search',
    filters: {
      ...filters,
      boards: [...filters.boards],
      roleTypes: [...filters.roleTypes],
    },
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertSavedSearch(list: SavedSearch[], entry: SavedSearch): SavedSearch[] {
  const idx = list.findIndex((s) => s.id === entry.id)
  if (idx === -1) return [entry, ...list].slice(0, MAX_SAVED_SEARCHES)
  const next = [...list]
  next[idx] = { ...entry, updatedAt: new Date().toISOString() }
  return next
}

export function deleteSavedSearch(list: SavedSearch[], id: string): SavedSearch[] {
  return list.filter((s) => s.id !== id)
}

export function suggestSearchName(filters: SearchFilters): string {
  const titles = filters.jobTitles
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const head =
    titles[0] || filters.keywords.trim().split(/\s+/).slice(0, 3).join(' ') || 'Search'
  const region = filters.region.trim()
  const mode = filters.workMode !== 'any' ? filters.workMode : ''
  return [head, region, mode].filter(Boolean).join(' · ').slice(0, 80)
}
