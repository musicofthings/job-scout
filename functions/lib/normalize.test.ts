import { describe, expect, it } from 'vitest'
import { normalizeResults } from './normalize'

describe('normalizeResults', () => {
  it('maps search hits into job cards', () => {
    const jobs = normalizeResults([
      {
        title: 'Senior Backend Engineer at Acme Corp',
        description: 'Remote full-time role. Salary $150,000-$180,000. We are hiring.',
        url: 'https://jobs.lever.co/acme/abc123',
      },
    ])

    expect(jobs).toHaveLength(1)
    expect(jobs[0].title).toMatch(/Senior Backend Engineer/i)
    expect(jobs[0].company.toLowerCase()).toContain('acme')
    expect(jobs[0].url).toBe('https://jobs.lever.co/acme/abc123')
    expect(jobs[0].source).toBe('jobs.lever.co')
    expect(jobs[0].tags).toEqual(expect.arrayContaining(['remote', 'full-time']))
    expect(jobs[0].salaryHint).toMatch(/150/)
    expect(jobs[0].id).toMatch(/^job_/)
  })

  it('deduplicates by URL', () => {
    const jobs = normalizeResults([
      { title: 'A', url: 'https://example.com/job/1', description: 'x' },
      { title: 'B', url: 'https://example.com/job/1', description: 'y' },
    ])
    expect(jobs).toHaveLength(1)
  })

  it('prefers structured json extraction when present', () => {
    const jobs = normalizeResults([
      {
        title: 'Page Title',
        url: 'https://boards.greenhouse.io/foo/jobs/1',
        description: 'snippet',
        json: {
          title: 'Research Scientist',
          company: 'Foo Labs',
          location: 'Boston, MA',
          description: 'Genomics focus',
          salary: '$120k',
        },
      },
    ])

    expect(jobs[0].title).toBe('Research Scientist')
    expect(jobs[0].company).toBe('Foo Labs')
    expect(jobs[0].location).toBe('Boston, MA')
    expect(jobs[0].description).toBe('Genomics focus')
    expect(jobs[0].salaryHint).toBe('$120k')
  })

  it('guesses company from greenhouse path', () => {
    const jobs = normalizeResults([
      {
        title: 'Software Engineer',
        url: 'https://boards.greenhouse.io/spacex/jobs/999',
        description: 'Build rockets',
      },
    ])
    expect(jobs[0].company.toLowerCase()).toContain('spacex')
  })

  it('skips entries without urls', () => {
    expect(normalizeResults([{ title: 'No URL' }])).toHaveLength(0)
  })
})
