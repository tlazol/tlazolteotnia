import { RouterContextProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { dbContext, reactionSecretContext } from '~/lib/cloudflare-context'
import { createReaction, getPostReactions, readReactionEmoji } from '~/lib/reactions.server'
import { action as reactionAction, loader as reactionLoader } from '~/routes/api.reactions.$slug'
import { loader as postLoader } from '~/routes/blog.$slug'
import { loader as homeLoader } from '~/routes/home'

class FakeD1 {
  readonly votes = new Set<string>()
  readonly counts = new Map<string, number>()
  listReads = 0

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

  async all<T>() {
    if (this.sql.startsWith('SELECT post_slug, emoji, count')) {
      this.db.listReads += 1
      const slugs = new Set(this.values)
      return {
        results: [...this.db.counts.entries()]
          .map(([key, count]) => {
            const separator = key.lastIndexOf('|')
            return {
              post_slug: key.slice(0, separator),
              emoji: key.slice(separator + 1),
              count
            }
          })
          .filter((row) => slugs.has(row.post_slug))
      } as D1Result<T>
    }
    throw new Error(`Unexpected all: ${this.sql}`)
  }

  async result() {
    if (this.sql.startsWith('SELECT post_slug, emoji, count')) {
      this.db.listReads += 1
      const slugs = new Set(this.values)
      return {
        results: [...this.db.counts.entries()]
          .map(([key, count]) => {
            const separator = key.lastIndexOf('|')
            return {
              post_slug: key.slice(0, separator),
              emoji: key.slice(separator + 1),
              count
            }
          })
          .filter((row) => slugs.has(row.post_slug))
      }
    }
    if (this.sql.startsWith('SELECT post_slug, emoji FROM reaction_votes')) {
      const prefix = `${this.values[0]}|`
      const slugs = new Set(this.values.slice(1))
      return {
        results: [...this.db.votes]
          .filter((key) => key.startsWith(prefix))
          .map((key) => {
            const value = key.slice(prefix.length)
            const separator = value.lastIndexOf('|')
            return {
              post_slug: value.slice(0, separator),
              emoji: value.slice(separator + 1)
            }
          })
          .filter((row) => slugs.has(row.post_slug))
      }
    }
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

function makeContext(db: FakeD1) {
  const context = new RouterContextProvider()
  context.set(dbContext, db as unknown as D1Database)
  context.set(reactionSecretContext, 'test-secret-at-least-long-enough')
  return context
}

function request(cookie?: string) {
  return new Request('https://example.com/api/reactions/post', {
    headers: cookie ? { Cookie: cookie } : undefined
  })
}

describe('reaction server', () => {
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

  it('returns 400 for invalid emoji and 404 for unknown posts', async () => {
    const context = makeContext(new FakeD1())
    const invalid = new FormData()
    invalid.set('emoji', '❌')
    await expect(
      reactionAction({
        context,
        params: { slug: 'react-router-renewal' },
        request: new Request('https://example.com', { method: 'POST', body: invalid })
      } as unknown as Parameters<typeof reactionAction>[0])
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      reactionLoader({
        context,
        params: { slug: 'missing-post' },
        request: request()
      } as unknown as Parameters<typeof reactionLoader>[0])
    ).rejects.toMatchObject({ status: 404 })
  })

  it('keeps reads available and returns a short write error when D1 fails', async () => {
    const context = makeContext({
      prepare() {
        throw new Error('D1 unavailable')
      }
    } as unknown as FakeD1)
    const readResult = await reactionLoader({
      context,
      params: { slug: 'react-router-renewal' },
      request: request()
    } as unknown as Parameters<typeof reactionLoader>[0])
    expect(readResult.data).toEqual({ reactions: [], reactedEmojis: [] })

    const form = new FormData()
    form.set('emoji', '👍')
    const writeResult = await reactionAction({
      context,
      params: { slug: 'react-router-renewal' },
      request: new Request('https://example.com', { method: 'POST', body: form })
    } as unknown as Parameters<typeof reactionAction>[0])
    expect(writeResult.init?.status).toBe(503)
    expect(writeResult.data).toEqual({ error: 'リアクションを送信できませんでした。' })
  })

  it('renders home and post loaders with empty reactions when D1 reads fail', async () => {
    const context = makeContext({
      prepare() {
        throw new Error('D1 unavailable')
      }
    } as unknown as FakeD1)
    const home = await homeLoader({ context, request: request() } as unknown as Parameters<
      typeof homeLoader
    >[0])
    expect(home.data.posts.length).toBeGreaterThan(0)
    expect(home.data.reactionsBySlug).toEqual({})

    const post = await postLoader({
      context,
      params: { slug: 'react-router-renewal' },
      request: request()
    } as unknown as Parameters<typeof postLoader>[0])
    expect(post).toMatchObject({ post: { slug: 'react-router-renewal' }, reactions: [] })
  })

  it('reads fresh reaction counts on every home load', async () => {
    const firstDb = new FakeD1()
    firstDb.counts.set('react-router-renewal|👍', 1)
    const nextDb = new FakeD1()
    nextDb.counts.set('react-router-renewal|👍', 2)
    const first = await homeLoader({
      context: makeContext(firstDb),
      request: request()
    } as unknown as Parameters<typeof homeLoader>[0])
    expect(first.data.reactionsBySlug['react-router-renewal']?.[0]?.count).toBe(1)

    const refreshed = await homeLoader({
      context: makeContext(nextDb),
      request: request()
    } as unknown as Parameters<typeof homeLoader>[0])
    expect(refreshed.data.reactionsBySlug['react-router-renewal']?.[0]?.count).toBe(2)
    expect(nextDb.listReads).toBe(1)
  })

  it('restores the current visitor reactions on the home timeline', async () => {
    const db = new FakeD1()
    const context = makeContext(db)
    const cookie = `reaction_visitor=${'a'.repeat(43)}`
    await createReaction(context, request(cookie), 'react-router-renewal', '👍')

    const home = await homeLoader({
      context,
      request: request(cookie)
    } as unknown as Parameters<typeof homeLoader>[0])

    expect(home.data.reactionsBySlug['react-router-renewal']).toEqual([
      { emoji: '👍', count: 1, reacted: true }
    ])
  })
})
