/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { normalizeResults } from './functions/lib/normalize'
import { detectActiveStatus } from './functions/lib/activeStatus'

/** In-memory digest store for local `npm run dev` only. */
const localDigests = new Map<
  string,
  {
    id: string
    email: string
    label: string
    unsubToken: string
    hourUtc: number
    filters: unknown
    firecrawlKey: string
  }
>()

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
        const path = req.url.split('?')[0] || req.url

        try {
          // One-click unsub (GET)
          if (req.method === 'GET' && path.startsWith('/api/digest/unsubscribe')) {
            const u = new URL(req.url, 'http://localhost')
            const email = (u.searchParams.get('email') || '').toLowerCase()
            const token = u.searchParams.get('token') || ''
            const sub = localDigests.get(email)
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            if (!sub || sub.unsubToken !== token) {
              res.statusCode = 404
              res.end('<p>Subscription not found.</p>')
              return
            }
            localDigests.delete(email)
            res.statusCode = 200
            res.end(`<p>Unsubscribed ${email} (local dev store).</p>`)
            return
          }

          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
            return
          }

          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const apiKey = String(req.headers['x-firecrawl-key'] || '').trim()

          // Digest routes (no X-Firecrawl-Key header required)
          if (path.startsWith('/api/digest/subscribe')) {
            const email = String(body.email || '')
              .trim()
              .toLowerCase()
            const firecrawlKey = String(body.firecrawlKey || '').trim()
            if (!email || !firecrawlKey) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'email and firecrawlKey are required',
                }),
              )
              return
            }
            const id = `local_${Date.now().toString(36)}`
            const unsubToken = `tok_${Math.random().toString(36).slice(2)}`
            const hourLocal = Number(body.hourLocal ?? 8)
            const offset = Number(body.timezoneOffsetMinutes ?? 0)
            const hourUtc = (Math.floor(hourLocal) + Math.floor(offset / 60) + 48) % 24
            localDigests.set(email, {
              id,
              email,
              label: String(body.label || 'Daily job digest'),
              unsubToken,
              hourUtc,
              filters: body.filters,
              firecrawlKey,
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                success: true,
                id,
                email,
                hourUtc,
                label: body.label || 'Daily job digest',
                unsubToken,
                message:
                  'Local dev: digest saved in memory only. Configure KV + Resend for production email.',
              }),
            )
            return
          }

          if (path.startsWith('/api/digest/unsubscribe')) {
            const email = String(body.email || '')
              .trim()
              .toLowerCase()
            const token = String(body.token || '').trim()
            const sub = localDigests.get(email)
            res.setHeader('Content-Type', 'application/json')
            if (!sub || sub.unsubToken !== token) {
              res.statusCode = 404
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'Subscription not found or token mismatch.',
                }),
              )
              return
            }
            localDigests.delete(email)
            res.statusCode = 200
            res.end(
              JSON.stringify({
                success: true,
                message: 'Unsubscribed (local dev store).',
              }),
            )
            return
          }

          if (path.startsWith('/api/digest/run')) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                success: true,
                processed: localDigests.size,
                results: [...localDigests.values()].map((s) => ({
                  id: s.id,
                  email: s.email,
                  status: 'skipped_local',
                  error: 'Local dev does not send email. Use production cron + Resend.',
                })),
              }),
            )
            return
          }

          const needsKey =
            path.startsWith('/api/search') ||
            path.startsWith('/api/scrape') ||
            path.startsWith('/api/active')

          if (needsKey && !apiKey) {
            res.statusCode = 401
            res.setHeader('Content-Type', 'application/json')
            const isSearch = path.startsWith('/api/search')
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

          if (path.startsWith('/api/active')) {
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
                      'Determine if this page is an open job application. Set isOpen true only if candidates can still apply.',
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
            res.setHeader('Content-Type', 'application/json')
            if (!upstream.ok || data.success === false) {
              const err = data.error || `Firecrawl scrape error (${upstream.status})`
              if (/404|not found|gone/i.test(err) || upstream.status === 404) {
                res.statusCode = 200
                res.end(
                  JSON.stringify({
                    success: true,
                    url,
                    status: 'inactive',
                    reason: err,
                    confidence: 'high',
                  }),
                )
                return
              }
              res.statusCode = upstream.status >= 400 ? upstream.status : 502
              res.end(JSON.stringify({ success: false, error: err }))
              return
            }
            const extracted = data.data?.json ?? {}
            const result = detectActiveStatus({
              text: `${data.data?.markdown || ''}\n${extracted.statusLabel || ''}`,
              title: extracted.title || data.data?.metadata?.title || '',
              httpStatus: data.data?.metadata?.statusCode,
              structuredOpen: typeof extracted.isOpen === 'boolean' ? extracted.isOpen : null,
            })
            res.statusCode = 200
            res.end(
              JSON.stringify({
                success: true,
                url,
                status: result.status,
                reason: result.reason,
                confidence: result.confidence,
              }),
            )
            return
          }

          if (path.startsWith('/api/search')) {
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

          if (path.startsWith('/api/scrape')) {
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
