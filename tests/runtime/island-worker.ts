// Worker used only by the runtime tests: the real island API and Durable
// Object, plus a clock, fault injection and write records the tests control.
// None of this is part of the deployed Worker.

import { handleIslandRequest } from '../../src/lib/island-api.server'
import { IslandRoom as BaseIslandRoom, type CommitKind } from '../../src/lib/island-room.server'

type TestEnv = Env & { TEST_CONTROL: string }

let clockOffset = 0
let frozenAt: number | null = null
let pendingFault: string | null = null
const writes: Array<{ kind: CommitKind; rows: number }> = []

export class IslandRoom extends BaseIslandRoom {
  protected override now() {
    return frozenAt ?? Date.now() + clockOffset
  }
  protected override fault(point: string) {
    if (pendingFault === point) {
      pendingFault = null
      throw new Error(`injected fault at ${point}`)
    }
  }
  protected override recordWrite(kind: CommitKind, rows: number) {
    writes.push({ kind, rows })
  }
  override async fetch(request: Request) {
    const url = new URL(request.url)
    if (url.pathname === '/__test/sockets') {
      return Response.json({
        total: this.ctx.getWebSockets().length,
        tags: this.ctx.getWebSockets().map((ws) => this.ctx.getTags(ws)[0]?.slice(0, 12))
      })
    }
    if (url.pathname === '/__test/alarm') {
      await this.alarm()
      return Response.json({ ok: true })
    }
    return super.fetch(request)
  }
}

export default {
  async fetch(request: Request, env: TestEnv) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/__test/')) {
      if (request.headers.get('X-Test-Control') !== env.TEST_CONTROL)
        return new Response('Forbidden', { status: 403 })
      switch (url.pathname) {
        case '/__test/clock':
          clockOffset = Number(url.searchParams.get('offset') ?? 0)
          frozenAt = url.searchParams.has('at') ? Number(url.searchParams.get('at')) : null
          return Response.json({ now: frozenAt ?? Date.now() + clockOffset })
        case '/__test/fault':
          pendingFault = url.searchParams.get('point')
          return Response.json({ ok: true })
        case '/__test/writes': {
          const copy = writes.splice(0)
          return Response.json(copy)
        }
        case '/__test/sockets':
        case '/__test/alarm': {
          const stub = env.ISLAND_ROOM.get(env.ISLAND_ROOM.idFromName('public-island'))
          return stub.fetch(`https://island.internal${url.pathname}`)
        }
      }
      return new Response('Not Found', { status: 404 })
    }
    return (await handleIslandRequest(request, env)) ?? new Response('Not Found', { status: 404 })
  }
} satisfies ExportedHandler<TestEnv>
