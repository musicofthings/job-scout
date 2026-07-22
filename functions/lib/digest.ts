import type { SearchFilters } from '../../src/lib/types'
import { decryptText, encryptText, randomToken } from './crypto'

export interface DigestSubscription {
  id: string
  email: string
  label: string
  filters: SearchFilters
  /** AES-GCM encrypted Firecrawl key (BYOK stored only for digest runs). */
  firecrawlKeyEnc: string
  /** Hour of day in UTC (0–23) when the digest should send. */
  hourUtc: number
  timezone: string
  createdAt: string
  lastSentAt?: string
  unsubToken: string
  active: boolean
}

export interface DigestEnv {
  DIGESTS?: KVNamespace
  /** Preferred: Google Apps Script web app URL that sends via your Gmail. */
  GMAIL_APPS_SCRIPT_URL?: string
  /** Optional shared secret checked by the Apps Script (defaults to CRON_SECRET). */
  GMAIL_APPS_SCRIPT_SECRET?: string
  /** Gmail API OAuth (alternative to Apps Script). */
  GMAIL_CLIENT_ID?: string
  GMAIL_CLIENT_SECRET?: string
  GMAIL_REFRESH_TOKEN?: string
  /** From address, e.g. you@gmail.com (required for Gmail API / optional display for Apps Script). */
  DIGEST_FROM_EMAIL?: string
  /** Optional fallback if Gmail is not configured. */
  RESEND_API_KEY?: string
  DIGEST_ENCRYPTION_KEY?: string
  CRON_SECRET?: string
  PUBLIC_APP_URL?: string
}

const INDEX_KEY = 'digest:index'

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

export function requireKv(env: DigestEnv): KVNamespace | Response {
  if (!env.DIGESTS) {
    return json(
      {
        success: false,
        error:
          'Digest storage is not configured. Bind a KV namespace as DIGESTS in Cloudflare Pages (see README).',
      },
      503,
    )
  }
  return env.DIGESTS
}

export function encryptionSecret(env: DigestEnv): string | Response {
  const secret = env.DIGEST_ENCRYPTION_KEY || env.CRON_SECRET
  if (!secret || secret.length < 16) {
    return json(
      {
        success: false,
        error:
          'Set DIGEST_ENCRYPTION_KEY (or CRON_SECRET, min 16 chars) to encrypt Firecrawl keys for digests.',
      },
      503,
    )
  }
  return secret
}

export async function listSubscriptionIds(kv: KVNamespace): Promise<string[]> {
  const raw = await kv.get(INDEX_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveSubscription(
  kv: KVNamespace,
  sub: DigestSubscription,
): Promise<void> {
  await kv.put(`digest:sub:${sub.id}`, JSON.stringify(sub))
  const ids = await listSubscriptionIds(kv)
  if (!ids.includes(sub.id)) {
    ids.push(sub.id)
    await kv.put(INDEX_KEY, JSON.stringify(ids))
  }
  await kv.put(`digest:email:${sub.email.toLowerCase()}`, sub.id)
}

export async function getSubscription(
  kv: KVNamespace,
  id: string,
): Promise<DigestSubscription | null> {
  const raw = await kv.get(`digest:sub:${id}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DigestSubscription
  } catch {
    return null
  }
}

export async function getSubscriptionByEmail(
  kv: KVNamespace,
  email: string,
): Promise<DigestSubscription | null> {
  const id = await kv.get(`digest:email:${email.toLowerCase()}`)
  if (!id) return null
  return getSubscription(kv, id)
}

export async function deleteSubscription(kv: KVNamespace, sub: DigestSubscription): Promise<void> {
  await kv.delete(`digest:sub:${sub.id}`)
  await kv.delete(`digest:email:${sub.email.toLowerCase()}`)
  const ids = (await listSubscriptionIds(kv)).filter((id) => id !== sub.id)
  await kv.put(INDEX_KEY, JSON.stringify(ids))
}

export async function createSubscription(input: {
  email: string
  label: string
  filters: SearchFilters
  firecrawlKey: string
  hourUtc: number
  timezone: string
  secret: string
}): Promise<DigestSubscription> {
  const now = new Date().toISOString()
  const id = `dg_${Date.now().toString(36)}_${randomToken(6)}`
  return {
    id,
    email: input.email.trim().toLowerCase(),
    label: input.label.trim() || 'Daily job digest',
    filters: input.filters,
    firecrawlKeyEnc: await encryptText(input.firecrawlKey, input.secret),
    hourUtc: Math.min(23, Math.max(0, Math.floor(input.hourUtc))),
    timezone: input.timezone || 'UTC',
    createdAt: now,
    unsubToken: randomToken(24),
    active: true,
  }
}

export async function unlockFirecrawlKey(
  sub: DigestSubscription,
  secret: string,
): Promise<string> {
  return decryptText(sub.firecrawlKeyEnc, secret)
}

export function isDueToday(sub: DigestSubscription, now = new Date()): boolean {
  if (!sub.active) return false
  const hour = now.getUTCHours()
  // Send in the subscriber's preferred UTC hour window (same hour)
  if (hour !== sub.hourUtc) return false
  if (!sub.lastSentAt) return true
  const last = new Date(sub.lastSentAt)
  const sameDay =
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth() &&
    last.getUTCDate() === now.getUTCDate()
  return !sameDay
}

export function buildDigestHtml(input: {
  label: string
  query: string
  jobs: { title: string; company: string; location: string; url: string; source: string }[]
  appUrl: string
  unsubUrl: string
}): string {
  const rows = input.jobs.length
    ? input.jobs
        .map(
          (j) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e8e0d4;">
          <a href="${escapeHtml(j.url)}" style="color:#050142;font-weight:600;text-decoration:none;font-size:16px;">${escapeHtml(j.title)}</a>
          <div style="color:#6b635a;font-size:13px;margin-top:4px;">${escapeHtml(j.company)} · ${escapeHtml(j.location)}</div>
          <div style="color:#9a9187;font-size:12px;margin-top:2px;">${escapeHtml(j.source)}</div>
        </td>
      </tr>`,
        )
        .join('')
    : `<tr><td style="padding:16px 0;color:#6b635a;">No new postings matched your filters today.</td></tr>`

  return `<!doctype html>
<html>
<body style="margin:0;background:#fbf8f2;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#221510;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#6b635a;">Job Scout · daily digest</div>
    <h1 style="font-family:Georgia,serif;font-size:28px;letter-spacing:-0.03em;margin:8px 0 6px;">${escapeHtml(input.label)}</h1>
    <p style="color:#6b635a;font-size:14px;line-height:1.5;margin:0 0 20px;">Query: <code style="background:#f3ede4;padding:2px 6px;border-radius:4px;">${escapeHtml(input.query)}</code></p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffcf7;border:1px solid #e8e0d4;border-radius:16px;padding:8px 18px;">
      ${rows}
    </table>
    <p style="margin:24px 0 8px;">
      <a href="${escapeHtml(input.appUrl)}" style="display:inline-block;background:#050142;color:#fffcf7;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:600;">Open Job Scout</a>
    </p>
    <p style="color:#9a9187;font-size:12px;line-height:1.5;">
      You’re receiving this because you scheduled a daily digest.
      <a href="${escapeHtml(input.unsubUrl)}" style="color:#6b635a;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendDigestEmail(
  env: DigestEnv,
  input: { to: string; subject: string; html: string },
): Promise<{ ok: boolean; error?: string }> {
  // 1) Gmail via Google Apps Script (recommended — uses your Gmail mailbox)
  if (env.GMAIL_APPS_SCRIPT_URL?.trim()) {
    return sendViaGmailAppsScript(env, input)
  }

  // 2) Gmail API with OAuth refresh token
  if (env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN) {
    return sendViaGmailApi(env, input)
  }

  // 3) Optional Resend fallback
  if (env.RESEND_API_KEY && env.DIGEST_FROM_EMAIL) {
    return sendViaResend(env, input)
  }

  return {
    ok: false,
    error:
      'No email provider configured. Set GMAIL_APPS_SCRIPT_URL (recommended) or Gmail OAuth vars (GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN + DIGEST_FROM_EMAIL).',
  }
}

async function sendViaGmailAppsScript(
  env: DigestEnv,
  input: { to: string; subject: string; html: string },
): Promise<{ ok: boolean; error?: string }> {
  const url = env.GMAIL_APPS_SCRIPT_URL!.trim()
  const secret = env.GMAIL_APPS_SCRIPT_SECRET || env.CRON_SECRET || ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        to: input.to,
        subject: input.subject,
        html: input.html,
        from: env.DIGEST_FROM_EMAIL,
      }),
      redirect: 'follow',
    })
    const text = await res.text()
    if (!res.ok) {
      return { ok: false, error: `Gmail Apps Script error (${res.status}): ${text.slice(0, 200)}` }
    }
    try {
      const data = JSON.parse(text) as { ok?: boolean; error?: string }
      if (data.ok === false) {
        return { ok: false, error: data.error || 'Gmail Apps Script rejected the send' }
      }
    } catch {
      /* Apps Script sometimes returns empty/HTML on success after redirect */
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gmail Apps Script request failed',
    }
  }
}

async function sendViaGmailApi(
  env: DigestEnv,
  input: { to: string; subject: string; html: string },
): Promise<{ ok: boolean; error?: string }> {
  const from = (env.DIGEST_FROM_EMAIL || '').trim()
  if (!from) {
    return { ok: false, error: 'Set DIGEST_FROM_EMAIL to your Gmail address for Gmail API sends.' }
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID!,
      client_secret: env.GMAIL_CLIENT_SECRET!,
      refresh_token: env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }
  if (!tokenRes.ok || !tokenData.access_token) {
    return {
      ok: false,
      error: `Gmail OAuth token error: ${tokenData.error || tokenRes.status}`,
    }
  }

  const raw = toBase64Url(
    [
      `From: ${from}`,
      `To: ${input.to}`,
      `Subject: ${encodeRfc2047(input.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      input.html,
    ].join('\r\n'),
  )

  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!sendRes.ok) {
    const text = await sendRes.text()
    return { ok: false, error: `Gmail API send error (${sendRes.status}): ${text.slice(0, 200)}` }
  }
  return { ok: true }
}

async function sendViaResend(
  env: DigestEnv,
  input: { to: string; subject: string; html: string },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.DIGEST_FROM_EMAIL,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `Resend error (${res.status}): ${text.slice(0, 200)}` }
  }
  return { ok: true }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const b64 = btoa(binary)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/** Encode Subject for non-ASCII safely (RFC 2047). */
function encodeRfc2047(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject
  const b64 = btoa(unescape(encodeURIComponent(subject)))
  return `=?UTF-8?B?${b64}?=`
}
