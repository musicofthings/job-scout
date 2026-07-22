import { detectActiveStatus, type ActiveStatus } from '../lib/activeStatus'

interface ActiveBody {
  url?: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * BYOK: scrape a job URL and classify whether the posting still looks open.
 */
export const onRequestPost: PagesFunction = async (context) => {
  const apiKey = context.request.headers.get('X-Firecrawl-Key')?.trim()
  if (!apiKey) {
    return json({ success: false, error: 'Missing X-Firecrawl-Key header (BYOK).' }, 401)
  }

  let body: ActiveBody
  try {
    body = (await context.request.json()) as ActiveBody
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const url = (body.url || '').trim()
  if (!url) {
    return json({ success: false, error: 'URL is required.' }, 400)
  }

  try {
    const upstream = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        onlyMainContent: true,
        formats: [
          { type: 'markdown' },
          {
            type: 'json',
            prompt:
              'Determine if this web page is an open job application. Set isOpen true only if candidates can still apply. Set isOpen false if the job is closed, filled, expired, or removed. If unclear, omit isOpen.',
            schema: {
              type: 'object',
              properties: {
                isOpen: { type: 'boolean' },
                statusLabel: { type: 'string' },
                title: { type: 'string' },
              },
            },
          },
        ],
      }),
    })

    const data = (await upstream.json()) as {
      success?: boolean
      error?: string
      data?: {
        markdown?: string
        json?: { isOpen?: boolean; statusLabel?: string; title?: string }
        metadata?: { title?: string; statusCode?: number }
      }
    }

    if (!upstream.ok || data.success === false) {
      // Hard 404-style failures from Firecrawl → inactive when message says so
      const err = data.error || `Firecrawl scrape error (${upstream.status})`
      if (/404|not found|gone/i.test(err) || upstream.status === 404) {
        return json({
          success: true,
          url,
          status: 'inactive' as ActiveStatus,
          reason: err,
          confidence: 'high',
        })
      }
      return json({ success: false, error: err }, upstream.status >= 400 ? upstream.status : 502)
    }

    const extracted = data.data?.json ?? {}
    const markdown = data.data?.markdown || ''
    const title = extracted.title || data.data?.metadata?.title || ''
    const structuredOpen =
      typeof extracted.isOpen === 'boolean' ? extracted.isOpen : null

    const result = detectActiveStatus({
      text: `${markdown}\n${extracted.statusLabel || ''}`,
      title,
      httpStatus: data.data?.metadata?.statusCode,
      structuredOpen,
    })

    return json({
      success: true,
      url,
      status: result.status,
      reason: result.reason,
      confidence: result.confidence,
      title: title || undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Active check failed'
    return json({ success: false, error: message }, 502)
  }
}
