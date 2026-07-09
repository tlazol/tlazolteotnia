import type { RouterContextProvider } from 'react-router'
import { getBlogPost } from '~/lib/blog.server'
import { dbContext, reactionSecretContext } from '~/lib/cloudflare-context'
import {
  isReactionEmoji,
  type ReactionCount,
  type ReactionEmoji,
  sortReactionCounts
} from '~/lib/reactions'

const VISITOR_COOKIE = 'reaction_visitor'
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365 * 2
const visitorPattern = /^[A-Za-z0-9_-]{43}$/

type CountRow = { emoji: string; count: number }
type VoteRow = { emoji: string }

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
  slugs: string[]
): Promise<Record<string, ReactionCount[]>> {
  if (slugs.length === 0) return {}
  const placeholders = slugs.map(() => '?').join(', ')
  const result = await context
    .get(dbContext)
    .prepare(
      `SELECT post_slug, emoji, count FROM reaction_counts WHERE post_slug IN (${placeholders})`
    )
    .bind(...slugs)
    .all<{ post_slug: string; emoji: string; count: number }>()
  const bySlug: Record<string, ReactionCount[]> = {}
  for (const row of result.results) {
    if (!isReactionEmoji(row.emoji)) continue
    const reactions = bySlug[row.post_slug] ?? []
    reactions.push({ emoji: row.emoji, count: row.count })
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
  return {
    reaction: { emoji, count: count ?? 0, reacted: true } satisfies ReactionCount,
    created: insert.meta.changes > 0,
    cookie
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
