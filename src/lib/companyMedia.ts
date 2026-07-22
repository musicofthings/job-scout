import type { JobPosting } from './types'

/** ATS / aggregator hosts where the first path segment is usually a company slug. */
const SLUG_PATH_HOSTS = [
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.lever.co',
  'jobs.ashbyhq.com',
  'apply.workable.com',
  'jobs.smartrecruiters.com',
  'wellfound.com',
  'angel.co',
]

const SKIP_SLUGS = new Set([
  'jobs',
  'job',
  'careers',
  'career',
  'company',
  'companies',
  'role',
  'roles',
  'position',
  'positions',
  'opening',
  'openings',
  'embed',
  'v1',
  'v2',
  'api',
  'en',
  'us',
  'www',
  'app',
  'boards',
  'job-boards',
])

const NON_BRAND_HOSTS = new Set([
  'linkedin.com',
  'www.linkedin.com',
  'indeed.com',
  'www.indeed.com',
  'google.com',
  'www.google.com',
  'careers.google.com',
  'remoteok.com',
  'weworkremotely.com',
  'remotive.com',
  'wellfound.com',
  'angel.co',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'greenhouse.io',
  'jobs.lever.co',
  'lever.co',
  'jobs.ashbyhq.com',
  'ashbyhq.com',
  'apply.workable.com',
  'workable.com',
  'jobs.smartrecruiters.com',
  'smartrecruiters.com',
])

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function slugToDomain(slug: string): string | undefined {
  const clean = slug
    .toLowerCase()
    .replace(/\.com$/i, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
  if (!clean || clean.length < 2 || SKIP_SLUGS.has(clean)) return undefined
  // Common pattern: ATS slug is company domain label
  return `${clean}.com`
}

function companyNameToDomain(company: string): string | undefined {
  const base = company
    .toLowerCase()
    .replace(/\s+(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|gmbh|ag|plc|sa|bv|oy|ab)\.?$/i, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '')
  if (!base || base.length < 2) return undefined
  // Skip if company was just a hostname already
  if (base.includes('.')) return base.replace(/^www\./, '')
  return `${base}.com`
}

/**
 * Best-effort brand domain for logo lookup from a job URL + company label.
 */
export function guessBrandDomain(url: string, company: string): string | undefined {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const parts = u.pathname.split('/').filter(Boolean)

    // Direct company career sites (not ATS shells)
    if (host && !NON_BRAND_HOSTS.has(host) && !SLUG_PATH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      // e.g. careers.stripe.com → stripe.com
      const labels = host.split('.')
      if (labels.length >= 3 && ['careers', 'jobs', 'job', 'work', 'talent', 'hiring'].includes(labels[0])) {
        return labels.slice(1).join('.')
      }
      return host
    }

    // Greenhouse / Lever / Ashby / Workable style: /{company}/...
    for (const ats of SLUG_PATH_HOSTS) {
      if (host === ats || host.endsWith(`.${ats}`) || host.includes(ats.split('.')[0]!)) {
        // wellfound.com/company/{slug}
        if (host.includes('wellfound') || host.includes('angel.co')) {
          const idx = parts.findIndex((p) => p === 'company' || p === 'companies')
          if (idx >= 0 && parts[idx + 1]) return slugToDomain(parts[idx + 1]!)
        }
        if (parts[0]) {
          const domain = slugToDomain(parts[0])
          if (domain) return domain
        }
      }
    }

    // SmartRecruiters sometimes: /{company}/...
    if (host.includes('smartrecruiters') && parts[0]) {
      const domain = slugToDomain(parts[0])
      if (domain) return domain
    }
  } catch {
    /* fall through */
  }

  return companyNameToDomain(company)
}

/** Build ordered image candidates: OG/cover first, then brand logos, then board favicon. */
export function buildJobImageCandidates(
  job: Pick<JobPosting, 'url' | 'company' | 'source' | 'imageUrl'>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const push = (src?: string | null) => {
    const s = src?.trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    out.push(s)
  }

  // Explicit image from normalize / enrich (often og:image)
  push(job.imageUrl)

  const brand = guessBrandDomain(job.url, job.company)
  if (brand) {
    // Unavatar aggregates Clearbit-style brand logos + more
    push(`https://unavatar.io/${encodeURIComponent(brand)}`)
    // High-res Google favicon as reliable fallback
    push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(brand)}&sz=128`)
    // DuckDuckGo icon service
    push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(brand)}.ico`)
  }

  // Last resort: listing host favicon (board brand)
  const host = hostOf(job.url) || job.source
  if (host && host !== 'web') {
    push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`)
  }

  return out
}

/** Prefer logo layout unless we have a real photo/OG image URL. */
export function jobMediaVariant(
  job: Pick<JobPosting, 'imageUrl'>,
): 'cover' | 'logo' {
  const src = job.imageUrl?.toLowerCase() ?? ''
  if (!src) return 'logo'
  if (
    src.includes('unavatar.io') ||
    src.includes('favicon') ||
    src.includes('duckduckgo.com/ip3') ||
    src.includes('logo.clearbit') ||
    src.endsWith('.ico')
  ) {
    return 'logo'
  }
  // og:image / scraped media → cover
  if (/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(src) || src.includes('og') || src.includes('image')) {
    return 'cover'
  }
  return 'logo'
}
