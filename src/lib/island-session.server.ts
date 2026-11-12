// Anonymous visitor cookie for editing the shared island. It only names a
// random id; quotas and permissions live in the island's Durable Object.

import { SESSION_TTL_MS } from './island-policy'

export const ISLAND_COOKIE = '__Host-island_visitor'
export const ISLAND_DEV_COOKIE = 'island_visitor_dev'
const COOKIE_VERSION = 'v1'
const idPattern = /^[A-Za-z0-9_-]{43}$/
const signaturePattern = /^[A-Za-z0-9_-]{43}$/
const timePattern = /^\d{1,15}$/

export type IslandSession = { id: string; issuedAt: number; expiresAt: number }

function isSecureRequest(url: URL) {
  return url.protocol === 'https:'
}
export function islandCookieName(url: URL) {
  return isSecureRequest(url) ? ISLAND_COOKIE : ISLAND_DEV_COOKIE
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return toBase64Url(new Uint8Array(signature))
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('Cookie') ?? ''
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1)
  }
  return null
}

export async function encodeSession(session: IslandSession, secret: string) {
  const payload = `${COOKIE_VERSION}.${session.id}.${Math.floor(session.issuedAt / 1000)}.${Math.floor(session.expiresAt / 1000)}`
  return `${payload}.${await hmac(secret, payload)}`
}

// Signature, format and expiry are all checked here; nothing else is trusted.
export async function decodeSession(
  value: string | null,
  secret: string,
  now: number
): Promise<IslandSession | null> {
  if (!value || value.length > 200) return null
  const parts = value.split('.')
  if (parts.length !== 5) return null
  const [version, id, issued, expires, signature] = parts
  if (
    version !== COOKIE_VERSION ||
    !idPattern.test(id) ||
    !timePattern.test(issued) ||
    !timePattern.test(expires) ||
    !signaturePattern.test(signature)
  )
    return null
  const expected = await hmac(secret, parts.slice(0, 4).join('.'))
  if (!timingSafeEqual(expected, signature)) return null
  const issuedAt = Number(issued) * 1000
  const expiresAt = Number(expires) * 1000
  if (expiresAt <= now || expiresAt - issuedAt > SESSION_TTL_MS || issuedAt > now + 60_000)
    return null
  return { id, issuedAt, expiresAt }
}

export function readIslandSession(request: Request, secret: string, now: number) {
  return decodeSession(readCookie(request, islandCookieName(new URL(request.url))), secret, now)
}

export function createSession(now: number): IslandSession {
  const id = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  // Whole seconds, so the cookie and the island agree on the expiry.
  const issuedAt = Math.floor(now / 1000) * 1000
  return { id, issuedAt, expiresAt: issuedAt + SESSION_TTL_MS }
}

export async function sessionCookie(session: IslandSession, secret: string, url: URL, now: number) {
  const maxAge = Math.max(0, Math.floor((session.expiresAt - now) / 1000))
  const secure = isSecureRequest(url) ? '; Secure' : ''
  return `${islandCookieName(url)}=${await encodeSession(session, secret)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}
