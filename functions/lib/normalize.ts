export interface JobPosting {
  id: string
  title: string
  company: string
  location: string
  description: string
  url: string
  source: string
  postedHint?: string
  salaryHint?: string
  tags: string[]
  markdown?: string
}

interface FirecrawlWebResult {
  title?: string
  description?: string
  url?: string
  markdown?: string
  metadata?: {
    title?: string
    description?: string
    sourceURL?: string
    url?: string
  }
  json?: Record<string, unknown>
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'web'
  }
}

function guessCompany(title: string, url: string, description: string): string {
  // Patterns: "Role at Company" / "Role | Company" / "Company is hiring"
  const atMatch = title.match(/\bat\s+(.+)$/i)
  if (atMatch?.[1]) return cleanCompany(atMatch[1])

  const pipeMatch = title.match(/\|\s*(.+)$/)
  if (pipeMatch?.[1] && pipeMatch[1].length < 60) return cleanCompany(pipeMatch[1])

  const dashMatch = title.match(/[-–—]\s*(.+)$/)
  if (dashMatch?.[1] && dashMatch[1].length < 60) return cleanCompany(dashMatch[1])

  const hireMatch = description.match(/^([A-Z][\w&.\s]{1,40})\s+is hiring/i)
  if (hireMatch?.[1]) return cleanCompany(hireMatch[1])

  // Greenhouse / Lever path often embeds company slug
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (u.hostname.includes('greenhouse') && parts[0]) {
      return titleCase(parts[0].replace(/[-_]/g, ' '))
    }
    if (u.hostname.includes('lever.co') && parts[0]) {
      return titleCase(parts[0].replace(/[-_]/g, ' '))
    }
    if (u.hostname.includes('ashbyhq') && parts[0]) {
      return titleCase(parts[0].replace(/[-_]/g, ' '))
    }
  } catch {
    /* ignore */
  }

  return hostOf(url)
}

function cleanCompany(s: string): string {
  return s
    .replace(/\s*[|·•].*$/, '')
    .replace(/\s+[-–—].*$/, '')
    .replace(/\s+(hiring|careers|jobs).*$/i, '')
    .trim()
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function extractLocation(text: string): string {
  const patterns = [
    /(?:location|based in|office)[:\s]+([^\n.|]{3,60})/i,
    /\b(Remote(?:\s*[-–—]\s*[A-Z]{2})?)\b/i,
    /\b([A-Z][a-zA-Z.]+(?:,\s*[A-Z]{2})(?:\s*,\s*[A-Za-z\s]+)?)\b/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

function extractSalary(text: string): string | undefined {
  const m = text.match(
    /(?:\$|USD|EUR|£|₹)\s?[\d,]+(?:\s*[-–—]\s*(?:\$|USD|EUR|£|₹)?\s?[\d,]+)?(?:\s*(?:k|K|\/yr|\/year|per year|a year))?/,
  )
  return m?.[0]?.trim()
}

function cleanTitle(title: string, company: string): string {
  let t = title
    .replace(/\s*[|·•]\s*.*$/, '')
    .replace(new RegExp(`\\s+at\\s+${escapeRe(company)}\\s*$`, 'i'), '')
    .replace(/\s*[-–—]\s*.*$/, '')
    .trim()
  if (t.length < 3) t = title
  return t
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hashId(url: string): string {
  let h = 0
  for (let i = 0; i < url.length; i++) h = (Math.imul(31, h) + url.charCodeAt(i)) | 0
  return `job_${Math.abs(h).toString(36)}`
}

export function normalizeResults(web: FirecrawlWebResult[]): JobPosting[] {
  const seen = new Set<string>()
  const jobs: JobPosting[] = []

  for (const item of web) {
    const url = item.url || item.metadata?.url || item.metadata?.sourceURL || ''
    if (!url || seen.has(url)) continue
    seen.add(url)

    const json = item.json ?? {}
    const title =
      (typeof json.title === 'string' && json.title) ||
      item.title ||
      item.metadata?.title ||
      'Untitled role'
    const description =
      (typeof json.description === 'string' && json.description) ||
      item.description ||
      item.metadata?.description ||
      ''
    const company =
      (typeof json.company === 'string' && json.company) ||
      guessCompany(title, url, description)
    const location =
      (typeof json.location === 'string' && json.location) ||
      extractLocation(`${title}\n${description}`)
    const salaryHint =
      (typeof json.salary === 'string' && json.salary) || extractSalary(description)
    const tags: string[] = []
    if (/remote/i.test(`${title} ${description} ${location}`)) tags.push('remote')
    if (/hybrid/i.test(`${title} ${description}`)) tags.push('hybrid')
    if (/contract|freelance/i.test(`${title} ${description}`)) tags.push('contract')
    if (/full[- ]?time/i.test(`${title} ${description}`)) tags.push('full-time')

    jobs.push({
      id: hashId(url),
      title: cleanTitle(title, company),
      company,
      location: location || 'Not specified',
      description: description.slice(0, 600),
      url,
      source: hostOf(url),
      salaryHint,
      tags,
      markdown: item.markdown,
    })
  }

  return jobs
}
