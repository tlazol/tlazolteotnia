import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type ConnectionState,
  createIslandConnection,
  type EditOutcome,
  editBlock,
  estimateActor,
  type WebSocketLike
} from '../src/lib/island-connection.client'
import type { ActorQuota } from '../src/lib/island-protocol'
import { createIsland, encodeIsland } from '../src/lib/island-world'

class FakeSocket implements WebSocketLike {
  readyState = 0
  sent: Array<Record<string, unknown>> = []
  closedWith: number | null = null
  onopen: WebSocketLike['onopen'] = null
  onmessage: WebSocketLike['onmessage'] = null
  onclose: WebSocketLike['onclose'] = null
  onerror: WebSocketLike['onerror'] = null
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close(code = 1000) {
    this.closedWith = code
  }
  deliver(message: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify({ v: 1, ...message }) })
  }
  drop(code: number) {
    this.onclose?.({ code })
  }
}

const island = encodeIsland(createIsland())
const DAY_END = Date.UTC(2026, 10, 13)
const global = (used = 0) => ({ dayUtc: '2026-11-12', used, limit: 100, resetsAt: DAY_END })
const actor = (overrides: Record<string, unknown> = {}) => ({
  actorRevision: 0,
  available: 30,
  nextRefillAt: null,
  expiresAt: DAY_END + 1e9,
  admission: { allowed: true } as const,
  ...overrides
})
const snapshot = (overrides: Record<string, unknown> = {}) => ({
  type: 'snapshot',
  serverNow: Date.now(),
  revision: 0,
  island,
  actor: actor(),
  global: global(),
  ...overrides
})

function setup(
  options: {
    session?: (init?: RequestInit) => Response | Promise<Response>
    view?: () => Response
  } = {}
) {
  const sockets: FakeSocket[] = []
  const states: ConnectionState[] = []
  const outcomes: EditOutcome[] = []
  const islands: Array<{ revision: number; source: string }> = []
  const patches: number[] = []
  const fetches: string[] = []
  let id = 0
  const connection = createIslandConnection(
    {
      createSocket: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
      fetch: async (url, init) => {
        fetches.push(url)
        if (url === '/view') return options.view?.() ?? new Response('', { status: 503 })
        return options.session?.(init) ?? Response.json({ ok: true })
      },
      now: () => Date.now(),
      random: () => 0.5,
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      requestId: () => `req-${++id}`,
      urls: { session: '/session', socket: 'ws://test/ws', view: '/view' }
    },
    {
      island: (_world, revision, source) => islands.push({ revision, source }),
      patch: (_edits, revision) => patches.push(revision),
      state: (state) => states.push(state),
      outcome: (outcome) => outcomes.push(outcome)
    }
  )
  return {
    connection,
    sockets,
    states,
    outcomes,
    islands,
    patches,
    fetches,
    last: () => sockets[sockets.length - 1],
    state: () => connection.state()
  }
}

async function started(test: ReturnType<typeof setup>) {
  test.connection.start()
  await vi.advanceTimersByTimeAsync(0)
  return test.last()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.UTC(2026, 10, 12, 3))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('island connection', () => {
  it.each(['resolve', 'reject'] as const)(
    'times out a stalled session, ignores its late %s and recovers on the next attempt',
    async (settle) => {
      let resolve!: (response: Response) => void
      let reject!: (error: Error) => void
      const pending = new Promise<Response>((yes, no) => {
        resolve = yes
        reject = no
      })
      let signal: AbortSignal | null | undefined
      const session = vi.fn((init?: RequestInit) => {
        signal = init?.signal
        return pending
      })
      const test = setup({
        session,
        view: () =>
          Response.json({ v: 1, serverNow: Date.now(), revision: 4, island, global: global() })
      })
      await started(test)
      await vi.advanceTimersByTimeAsync(9_999)
      expect(test.state().phase).toBe('connecting')
      expect(test.fetches).toEqual(['/session'])
      await vi.advanceTimersByTimeAsync(1)
      expect(signal?.aborted).toBe(true)
      expect(test.state()).toMatchObject({ phase: 'waiting', initialFailed: true })
      expect(test.islands).toEqual([{ revision: 4, source: 'view' }])
      expect(test.connection.editBlock()).toBe('waiting')
      const retryAt = test.state().retryAt ?? 0
      expect(retryAt - Date.now()).toBeGreaterThanOrEqual(60_000)

      await vi.advanceTimersByTimeAsync(1_000)
      if (settle === 'resolve') resolve(Response.json({ ok: true }))
      else reject(new Error('late network failure'))
      await vi.advanceTimersByTimeAsync(0)
      expect(test.sockets).toHaveLength(0)
      expect(test.state().retryAt).toBe(retryAt)

      session.mockImplementation(async () => Response.json({ ok: true }))
      await vi.advanceTimersByTimeAsync(retryAt - Date.now() - 1)
      expect(session).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(session).toHaveBeenCalledTimes(2)
      expect(test.sockets).toHaveLength(1)
      test.last().deliver(snapshot({ revision: 4 }))
      expect(test.state()).toMatchObject({ phase: 'synced', initialFailed: false })
      expect(test.connection.editBlock()).toBeNull()
      test.connection.stop()
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it('aborts a pending session on stop and ignores it after restarting', async () => {
    let resolve!: (response: Response) => void
    const pending = new Promise<Response>((yes) => {
      resolve = yes
    })
    let signal: AbortSignal | null | undefined
    const session = vi.fn((init?: RequestInit) => {
      signal = init?.signal
      return pending
    })
    const test = setup({ session })
    await started(test)
    test.connection.stop()
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)

    session.mockImplementation(async () => Response.json({ ok: true }))
    const socket = await started(test)
    socket.deliver(snapshot())
    resolve(Response.json({ ok: true }))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(test.sockets).toHaveLength(1)
    expect(test.state().phase).toBe('synced')
    expect(test.fetches).toEqual(['/session', '/session'])
    test.connection.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('gives up on a missing first snapshot after 10 s and waits at least a minute', async () => {
    const test = setup()
    const socket = await started(test)
    await vi.advanceTimersByTimeAsync(9_999)
    expect(test.state().phase).toBe('connecting')
    await vi.advanceTimersByTimeAsync(1)
    expect(socket.closedWith).toBe(1000)
    expect(test.state()).toMatchObject({ phase: 'waiting', initialFailed: true })
    const retryAt = test.state().retryAt ?? 0
    expect(retryAt - Date.now()).toBeGreaterThanOrEqual(60_000)
    // Late events from the abandoned socket change nothing and add no retries.
    socket.deliver(snapshot())
    socket.drop(1006)
    expect(test.state().phase).toBe('waiting')
    expect(test.islands).toEqual([])
    expect(test.state().retryAt).toBe(retryAt)
    await vi.advanceTimersByTimeAsync(retryAt - Date.now() - 1)
    expect(test.sockets).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(test.sockets).toHaveLength(2)
  })

  it('treats a failure before the snapshot like a refused upgrade and drops its timer', async () => {
    const test = setup()
    const socket = await started(test)
    await vi.advanceTimersByTimeAsync(2_000)
    socket.drop(1006)
    const retryAt = test.state().retryAt ?? 0
    expect(retryAt - Date.now()).toBeGreaterThanOrEqual(60_000)
    // The old 10 s deadline passes without moving the wait.
    await vi.advanceTimersByTimeAsync(9_000)
    expect(test.state().retryAt).toBe(retryAt)
    expect(test.sockets).toHaveLength(1)
  })

  it('waits for Retry-After on a 429 and a fallback read never shortens it', async () => {
    const test = setup({
      session: () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }),
      view: () =>
        Response.json({ v: 1, serverNow: Date.now(), revision: 4, island, global: global() })
    })
    test.connection.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(test.state().phase).toBe('waiting')
    expect((test.state().retryAt ?? 0) - Date.now()).toBeGreaterThanOrEqual(120_000)
    expect(test.state().limited).toBe(true)
    // The island is shown for reading while editing stays off.
    expect(test.islands).toEqual([{ revision: 4, source: 'view' }])
    expect(editBlock(test.state(), Date.now())).toBe('limited')
    await vi.advanceTimersByTimeAsync(119_000)
    expect(test.fetches.filter((url) => url === '/session')).toHaveLength(1)
  })

  it('backs off 1, 2, 4… seconds after drops and resets only after a minute of calm', async () => {
    const test = setup()
    const delays: number[] = []
    let socket = await started(test)
    for (let i = 0; i < 3; i++) {
      socket.deliver(snapshot())
      await vi.advanceTimersByTimeAsync(5_000)
      socket.drop(1006)
      const delay = (test.state().retryAt ?? 0) - Date.now()
      delays.push(delay)
      await vi.advanceTimersByTimeAsync(delay)
      socket = test.last()
    }
    expect(delays.map((d) => Math.floor(d / 1000))).toEqual([1, 2, 4])
    socket.deliver(snapshot())
    await vi.advanceTimersByTimeAsync(60_000)
    socket.drop(1006)
    expect(Math.floor(((test.state().retryAt ?? 0) - Date.now()) / 1000)).toBe(1)
  })

  it('waits a minute after being closed for sending too much', async () => {
    const test = setup()
    const socket = await started(test)
    socket.deliver(snapshot())
    socket.drop(4008)
    expect((test.state().retryAt ?? 0) - Date.now()).toBeGreaterThanOrEqual(60_000)
    expect(test.state().limited).toBe(true)
  })

  it('treats a refusal before the snapshot as a failed connection without waiting for the close', async () => {
    const test = setup()
    const socket = await started(test)
    socket.deliver({ type: 'error', code: 'CONNECTION_LIMIT' })
    expect(socket.closedWith).toBe(1000)
    expect(test.state().phase).toBe('waiting')
    expect((test.state().retryAt ?? 0) - Date.now()).toBeGreaterThanOrEqual(60_000)
    // A late close for the same socket schedules nothing more.
    socket.drop(1013)
    await vi.advanceTimersByTimeAsync(59_000)
    expect(test.sockets).toHaveLength(1)
  })

  it('applies patches in order, ignores repeats and resyncs on a gap', async () => {
    const test = setup()
    const socket = await started(test)
    socket.deliver(snapshot({ revision: 5 }))
    const patch = (revision: number) => ({
      type: 'patch',
      revision,
      edits: [],
      global: global(),
      serverNow: Date.now()
    })
    socket.deliver(patch(6))
    socket.deliver(patch(6))
    socket.deliver(patch(5))
    expect(test.patches).toEqual([6])
    socket.deliver(patch(8))
    expect(test.patches).toEqual([6])
    expect(test.state().phase).toBe('syncing')
    // The first sync waits for the 5 s spacing since connecting (the server
    // closes a connection that syncs sooner).
    await vi.advanceTimersByTimeAsync(4_999)
    expect(socket.sent.filter((m) => m.type === 'sync')).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(socket.sent.filter((m) => m.type === 'sync')).toHaveLength(1)
    // No answer within 10 s: reconnect from a snapshot.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(socket.closedWith).toBe(1000)
    expect(test.state().phase).toBe('waiting')
  })

  it('sends one edit at a time and never resends one whose outcome is unknown', async () => {
    const test = setup()
    const socket = await started(test)
    socket.deliver(snapshot())
    expect(test.connection.sendEdit({ tool: 'erase' }, [810])).toBe(true)
    expect(test.connection.sendEdit({ tool: 'erase' }, [811])).toBe(false)
    expect(editBlock(test.state(), Date.now())).toBe('pending')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(test.outcomes).toEqual([{ status: 'unknown' }])
    expect(socket.sent.filter((m) => m.type === 'edit')).toHaveLength(1)
    expect(socket.sent.filter((m) => m.type === 'sync')).toHaveLength(1)
  })

  it('rechecks the daily limit once at midnight UTC', async () => {
    const test = setup()
    const socket = await started(test)
    socket.deliver(snapshot({ global: { ...global(100) } }))
    expect(editBlock(test.state(), Date.now())).toBe('daily')
    await vi.advanceTimersByTimeAsync(DAY_END - Date.now() - 1)
    expect(socket.sent).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(socket.sent).toEqual([{ v: 1, type: 'sync' }])
    // The server answers with the new day: editing resumes.
    socket.deliver(
      snapshot({ global: { dayUtc: '2026-11-13', used: 0, limit: 100, resetsAt: DAY_END + 864e5 } })
    )
    expect(editBlock(test.state(), Date.now())).toBeNull()
    await vi.advanceTimersByTimeAsync(864e5)
    expect(socket.sent).toHaveLength(1)
  })

  it('merges an admission recheck that falls together with the daily one', async () => {
    const test = setup()
    const socket = await started(test)
    socket.deliver(
      snapshot({
        global: global(100),
        actor: actor({ admission: { allowed: false, code: 'NEW_ACTOR_LIMIT', retryAt: DAY_END } })
      })
    )
    await vi.advanceTimersByTimeAsync(DAY_END - Date.now() + 1_000)
    expect(socket.sent.filter((m) => m.type === 'sync')).toHaveLength(1)
    // Still busy with a new time: wait for it, nothing earlier.
    socket.deliver(
      snapshot({
        actor: actor({
          admission: { allowed: false, code: 'STORAGE_CAPACITY', retryAt: Date.now() + 60_000 }
        })
      })
    )
    expect(editBlock(test.state(), Date.now())).toBe('busy')
    await vi.advanceTimersByTimeAsync(59_000)
    expect(socket.sent.filter((m) => m.type === 'sync')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(socket.sent.filter((m) => m.type === 'sync')).toHaveLength(2)
  })

  it('resumes editing when another tab of the same visitor is admitted', async () => {
    const test = setup()
    const socket = await started(test)
    const blocked = { allowed: false, code: 'NEW_ACTOR_LIMIT', retryAt: DAY_END }
    socket.deliver(snapshot({ actor: actor({ admission: blocked }) }))
    expect(editBlock(test.state(), Date.now())).toBe('busy')
    socket.deliver({
      type: 'quota',
      actor: actor({ actorRevision: 1, available: 29 }),
      global: global(1),
      serverNow: Date.now()
    })
    expect(editBlock(test.state(), Date.now())).toBeNull()
    // The pending recheck is dropped: nothing is sent at the old time.
    await vi.advanceTimersByTimeAsync(DAY_END - Date.now() + 1_000)
    expect(socket.sent.filter((m) => m.type === 'sync')).toHaveLength(0)
  })

  it('runs an overdue recheck once when the page comes back from the background', async () => {
    const test = setup()
    const socket = await started(test)
    const retryAt = Date.now() + 60_000
    socket.deliver(
      snapshot({
        actor: actor({ admission: { allowed: false, code: 'STORAGE_CAPACITY', retryAt } })
      })
    )
    // A throttled background tab: the clock moves on but the timer has not fired.
    vi.setSystemTime(retryAt + 30_000)
    test.connection.resume()
    test.connection.resume()
    expect(socket.sent.filter((m) => m.type === 'sync')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(0)
    expect(socket.sent.filter((m) => m.type === 'sync')).toHaveLength(1)
  })

  it('stops every timer when unmounted', async () => {
    const test = setup()
    const socket = await started(test)
    test.connection.stop()
    expect(socket.closedWith).toBe(1000)
    await vi.advanceTimersByTimeAsync(600_000)
    expect(test.sockets).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('quota estimates', () => {
  it('counts refills since the message without exceeding 30', () => {
    const quota = { ...actor(), available: 3, nextRefillAt: 1_000 } as ActorQuota
    expect(estimateActor(quota, 999)).toEqual({ available: 3, nextRefillAt: 1_000 })
    expect(estimateActor(quota, 1_000)).toEqual({ available: 4, nextRefillAt: 61_000 })
    expect(estimateActor(quota, 10_000_000).available).toBe(30)
  })
})
