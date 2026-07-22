const KEY = 'job-scout:firecrawl-api-key'
const FILTERS_KEY = 'job-scout:last-filters'
const DIGEST_META_KEY = 'job-scout:digest-meta'
/** Prefix for every Job Scout localStorage key (used by clear-all). */
export const STORAGE_PREFIX = 'job-scout:'

export interface DigestMeta {
  email: string
  unsubToken: string
  label?: string
  hourLocal?: number
  id?: string
}

export function loadApiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY, key)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function loadDigestMeta(): DigestMeta | null {
  try {
    const raw = localStorage.getItem(DIGEST_META_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DigestMeta
  } catch {
    return null
  }
}

export function saveDigestMeta(meta: DigestMeta | null): void {
  try {
    if (!meta) localStorage.removeItem(DIGEST_META_KEY)
    else localStorage.setItem(DIGEST_META_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

/**
 * Remove Job Scout data from this browser.
 * @param keepTheme when true, leaves light/dark preference alone
 */
export function clearLocalStorage(options: { keepTheme?: boolean } = {}): string[] {
  const removed: string[] = []
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k)
    }
    for (const k of keys) {
      if (options.keepTheme && k === 'job-scout:theme') continue
      localStorage.removeItem(k)
      removed.push(k)
    }
  } catch {
    /* private mode */
  }
  return removed
}

export { FILTERS_KEY, DIGEST_META_KEY, KEY as API_KEY_STORAGE_KEY }
