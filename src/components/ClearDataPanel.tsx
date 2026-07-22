import { useState } from 'react'

interface Props {
  hasResults: boolean
  hasSavedSearches: boolean
  onClearResults: () => void
  onClearHistory: () => void
  onClearAll: () => void
}

export function ClearDataPanel({
  hasResults,
  hasSavedSearches,
  onClearResults,
  onClearHistory,
  onClearAll,
}: Props) {
  const [confirmAll, setConfirmAll] = useState(false)
  const [message, setMessage] = useState<string | undefined>()

  function run(action: () => void, ok: string) {
    action()
    setConfirmAll(false)
    setMessage(ok)
    setTimeout(() => setMessage(undefined), 2200)
  }

  return (
    <section className="panel clear-panel">
      <div className="panel-head">
        <div>
          <h2>Clear cache &amp; history</h2>
          <p className="muted">
            Clears data stored in <strong>this browser only</strong> (API key, filters, saved
            searches, results). Theme preference is kept on “clear all”.
          </p>
        </div>
      </div>

      <div className="clear-actions">
        <button
          type="button"
          className="ghost"
          disabled={!hasResults}
          onClick={() =>
            run(onClearResults, 'Cleared current results and search status.')
          }
        >
          Clear results
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!hasSavedSearches && !hasResults}
          onClick={() =>
            run(
              onClearHistory,
              'Cleared results, last filters, and saved searches.',
            )
          }
        >
          Clear history
        </button>
        {!confirmAll ? (
          <button
            type="button"
            className="ghost danger-text"
            onClick={() => setConfirmAll(true)}
          >
            Clear all local data…
          </button>
        ) : (
          <button
            type="button"
            className="primary danger-btn"
            onClick={() =>
              run(
                onClearAll,
                'Cleared API key, filters, saved searches, and results. Theme kept.',
              )
            }
          >
            Confirm clear all
          </button>
        )}
        {confirmAll && (
          <button type="button" className="ghost sm" onClick={() => setConfirmAll(false)}>
            Cancel
          </button>
        )}
      </div>

      <ul className="clear-legend muted tiny">
        <li>
          <strong>Clear results</strong> — empty the results list and banners (session only).
        </li>
        <li>
          <strong>Clear history</strong> — results + last search form + saved searches.
        </li>
        <li>
          <strong>Clear all</strong> — also removes API key. Theme is kept.
        </li>
      </ul>

      {message && <p className="status ok">{message}</p>}
    </section>
  )
}
