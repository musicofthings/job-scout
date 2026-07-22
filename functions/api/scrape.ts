interface ScrapeBody {
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
 * BYOK proxy: scrape a single job URL with structured JSON extraction.
 */
export const onRequestPost: PagesFunction = async (context) => {
  const apiKey = context.request.headers.get('X-Firecrawl-Key')?.trim()
  if (!apiKey) {
    return json({ success: false, error: 'Missing X-Firecrawl-Key header (BYOK).' }, 401)
  }

  let body: ScrapeBody
  try {
    body = (await context.request.json()) as ScrapeBody
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
              'Extract structured job posting details from this page. Prefer concise plain text.',
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                company: { type: 'string' },
                location: { type: 'string' },
                description: { type: 'string' },
                salary: { type: 'string' },
                employmentType: { type: 'string' },
                requirements: { type: 'string' },
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
        json?: Record<string, string>
        metadata?: { title?: string; description?: string; sourceURL?: string }
      }
    }

    if (!upstream.ok || data.success === false) {
      return json(
        { success: false, error: data.error || `Firecrawl scrape error (${upstream.status})` },
        upstream.status >= 400 ? upstream.status : 502,
      )
    }

    const extracted = data.data?.json ?? {}
    const meta = data.data?.metadata ?? {}

    return json({
      success: true,
      job: {
        title: extracted.title || meta.title || '',
        company: extracted.company || '',
        location: extracted.location || '',
        description: extracted.description || meta.description || '',
        salaryHint: extracted.salary || '',
        url,
        markdown: data.data?.markdown,
        tags: extracted.employmentType ? [extracted.employmentType.toLowerCase()] : [],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream scrape failed'
    return json({ success: false, error: message }, 502)
  }
}
