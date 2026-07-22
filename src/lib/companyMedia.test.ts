import { describe, expect, it } from 'vitest'
import { buildJobImageCandidates, guessBrandDomain, jobMediaVariant } from './companyMedia'

describe('guessBrandDomain', () => {
  it('extracts greenhouse company slug as .com domain', () => {
    expect(
      guessBrandDomain('https://boards.greenhouse.io/spacex/jobs/123', 'SpaceX'),
    ).toBe('spacex.com')
  })

  it('extracts lever company slug', () => {
    expect(guessBrandDomain('https://jobs.lever.co/netflix/abc', 'Netflix')).toBe(
      'netflix.com',
    )
  })

  it('extracts ashby company slug', () => {
    expect(
      guessBrandDomain('https://jobs.ashbyhq.com/anthropic/role-1', 'Anthropic'),
    ).toBe('anthropic.com')
  })

  it('uses company career subdomain root', () => {
    expect(
      guessBrandDomain('https://careers.stripe.com/jobs/123', 'Stripe'),
    ).toBe('stripe.com')
  })

  it('strips jobs/careers subdomains to brand host', () => {
    expect(
      guessBrandDomain('https://jobs.example-corp.io/openings/1', 'Example'),
    ).toBe('example-corp.io')
  })

  it('falls back to company name domain for aggregator hosts', () => {
    expect(
      guessBrandDomain('https://www.indeed.com/viewjob?jk=1', 'OpenAI'),
    ).toBe('openai.com')
  })
})

describe('buildJobImageCandidates', () => {
  it('prefers explicit imageUrl then brand logos', () => {
    const list = buildJobImageCandidates({
      url: 'https://boards.greenhouse.io/acme/jobs/1',
      company: 'Acme',
      source: 'boards.greenhouse.io',
      imageUrl: 'https://cdn.example.com/og.png',
    })
    expect(list[0]).toBe('https://cdn.example.com/og.png')
    expect(list.some((u) => u.includes('unavatar.io') && u.includes('acme.com'))).toBe(
      true,
    )
    expect(list.some((u) => u.includes('google.com/s2/favicons'))).toBe(true)
  })

  it('still returns board favicon when brand unknown', () => {
    const list = buildJobImageCandidates({
      url: 'https://www.indeed.com/viewjob?jk=x',
      company: '',
      source: 'indeed.com',
    })
    expect(list.length).toBeGreaterThan(0)
    expect(list.some((u) => u.includes('indeed.com'))).toBe(true)
  })
})

describe('jobMediaVariant', () => {
  it('treats favicon/logo endpoints as logo', () => {
    expect(jobMediaVariant({ imageUrl: 'https://unavatar.io/acme.com' })).toBe('logo')
    expect(
      jobMediaVariant({
        imageUrl: 'https://www.google.com/s2/favicons?domain=acme.com&sz=128',
      }),
    ).toBe('logo')
  })

  it('treats photo urls as cover', () => {
    expect(
      jobMediaVariant({ imageUrl: 'https://cdn.example.com/assets/hero.jpg' }),
    ).toBe('cover')
  })
})
