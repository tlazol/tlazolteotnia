// Helpers for driving the island Worker in a real workerd runtime.
import { createTestHarness } from 'wrangler'
import WebSocket from 'ws'
import { bucketReadyAt, initialBucket, takeFromBucket } from '../../src/lib/island-policy'

export const CONTROL = 'runtime-test-control'
type Message = Record<string, any>

export async function startIsland(config: string) {
  const server = createTestHarness({ workers: [{ configPath: config }] })
  let url = (await server.listen()).url
  let ip = 1
  const nextIp = () => `10.1.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}`

  async function control(path: string) {
    const response = await fetch(new URL(path, url), { headers: { 'X-Test-Control': CONTROL } })
    if (!response.ok) throw new Error(`${path}: ${response.status}`)
    return response.json()
  }

  async function session(extra: Record<string, string> = {}) {
    const response = await fetch(new URL('/api/island/session', url), {
      method: 'POST',
      headers: { Origin: url.origin, 'CF-Connecting-IP': nextIp(), ...extra }
    })
    const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? null
    return { response, cookie }
  }

  async function newCookie() {
    const { cookie } = await session()
    if (!cookie) throw new Error('no cookie')
    return cookie
  }

  function open(cookie: string, headers: Record<string, string> = {}) {
    const socket = new WebSocket(new URL('/api/island/ws', url).href.replace(/^http/, 'ws'), {
      headers: { Origin: url.origin, Cookie: cookie, 'CF-Connecting-IP': nextIp(), ...headers }
    })
    return new Client(socket)
  }

  async function connect(cookie: string) {
    const client = open(cookie)
    await client.next('snapshot')
    return client
  }

  async function writes(): Promise<Array<{ kind: string; rows: number }>> {
    return (await control('/__test/writes')) as Array<{ kind: string; rows: number }>
  }

  async function sql(query: string, ...bindings: unknown[]) {
    const storage = await server
      .getWorker()
      .getDurableObjectStorage('IslandRoom', { name: 'public-island' })
    return (await storage.exec(query, ...bindings)) as Array<Record<string, any>>
  }

  return {
    server,
    get url() {
      return url
    },
    async reset() {
      await server.reset()
      url = (await server.listen()).url
      await control('/__test/clock?offset=0')
    },
    control,
    session,
    newCookie,
    open,
    connect,
    writes,
    sql,
    evict(webSockets: 'close' | 'hibernate') {
      return server
        .getWorker()
        .evictDurableObject('IslandRoom', { name: 'public-island', webSockets })
    }
  }
}

export class Client {
  readonly messages: Message[] = []
  private waiters: Array<{ test: (message: Message) => boolean; resolve: (m: Message) => void }> =
    []
  private seen = 0
  readonly closed: Promise<{ code: number; status?: number }>
  revision = 0
  actorRevision = 0

  constructor(readonly socket: WebSocket) {
    socket.on('message', (data, binary) => {
      if (binary) return
      const message = JSON.parse(String(data))
      if (message.type === 'snapshot') {
        this.revision = message.revision
        this.actorRevision = message.actor.actorRevision
      }
      if (message.type === 'patch') this.revision = Math.max(this.revision, message.revision)
      if ((message.type === 'result' || message.type === 'quota') && message.actor)
        this.actorRevision = Math.max(this.actorRevision, message.actor.actorRevision)
      this.messages.push(message)
      for (const waiter of [...this.waiters]) {
        if (waiter.test(message)) {
          this.waiters.splice(this.waiters.indexOf(waiter), 1)
          waiter.resolve(message)
        }
      }
    })
    this.closed = new Promise((resolve) => {
      socket.on('close', (code) => resolve({ code }))
      socket.on('unexpected-response', (_request, response) => {
        resolve({ code: 1006, status: response.statusCode })
        socket.terminate()
      })
      socket.on('error', () => {})
    })
  }

  // The next message of a type that has not been consumed yet.
  next(type: string, timeout = 5_000): Promise<Message> {
    const index = this.messages.findIndex((m, i) => i >= this.seen && m.type === type)
    if (index >= 0) {
      this.seen = index + 1
      return Promise.resolve(this.messages[index])
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), timeout)
      this.waiters.push({
        test: (m) => m.type === type,
        resolve: (m) => {
          clearTimeout(timer)
          this.seen = this.messages.indexOf(m) + 1
          resolve(m)
        }
      })
    })
  }

  result(requestId: string, timeout = 5_000): Promise<Message> {
    const found = this.messages.find((m) => m.type === 'result' && m.requestId === requestId)
    if (found) return Promise.resolve(found)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no result for ${requestId}`)), timeout)
      this.waiters.push({
        test: (m) => (m.type === 'result' || m.type === 'error') && m.requestId === requestId,
        resolve: (m) => {
          clearTimeout(timer)
          resolve(m)
        }
      })
    })
  }

  // Paced like the real browser client: a burst of 4, then 2 a second.
  private bucket = initialBucket(Date.now())
  private queue = Promise.resolve()
  send(message: unknown) {
    const text = typeof message === 'string' ? message : JSON.stringify(message)
    this.queue = this.queue.then(async () => {
      const wait = bucketReadyAt(this.bucket, Date.now()) - Date.now()
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 20))
      this.bucket = takeFromBucket(this.bucket, Date.now()) ?? this.bucket
      this.socket.send(text)
    })
  }

  flushed() {
    return this.queue
  }

  private id = 0
  edit(command: unknown, indices: number[], overrides: Record<string, unknown> = {}) {
    const requestId = `r${++this.id}-${Math.random().toString(36).slice(2, 8)}`
    this.send({
      v: 1,
      type: 'edit',
      requestId,
      expectedActorRevision: this.actorRevision,
      baseRevision: this.revision,
      command,
      indices,
      ...overrides
    })
    return this.result(requestId)
  }

  close() {
    this.socket.close()
  }
}

// Editable tiles in a block away from the centre, row by row.
export function tiles(count: number, row = 6, column = 6) {
  return Array.from(
    { length: count },
    (_, i) => (row + Math.floor(i / 10)) * 80 + column + (i % 10)
  )
}
