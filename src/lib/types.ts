export type WorkMode = 'any' | 'remote' | 'hybrid' | 'onsite'
export type ExperienceLevel = 'any' | 'internship' | 'entry' | 'mid' | 'senior' | 'lead' | 'executive'
export type TimeRange = 'any' | 'day' | 'week' | 'month'

export interface SearchFilters {
  keywords: string
  jobTitles: string
  region: string
  country: string
  roleTypes: string[]
  workMode: WorkMode
  experience: ExperienceLevel
  timeRange: TimeRange
  limit: number
  scrapeContent: boolean
  boards: string[]
}

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

export interface SearchResponse {
  success: boolean
  query: string
  jobs: JobPosting[]
  creditsUsed?: number
  warning?: string
  error?: string
  rawCount?: number
}

export interface ScrapeJobResponse {
  success: boolean
  job?: Partial<JobPosting> & { markdown?: string }
  error?: string
}

/** Curated public job-board hostnames (Firecrawl includeDomains). */
export const JOB_BOARDS: { id: string; label: string; domains: string[] }[] = [
  {
    id: 'greenhouse',
    label: 'Greenhouse',
    domains: ['boards.greenhouse.io', 'job-boards.greenhouse.io', 'greenhouse.io'],
  },
  {
    id: 'lever',
    label: 'Lever',
    domains: ['jobs.lever.co', 'lever.co'],
  },
  {
    id: 'ashby',
    label: 'Ashby',
    domains: ['jobs.ashbyhq.com', 'ashbyhq.com'],
  },
  {
    id: 'workable',
    label: 'Workable',
    domains: ['apply.workable.com', 'workable.com'],
  },
  {
    id: 'smartrecruiters',
    label: 'SmartRecruiters',
    domains: ['jobs.smartrecruiters.com', 'smartrecruiters.com'],
  },
  {
    id: 'wellfound',
    label: 'Wellfound',
    domains: ['wellfound.com'],
  },
  {
    id: 'remoteok',
    label: 'RemoteOK',
    domains: ['remoteok.com'],
  },
  {
    id: 'weworkremotely',
    label: 'We Work Remotely',
    domains: ['weworkremotely.com'],
  },
  {
    id: 'remotive',
    label: 'Remotive',
    domains: ['remotive.com'],
  },
  {
    id: 'indeed',
    label: 'Indeed',
    domains: ['indeed.com', 'www.indeed.com'],
  },
  {
    id: 'linkedin',
    label: 'LinkedIn Jobs (public)',
    domains: ['linkedin.com', 'www.linkedin.com'],
  },
  {
    id: 'google',
    label: 'Google Jobs / Careers',
    domains: ['careers.google.com', 'www.google.com'],
  },
]

export const ROLE_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Freelance',
  'Internship',
  'Temporary',
]

export const DEFAULT_FILTERS: SearchFilters = {
  keywords: '',
  jobTitles: '',
  region: '',
  country: 'US',
  roleTypes: ['Full-time'],
  workMode: 'any',
  experience: 'any',
  timeRange: 'month',
  limit: 12,
  scrapeContent: false,
  boards: ['greenhouse', 'lever', 'ashby', 'wellfound', 'remoteok'],
}

export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapore' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IE', name: 'Ireland' },
  { code: 'JP', name: 'Japan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AE', name: 'United Arab Emirates' },
]
