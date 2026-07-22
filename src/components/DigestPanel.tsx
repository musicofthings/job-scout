import { useEffect, useState } from 'react'
import type { SearchFilters } from '../lib/types'
import { subscribeDigest, unsubscribeDigest } from '../lib/api'
import {
  loadDigestMeta,
  saveDigestMeta,
  type DigestMeta,
} from '../lib/storage'

interface Props {
  apiKey: string
  filters: SearchFilters
  /** Bump to re-read local digest meta after clear-all. */
  storageEpoch?: number
}

export function DigestPanel({ apiKey, filters, storageEpoch = 0 }: Props) {
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('Daily job digest')
  const [hourLocal, setHourLocal] = useState(8)
  const [token, setToken] = useState('')
  const [meta, setMeta] = useState<DigestMeta | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    const m = loadDigestMeta()
    if (m) {
      setMeta(m)
      setEmail(m.email)
      setToken(m.unsubToken)
      if (m.label) setLabel(m.label)
      if (typeof m.hourLocal === 'number') setHourLocal(m.hourLocal)
    } else {
      setMeta(null)
      setEmail('')
      setToken('')
      setLabel('Daily job digest')
      setHourLocal(8)
      setMessage(undefined)
      setError(undefined)
    }
  }, [storageEpoch])

  async function handleSubscribe() {
    setBusy(true)
    setError(undefined)
    setMessage(undefined)
    try {
      if (!apiKey.trim()) {
        setError('Save your Firecrawl key first — digests use it (encrypted) for scheduled runs.')
        return
      }
      if (!email.trim()) {
        setError('Enter an email address.')
        return
      }
      if (!filters.jobTitles.trim() && !filters.keywords.trim()) {
        setError('Set job titles or keywords before scheduling a digest.')
        return
      }

      const res = await subscribeDigest({
        email: email.trim(),
        label: label.trim() || 'Daily job digest',
        filters,
        firecrawlKey: apiKey.trim(),
        hourLocal,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })

      if (!res.success || !res.unsubToken || !res.email) {
        setError(res.error || 'Could not schedule digest (is KV + Gmail configured?)')
        return
      }

      const next: DigestMeta = {
        email: res.email,
        unsubToken: res.unsubToken,
        label: res.label,
        hourLocal,
        id: res.id,
      }
      saveDigestMeta(next)
      setMeta(next)
      setToken(res.unsubToken)
      setMessage(
        res.message ||
          `Scheduled daily at ${hourLocal}:00 local time. Keep this unsubscribe token safe.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscribe network error')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnsubscribe() {
    setBusy(true)
    setError(undefined)
    setMessage(undefined)
    try {
      const res = await unsubscribeDigest(email.trim(), token.trim())
      if (!res.success) {
        setError(res.error || 'Unsubscribe failed')
        return
      }
      saveDigestMeta(null)
      setMeta(null)
      setToken('')
      setMessage(res.message || 'Unsubscribed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unsubscribe network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel digest-panel">
      <div className="panel-head">
        <div>
          <h2>Daily email digest</h2>
          <p className="muted">
            Works for everyone on the <strong>live</strong> site after Gmail + KV + cron are
            configured on Cloudflare. Local <code>npm run dev</code> only stores digests in
            this machine&apos;s memory (no email to others). Your Firecrawl key is stored{' '}
            <strong>encrypted</strong> for cron runs only.
          </p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field span-2">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Digest label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. ML roles · remote"
          />
        </label>

        <label className="field">
          <span>Send hour (local)</span>
          <select
            value={hourLocal}
            onChange={(e) => setHourLocal(Number(e.target.value))}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>

        <label className="field span-2">
          <span>Unsubscribe token</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Filled after subscribe — needed to cancel"
            spellCheck={false}
          />
        </label>
      </div>

      <div className="digest-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void handleSubscribe()}>
          {busy ? 'Working…' : meta ? 'Update digest' : 'Schedule daily digest'}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={busy || !email || !token}
          onClick={() => void handleUnsubscribe()}
        >
          Unsubscribe
        </button>
      </div>

      {message && <p className="status ok">{message}</p>}
      {error && <p className="status warn">{error}</p>}
      <p className="hint">
        Production needs Cloudflare KV (<code>DIGESTS</code>), email via Gmail Apps Script
        or Resend, <code>DIGEST_ENCRYPTION_KEY</code>, <code>CRON_SECRET</code>,{' '}
        <code>PUBLIC_APP_URL</code>, and hourly cron to <code>POST /api/digest/run</code>. If
        Google shows <code>policy_enforced</code> / Advanced Protection, use a secondary Gmail
        without APP or use Resend — see README.
      </p>
    </section>
  )
}
