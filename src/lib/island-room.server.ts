// The one shared island. A single Durable Object owns the island, every
// visitor's quota and the daily counters, all in its own SQLite storage.
// No history is kept: only the latest island and current counters.

import { DurableObject } from 'cloudflare:workers'
import {
  applyEdits,
  cloneIsland,
  isEditableIndex,
  planCommand,
  type SkipCode,
  type TileEdit
} from './island-edit'
import { INTERNAL_ACTOR_HEADER, INTERNAL_EXPIRES_HEADER } from './island-internal.server'
import {
  type ActorTokens,
  type AdmissionLimits,
  CLEANUP_ROWS_PER_DAY,
  type ControlCounters,
  countersFor,
  DAILY_TILE_LIMIT,
  defaultAdmissionLimits,
  evaluateAdmission,
  globalQuota,
  initialBucket,
  MAX_CONNECTIONS,
  MAX_CONNECTIONS_PER_ACTOR,
  type MessageBucket,
  nextRefillAt,
  nextUtcDayStart,
  normalizeProtectedArea,
  refillTokens,
  SYNC_INTERVAL_MS,
  SYNC_INTERVAL_TOLERANCE_MS,
  spendTokens,
  takeFromBucket,
  utcDay
} from './island-policy'
import {
  type ActorQuota,
  CLOSE,
  type EditRequest,
  type ErrorCode,
  type IslandView,
  isWithinMessageLimit,
  PROTOCOL_VERSION,
  parseClientMessage,
  type RejectCode,
  type ServerMessage
} from './island-protocol'
import {
  createDefaultIsland,
  decodeIsland,
  encodeIsland,
  GRASS,
  ISLAND_SAVE_VERSION,
  type IslandSave,
  type IslandWorld
} from './island-world'

const SCHEMA_VERSION = 1
const ALARM_DELAY_MS = 60_000

type Attachment = {
  actor: string
  expiresAt: number
  bucket: MessageBucket
  lastSyncAt: number
}
type ActorRow = ActorTokens & { revision: number; expiresAt: number }
type RoomLimits = AdmissionLimits & { dailyTiles: number }
export type CommitKind = 'edit' | 'cleanup' | 'init'

// Local settings may only make the island stricter, never looser.
function stricter(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed < fallback ? parsed : fallback
}
export function roomLimits(env: unknown): RoomLimits {
  const vars = (env ?? {}) as Record<string, unknown>
  return {
    dailyTiles: stricter(vars.ISLAND_DAILY_TILE_LIMIT, DAILY_TILE_LIMIT),
    newActorsPerDay: stricter(
      vars.ISLAND_NEW_ACTORS_PER_DAY,
      defaultAdmissionLimits.newActorsPerDay
    ),
    maxActorRows: stricter(vars.ISLAND_MAX_ACTOR_ROWS, defaultAdmissionLimits.maxActorRows),
    adminBudget: defaultAdmissionLimits.adminBudget
  }
}

const tag = (actor: string) => `actor:${actor}`
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export class IslandRoom extends DurableObject<Env> {
  private readonly sql: SqlStorage
  private readonly limits: RoomLimits
  private world: IslandWorld | null = null
  private save: IslandSave | null = null
  private revision = 0
  private control: ControlCounters = {
    day: '',
    used: 0,
    newActors: 0,
    adminRows: 0,
    cleaned: 0,
    actorRows: 0
  }
  private alarmAt: number | null = null
  private broken: string | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.limits = roomLimits(env)
    void ctx.blockConcurrencyWhile(async () => {
      this.load()
      this.alarmAt = await ctx.storage.getAlarm()
    })
  }

  // Seams for the runtime tests; production uses the real clock and no faults.
  protected now() {
    return Date.now()
  }
  protected fault(_point: string) {}
  protected recordWrite(_kind: CommitKind, _rows: number) {}

  // ---- Storage ---------------------------------------------------------------

  private load() {
    try {
      const existing = this.sql
        .exec<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'island_control'"
        )
        .toArray()
      if (!existing.length) {
        this.initialize()
        return
      }
      const control = this.sql
        .exec<Record<string, number | string>>('SELECT * FROM island_control WHERE id = 1')
        .toArray()[0]
      if (!control || control.schema_version !== SCHEMA_VERSION) {
        this.fail(`unknown island schema ${control?.schema_version}`)
        return
      }
      this.control = {
        day: String(control.day),
        used: Number(control.used),
        newActors: Number(control.new_actors),
        adminRows: Number(control.admin_rows),
        cleaned: Number(control.cleaned),
        actorRows: Number(control.actor_rows)
      }
      const state = this.sql
        .exec<{ save_version: number; island: string; revision: number }>(
          'SELECT save_version, island, revision FROM island_state WHERE id = 1'
        )
        .toArray()[0]
      if (!state) {
        this.fail('island state is missing')
        return
      }
      if (state.save_version !== ISLAND_SAVE_VERSION) {
        this.fail(`unknown island save version ${state.save_version}`)
        return
      }
      let world: IslandWorld | null = null
      try {
        world = decodeIsland(JSON.parse(state.island))
      } catch {
        world = null
      }
      if (!world) {
        this.fail('island save is damaged')
        return
      }
      this.world = world
      this.save = encodeIsland(world)
      this.revision = state.revision
    } catch (error) {
      this.fail('island storage is unavailable', error)
    }
  }

  // Runs once, when the island has never existed.
  private initialize() {
    const now = this.now()
    const world = normalizeProtectedArea(createDefaultIsland(), GRASS)
    const save = encodeIsland(world)
    let rows = 0
    this.ctx.storage.transactionSync(() => {
      const statements = [
        'CREATE TABLE island_state (id INTEGER PRIMARY KEY CHECK (id = 1), save_version INTEGER NOT NULL, island TEXT NOT NULL, revision INTEGER NOT NULL)',
        'CREATE TABLE island_actor (id TEXT PRIMARY KEY, tokens INTEGER NOT NULL, refill_base INTEGER NOT NULL, revision INTEGER NOT NULL, expires_at INTEGER NOT NULL) WITHOUT ROWID',
        'CREATE TABLE island_control (id INTEGER PRIMARY KEY CHECK (id = 1), schema_version INTEGER NOT NULL, day TEXT NOT NULL, used INTEGER NOT NULL, new_actors INTEGER NOT NULL, admin_rows INTEGER NOT NULL, cleaned INTEGER NOT NULL, actor_rows INTEGER NOT NULL)'
      ]
      for (const statement of statements) rows += this.run(statement)
      rows += this.run(
        'INSERT INTO island_state (id, save_version, island, revision) VALUES (1, ?, ?, 0)',
        ISLAND_SAVE_VERSION,
        JSON.stringify(save)
      )
      // The control row records the setup cost, itself included, as upkeep.
      const setupRows = rows + 1
      rows += this.run(
        'INSERT INTO island_control (id, schema_version, day, used, new_actors, admin_rows, cleaned, actor_rows) VALUES (1, ?, ?, 0, 0, ?, 0, 0)',
        SCHEMA_VERSION,
        utcDay(now),
        setupRows
      )
    })
    this.recordWrite('init', rows)
    this.world = world
    this.save = save
    this.revision = 0
    this.control = {
      day: utcDay(now),
      used: 0,
      newActors: 0,
      adminRows: rows,
      cleaned: 0,
      actorRows: 0
    }
  }

  private run(query: string, ...bindings: unknown[]) {
    const cursor = this.sql.exec(query, ...bindings)
    cursor.toArray()
    return cursor.rowsWritten
  }

  private fail(reason: string, error?: unknown) {
    this.broken = reason
    this.world = null
    this.save = null
    console.error(`Island storage stopped: ${reason}`, error ?? '')
  }

  private readActor(id: string): { row: ActorRow | null; stored: boolean } {
    const found = this.sql
      .exec<{ tokens: number; refill_base: number; revision: number; expires_at: number }>(
        'SELECT tokens, refill_base, revision, expires_at FROM island_actor WHERE id = ?',
        id
      )
      .toArray()[0]
    if (!found) return { row: null, stored: false }
    // An expired row is treated as absent; its slot is reused by the upsert.
    if (found.expires_at <= this.now()) return { row: null, stored: true }
    return {
      row: {
        tokens: found.tokens,
        refillBaseMs: found.refill_base,
        revision: found.revision,
        expiresAt: found.expires_at
      },
      stored: true
    }
  }

  // ---- Views -----------------------------------------------------------------

  private actorQuota(attachment: Attachment, row: ActorRow | null, now: number): ActorQuota {
    return {
      actorRevision: row?.revision ?? 0,
      available: refillTokens(row, now).available,
      nextRefillAt: nextRefillAt(row, now),
      expiresAt: attachment.expiresAt,
      admission: evaluateAdmission(row !== null, this.control, now, this.limits)
    }
  }

  private islandView(now: number): IslandView | null {
    if (!this.save) return null
    return {
      v: PROTOCOL_VERSION,
      serverNow: now,
      revision: this.revision,
      island: this.save,
      global: globalQuota(this.control, this.limits.dailyTiles, now)
    }
  }

  private snapshot(attachment: Attachment, now: number): ServerMessage | null {
    const view = this.islandView(now)
    if (!view) return null
    const { row } = this.readActor(attachment.actor)
    return { ...view, type: 'snapshot', actor: this.actorQuota(attachment, row, now) }
  }

  private send(ws: WebSocket, message: ServerMessage) {
    try {
      ws.send(JSON.stringify(message))
      return true
    } catch {
      // A socket that cannot take a message is closed rather than queued for.
      this.close(ws, CLOSE.tryAgainLater, 'send failed')
      return false
    }
  }

  private close(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason)
    } catch {
      // Already closed.
    }
  }

  private sendError(
    ws: WebSocket,
    code: ErrorCode,
    extra: { requestId?: string; retryAt?: number } = {}
  ) {
    this.send(ws, { v: PROTOCOL_VERSION, type: 'error', code, ...extra })
  }

  // ---- HTTP ------------------------------------------------------------------

  async fetch(request: Request) {
    const url = new URL(request.url)
    if (url.pathname === '/view') {
      const view = this.islandView(this.now())
      return view ? json(view) : json({ error: 'unavailable' }, 503)
    }
    if (url.pathname === '/ws') return this.acceptVisitor(request)
    return new Response('Not Found', { status: 404 })
  }

  private acceptVisitor(request: Request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('Upgrade Required', { status: 426 })
    const actor = request.headers.get(INTERNAL_ACTOR_HEADER) ?? ''
    const expiresAt = Number(request.headers.get(INTERNAL_EXPIRES_HEADER))
    if (!/^[A-Za-z0-9_-]{43}$/.test(actor) || !Number.isSafeInteger(expiresAt))
      return new Response('Bad Request', { status: 400 })
    const now = this.now()
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    const attachment: Attachment = {
      actor,
      expiresAt,
      bucket: initialBucket(now),
      lastSyncAt: now
    }
    const full =
      this.ctx.getWebSockets().length >= MAX_CONNECTIONS ||
      this.ctx.getWebSockets(tag(actor)).length >= MAX_CONNECTIONS_PER_ACTOR
    const refusal: [ErrorCode, number] | null = full
      ? ['CONNECTION_LIMIT', CLOSE.tryAgainLater]
      : expiresAt <= now
        ? ['SESSION_EXPIRED', CLOSE.sessionExpired]
        : !this.save
          ? ['STORAGE_UNAVAILABLE', 1011]
          : null
    if (refusal) {
      // Refused sockets are never registered with hibernation or counted: a
      // plain accept lets the close handshake finish right away.
      server.accept()
      this.sendError(server, refusal[0])
      this.close(server, refusal[1], refusal[0])
      return new Response(null, { status: 101, webSocket: client })
    }
    this.ctx.acceptWebSocket(server, [tag(actor)])
    server.serializeAttachment(attachment)
    // Registered before the snapshot is sent, and nothing can run in
    // between: every later patch arrives after this snapshot.
    const snapshot = this.snapshot(attachment, now)
    if (snapshot) this.send(server, snapshot)
    return new Response(null, { status: 101, webSocket: client })
  }

  // ---- WebSocket ---------------------------------------------------------------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') {
      this.close(ws, CLOSE.policy, 'binary messages are not accepted')
      return
    }
    if (!isWithinMessageLimit(message)) {
      this.close(ws, CLOSE.tooLarge, 'message too large')
      return
    }
    const attachment = ws.deserializeAttachment() as Attachment | null
    if (!attachment) {
      this.close(ws, CLOSE.policy, 'unknown connection')
      return
    }
    const now = this.now()
    const bucket = takeFromBucket(attachment.bucket, now)
    if (!bucket) {
      this.sendError(ws, 'RATE_LIMITED', { retryAt: now + 60_000 })
      this.close(ws, CLOSE.rateLimited, 'rate limited')
      return
    }
    attachment.bucket = bucket
    if (now >= attachment.expiresAt) {
      ws.serializeAttachment(attachment)
      this.sendError(ws, 'SESSION_EXPIRED')
      this.close(ws, CLOSE.sessionExpired, 'session expired')
      return
    }
    const request = parseClientMessage(message)
    if (!request) {
      ws.serializeAttachment(attachment)
      this.sendError(ws, 'INVALID_MESSAGE')
      this.close(ws, CLOSE.policy, 'invalid message')
      return
    }
    if (request.type === 'sync') {
      if (now - attachment.lastSyncAt < SYNC_INTERVAL_MS - SYNC_INTERVAL_TOLERANCE_MS) {
        ws.serializeAttachment(attachment)
        this.sendError(ws, 'RATE_LIMITED', { retryAt: now + 60_000 })
        this.close(ws, CLOSE.rateLimited, 'sync too often')
        return
      }
      attachment.lastSyncAt = now
      ws.serializeAttachment(attachment)
      const snapshot = this.snapshot(attachment, now)
      if (snapshot) this.send(ws, snapshot)
      else this.sendError(ws, 'STORAGE_UNAVAILABLE')
      return
    }
    ws.serializeAttachment(attachment)
    this.edit(ws, attachment, request, now)
  }

  async webSocketClose(ws: WebSocket, code: number) {
    this.close(ws, code === 1005 || code === 1006 ? CLOSE.normal : code, 'closed')
  }

  async webSocketError(ws: WebSocket) {
    this.close(ws, 1011, 'error')
  }

  private reject(
    ws: WebSocket,
    attachment: Attachment,
    request: EditRequest,
    code: RejectCode,
    row: ActorRow | null,
    now: number,
    skipped: Array<{ index: number; code: SkipCode }> = []
  ) {
    this.send(ws, {
      v: PROTOCOL_VERSION,
      type: 'result',
      requestId: request.requestId,
      status: 'rejected',
      code,
      revision: this.revision,
      changedCount: 0,
      skipped,
      actor: this.actorQuota(attachment, row, now),
      global: globalQuota(this.control, this.limits.dailyTiles, now),
      serverNow: now
    })
  }

  private edit(ws: WebSocket, attachment: Attachment, request: EditRequest, now: number) {
    const world = this.world
    if (!world || this.broken) {
      this.sendError(ws, 'STORAGE_UNAVAILABLE', { requestId: request.requestId })
      return
    }
    if (!request.indices.every((index) => isEditableIndex(world, index))) {
      this.sendError(ws, 'INVALID_MESSAGE', { requestId: request.requestId })
      this.close(ws, CLOSE.policy, 'invalid tiles')
      return
    }
    let actor: { row: ActorRow | null; stored: boolean }
    try {
      actor = this.readActor(attachment.actor)
    } catch (error) {
      console.error('Island actor read failed', error)
      this.sendError(ws, 'STORAGE_UNAVAILABLE', { requestId: request.requestId })
      return
    }
    const { row } = actor
    if (request.expectedActorRevision !== (row?.revision ?? 0))
      return this.reject(ws, attachment, request, 'ACTOR_STALE', row, now)
    if (request.baseRevision > this.revision)
      return this.reject(ws, attachment, request, 'REVISION_AHEAD', row, now)

    // Re-evaluate every tile against the latest confirmed island.
    const edits: TileEdit[] = []
    const skipped: Array<{ index: number; code: SkipCode }> = []
    for (const index of request.indices) {
      const plan = planCommand(world, index, request.command)
      if (plan.edit) edits.push(plan.edit)
      else skipped.push({ index, code: plan.code })
    }
    const global = () => globalQuota(this.control, this.limits.dailyTiles, now)
    if (!edits.length) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: 'result',
        requestId: request.requestId,
        status: 'noop',
        revision: this.revision,
        changedCount: 0,
        skipped,
        actor: this.actorQuota(attachment, row, now),
        global: global(),
        serverNow: now
      })
      return
    }

    const counters = countersFor(this.control, now)
    const remaining = this.limits.dailyTiles - counters.used
    if (remaining <= 0)
      return this.reject(ws, attachment, request, 'DAILY_LIMIT', row, now, skipped)
    const admission = evaluateAdmission(row !== null, this.control, now, this.limits)
    if (!admission.allowed)
      return this.reject(ws, attachment, request, admission.code, row, now, skipped)
    const spent = spendTokens(row, edits.length, now)
    if (!spent)
      return this.reject(ws, attachment, request, 'INSUFFICIENT_TOKENS', row, now, skipped)
    if (edits.length > remaining)
      return this.reject(ws, attachment, request, 'INSUFFICIENT_GLOBAL_QUOTA', row, now, skipped)

    const isNew = row === null
    const scheduleAlarm = isNew && this.alarmAt === null
    const nextCounters: ControlCounters = {
      ...counters,
      used: counters.used + edits.length,
      newActors: counters.newActors + (isNew ? 1 : 0),
      actorRows: counters.actorRows + (isNew && !actor.stored ? 1 : 0),
      adminRows: counters.adminRows + (scheduleAlarm ? 1 : 0)
    }
    const nextRow: ActorRow = {
      ...spent,
      revision: (row?.revision ?? 0) + 1,
      expiresAt: attachment.expiresAt
    }
    const next = cloneIsland(world)
    applyEdits(next, edits)
    const save = encodeIsland(next)
    const revision = this.revision + 1

    let rows = 0
    try {
      this.ctx.storage.transactionSync(() => {
        rows += this.run(
          'UPDATE island_state SET island = ?, revision = ? WHERE id = 1',
          JSON.stringify(save),
          revision
        )
        this.fault('island')
        rows += this.run(
          'INSERT INTO island_actor (id, tokens, refill_base, revision, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET tokens = excluded.tokens, refill_base = excluded.refill_base, revision = excluded.revision, expires_at = excluded.expires_at',
          attachment.actor,
          nextRow.tokens,
          nextRow.refillBaseMs,
          nextRow.revision,
          nextRow.expiresAt
        )
        this.fault('actor')
        rows += this.writeControl(nextCounters)
        this.fault('control')
      })
    } catch (error) {
      console.error('Island commit failed', error)
      this.sendError(ws, 'STORAGE_UNAVAILABLE', { requestId: request.requestId })
      return
    }
    this.recordWrite('edit', rows)

    // Stored: only now does the island in memory move on.
    this.world = next
    this.save = save
    this.revision = revision
    this.control = nextCounters
    if (scheduleAlarm) {
      this.alarmAt = nextUtcDayStart(now) + ALARM_DELAY_MS
      void this.ctx.storage.setAlarm(this.alarmAt)
    }

    const patch: ServerMessage = {
      v: PROTOCOL_VERSION,
      type: 'patch',
      revision,
      edits,
      global: global(),
      serverNow: now
    }
    const patchText = JSON.stringify(patch)
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(patchText)
      } catch {
        this.close(socket, CLOSE.tryAgainLater, 'send failed')
      }
    }
    const quota = this.actorQuota(attachment, nextRow, now)
    this.send(ws, {
      v: PROTOCOL_VERSION,
      type: 'result',
      requestId: request.requestId,
      status: 'applied',
      revision,
      changedCount: edits.length,
      skipped,
      actor: quota,
      global: global(),
      serverNow: now
    })
    for (const socket of this.ctx.getWebSockets(tag(attachment.actor))) {
      if (socket === ws) continue
      const other = socket.deserializeAttachment() as Attachment | null
      if (!other) continue
      this.send(socket, {
        v: PROTOCOL_VERSION,
        type: 'quota',
        actor: { ...quota, expiresAt: other.expiresAt },
        global: global(),
        serverNow: now
      })
    }
  }

  private writeControl(counters: ControlCounters) {
    return this.run(
      'UPDATE island_control SET day = ?, used = ?, new_actors = ?, admin_rows = ?, cleaned = ?, actor_rows = ? WHERE id = 1',
      counters.day,
      counters.used,
      counters.newActors,
      counters.adminRows,
      counters.cleaned,
      counters.actorRows
    )
  }

  // ---- Daily upkeep --------------------------------------------------------------

  // Once a day: delete visitor rows whose cookie has expired, within budget.
  // The day's progress lives in the control row, so a retried alarm does not
  // spend the budget twice and never touches rows that are still valid.
  async alarm() {
    this.alarmAt = null
    if (this.broken) return
    const now = this.now()
    const counters = countersFor(this.control, now)
    const budget = Math.min(
      CLEANUP_ROWS_PER_DAY - counters.cleaned,
      // Keep two rows for the control update and the next alarm.
      this.limits.adminBudget - counters.adminRows - 2
    )
    let deleted = 0
    let rows = 0
    const next: ControlCounters = { ...counters }
    this.ctx.storage.transactionSync(() => {
      if (budget > 0) {
        deleted = this.run(
          'DELETE FROM island_actor WHERE id IN (SELECT id FROM island_actor WHERE expires_at <= ? LIMIT ?)',
          now,
          budget
        )
      }
      next.cleaned = counters.cleaned + deleted
      next.actorRows = Math.max(0, counters.actorRows - deleted)
      const reschedule = next.actorRows > 0
      next.adminRows = counters.adminRows + deleted + 1 + (reschedule ? 1 : 0)
      rows = deleted + this.writeControl(next)
    })
    this.recordWrite('cleanup', rows)
    this.control = next
    if (next.actorRows > 0) {
      this.alarmAt = nextUtcDayStart(now) + ALARM_DELAY_MS
      await this.ctx.storage.setAlarm(this.alarmAt)
    }
  }
}
