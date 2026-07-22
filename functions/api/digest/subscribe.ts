import type { SearchFilters } from '../../../src/lib/types'
import {
  createSubscription,
  encryptionSecret,
  getSubscriptionByEmail,
  json,
  requireKv,
  saveSubscription,
  type DigestEnv,
} from '../../lib/digest'

interface Body {
  email?: string
  label?: string
  filters?: SearchFilters
  firecrawlKey?: string
  hourUtc?: number
  /** Local hour 0–23; converted with timezoneOffsetMinutes if hourUtc omitted */
  hourLocal?: number
  timezoneOffsetMinutes?: number
  timezone?: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const onRequestPost: PagesFunction<DigestEnv> = async (context) => {
  const kvOrErr = requireKv(context.env)
  if (kvOrErr instanceof Response) return kvOrErr
  const secretOrErr = encryptionSecret(context.env)
  if (secretOrErr instanceof Response) return secretOrErr

  let body: Body
  try {
    body = (await context.request.json()) as Body
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const email = (body.email || '').trim().toLowerCase()
  const firecrawlKey = (body.firecrawlKey || '').trim()
  const filters = body.filters

  if (!isValidEmail(email)) {
    return json({ success: false, error: 'A valid email is required.' }, 400)
  }
  if (!firecrawlKey) {
    return json(
      {
        success: false,
        error: 'Firecrawl key is required so the daily digest can run searches for you (stored encrypted).',
      },
      400,
    )
  }
  if (!filters || (!filters.jobTitles?.trim() && !filters.keywords?.trim())) {
    return json(
      { success: false, error: 'Search filters with job titles or keywords are required.' },
      400,
    )
  }

  let hourUtc = body.hourUtc
  if (typeof hourUtc !== 'number') {
    const local = typeof body.hourLocal === 'number' ? body.hourLocal : 8
    const offset = typeof body.timezoneOffsetMinutes === 'number' ? body.timezoneOffsetMinutes : 0
    // local = utc + (-offset/60) in JS getTimezoneOffset; offset minutes is Date#getTimezoneOffset
    hourUtc = (Math.floor(local) + Math.floor(offset / 60) + 48) % 24
  }

  const existing = await getSubscriptionByEmail(kvOrErr, email)
  const sub = await createSubscription({
    email,
    label: body.label || existing?.label || 'Daily job digest',
    filters,
    firecrawlKey,
    hourUtc,
    timezone: body.timezone || 'UTC',
    secret: secretOrErr,
  })

  // Preserve id if updating same email so unsub links stay simpler
  if (existing) {
    sub.id = existing.id
    sub.createdAt = existing.createdAt
    sub.unsubToken = existing.unsubToken
  }

  await saveSubscription(kvOrErr, sub)

  const appUrl = context.env.PUBLIC_APP_URL || new URL(context.request.url).origin

  return json({
    success: true,
    id: sub.id,
    email: sub.email,
    hourUtc: sub.hourUtc,
    label: sub.label,
    unsubToken: sub.unsubToken,
    message:
      'Daily digest scheduled. Your Firecrawl key is stored encrypted and used only for scheduled runs.',
    unsubHint: `POST /api/digest/unsubscribe with email + token, or open ${appUrl} and use the digest panel.`,
  })
}
