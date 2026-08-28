import { describe, expect, it } from 'vitest'
import { loadHomeData, loadPostData } from '#/lib/blog-data.server'
import type { RuntimeDependencies } from '#/lib/cloudflare-context'
import { handleGetReactions, handlePostReaction } from '#/lib/reaction-api.server'
import { createReaction, getPostReactions, readReactionEmoji } from '#/lib/reactions.server'

class FakeD1 {
  readonly votes = new Set<string>()
  readonly counts = new Map<string, number>()
  listReads = 0
  voteListReads = 0

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
      this.db.voteListReads += 1
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

class FakeCache {
  readonly entries = new Map<string, Response>()

  async match(request: RequestInfo | URL) {
    return this.entries.get(cacheKey(request))?.clone()
  }

  async put(request: RequestInfo | URL, response: Response) {
    this.entries.set(cacheKey(request), response.clone())
  }

  async delete(request: RequestInfo | URL) {
    return this.entries.delete(cacheKey(request))
  }
}

class DeferredCache extends FakeCache {
  releasePut: (() => void) | undefined

  override async put(request: RequestInfo | URL, response: Response) {
    await new Promise<void>((resolve) => {
      this.releasePut = resolve
    })
    await super.put(request, response)
  }
}

function cacheKey(request: RequestInfo | URL) {
  return request instanceof Request ? request.url : String(request)
}

function makeContext(db: FakeD1, cache?: FakeCache): RuntimeDependencies {
  return {
    db: db as unknown as D1Database,
    reactionCountsCache: (cache as unknown as Cache) ?? null,
    reactionCookieSecret: 'test-secret-at-least-long-enough',
    waitUntil: null
  }
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

  it('renders home and post loaders with empty reactions when D1 reads fail', async () => {
    const context = makeContext({
      prepare() {
        throw new Error('D1 unavailable')
      }
    } as unknown as FakeD1)
    const home = await loadHomeData(context, request())
    expect(home.posts.length).toBeGreaterThan(0)
    expect(home.reactionsBySlug).toEqual({})

    const post = await loadPostData(context, request(), 'react-router-renewal')
    expect(post).toMatchObject({ post: { slug: 'react-router-renewal' }, reactions: [] })
  })

  it('caches public counts while reading visitor votes on every home load', async () => {
    const db = new FakeD1()
    const cache = new FakeCache()
    const context = makeContext(db, cache)
    db.counts.set('react-router-renewal|👍', 1)
    const first = await loadHomeData(context, request())
    expect(first.reactionsBySlug['react-router-renewal']?.[0]?.count).toBe(1)

    db.counts.set('react-router-renewal|👍', 2)
    const cached = await loadHomeData(context, request())
    expect(cached.reactionsBySlug['react-router-renewal']?.[0]?.count).toBe(1)
    expect(db.listReads).toBe(1)
    expect(db.voteListReads).toBe(2)
  })

  it('stores public counts after returning the home response', async () => {
    const db = new FakeD1()
    const cache = new DeferredCache()
    const context = makeContext(db, cache)
    const backgroundTasks: Promise<unknown>[] = []
    context.waitUntil = (task) => backgroundTasks.push(task)
    db.counts.set('react-router-renewal|👍', 1)

    const home = await loadHomeData(context, request())

    expect(home.reactionsBySlug['react-router-renewal']?.[0]?.count).toBe(1)
    expect(backgroundTasks).toHaveLength(1)
    expect(cache.entries).toHaveLength(0)
    cache.releasePut?.()
    await Promise.all(backgroundTasks)
    expect(cache.entries).toHaveLength(1)
  })

  it('invalidates cached counts after a new reaction', async () => {
    const db = new FakeD1()
    const cache = new FakeCache()
    const context = makeContext(db, cache)
    const firstVisitor = request(`reaction_visitor=${'a'.repeat(43)}`)
    const nextVisitor = request(`reaction_visitor=${'b'.repeat(43)}`)
    await createReaction(context, firstVisitor, 'react-router-renewal', '👍')

    const first = await loadHomeData(context, firstVisitor)
    expect(first.reactionsBySlug['react-router-renewal']?.[0]?.count).toBe(1)

    await createReaction(context, nextVisitor, 'react-router-renewal', '👍')
    const refreshed = await loadHomeData(context, firstVisitor)
    expect(refreshed.reactionsBySlug['react-router-renewal']?.[0]?.count).toBe(2)
    expect(db.listReads).toBe(2)
  })

  it('keeps visitor reactions private when public counts are cached', async () => {
    const db = new FakeD1()
    const cache = new FakeCache()
    const context = makeContext(db, cache)
    const cookie = `reaction_visitor=${'a'.repeat(43)}`
    await createReaction(context, request(cookie), 'react-router-renewal', '👍')

    const home = await loadHomeData(context, request(cookie))

    expect(home.reactionsBySlug['react-router-renewal']).toEqual([
      { emoji: '👍', count: 1, reacted: true }
    ])

    const otherVisitor = await loadHomeData(context, request(`reaction_visitor=${'b'.repeat(43)}`))
    expect(otherVisitor.reactionsBySlug['react-router-renewal']).toEqual([
      { emoji: '👍', count: 1, reacted: false }
    ])
    expect(db.listReads).toBe(1)
  })
})
