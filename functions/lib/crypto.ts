/** AES-GCM encrypt/decrypt for storing Firecrawl keys on digest subscriptions. */

function bytesToB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]!)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('job-scout-digest-v1'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptText(plain: string, secret: string): Promise<string> {
  const key = await deriveKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  )
  return `${bytesToB64(iv)}.${bytesToB64(cipher)}`
}

export async function decryptText(payload: string, secret: string): Promise<string> {
  const [ivB64, dataB64] = payload.split('.')
  if (!ivB64 || !dataB64) throw new Error('Invalid encrypted payload')
  const key = await deriveKey(secret)
  const iv = b64ToBytes(ivB64)
  const data = b64ToBytes(dataB64)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(plain)
}

export function randomToken(bytes = 18): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  return bytesToB64(arr).replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''))
}
