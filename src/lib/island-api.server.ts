// The Worker's front door for the shared island: checks origin, rate limits
// and the visitor cookie, then hands everything to the one fixed island.

import {
  INTERNAL_ACTOR_HEADER,
  INTERNAL_EXPIRES_HEADER,
  ISLAND_ROOM_NAME
} from './island-internal.server'
import { createSession, readIslandSession, sessionCookie } from './island-session.server'

export type IslandBindings = {
  ISLAND_ROOM: DurableObjectNamespace
  ISLAND_COOKIE_SECRET?: string
  ISLAND_SESSION_RATE_LIMITER: RateLimit
  ISLAND_CONNECT_RATE_LIMITER: RateLimit
}

const noStore = { 'Cache-Control': 'private, no-store' }
const reply = (status: number, body: unknown, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { ...noStore, ...headers } })

function sameOrigin(request: Request) {
  // Missing and opaque ("null") origins fail closed.
  return request.headers.get('Origin') === new URL(request.url).origin
}

async function withinLimit(limiter: RateLimit, scope: string, request: Request) {
  // Cloudflare supplies this header; X-Forwarded-For is never trusted.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  try {
    const { success } = await limiter.limit({ key: `tlazolteotnia:island:${scope}:${ip}` })
    return success ? null : reply(429, { error: 'RATE_LIMITED' }, { 'Retry-After': '60' })
  } catch (error) {
    console.error('Island rate limiter failed', error)
    return reply(503, { error: 'UNAVAILABLE' })
  }
}

function room(env: IslandBindings) {
  return env.ISLAND_ROOM.get(env.ISLAND_ROOM.idFromName(ISLAND_ROOM_NAME))
}

function methodNotAllowed(allow: string) {
  return new Response('Method Not Allowed', { status: 405, headers: { ...noStore, Allow: allow } })
}

export async function handleIslandRequest(
  request: Request,
  env: IslandBindings
): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/api/island' && !url.pathname.startsWith('/api/island/')) return null
  switch (url.pathname) {
    case '/api/island/session':
      return request.method === 'POST' ? session(request, env) : methodNotAllowed('POST')
    case '/api/island/ws':
      return request.method === 'GET' ? connect(request, env) : methodNotAllowed('GET')
    case '/api/island':
      return request.method === 'GET' ? view(request, env) : methodNotAllowed('GET')
    default:
      return new Response('Not Found', { status: 404, headers: noStore })
  }
}

async function session(request: Request, env: IslandBindings) {
  if (!sameOrigin(request)) return reply(403, { error: 'FORBIDDEN' })
  const secret = env.ISLAND_COOKIE_SECRET
  if (!secret) return reply(503, { error: 'UNAVAILABLE' })
  const limited = await withinLimit(env.ISLAND_SESSION_RATE_LIMITER, 'session', request)
  if (limited) return limited
  const now = Date.now()
  if (await readIslandSession(request, secret, now)) return reply(200, { ok: true })
  const cookie = await sessionCookie(createSession(now), secret, new URL(request.url), now)
  return reply(200, { ok: true }, { 'Set-Cookie': cookie })
}

async function connect(request: Request, env: IslandBindings) {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
    return new Response('Upgrade Required', {
      status: 426,
      headers: { ...noStore, Upgrade: 'websocket' }
    })
  if (!sameOrigin(request)) return reply(403, { error: 'FORBIDDEN' })
  const secret = env.ISLAND_COOKIE_SECRET
  if (!secret) return reply(503, { error: 'UNAVAILABLE' })
  const limited = await withinLimit(env.ISLAND_CONNECT_RATE_LIMITER, 'connect', request)
  if (limited) return limited
  const visitor = await readIslandSession(request, secret, Date.now())
  if (!visitor) return reply(401, { error: 'SESSION_REQUIRED' })
  // A fresh request: nothing the browser sent is forwarded as verified data.
  const forwarded = new Request('https://island.internal/ws', {
    headers: {
      Upgrade: 'websocket',
      [INTERNAL_ACTOR_HEADER]: visitor.id,
      [INTERNAL_EXPIRES_HEADER]: String(visitor.expiresAt)
    }
  })
  // The 101 response goes back untouched.
  return room(env).fetch(forwarded)
}

async function view(request: Request, env: IslandBindings) {
  const limited = await withinLimit(env.ISLAND_CONNECT_RATE_LIMITER, 'connect', request)
  if (limited) return limited
  try {
    const response = await room(env).fetch('https://island.internal/view')
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...noStore,
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Island view failed', error)
    return reply(503, { error: 'UNAVAILABLE' })
  }
}
