import { normalizeResults } from '../lib/normalize'

interface SearchBody {
  query?: string
  limit?: number
  country?: string
  location?: string
  tbs?: string
  includeDomains?: string[]
  scrapeContent?: boolean
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
 * BYOK proxy: forwards the user's Firecrawl key to /v2/search.
 * The key is never stored — only read from the request header.
 */
export const onRequestPost: PagesFunction = async (context) => {
  const apiKey = context.request.headers.get('X-Firecrawl-Key')?.trim()
  if (!apiKey) {
    return json(
      { success: false, query: '', jobs: [], error: 'Missing X-Firecrawl-Key header (BYOK).' },
      401,
    )
  }

  let body: SearchBody
  try {
    body = (await context.request.json()) as SearchBody
  } catch {
    return json({ success: false, query: '', jobs: [], error: 'Invalid JSON body.' }, 400)
  }

  const query = (body.query || '').trim()
  if (!query) {
    return json({ success: false, query: '', jobs: [], error: 'Query is required.' }, 400)
  }

  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 30)
  const payload: Record<string, unknown> = {
    query,
    limit,
    country: body.country || 'US',
    sources: [{ type: 'web' }],
    ignoreInvalidURLs: true,
  }

  if (body.location) payload.location = body.location
  if (body.tbs) payload.tbs = body.tbs
  if (body.includeDomains?.length) payload.includeDomains = body.includeDomains

  if (body.scrapeContent) {
    payload.scrapeOptions = {
      formats: [
        { type: 'markdown' },
        {
          type: 'json',
          prompt:
            'Extract job posting fields if this page is a job listing. If not a job listing, set title to the page title and leave other fields empty.',
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              company: { type: 'string' },
              location: { type: 'string' },
              description: { type: 'string' },
              salary: { type: 'string' },
              employmentType: { type: 'string' },
              isJobPosting: { type: 'boolean' },
            },
          },
        },
      ],
      onlyMainContent: true,
    }
  }

  try {
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
      warning?: string
      creditsUsed?: number
      data?: { web?: unknown[] }
    }

    if (!upstream.ok || data.success === false) {
      return json(
        {
          success: false,
          query,
          jobs: [],
          error: data.error || `Firecrawl error (${upstream.status})`,
          creditsUsed: data.creditsUsed,
        },
        upstream.status >= 400 ? upstream.status : 502,
      )
    }

    const web = (data.data?.web ?? []) as Parameters<typeof normalizeResults>[0]
    const jobs = normalizeResults(web)

    return json({
      success: true,
      query,
      jobs,
      rawCount: web.length,
      creditsUsed: data.creditsUsed,
      warning: data.warning,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream request failed'
    return json({ success: false, query, jobs: [], error: message }, 502)
  }
}
