import { buildSearchQuery, getIncludeDomains, getLocationParam, getTimeTbs } from '../../../src/lib/queryBuilder'
import { normalizeResults } from '../../lib/normalize'
import {
  buildDigestHtml,
  encryptionSecret,
  getSubscription,
  isDueToday,
  json,
  listSubscriptionIds,
  requireKv,
  saveSubscription,
  sendDigestEmail,
  unlockFirecrawlKey,
  type DigestEnv,
  type DigestSubscription,
} from '../../lib/digest'

/**
 * Cron-protected runner: process due digests.
 * Call hourly with header: Authorization: Bearer <CRON_SECRET>
 * e.g. Cloudflare Cron Trigger or external cron → POST /api/digest/run
 */
export const onRequestPost: PagesFunction<DigestEnv> = async (context) => {
  const cronSecret = context.env.CRON_SECRET
  if (!cronSecret) {
    return json({ success: false, error: 'CRON_SECRET is not configured.' }, 503)
  }
  const auth = context.request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (token !== cronSecret) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  const kvOrErr = requireKv(context.env)
  if (kvOrErr instanceof Response) return kvOrErr
  const secretOrErr = encryptionSecret(context.env)
  if (secretOrErr instanceof Response) return secretOrErr

  let force = false
  let onlyId: string | undefined
  try {
    const body = (await context.request.json()) as { force?: boolean; id?: string }
    force = Boolean(body.force)
    onlyId = body.id
  } catch {
    /* empty body ok */
  }

  const ids = onlyId ? [onlyId] : await listSubscriptionIds(kvOrErr)
  const now = new Date()
  const appUrl = context.env.PUBLIC_APP_URL || new URL(context.request.url).origin

  const results: {
    id: string
    email: string
    status: string
    jobs?: number
    error?: string
  }[] = []

  for (const id of ids) {
    const sub = await getSubscription(kvOrErr, id)
    if (!sub || !sub.active) {
      results.push({ id, email: sub?.email || '', status: 'skipped' })
      continue
    }
    if (!force && !isDueToday(sub, now)) {
      results.push({ id, email: sub.email, status: 'not_due' })
      continue
    }

    try {
      const outcome = await runOneDigest(context.env, sub, secretOrErr, appUrl)
      if (outcome.ok) {
        sub.lastSentAt = now.toISOString()
        await saveSubscription(kvOrErr, sub)
        results.push({ id, email: sub.email, status: 'sent', jobs: outcome.jobs })
      } else {
        results.push({ id, email: sub.email, status: 'error', error: outcome.error })
      }
    } catch (err) {
      results.push({
        id,
        email: sub.email,
        status: 'error',
        error: err instanceof Error ? err.message : 'run failed',
      })
    }
  }

  return json({
    success: true,
    processed: results.length,
    results,
    at: now.toISOString(),
  })
}

async function runOneDigest(
  env: DigestEnv,
  sub: DigestSubscription,
  secret: string,
  appUrl: string,
): Promise<{ ok: boolean; jobs?: number; error?: string }> {
  const apiKey = await unlockFirecrawlKey(sub, secret)
  const query = buildSearchQuery(sub.filters)
  const limit = Math.min(Math.max(Number(sub.filters.limit) || 10, 1), 20)

  const payload: Record<string, unknown> = {
    query,
    limit,
    country: sub.filters.country || 'US',
    sources: [{ type: 'web' }],
    ignoreInvalidURLs: true,
  }
  const location = getLocationParam(sub.filters)
  const tbs = getTimeTbs(sub.filters)
  const domains = getIncludeDomains(sub.filters)
  if (location) payload.location = location
  if (tbs) payload.tbs = tbs
  if (domains?.length) payload.includeDomains = domains

  const upstream = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await upstream.json()) as {
    success?: boolean
    error?: string
    data?: { web?: Parameters<typeof normalizeResults>[0] }
  }

  if (!upstream.ok || data.success === false) {
    return { ok: false, error: data.error || `Firecrawl search failed (${upstream.status})` }
  }

  const jobs = normalizeResults(data.data?.web ?? []).slice(0, limit)
  const unsubUrl = `${appUrl}/api/digest/unsubscribe?email=${encodeURIComponent(sub.email)}&token=${encodeURIComponent(sub.unsubToken)}`
  const html = buildDigestHtml({
    label: sub.label,
    query,
    jobs: jobs.map((j) => ({
      title: j.title,
      company: j.company,
      location: j.location,
      url: j.url,
      source: j.source,
    })),
    appUrl,
    unsubUrl,
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const sent = await sendDigestEmail(env, {
    to: sub.email,
    subject: `Job Scout · ${sub.label} · ${stamp}`,
    html,
  })

  if (!sent.ok) return { ok: false, error: sent.error }
  return { ok: true, jobs: jobs.length }
}
