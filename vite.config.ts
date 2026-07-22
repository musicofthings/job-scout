/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { normalizeResults } from './functions/lib/normalize'

/**
 * Local dev proxy mirroring Cloudflare Pages Functions so `npm run dev`
 * can call /api/* without wrangler. Production uses functions/api/*.
 */
function localApiPlugin(): Plugin {
  return {
    name: 'job-scout-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const apiKey = String(req.headers['x-firecrawl-key'] || '').trim()

          if (!apiKey) {
            res.statusCode = 401
            res.setHeader('Content-Type', 'application/json')
            const isSearch = req.url.startsWith('/api/search')
            res.end(
              JSON.stringify(
                isSearch
                  ? {
                      success: false,
                      query: '',
                      jobs: [],
                      error: 'Missing X-Firecrawl-Key header (BYOK).',
                    }
                  : {
                      success: false,
                      error: 'Missing X-Firecrawl-Key header (BYOK).',
                    },
              ),
            )
            return
          }

          if (req.url.startsWith('/api/search')) {
            const query = String(body.query || '').trim()
            if (!query) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  success: false,
                  query: '',
                  jobs: [],
                  error: 'Query is required.',
                }),
              )
              return
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
              data?: { web?: Parameters<typeof normalizeResults>[0] }
            }

            res.setHeader('Content-Type', 'application/json')
            if (!upstream.ok || data.success === false) {
              res.statusCode = upstream.status >= 400 ? upstream.status : 502
              res.end(
                JSON.stringify({
                  success: false,
                  query,
                  jobs: [],
                  error: data.error || `Firecrawl error (${upstream.status})`,
                  creditsUsed: data.creditsUsed,
                }),
              )
              return
            }

            const web = data.data?.web ?? []
            res.statusCode = 200
            res.end(
              JSON.stringify({
                success: true,
                query,
                jobs: normalizeResults(web),
                rawCount: web.length,
                creditsUsed: data.creditsUsed,
                warning: data.warning,
              }),
            )
            return
          }

          if (req.url.startsWith('/api/scrape')) {
            const url = String(body.url || '').trim()
            if (!url) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'URL is required.' }))
              return
            }

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
                metadata?: { title?: string; description?: string }
              }
            }

            res.setHeader('Content-Type', 'application/json')
            if (!upstream.ok || data.success === false) {
              res.statusCode = upstream.status >= 400 ? upstream.status : 502
              res.end(
                JSON.stringify({
                  success: false,
                  error: data.error || `Firecrawl scrape error (${upstream.status})`,
                }),
              )
              return
            }

            const extracted = data.data?.json ?? {}
            const meta = data.data?.metadata ?? {}
            res.statusCode = 200
            res.end(
              JSON.stringify({
                success: true,
                job: {
                  title: extracted.title || meta.title || '',
                  company: extracted.company || '',
                  location: extracted.location || '',
                  description: extracted.description || meta.description || '',
                  salaryHint: extracted.salary || '',
                  url,
                  markdown: data.data?.markdown,
                  tags: extracted.employmentType
                    ? [extracted.employmentType.toLowerCase()]
                    : [],
                },
              }),
            )
            return
          }

          next()
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : 'Local API error',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
  },
})
