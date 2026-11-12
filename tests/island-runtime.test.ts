// Runs the island's Worker and Durable Object in workerd (wrangler's test
// harness): storage, transactions, hibernation and WebSockets are real.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeIsland } from '../src/lib/island-world'
import { type Client, startIsland, tiles } from './runtime/island-harness'

vi.setConfig({ testTimeout: 30_000 })

const DAY = 86_400_000
const GRASS = 2
const SAND = 1
const land = (ground: number) => ({ tool: 'land', ground })

describe('shared island in workerd', () => {
  let island: Awaited<ReturnType<typeof startIsland>>
  const clients: Client[] = []
  const track = (client: Client) => {
    clients.push(client)
    return client
  }
  const connect = async (cookie?: string) =>
    track(await island.connect(cookie ?? (await island.newCookie())))

  beforeAll(async () => {
    island = await startIsland('./tests/runtime/wrangler.island-test.jsonc')
  }, 120_000)
  afterAll(async () => {
    for (const client of clients) client.close()
    await island?.server.close()
  })
  beforeEach(async () => {
    for (const client of clients.splice(0)) client.close()
    await island.reset()
    await island.writes()
  }, 60_000)

  it('keeps edits from different visitors and stores them', async () => {
    const a = await connect()
    const b = await connect()
    const ra = await a.edit(land(GRASS), tiles(3, 6))
    const rb = await b.edit(land(SAND), tiles(3, 8))
    expect(ra.status).toBe('applied')
    expect(rb.status).toBe('applied')
    // Both see both patches, in order.
    await a.next('patch')
    await a.next('patch')
    expect(a.revision).toBe(2)
    const fresh = await connect()
    const snapshot = fresh.messages[0]
    expect(snapshot.revision).toBe(2)
    const state = await island.sql('SELECT revision FROM island_state')
    expect(state[0].revision).toBe(2)
  })

  it('settles conflicts on one tile the same way for everyone', async () => {
    const a = await connect()
    const b = await connect()
    const watcher = await connect()
    const tile = tiles(1, 10)
    const [ra, rb] = await Promise.all([a.edit(land(GRASS), tile), b.edit(land(SAND), tile)])
    expect([ra.status, rb.status]).toEqual(['applied', 'applied'])
    const patches = [await watcher.next('patch'), await watcher.next('patch')]
    const last = patches[1].edits[0]
    expect(patches.map((patch) => patch.revision)).toEqual([1, 2])
    // Every client applies the same patches in order; a newcomer's island agrees.
    const view = (await (await fetch(new URL('/api/island', island.url))).json()) as {
      revision: number
      island: unknown
    }
    expect(view.revision).toBe(2)
    expect(decodeIsland(view.island)?.ground[tile[0]]).toBe(last.ground)
    for (const client of [a, b])
      expect(client.messages.filter((m) => m.type === 'patch').map((m) => m.edits)).toEqual(
        patches.map((patch) => patch.edits)
      )
  })

  it('never applies a repeated or stale request twice', async () => {
    const a = await connect()
    const request = {
      v: 1,
      type: 'edit',
      requestId: 'same-request',
      expectedActorRevision: 0,
      baseRevision: 0,
      command: land(GRASS),
      indices: tiles(2, 12)
    }
    a.send(request)
    const first = await a.result('same-request')
    expect(first.status).toBe('applied')
    a.send({ ...request, requestId: 'same-request-again' })
    const second = await a.result('same-request-again')
    expect(second).toMatchObject({ status: 'rejected', code: 'ACTOR_STALE' })
    expect(second.actor.available).toBe(28)
    const rows = await island.sql('SELECT tokens, revision FROM island_actor')
    expect(rows).toEqual([{ tokens: 28, revision: 1 }])
  })

  it('lets only one of two tabs spend the last tile', async () => {
    const cookie = await island.newCookie()
    const a = await connect(cookie)
    const b = await connect(cookie)
    expect((await a.edit(land(GRASS), tiles(29, 6))).status).toBe('applied')
    // b hears about it through a quota message.
    const quota = await b.next('quota')
    expect(quota.actor.available).toBe(1)
    const [ra, rb] = await Promise.all([
      a.edit(land(SAND), tiles(1, 20)),
      b.edit(land(SAND), tiles(1, 22))
    ])
    const statuses = [ra.status, rb.status].sort()
    expect(statuses).toEqual(['applied', 'rejected'])
    const [rejected] = [ra, rb].filter((r) => r.status === 'rejected')
    expect(['ACTOR_STALE', 'INSUFFICIENT_TOKENS']).toContain(rejected.code)
    const rows = await island.sql('SELECT tokens FROM island_actor')
    expect(rows[0].tokens).toBe(0)
  })

  it('rolls back the island, quota and counters together when a write fails', async () => {
    const a = await connect()
    expect((await a.edit(land(GRASS), tiles(2, 6))).status).toBe('applied')
    const before = {
      state: await island.sql('SELECT * FROM island_state'),
      actor: await island.sql('SELECT * FROM island_actor'),
      control: await island.sql('SELECT * FROM island_control')
    }
    for (const point of ['island', 'actor', 'control']) {
      await island.control(`/__test/fault?point=${point}`)
      const failed = await a.edit(land(SAND), tiles(2, 6))
      expect(failed).toMatchObject({ type: 'error', code: 'STORAGE_UNAVAILABLE' })
      expect(await island.sql('SELECT * FROM island_state')).toEqual(before.state)
      expect(await island.sql('SELECT * FROM island_actor')).toEqual(before.actor)
      expect(await island.sql('SELECT * FROM island_control')).toEqual(before.control)
    }
    // Nothing was broadcast, and the next edit works from the stored state.
    expect(a.messages.filter((m) => m.type === 'patch')).toHaveLength(1)
    const ok = await a.edit(land(SAND), tiles(2, 6))
    expect(ok).toMatchObject({ status: 'applied', revision: 2 })
  })

  it('recovers a lost reply from the next snapshot', async () => {
    const cookie = await island.newCookie()
    const a = await connect(cookie)
    a.send({
      v: 1,
      type: 'edit',
      requestId: 'lost',
      expectedActorRevision: 0,
      baseRevision: 0,
      command: land(GRASS),
      indices: tiles(3, 14)
    })
    // The connection goes away before the reply can be read.
    await a.flushed()
    a.socket.close()
    await a.closed
    await new Promise((resolve) => setTimeout(resolve, 200))
    const again = await connect(cookie)
    const snapshot = again.messages[0]
    expect(snapshot.revision).toBe(1)
    expect(snapshot.actor).toMatchObject({ actorRevision: 1, available: 27 })
  })

  it('never drops a patch between the snapshot and the subscription', async () => {
    const writer = await connect()
    let revision = 0
    const joining: Client[] = []
    for (let i = 0; i < 6; i++) {
      const result = writer.edit(land(i % 2 ? SAND : GRASS), tiles(1, 16 + (i % 3)), {
        expectedActorRevision: i,
        baseRevision: revision
      })
      joining.push(track(island.open(await island.newCookie())))
      revision = (await result).revision
    }
    for (const client of joining) {
      const snapshot = await client.next('snapshot')
      let expected = snapshot.revision + 1
      await new Promise((resolve) => setTimeout(resolve, 100))
      for (const patch of client.messages.filter((m) => m.type === 'patch')) {
        expect(patch.revision).toBe(expected)
        expected++
      }
      expect(expected - 1).toBe(revision)
    }
  })

  it('restores island, quota, daily count and message pacing after hibernation', async () => {
    const now = Date.UTC(2026, 10, 12, 12)
    await island.control(`/__test/clock?at=${now}`)
    const cookie = await island.newCookie()
    const a = await connect(cookie)
    expect((await a.edit(land(GRASS), tiles(5, 6))).status).toBe('applied')
    // Use up the burst (1 edit + 3 stale requests).
    for (let i = 0; i < 3; i++) await a.edit(land(SAND), tiles(1, 30), { expectedActorRevision: 0 })
    await island.evict('hibernate')
    // The connection survived; its bucket did not refill on wake-up.
    a.send({
      v: 1,
      type: 'edit',
      requestId: 'after-wake',
      expectedActorRevision: 0,
      baseRevision: 0,
      command: land(SAND),
      indices: tiles(1, 30)
    })
    expect((await a.closed).code).toBe(4008)
    await island.control(`/__test/clock?at=${now + 1_000}`)
    await island.evict('close')
    const b = await connect(cookie)
    const snapshot = b.messages[0]
    expect(snapshot.revision).toBe(1)
    expect(snapshot.actor.available).toBe(25)
    expect(snapshot.global.used).toBe(5)
  })

  it('closes connections that send oversized, binary, malformed or too many messages', async () => {
    const cookie = await island.newCookie()
    const cases: Array<[unknown, number]> = [
      ['x'.repeat(4097), 1009],
      [Buffer.from('{}'), 1008],
      ['{not json', 1008],
      [JSON.stringify({ v: 2, type: 'sync' }), 1008],
      [JSON.stringify({ v: 1, type: 'edit', requestId: 'x', indices: [0] }), 1008]
    ]
    for (const [message, code] of cases) {
      const client = await connect(cookie)
      client.socket.send(message as string)
      expect((await client.closed).code).toBe(code)
    }
    const flooder = await connect(cookie)
    for (let i = 0; i < 8; i++)
      flooder.socket.send(JSON.stringify({ v: 1, type: 'edit' }).replace('edit', 'sync'))
    const closed = await flooder.closed
    expect([4008]).toContain(closed.code)
    expect(flooder.messages.some((m) => m.code === 'RATE_LIMITED')).toBe(true)
  })

  it('refuses tiles outside the editable area as a malformed batch', async () => {
    const a = await connect()
    a.send({
      v: 1,
      type: 'edit',
      requestId: 'edge',
      expectedActorRevision: 0,
      baseRevision: 0,
      command: land(GRASS),
      indices: [0]
    })
    expect((await a.closed).code).toBe(1008)
  })

  it('rejects other origins, tampered or expired cookies and missing cookies', async () => {
    const forged = await island.session({ Origin: 'https://example.com' })
    expect(forged.response.status).toBe(403)
    const cookie = await island.newCookie()
    const wrongOrigin = track(island.open(cookie, { Origin: 'https://example.com' }))
    expect((await wrongOrigin.closed).status).toBe(403)
    const tampered = track(island.open(`${cookie.slice(0, -2)}xx`))
    expect((await tampered.closed).status).toBe(401)
    const none = track(island.open('other=1'))
    expect((await none.closed).status).toBe(401)
    const plain = await fetch(new URL('/api/island/ws', island.url))
    expect(plain.status).toBe(426)
    const post = await fetch(new URL('/api/island', island.url), { method: 'POST' })
    expect(post.status).toBe(405)
    // The room checks expiry on every message of an open connection.
    const valid = track(await island.connect(cookie))
    await island.control(`/__test/clock?offset=${31 * DAY}`)
    const result = valid.edit(land(GRASS), tiles(1, 6)).catch(() => null)
    expect((await valid.closed).code).toBe(4001)
    expect(valid.messages.some((m) => m.code === 'SESSION_EXPIRED')).toBe(true)
    await result
  })

  it('reissues a cookie only when needed and returns the island without a visitor row', async () => {
    const first = await island.session()
    expect(first.response.status).toBe(200)
    expect(await first.response.json()).toEqual({ ok: true })
    expect(first.response.headers.get('cache-control')).toBe('private, no-store')
    const again = await island.session({ Cookie: first.cookie ?? '' })
    expect(again.cookie).toBeNull()
    const view = await fetch(new URL('/api/island', island.url))
    const body = (await view.json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['global', 'island', 'revision', 'serverNow', 'v'])
    expect(view.headers.get('cache-control')).toBe('private, no-store')
    expect(await island.sql('SELECT COUNT(*) AS n FROM island_actor')).toEqual([{ n: 0 }])
  })

  it('limits connections per visitor', async () => {
    const cookie = await island.newCookie()
    await connect(cookie)
    await connect(cookie)
    const started = Date.now()
    const third = track(island.open(cookie))
    expect((await third.closed).code).toBe(1013)
    // The refusal finishes its close handshake at once (it is not left closing).
    expect(Date.now() - started).toBeLessThan(2_000)
    expect(third.messages[0]).toMatchObject({ type: 'error', code: 'CONNECTION_LIMIT' })
  })

  it('splits refusals for the daily limit by what is left', async () => {
    // The test Worker caps the island at 40 tiles a day.
    const day = Date.UTC(2026, 10, 12, 23, 59)
    await island.control(`/__test/clock?at=${day}`)
    const a = await connect()
    const b = await connect()
    expect((await a.edit(land(GRASS), tiles(30, 6))).status).toBe('applied')
    expect((await b.edit(land(GRASS), tiles(5, 12))).status).toBe('applied')
    const tooMany = await b.edit(land(GRASS), tiles(10, 14))
    expect(tooMany).toMatchObject({ status: 'rejected', code: 'INSUFFICIENT_GLOBAL_QUOTA' })
    expect(tooMany.global).toMatchObject({ used: 35, limit: 40 })
    expect(tooMany.actor.available).toBe(25)
    expect((await b.edit(land(GRASS), tiles(5, 14))).status).toBe('applied')
    const done = await b.edit(land(GRASS), tiles(1, 16))
    expect(done).toMatchObject({ status: 'rejected', code: 'DAILY_LIMIT' })
    // After midnight UTC only the island-wide count is fresh.
    await island.control(`/__test/clock?at=${day + 60_000}`)
    await new Promise((resolve) => setTimeout(resolve, 5_100))
    b.send({ v: 1, type: 'sync' })
    const snapshot = await b.next('snapshot')
    expect(snapshot.global).toMatchObject({ dayUtc: '2026-11-13', used: 0 })
    expect(snapshot.actor.available).toBe(21)
    expect((await b.edit(land(SAND), tiles(1, 16))).status).toBe('applied')
  }, 20_000)

  it('writes three rows per commit and nothing for reads or refusals', async () => {
    const a = await connect()
    await island.writes()
    for (let i = 0; i < 3; i++)
      expect((await a.edit(land(i % 2 ? SAND : GRASS), tiles(1, 6))).status).toBe('applied')
    // A stale request and a no-op (the tile is already grass) write nothing.
    expect((await a.edit(land(SAND), tiles(1, 6), { expectedActorRevision: 0 })).code).toBe(
      'ACTOR_STALE'
    )
    expect((await a.edit(land(GRASS), tiles(1, 6))).status).toBe('noop')
    await new Promise((resolve) => setTimeout(resolve, 5_100))
    a.send({ v: 1, type: 'sync' })
    await a.next('snapshot')
    await fetch(new URL('/api/island', island.url))
    const writes = await island.writes()
    expect(writes).toEqual([
      { kind: 'edit', rows: 3 },
      { kind: 'edit', rows: 3 },
      { kind: 'edit', rows: 3 }
    ])
  }, 20_000)

  it('cleans up expired visitors once a day within budget and keeps valid ones', async () => {
    const valid = await connect()
    expect((await valid.edit(land(GRASS), tiles(1, 6))).status).toBe('applied')
    // An id whose cookie ran out long ago.
    await island.sql(
      'INSERT INTO island_actor (id, tokens, refill_base, revision, expires_at) VALUES (?, 3, 0, 4, 1)',
      'e'.repeat(43)
    )
    await island.sql('UPDATE island_control SET actor_rows = actor_rows + 1')
    await island.evict('close')
    await island.writes()
    await island.control('/__test/alarm')
    await island.control('/__test/alarm')
    expect(await island.sql('SELECT COUNT(*) AS n FROM island_actor')).toEqual([{ n: 1 }])
    const control = (await island.sql('SELECT cleaned, actor_rows FROM island_control'))[0]
    expect(control).toEqual({ cleaned: 1, actor_rows: 1 })
    // The retry deletes nothing more and only updates its own progress.
    expect((await island.writes()).map((w) => w.rows)).toEqual([2, 1])
  })
})

describe('admission limits in workerd', () => {
  let island: Awaited<ReturnType<typeof startIsland>>
  beforeAll(async () => {
    island = await startIsland('./tests/runtime/wrangler.island-small.jsonc')
  }, 120_000)
  afterAll(async () => {
    await island?.server.close()
  })

  it('holds new ids back until the next day, keeping existing ids editing', async () => {
    // At most two new ids a day and three visitor rows in total.
    const day = Date.UTC(2026, 10, 12, 23, 59)
    await island.control(`/__test/clock?at=${day}`)
    const a = await island.connect(await island.newCookie())
    const b = await island.connect(await island.newCookie())
    expect((await a.edit(land(GRASS), tiles(1, 6))).status).toBe('applied')
    expect((await b.edit(land(GRASS), tiles(1, 8))).status).toBe('applied')
    const c = await island.connect(await island.newCookie())
    expect(c.messages[0].actor.admission).toEqual({
      allowed: false,
      code: 'NEW_ACTOR_LIMIT',
      retryAt: Date.UTC(2026, 10, 13)
    })
    await island.writes()
    const refused = await c.edit(land(GRASS), tiles(1, 10))
    expect(refused).toMatchObject({ status: 'rejected', code: 'NEW_ACTOR_LIMIT' })
    // Reading admission writes nothing.
    expect(await island.writes()).toEqual([])
    expect((await a.edit(land(SAND), tiles(1, 6))).status).toBe('applied')
    // Next day: one more id fits, then the row limit holds with a 60 s recheck.
    await island.control(`/__test/clock?at=${day + 120_000}`)
    expect((await c.edit(land(GRASS), tiles(1, 10))).status).toBe('applied')
    const d = await island.connect(await island.newCookie())
    expect(d.messages[0].actor.admission).toEqual({
      allowed: false,
      code: 'STORAGE_CAPACITY',
      retryAt: d.messages[0].serverNow + 60_000
    })
    for (const client of [a, b, c, d]) client.close()
  })
})
