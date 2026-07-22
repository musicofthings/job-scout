import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearLocalStorage, STORAGE_PREFIX } from './storage'

describe('clearLocalStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes job-scout keys and can keep theme', () => {
    const store = new Map<string, string>([
      [`${STORAGE_PREFIX}firecrawl-api-key`, 'fc-x'],
      [`${STORAGE_PREFIX}theme`, 'dark'],
      [`${STORAGE_PREFIX}saved-searches`, '[]'],
      ['other-app:data', 'keep'],
    ])

    const localStorageMock = {
      get length() {
        return store.size
      },
      key(i: number) {
        return [...store.keys()][i] ?? null
      },
      getItem(k: string) {
        return store.has(k) ? store.get(k)! : null
      },
      setItem(k: string, v: string) {
        store.set(k, v)
      },
      removeItem(k: string) {
        store.delete(k)
      },
    }
    vi.stubGlobal('localStorage', localStorageMock)

    const removed = clearLocalStorage({ keepTheme: true })
    expect(removed).toEqual(
      expect.arrayContaining([
        `${STORAGE_PREFIX}firecrawl-api-key`,
        `${STORAGE_PREFIX}saved-searches`,
      ]),
    )
    expect(removed).not.toContain(`${STORAGE_PREFIX}theme`)
    expect(store.has(`${STORAGE_PREFIX}theme`)).toBe(true)
    expect(store.has('other-app:data')).toBe(true)
    expect(store.has(`${STORAGE_PREFIX}firecrawl-api-key`)).toBe(false)
  })
})
