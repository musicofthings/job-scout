export type ActiveStatus = 'active' | 'inactive' | 'unknown'

export interface ActiveCheckResult {
  status: ActiveStatus
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

const INACTIVE_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /no longer accepting\s+(applications|applicants)/i, reason: 'No longer accepting applications' },
  { re: /this (position|job|role|posting)\s+(has been\s+)?(filled|closed)/i, reason: 'Position filled or closed' },
  { re: /job\s+(is\s+)?(no longer available|closed|expired)/i, reason: 'Job no longer available' },
  { re: /posting\s+(has\s+)?(expired|been removed|closed)/i, reason: 'Posting expired or removed' },
  { re: /applications?\s+(have|has)\s+closed/i, reason: 'Applications closed' },
  { re: /not\s+accepting\s+applications/i, reason: 'Not accepting applications' },
  { re: /this\s+requisition\s+is\s+closed/i, reason: 'Requisition closed' },
  { re: /sorry[,.]?\s+this\s+job\s+is\s+no\s+longer/i, reason: 'Job no longer listed' },
  { re: /position\s+withdrawn/i, reason: 'Position withdrawn' },
  { re: /page\s+not\s+found|404\s+not\s+found|error\s+404/i, reason: 'Page not found' },
  { re: /job\s+opening\s+is\s+no\s+longer\s+active/i, reason: 'Opening no longer active' },
  { re: /this\s+job\s+has\s+been\s+taken\s+down/i, reason: 'Job taken down' },
  { re: /application\s+deadline\s+has\s+passed/i, reason: 'Application deadline passed' },
  { re: /\b(closed\s+job|job\s+closed)\b/i, reason: 'Marked closed' },
]

const ACTIVE_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\bapply\s+now\b/i, reason: 'Apply now CTA present' },
  { re: /\bsubmit\s+(your\s+)?application\b/i, reason: 'Submit application present' },
  { re: /\beasy\s+apply\b/i, reason: 'Easy apply present' },
  { re: /\bstart\s+(your\s+)?application\b/i, reason: 'Start application present' },
  { re: /\bapply\s+for\s+this\s+(job|role|position)\b/i, reason: 'Apply CTA present' },
  { re: /\bwe'?re\s+hiring\b/i, reason: 'Hiring language present' },
  { re: /\bopen\s+role\b/i, reason: 'Open role language' },
  { re: /\bapplications?\s+(are\s+)?open\b/i, reason: 'Applications open' },
]

/**
 * Classify whether a job posting page still looks open based on scraped text / signals.
 */
export function detectActiveStatus(input: {
  text?: string
  title?: string
  httpStatus?: number
  structuredOpen?: boolean | null
}): ActiveCheckResult {
  if (typeof input.httpStatus === 'number') {
    if (input.httpStatus === 404 || input.httpStatus === 410) {
      return {
        status: 'inactive',
        reason: `HTTP ${input.httpStatus}`,
        confidence: 'high',
      }
    }
    if (input.httpStatus >= 500) {
      return {
        status: 'unknown',
        reason: `HTTP ${input.httpStatus}`,
        confidence: 'low',
      }
    }
  }

  if (typeof input.structuredOpen === 'boolean') {
    return {
      status: input.structuredOpen ? 'active' : 'inactive',
      reason: input.structuredOpen
        ? 'Structured extraction: still open'
        : 'Structured extraction: closed',
      confidence: 'high',
    }
  }

  const blob = `${input.title || ''}\n${input.text || ''}`.trim()
  if (!blob) {
    return { status: 'unknown', reason: 'No page content to inspect', confidence: 'low' }
  }

  for (const p of INACTIVE_PATTERNS) {
    if (p.re.test(blob)) {
      return { status: 'inactive', reason: p.reason, confidence: 'high' }
    }
  }

  for (const p of ACTIVE_PATTERNS) {
    if (p.re.test(blob)) {
      return { status: 'active', reason: p.reason, confidence: 'medium' }
    }
  }

  // Soft signal: substantial content without closed language
  if (blob.length > 400) {
    return {
      status: 'active',
      reason: 'Listing content present; no closed signals',
      confidence: 'low',
    }
  }

  return {
    status: 'unknown',
    reason: 'Could not determine from page content',
    confidence: 'low',
  }
}
