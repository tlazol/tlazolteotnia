import type { RouterContextProvider } from 'react-router'
import { getBlogPost } from '~/lib/blog.server'
import {
  dbContext,
  reactionCountsCacheContext,
  reactionSecretContext,
  waitUntilContext
} from '~/lib/cloudflare-context'
import {
  isReactionEmoji,
  type ReactionCount,
  type ReactionEmoji,
  sortReactionCounts
} from '~/lib/reactions'

const VISITOR_COOKIE = 'reaction_visitor'
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365 * 2
const visitorPattern = /^[A-Za-z0-9_-]{43}$/
const REACTION_COUNTS_CACHE_PATH = '/__cache/reaction-counts-v1'
const REACTION_COUNTS_CACHE_TTL = 60

type CountRow = { emoji: string; count: number }
type VoteRow = { emoji: string }
type CountBySlugRow = CountRow & { post_slug: string }
type VoteBySlugRow = VoteRow & { post_slug: string }
type CountCachePayload = { slugs: string[]; rows: CountBySlugRow[] }

export async function requirePost(slug: string | undefined) {
  const post = slug ? await getBlogPost(slug) : null
  if (!post) throw new Response('Not Found', { status: 404 })
  return post
}

export async function getPostReactions(
  context: Readonly<RouterContextProvider>,
  request: Request,
  slug: string
): Promise<{ reactions: ReactionCount[]; cookie?: string }> {
  const { id, cookie } = getOrCreateVisitor(request)
  const visitorHash = await hashVisitor(id, context.get(reactionSecretContext))
  const db = context.get(dbContext)
  const [countsResult, votesResult] = await db.batch([
    db.prepare('SELECT emoji, count FROM reaction_counts WHERE post_slug = ?').bind(slug),
    db
      .prepare('SELECT emoji FROM reaction_votes WHERE visitor_hash = ? AND post_slug = ?')
      .bind(visitorHash, slug)
  ])
  const reacted = new Set(
    (votesResult.results as VoteRow[]).map((row) => row.emoji).filter(isReactionEmoji)
  )
  const reactions = sortReactionCounts(
    (countsResult.results as CountRow[])
      .filter((row): row is CountRow & { emoji: ReactionEmoji } => isReactionEmoji(row.emoji))
      .map((row) => ({ emoji: row.emoji, count: row.count, reacted: reacted.has(row.emoji) }))
  )
  return { reactions, cookie }
}

export async function getReactionCountsBySlug(
  context: Readonly<RouterContextProvider>,
  request: Request,
  slugs: string[]
): Promise<{ reactionsBySlug: Record<string, ReactionCount[]>; cookie?: string }> {
  if (slugs.length === 0) return { reactionsBySlug: {} }
  const { id, cookie } = getOrCreateVisitor(request)
  const visitorHash = await hashVisitor(id, context.get(reactionSecretContext))
  const normalizedSlugs = [...slugs].sort()
  const placeholders = normalizedSlugs.map(() => '?').join(', ')
  const db = context.get(dbContext)
  const cache = context.get(reactionCountsCacheContext)
  const cacheKey = getReactionCountsCacheKey(request)
  const cachedRows = cache ? await readCachedCountRows(cache, cacheKey, normalizedSlugs) : undefined

  if (cachedRows) {
    const [votesResult] = await db.batch([
      db
        .prepare(
          `SELECT post_slug, emoji FROM reaction_votes WHERE visitor_hash = ? AND post_slug IN (${placeholders})`
        )
        .bind(visitorHash, ...normalizedSlugs)
    ])
    return {
      reactionsBySlug: buildReactionsBySlug(cachedRows, votesResult.results as VoteBySlugRow[]),
      cookie
    }
  }

  const [countsResult, votesResult] = await db.batch([
    db
      .prepare(
        `SELECT post_slug, emoji, count FROM reaction_counts WHERE post_slug IN (${placeholders})`
      )
      .bind(...normalizedSlugs),
    db
      .prepare(
        `SELECT post_slug, emoji FROM reaction_votes WHERE visitor_hash = ? AND post_slug IN (${placeholders})`
      )
      .bind(visitorHash, ...normalizedSlugs)
  ])
  const countRows = countsResult.results as CountBySlugRow[]
  if (cache) {
    await storeCountRows(context, cache, cacheKey, {
      slugs: normalizedSlugs,
      rows: countRows
    })
  }
  return {
    reactionsBySlug: buildReactionsBySlug(countRows, votesResult.results as VoteBySlugRow[]),
    cookie
  }
}

function buildReactionsBySlug(
  countRows: CountBySlugRow[],
  voteRows: VoteBySlugRow[]
): Record<string, ReactionCount[]> {
  const reacted = new Set(
    voteRows
      .filter((row) => isReactionEmoji(row.emoji))
      .map((row) => `${row.post_slug}\0${row.emoji}`)
  )
  const bySlug: Record<string, ReactionCount[]> = {}
  for (const row of countRows) {
    if (!isReactionEmoji(row.emoji)) continue
    const reactions = bySlug[row.post_slug] ?? []
    reactions.push({
      emoji: row.emoji,
      count: row.count,
      reacted: reacted.has(`${row.post_slug}\0${row.emoji}`)
    })
    bySlug[row.post_slug] = reactions
  }
  for (const slug of Object.keys(bySlug)) bySlug[slug] = sortReactionCounts(bySlug[slug])
  return bySlug
}

export async function createReaction(
  context: Readonly<RouterContextProvider>,
  request: Request,
  slug: string,
  emoji: ReactionEmoji
) {
  const { id, cookie } = getOrCreateVisitor(request)
  const visitorHash = await hashVisitor(id, context.get(reactionSecretContext))
  const db = context.get(dbContext)
  const insert = await db
    .prepare(
      'INSERT OR IGNORE INTO reaction_votes (visitor_hash, post_slug, emoji) VALUES (?, ?, ?)'
    )
    .bind(visitorHash, slug, emoji)
    .run()
  const count = await db
    .prepare('SELECT count FROM reaction_counts WHERE post_slug = ? AND emoji = ?')
    .bind(slug, emoji)
    .first<number>('count')
  if (insert.meta.changes > 0) {
    await invalidateReactionCountsCache(context, request)
  }
  return {
    reaction: { emoji, count: count ?? 0, reacted: true } satisfies ReactionCount,
    created: insert.meta.changes > 0,
    cookie
  }
}

function getReactionCountsCacheKey(request: Request): Request {
  const url = new URL(REACTION_COUNTS_CACHE_PATH, request.url)
  return new Request(url)
}

async function readCachedCountRows(
  cache: Cache,
  key: Request,
  slugs: string[]
): Promise<CountBySlugRow[] | undefined> {
  try {
    const response = await cache.match(key)
    if (!response) return undefined
    const payload = (await response.json()) as CountCachePayload
    if (
      payload.slugs.length !== slugs.length ||
      payload.slugs.some((slug, index) => slug !== slugs[index])
    ) {
      return undefined
    }
    return payload.rows
  } catch (error) {
    console.error('Failed to read reaction count cache', error)
    return undefined
  }
}

async function storeCountRows(
  context: Readonly<RouterContextProvider>,
  cache: Cache,
  key: Request,
  payload: CountCachePayload
) {
  const write = cache
    .put(
      key,
      new Response(JSON.stringify(payload), {
        headers: {
          'Cache-Control': `public, s-maxage=${REACTION_COUNTS_CACHE_TTL}`,
          'Content-Type': 'application/json'
        }
      })
    )
    .catch((error) => console.error('Failed to store reaction count cache', error))
  const waitUntil = context.get(waitUntilContext)
  if (waitUntil) {
    waitUntil(write)
    return
  }
  await write
}

async function invalidateReactionCountsCache(
  context: Readonly<RouterContextProvider>,
  request: Request
) {
  const cache = context.get(reactionCountsCacheContext)
  if (!cache) return
  try {
    await cache.delete(getReactionCountsCacheKey(request))
  } catch (error) {
    console.error('Failed to invalidate reaction count cache', error)
  }
}

export function readReactionEmoji(formData: FormData): ReactionEmoji {
  const emoji = formData.get('emoji')
  if (!isReactionEmoji(emoji)) throw new Response('Invalid emoji', { status: 400 })
  return emoji
}

export function appendVisitorCookie(headers: Headers, cookie?: string) {
  if (cookie) headers.append('Set-Cookie', cookie)
}

function getOrCreateVisitor(request: Request): { id: string; cookie?: string } {
  const cookieHeader = request.headers.get('Cookie') ?? ''
  const value = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1)
  if (value && visitorPattern.test(value)) return { id: value }
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const id = toBase64Url(bytes)
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return {
    id,
    cookie: `${VISITOR_COOKIE}=${id}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${VISITOR_MAX_AGE}`
  }
}

async function hashVisitor(visitorId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(visitorId))
  return toBase64Url(new Uint8Array(signature))
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
