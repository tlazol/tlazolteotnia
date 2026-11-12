import { describe, expect, it, vi } from 'vitest'
import { handleIslandRequest, type IslandBindings } from '../src/lib/island-api.server'
import {
  createSession,
  decodeSession,
  encodeSession,
  ISLAND_COOKIE,
  ISLAND_DEV_COOKIE,
  sessionCookie
} from '../src/lib/island-session.server'

const SECRET = 'unit-test-secret'
const ORIGIN = 'https://0rga.org'

function env(overrides: Partial<IslandBindings> = {}) {
  const forwarded: Request[] = []
  const stub = {
    fetch: vi.fn(async (input: Request | string) => {
      forwarded.push(typeof input === 'string' ? new Request(input) : input)
      return Response.json({ v: 1 })
    })
  }
  const bindings = {
    ISLAND_ROOM: {
      idFromName: vi.fn(() => 'id'),
      get: vi.fn(() => stub)
    } as unknown as DurableObjectNamespace,
    ISLAND_COOKIE_SECRET: SECRET,
    ISLAND_SESSION_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    ISLAND_CONNECT_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    ...overrides
  } as IslandBindings
  return { bindings, forwarded }
}

const request = (path: string, init: RequestInit = {}) => new Request(`${ORIGIN}${path}`, init)
const upgrade = (headers: Record<string, string> = {}) =>
  request('/api/island/ws', { headers: { Upgrade: 'websocket', Origin: ORIGIN, ...headers } })

describe('island session cookie', () => {
  it('signs, expires after 30 days and rejects tampering', async () => {
    const now = Date.UTC(2026, 10, 12)
    const session = createSession(now)
    const value = await encodeSession(session, SECRET)
    expect(await decodeSession(value, SECRET, now)).toEqual(session)
    expect(await decodeSession(value, 'other-secret', now)).toBeNull()
    expect(await decodeSession(value.replace(session.id, 'A'.repeat(43)), SECRET, now)).toBeNull()
    expect(await decodeSession(value, SECRET, session.expiresAt)).toBeNull()
    expect(session.expiresAt - session.issuedAt).toBe(30 * 86_400_000)
  })

  it('uses a __Host- secure cookie on https and a plain one for local http', async () => {
    const now = Date.now()
    const session = createSession(now)
    const secure = await sessionCookie(session, SECRET, new URL(ORIGIN), now)
    expect(secure).toMatch(new RegExp(`^${ISLAND_COOKIE}=`))
    expect(secure).toContain('; HttpOnly; Secure; SameSite=Lax; Path=/;')
    const local = await sessionCookie(session, SECRET, new URL('http://localhost:3000'), now)
    expect(local).toMatch(new RegExp(`^${ISLAND_DEV_COOKIE}=`))
    expect(local).not.toContain('Secure')
  })
})

describe('island API entry', () => {
  it('leaves other paths to the app', async () => {
    expect(await handleIslandRequest(request('/blog/x'), env().bindings)).toBeNull()
    expect(await handleIslandRequest(request('/api/islander'), env().bindings)).toBeNull()
  })

  it('answers wrong methods and plain GETs on the socket path', async () => {
    const { bindings } = env()
    expect((await handleIslandRequest(request('/api/island/session'), bindings))?.status).toBe(405)
    expect(
      (await handleIslandRequest(request('/api/island', { method: 'POST' }), bindings))?.status
    ).toBe(405)
    expect((await handleIslandRequest(request('/api/island/ws'), bindings))?.status).toBe(426)
    expect((await handleIslandRequest(request('/api/island/other'), bindings))?.status).toBe(404)
  })

  it('stops sessions and editing without the secret but keeps reading', async () => {
    const { bindings } = env({ ISLAND_COOKIE_SECRET: '' })
    const post = request('/api/island/session', { method: 'POST', headers: { Origin: ORIGIN } })
    expect((await handleIslandRequest(post, bindings))?.status).toBe(503)
    expect((await handleIslandRequest(upgrade(), bindings))?.status).toBe(503)
    expect((await handleIslandRequest(request('/api/island'), bindings))?.status).toBe(200)
  })

  it('refuses other, missing and opaque origins', async () => {
    const { bindings } = env()
    for (const origin of [undefined, 'null', 'https://evil.example']) {
      const headers: Record<string, string> = origin ? { Origin: origin } : {}
      const post = request('/api/island/session', { method: 'POST', headers })
      expect((await handleIslandRequest(post, bindings))?.status).toBe(403)
      const ws = request('/api/island/ws', { headers: { Upgrade: 'websocket', ...headers } })
      expect((await handleIslandRequest(ws, bindings))?.status).toBe(403)
    }
  })

  it('returns 429 with Retry-After, and 503 when the limiter fails', async () => {
    const limited = env({
      ISLAND_SESSION_RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) }
    })
    const post = () =>
      request('/api/island/session', {
        method: 'POST',
        headers: { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.9', 'X-Forwarded-For': '1.1.1.1' }
      })
    const response = await handleIslandRequest(post(), limited.bindings)
    expect(response?.status).toBe(429)
    expect(response?.headers.get('Retry-After')).toBe('60')
    expect(limited.bindings.ISLAND_SESSION_RATE_LIMITER.limit).toHaveBeenCalledWith({
      key: 'tlazolteotnia:island:session:203.0.113.9'
    })
    const broken = env({
      ISLAND_CONNECT_RATE_LIMITER: {
        limit: vi.fn(async () => {
          throw new Error('down')
        })
      }
    })
    expect((await handleIslandRequest(request('/api/island'), broken.bindings))?.status).toBe(503)
  })

  it('forwards only the verified visitor to the one fixed island', async () => {
    const { bindings, forwarded } = env()
    const now = Date.now()
    const session = createSession(now)
    const cookie = `${ISLAND_COOKIE}=${await encodeSession(session, SECRET)}`
    // A browser trying to pick its own identity or island.
    const response = await handleIslandRequest(
      upgrade({ Cookie: cookie, 'X-Island-Actor': 'B'.repeat(43), 'X-Island-Expires': '9e15' }),
      bindings
    )
    expect(response?.status).toBe(200)
    expect(bindings.ISLAND_ROOM.idFromName).toHaveBeenCalledWith('public-island')
    const sent = forwarded[0]
    expect(sent.headers.get('X-Island-Actor')).toBe(session.id)
    expect(sent.headers.get('X-Island-Expires')).toBe(String(session.expiresAt))
    expect(sent.headers.get('Cookie')).toBeNull()
    // Without a valid cookie nothing reaches the island.
    const anonymous = await handleIslandRequest(
      upgrade({ 'X-Island-Actor': 'B'.repeat(43) }),
      bindings
    )
    expect(anonymous?.status).toBe(401)
    expect(forwarded).toHaveLength(1)
  })

  it('reissues a cookie only when the current one is not valid', async () => {
    const { bindings } = env()
    const post = (cookie?: string) =>
      request('/api/island/session', {
        method: 'POST',
        headers: { Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) }
      })
    const first = await handleIslandRequest(post(), bindings)
    expect(first?.status).toBe(200)
    expect(first?.headers.get('Cache-Control')).toBe('private, no-store')
    const cookie = first?.headers.get('Set-Cookie')?.split(';')[0]
    expect(cookie).toBeTruthy()
    const second = await handleIslandRequest(post(cookie), bindings)
    expect(second?.headers.get('Set-Cookie')).toBeNull()
    expect(await second?.json()).toEqual({ ok: true })
  })
})
