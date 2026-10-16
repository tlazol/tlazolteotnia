import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as blogSource from '#/lib/blog.server'
import { loadHomeData, loadPostData } from '#/lib/blog-data.server'
import type { RuntimeDependencies } from '#/lib/cloudflare-context'
import { handleGetReactions, handlePostReaction } from '#/lib/reaction-api.server'
import * as reactionStore from '#/lib/reactions.server'
import { createReaction, getPostReactions, readReactionEmoji } from '#/lib/reactions.server'

class FakeD1 {
  readonly votes = new Set<string>()
  readonly counts = new Map<string, number>()

  prepare(sql: string) {
    return new FakeStatement(this, sql)
  }

  async batch(statements: FakeStatement[]) {
    return Promise.all(statements.map((statement) => statement.result()))
  }
}

class FakeStatement {
  private values: unknown[] = []

  constructor(
    private db: FakeD1,
    private sql: string
  ) {}

  bind(...values: unknown[]) {
    this.values = values
    return this
  }

  async run() {
    if (this.sql.startsWith('INSERT OR IGNORE INTO reaction_votes')) {
      const key = this.values.join('|')
      if (this.db.votes.has(key)) return { meta: { changes: 0 } }
      this.db.votes.add(key)
      const countKey = `${this.values[1]}|${this.values[2]}`
      this.db.counts.set(countKey, (this.db.counts.get(countKey) ?? 0) + 1)
      return { meta: { changes: 1 } }
    }
    throw new Error(`Unexpected run: ${this.sql}`)
  }

  async first<T>() {
    const count = this.db.counts.get(`${this.values[0]}|${this.values[1]}`)
    return count as T | null
  }

  async result() {
    if (this.sql.startsWith('SELECT emoji, count')) {
      const prefix = `${this.values[0]}|`
      return {
        results: [...this.db.counts.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, count]) => ({ emoji: key.slice(prefix.length), count }))
      }
    }
    if (this.sql.startsWith('SELECT emoji FROM reaction_votes')) {
      const prefix = `${this.values[0]}|${this.values[1]}|`
      return {
        results: [...this.db.votes]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ emoji: key.slice(prefix.length) }))
      }
    }
    throw new Error(`Unexpected result: ${this.sql}`)
  }
}

function makeContext(db: FakeD1): RuntimeDependencies {
  return {
    db: db as unknown as D1Database,
    reactionCookieSecret: 'test-secret-at-least-long-enough',
    reactionRateLimiter: { limit: vi.fn(async () => ({ success: true })) }
  }
}

function request(cookie?: string) {
  return new Request('https://example.com/api/reactions/post', {
    headers: cookie ? { Cookie: cookie } : undefined
  })
}

describe('reaction server', () => {
  afterEach(() => vi.restoreAllMocks())

  it('limits cookie-free and rotated-cookie writes across articles by connection IP', async () => {
    const db = new FakeD1()
    const context = makeContext(db)
    const callsByKey = new Map<string, number>()
    const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'))
    const binding = config.ratelimits?.find(
      (entry: { name: string }) => entry.name === 'REACTION_RATE_LIMITER'
    )
    expect(binding?.simple).toEqual({ limit: 30, period: 60 })
    context.reactionRateLimiter.limit = vi.fn(async ({ key }) => {
      const calls = (callsByKey.get(key) ?? 0) + 1
      callsByKey.set(key, calls)
      return { success: calls <= binding.simple.limit }
    })

    const send = (index: number, ip = '192.0.2.1') => {
      const slug = index % 2 ? 'react-router-renewal' : 'react-router-to-tanstack-start'
      const headers = new Headers({ 'CF-Connecting-IP': ip })
      headers.set('X-Forwarded-For', `198.51.100.${index}`)
      if (index % 2) headers.set('Cookie', `reaction_visitor=${String(index).padStart(43, 'a')}`)
      return handlePostReaction(
        context,
        new Request(`https://example.com/api/reactions/${slug}`, {
          method: 'POST',
          headers,
          body: new URLSearchParams({ emoji: '👍' })
        }),
        slug
      )
    }

    for (let index = 0; index < 30; index++) {
      expect((await send(index)).status).toBe(200)
    }
    const prepare = vi.spyOn(db, 'prepare')
    for (const index of [30, 31]) {
      const response = await send(index)
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('60')
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(response.headers.get('Set-Cookie')).toBeNull()
      expect(await response.json()).toEqual({
        error: '送信が多すぎます。しばらく待ってからお試しください。'
      })
    }
    expect(prepare).not.toHaveBeenCalled()
    expect(db.votes.size).toBe(30)
    expect([...db.counts.values()].reduce((sum, count) => sum + count, 0)).toBe(30)
    expect(callsByKey.size).toBe(1)

    expect((await handleGetReactions(context, request(), 'react-router-renewal')).status).toBe(200)
    expect([...callsByKey.values()]).toEqual([32])
    expect((await send(32, '192.0.2.2')).status).toBe(200)
    expect(db.votes.size).toBe(31)
  })

  it('shares a limited fallback bucket when connection IP is unavailable', async () => {
    const context = makeContext(new FakeD1())
    const limit = vi.fn(async () => ({ success: false }))
    context.reactionRateLimiter.limit = limit
    for (const ip of ['198.51.100.1', '198.51.100.2']) {
      const req = new Request('https://example.com/api/reactions/react-router-renewal', {
        method: 'POST',
        headers: { 'X-Forwarded-For': ip, Cookie: `reaction_visitor=${ip.padStart(43, 'a')}` },
        body: 'invalid form body'
      })
      const readBody = vi.spyOn(req, 'formData')
      expect((await handlePostReaction(context, req, 'react-router-renewal')).status).toBe(429)
      expect(readBody).not.toHaveBeenCalled()
    }
    expect(limit).toHaveBeenCalledTimes(2)
    expect(limit.mock.calls[0]).toEqual(limit.mock.calls[1])
  })

  it('rejects writes without touching D1 when the rate limiter fails', async () => {
    const db = new FakeD1()
    const context = makeContext(db)
    context.reactionRateLimiter.limit = vi.fn().mockRejectedValue(new Error('Limiter unavailable'))
    const prepare = vi.spyOn(db, 'prepare')
    const response = await handlePostReaction(
      context,
      new Request('https://example.com/api/reactions/react-router-renewal', { method: 'POST' }),
      'react-router-renewal'
    )
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ error: 'リアクションを送信できませんでした。' })
    expect(prepare).not.toHaveBeenCalled()
  })

  it('accepts only allowlisted form values', () => {
    const allowed = new FormData()
    allowed.set('emoji', '🚀')
    expect(readReactionEmoji(allowed)).toBe('🚀')

    for (const value of ['', '❌']) {
      const invalid = new FormData()
      invalid.set('emoji', value)
      expect(() => readReactionEmoji(invalid)).toThrow(Response)
    }
  })

  it('creates once, is idempotent, and never stores the cookie value', async () => {
    const db = new FakeD1()
    const context = makeContext(db)
    const visitor = 'a'.repeat(43)
    const req = request(`reaction_visitor=${visitor}`)

    const first = await createReaction(context, req, 'post', '👍')
    const duplicates = await Promise.all(
      Array.from({ length: 99 }, () => createReaction(context, req, 'post', '👍'))
    )

    expect(first).toMatchObject({ created: true, reaction: { count: 1 } })
    expect(duplicates.every((result) => !result.created && result.reaction.count === 1)).toBe(true)
    expect(db.votes.size).toBe(1)
    expect([...db.votes].join('')).not.toContain(visitor)
  })

  it('separates browsers, posts, and emoji', async () => {
    const db = new FakeD1()
    const context = makeContext(db)
    await createReaction(context, request(`reaction_visitor=${'a'.repeat(43)}`), 'one', '👍')
    await createReaction(context, request(`reaction_visitor=${'b'.repeat(43)}`), 'one', '👍')
    await createReaction(context, request(`reaction_visitor=${'a'.repeat(43)}`), 'one', '❤️')
    await createReaction(context, request(`reaction_visitor=${'a'.repeat(43)}`), 'two', '👍')

    expect(db.counts).toEqual(
      new Map([
        ['one|👍', 2],
        ['one|❤️', 1],
        ['two|👍', 1]
      ])
    )
  })

  it('issues a secure anonymous cookie and restores reacted emoji', async () => {
    const db = new FakeD1()
    const context = makeContext(db)
    const firstRead = await getPostReactions(context, request(), 'post')
    expect(firstRead.cookie).toMatch(
      /^reaction_visitor=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=/
    )
    const cookie = firstRead.cookie?.split(';')[0]
    await createReaction(context, request(cookie), 'post', '🎉')
    const restored = await getPostReactions(context, request(cookie), 'post')
    expect(restored.reactions).toEqual([{ emoji: '🎉', count: 1, reacted: true }])
  })

  it('returns the public GET and POST API response shapes', async () => {
    const context = makeContext(new FakeD1())
    const getResponse = await handleGetReactions(context, request(), 'react-router-renewal')
    expect(getResponse.status).toBe(200)
    expect(getResponse.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await getResponse.json()).toEqual({ reactions: [], reactedEmojis: [] })

    const form = new FormData()
    form.set('emoji', '👍')
    const postResponse = await handlePostReaction(
      context,
      new Request('https://example.com', { method: 'POST', body: form }),
      'react-router-renewal'
    )
    expect(postResponse.status).toBe(200)
    expect(await postResponse.json()).toEqual({
      reaction: { emoji: '👍', count: 1, reacted: true },
      created: true
    })
  })

  it('returns 400 for invalid emoji and 404 for unknown posts', async () => {
    const context = makeContext(new FakeD1())
    const invalid = new FormData()
    invalid.set('emoji', '❌')
    await expect(
      handlePostReaction(
        context,
        new Request('https://example.com', { method: 'POST', body: invalid }),
        'react-router-renewal'
      )
    ).rejects.toMatchObject({ status: 400 })
    await expect(handleGetReactions(context, request(), 'missing-post')).rejects.toMatchObject({
      status: 404
    })
  })

  it('keeps reads available and returns a short write error when D1 fails', async () => {
    const context = makeContext({
      prepare() {
        throw new Error('D1 unavailable')
      }
    } as unknown as FakeD1)
    const readResult = await handleGetReactions(context, request(), 'react-router-renewal')
    expect(await readResult.json()).toEqual({ reactions: [], reactedEmojis: [] })

    const form = new FormData()
    form.set('emoji', '👍')
    const writeResult = await handlePostReaction(
      context,
      new Request('https://example.com', { method: 'POST', body: form }),
      'react-router-renewal'
    )
    expect(writeResult.status).toBe(503)
    expect(await writeResult.json()).toEqual({ error: 'リアクションを送信できませんでした。' })
  })

  it('renders post content with empty reactions when D1 reads fail', async () => {
    const db = new FakeD1()
    vi.spyOn(db, 'prepare').mockImplementation(() => {
      throw new Error('D1 unavailable')
    })
    const post = await loadPostData(makeContext(db), request(), 'react-router-renewal')
    expect(post).toMatchObject({ post: { slug: 'react-router-renewal' }, reactions: [] })
    expect(post?.cookie).toBeUndefined()
  })

  it('loads home summaries without reaction storage or a visitor cookie', async () => {
    const readReactions = vi.spyOn(reactionStore, 'getPostReactions')
    const home = await loadHomeData()
    expect(readReactions).not.toHaveBeenCalled()
    expect(home.posts.length).toBeGreaterThan(0)
    expect(Object.keys(home)).toEqual(['posts'])
  })

  it('returns only the selected post and preserves visitor reactions', async () => {
    const readSummaries = vi.spyOn(blogSource, 'getBlogPosts')
    const context = makeContext(new FakeD1())
    const first = await loadPostData(context, request(), 'react-router-renewal')
    expect(first?.cookie).toMatch(/^reaction_visitor=/)
    expect(first).not.toHaveProperty('posts')
    const cookie = first?.cookie?.split(';')[0]
    await createReaction(context, request(cookie), 'react-router-renewal', '👍')
    const restored = await loadPostData(context, request(cookie), 'react-router-renewal')
    expect(restored?.reactions).toEqual([{ emoji: '👍', count: 1, reacted: true }])
    expect(restored?.cookie).toBeUndefined()
    const otherVisitor = await loadPostData(context, request(), 'react-router-renewal')
    expect(otherVisitor?.reactions).toEqual([{ emoji: '👍', count: 1, reacted: false }])
    expect(readSummaries).not.toHaveBeenCalled()
  })

  it('returns null without accessing D1 when the post is missing', async () => {
    const db = new FakeD1()
    const prepare = vi.spyOn(db, 'prepare')
    expect(await loadPostData(makeContext(db), request(), 'missing-post')).toBeNull()
    expect(prepare).not.toHaveBeenCalled()
  })
})
