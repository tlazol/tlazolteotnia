// Load check for the shared island in local workerd (spec §13.4). Run with:
//   npx tsx tests/runtime/island-load.ts
// It prints totals only; no edit contents are kept.
import { startIsland, tiles } from './island-harness'

const EDITORS = 100
const EDITS_PER_EDITOR = 10
const TILES_PER_EDIT = 3

const island = await startIsland('./tests/runtime/wrangler.island-load.jsonc')
const started = Date.now()
try {
  await island.writes()
  // 100 visitors, each with its own cookie and connection.
  const cookies = await Promise.all(Array.from({ length: EDITORS }, () => island.newCookie()))
  const clients = await Promise.all(cookies.map((cookie) => island.connect(cookie)))
  const connectedAt = Date.now()

  // A slow receiver: its socket stops reading while everyone edits.
  const slow = await island.connect(await island.newCookie())
  const raw = (slow.socket as unknown as { _socket?: { pause(): void; resume(): void } })._socket
  raw?.pause()

  let applied = 0
  let noop = 0
  let rejected = 0
  let tilesChanged = 0
  const latencies: number[] = []
  await Promise.all(
    clients.map(async (client, n) => {
      for (let i = 0; i < EDITS_PER_EDITOR; i++) {
        // Neighbouring visitors overlap, so some edits race for the same tiles.
        const row = 4 + ((n * 3 + i) % 50)
        const column = 4 + ((n * 7) % 60)
        const ground = (i % 2) + 1
        const at = Date.now()
        const result = await client.edit(
          { tool: 'land', ground },
          tiles(TILES_PER_EDIT, row, column)
        )
        latencies.push(Date.now() - at)
        if (result.status === 'applied') {
          applied++
          tilesChanged += result.changedCount
        } else if (result.status === 'noop') noop++
        else rejected++
      }
    })
  )
  raw?.resume()
  await new Promise((resolve) => setTimeout(resolve, 1_000))

  const writes = await island.writes()
  const editRows = writes.filter((w) => w.kind === 'edit').map((w) => w.rows)
  const control = (await island.sql('SELECT used, actor_rows FROM island_control'))[0]
  const patchesSeen = clients.reduce(
    (sum, c) => sum + c.messages.filter((m) => m.type === 'patch').length,
    0
  )
  const slowState = slow.socket.readyState
  latencies.sort((a, b) => a - b)

  const sameVisitor = island.open(cookies[0])
  const third = island.open(cookies[0])
  const perVisitor = await Promise.race([
    third.closed.then(({ code }) => String(code)),
    new Promise<string>((resolve) => setTimeout(() => resolve('open'), 3_000))
  ])

  // 2 per visitor: the editor already has one; a second is fine, a third is not.
  // Oversized message from a well-connected visitor.
  const big = await island.connect(await island.newCookie()).catch(() => null)
  big?.socket.send('x'.repeat(5_000))
  const bigClose = big ? (await big.closed).code : 'no slot'

  // Connection cap: 200 sockets in total.
  const extra = []
  for (let i = 0; i < 110; i++) extra.push(island.open(await island.newCookie()))
  const outcomes = await Promise.all(
    extra.map(
      (client) =>
        new Promise<string>((resolve) => {
          const timer = setTimeout(() => resolve('open'), 3_000)
          client.closed.then(({ code }) => {
            clearTimeout(timer)
            resolve(String(code))
          })
        })
    )
  )
  const closedEarly = clients.filter((c) => c.socket.readyState !== 1).length
  console.log(
    JSON.stringify(
      {
        editors: EDITORS,
        requests: EDITORS * EDITS_PER_EDITOR,
        applied,
        noop,
        rejected,
        tilesChanged,
        dailyUsed: control.used,
        visitorRows: control.actor_rows,
        commits: editRows.length,
        rowsWritten: editRows.reduce((a, b) => a + b, 0),
        maxRowsPerCommit: Math.max(...editRows),
        patchesDelivered: patchesSeen,
        latencyMs: {
          p50: latencies[Math.floor(latencies.length / 2)],
          p95: latencies[Math.floor(latencies.length * 0.95)],
          max: latencies.at(-1)
        },
        connectSeconds: (connectedAt - started) / 1000,
        totalSeconds: (Date.now() - started) / 1000,
        editorsDisconnected: closedEarly,
        slowReceiverStillOpen: slowState === 1,
        extraConnections: outcomes.reduce<Record<string, number>>((acc, code) => {
          acc[code] = (acc[code] ?? 0) + 1
          return acc
        }, {}),
        thirdForSameVisitor: perVisitor,
        oversizedMessageClose: bigClose
      },
      null,
      2
    )
  )
  for (const client of [...clients, ...extra, slow, sameVisitor, third]) client.close()
  big?.close()
} finally {
  await island.server.close()
}
