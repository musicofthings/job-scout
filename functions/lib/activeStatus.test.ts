import { describe, expect, it } from 'vitest'
import { detectActiveStatus } from './activeStatus'

describe('detectActiveStatus', () => {
  it('marks closed listings inactive', () => {
    const r = detectActiveStatus({
      text: 'Sorry, this position has been filled. We are no longer accepting applications.',
    })
    expect(r.status).toBe('inactive')
    expect(r.confidence).toBe('high')
  })

  it('marks apply CTA as active', () => {
    const r = detectActiveStatus({
      text: 'We are hiring a Staff Engineer. Apply now to join the team.',
    })
    expect(r.status).toBe('active')
  })

  it('respects structured isOpen false', () => {
    const r = detectActiveStatus({
      text: 'Something vague',
      structuredOpen: false,
    })
    expect(r.status).toBe('inactive')
    expect(r.confidence).toBe('high')
  })

  it('uses HTTP 404 as inactive', () => {
    const r = detectActiveStatus({ httpStatus: 404, text: '' })
    expect(r.status).toBe('inactive')
  })

  it('returns unknown for empty content', () => {
    expect(detectActiveStatus({ text: '' }).status).toBe('unknown')
  })
})
