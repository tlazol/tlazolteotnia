// The browser's link to the shared island: session, WebSocket, snapshots and
// patches, one edit at a time, and patient reconnecting. Nothing here is
// retried blindly: an edit whose outcome is unknown is resolved by a snapshot.

import type { IslandCommand, TileEdit } from './island-edit'
import {
  bucketReadyAt,
  INITIAL_SNAPSHOT_TIMEOUT_MS,
  initialBucket,
  type MessageBucket,
  PENALTY_RETRY_MS,
  penaltyDelay,
  RESPONSE_TIMEOUT_MS,
  reconnectDelay,
  STABLE_CONNECTION_MS,
  SYNC_INTERVAL_MS,
  takeFromBucket
} from './island-policy'
import {
  type ActorQuota,
  CLOSE,
  type GlobalQuota,
  isNewerActor,
  isNewerGlobal,
  type PatchMessage,
  PROTOCOL_VERSION,
  parseIslandView,
  parseServerMessage,
  type ResultMessage,
  type ServerMessage
} from './island-protocol'
import { type ConnectionPhase, type ConnectionState, editBlock, strokeLimit } from './island-status'
import { decodeIsland, type IslandWorld } from './island-world'

export type { ConnectionState, EditBlock } from './island-status'
export { editBlock, estimateActor } from './island-status'

export type WebSocketLike = {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((event: unknown) => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: { code: number }) => void) | null
  onerror: ((event: unknown) => void) | null
}

export type ConnectionDeps = {
  createSocket: (url: string) => WebSocketLike
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  // Monotonic milliseconds (performance.now in the browser).
  now: () => number
  random: () => number
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
  requestId: () => string
  urls: { session: string; socket: string; view: string }
}

export type EditOutcome =
  | { status: 'applied' | 'noop' | 'rejected'; result: ResultMessage }
  | { status: 'unknown' }

export type ConnectionEvents = {
  island: (world: IslandWorld, revision: number, source: 'snapshot' | 'view') => void
  patch: (edits: TileEdit[], revision: number) => void
  state: (state: ConnectionState) => void
  outcome: (outcome: EditOutcome) => void
}

type Attempt = {
  socket: WebSocketLike
  synced: boolean
  snapshotTimer: unknown
  stableTimer: unknown
}
type SessionAttempt = { controller: AbortController; timer: unknown }

export function createIslandConnection(deps: ConnectionDeps, events: ConnectionEvents) {
  const state: ConnectionState = {
    phase: 'connecting',
    retryAt: null,
    limited: false,
    initialFailed: false,
    revision: 0,
    actor: null,
    global: null,
    serverOffset: 0,
    pending: false,
    storageError: false
  }
  let attempt: Attempt | null = null
  let sessionAttempt: SessionAttempt | null = null
  let stopped = true
  let everSynced = false
  let haveIsland = false
  let needSession = true
  let failures = 0
  // The shared waiting deadline: only ever pushed later, never shortened.
  let blockedUntil = 0
  let retryTimer: unknown = null
  let bucket: MessageBucket = initialBucket(deps.now())
  let lastSyncAt = Number.NEGATIVE_INFINITY
  let syncTimer: unknown = null
  let syncDeferTimer: unknown = null
  let syncInFlight = false
  let edit: {
    requestId: string
    command: IslandCommand
    indices: number[]
    timer: unknown
    sent: boolean
  } | null = null
  let recheckTimer: unknown = null
  let recheckTarget: number | null = null
  let viewInFlight = false

  const emit = () => events.state({ ...state })
  const clear = (timer: unknown) => {
    if (timer !== null) deps.clearTimeout(timer)
  }

  function setPhase(phase: ConnectionPhase) {
    state.phase = phase
    emit()
  }

  // ---- Connecting ---------------------------------------------------------------

  function wait(delay: number, limited: boolean) {
    blockedUntil = Math.max(blockedUntil, deps.now() + delay)
    state.retryAt = blockedUntil
    state.limited = state.limited || limited
    state.phase = 'waiting'
    clear(retryTimer)
    retryTimer = deps.setTimeout(retry, Math.max(0, blockedUntil - deps.now()))
    emit()
    if (!haveIsland) void loadView()
  }

  function retry() {
    retryTimer = null
    if (stopped) return
    const remaining = blockedUntil - deps.now()
    if (remaining > 0) {
      retryTimer = deps.setTimeout(retry, remaining)
      return
    }
    void connect()
  }

  async function connect() {
    if (stopped || attempt || sessionAttempt) return
    state.retryAt = null
    state.limited = false
    setPhase('connecting')
    if (needSession) {
      const current: SessionAttempt = { controller: new AbortController(), timer: null }
      sessionAttempt = current
      // Session acquisition can stall before a WebSocket (and its snapshot
      // deadline) exists. Invalidate it before aborting so late replies are ignored.
      current.timer = deps.setTimeout(() => {
        if (sessionAttempt !== current) return
        abandonSession()
        failBeforeSnapshot()
      }, RESPONSE_TIMEOUT_MS)
      let response: Response
      try {
        response = await deps.fetch(deps.urls.session, {
          method: 'POST',
          credentials: 'same-origin',
          signal: current.controller.signal
        })
      } catch {
        if (sessionAttempt === current) {
          sessionAttempt = null
          if (!stopped) failBeforeSnapshot()
        }
        return
      } finally {
        clear(current.timer)
      }
      if (sessionAttempt !== current || stopped) return
      sessionAttempt = null
      if (response.status === 429) {
        waitAfterTooMany(response)
        return
      }
      if (!response.ok) {
        failBeforeSnapshot()
        return
      }
      needSession = false
    }
    openSocket()
  }

  function abandonSession() {
    const current = sessionAttempt
    if (!current) return
    sessionAttempt = null
    clear(current.timer)
    current.controller.abort()
  }

  function waitAfterTooMany(response: Response) {
    const header = Number(response.headers.get('Retry-After'))
    const asked = Number.isFinite(header) && header > 0 ? header * 1000 : 0
    wait(Math.max(PENALTY_RETRY_MS, asked) + Math.floor(deps.random() * 15_000), true)
  }

  function failBeforeSnapshot() {
    needSession = true
    if (!everSynced && !haveIsland) state.initialFailed = true
    wait(penaltyDelay(deps.random()), false)
  }

  function openSocket() {
    let socket: WebSocketLike
    try {
      socket = deps.createSocket(deps.urls.socket)
    } catch {
      failBeforeSnapshot()
      return
    }
    const current: Attempt = { socket, synced: false, snapshotTimer: null, stableTimer: null }
    attempt = current
    // Counted from the socket's creation; only a valid snapshot stops it.
    current.snapshotTimer = deps.setTimeout(() => {
      if (attempt !== current) return
      abandon(current)
      failBeforeSnapshot()
    }, INITIAL_SNAPSHOT_TIMEOUT_MS)
    socket.onmessage = (event) => {
      if (attempt !== current) return
      const message = parseServerMessage(event.data)
      if (message) receive(current, message)
    }
    socket.onclose = (event) => {
      if (attempt !== current) return
      abandon(current)
      closed(current, event.code)
    }
    socket.onerror = () => {}
  }

  // Forget an attempt: its late messages and close events are ignored.
  function abandon(current: Attempt) {
    clear(current.snapshotTimer)
    clear(current.stableTimer)
    current.snapshotTimer = null
    current.stableTimer = null
    if (attempt === current) attempt = null
    current.socket.onmessage = null
    current.socket.onclose = null
    try {
      current.socket.close(CLOSE.normal, 'done')
    } catch {
      // Already closing.
    }
    clear(syncTimer)
    syncTimer = null
    syncInFlight = false
    clear(syncDeferTimer)
    syncDeferTimer = null
    if (edit) {
      clear(edit.timer)
      edit = null
      state.pending = false
      events.outcome({ status: 'unknown' })
    }
  }

  function closed(current: Attempt, code: number) {
    if (stopped) return
    if (!current.synced) {
      failBeforeSnapshot()
      return
    }
    if (code === CLOSE.rateLimited || code === CLOSE.tryAgainLater) {
      wait(penaltyDelay(deps.random()), code === CLOSE.rateLimited)
      return
    }
    if (code === CLOSE.sessionExpired) needSession = true
    wait(reconnectDelay(failures++, deps.random()), false)
  }

  async function loadView() {
    if (viewInFlight || haveIsland || stopped) return
    viewInFlight = true
    try {
      const response = await deps.fetch(deps.urls.view, { credentials: 'same-origin' })
      if (response.status === 429) {
        const header = Number(response.headers.get('Retry-After'))
        blockedUntil = Math.max(
          blockedUntil,
          deps.now() + Math.max(PENALTY_RETRY_MS, Number.isFinite(header) ? header * 1000 : 0)
        )
        if (state.phase === 'waiting') wait(0, true)
        return
      }
      if (!response.ok) return
      const view = parseIslandView(await response.json())
      const world = view && decodeIsland(view.island)
      if (!view || !world || stopped || haveIsland) return
      haveIsland = true
      // Shown for reading only: editing waits for a live snapshot.
      state.global = view.global
      emit()
      events.island(world, view.revision, 'view')
    } catch {
      // Reading is optional; the reconnect continues on its own schedule.
    } finally {
      viewInFlight = false
    }
  }

  // ---- Messages ---------------------------------------------------------------------

  function receive(current: Attempt, message: ServerMessage) {
    if ('serverNow' in message) state.serverOffset = message.serverNow - deps.now()
    switch (message.type) {
      case 'snapshot': {
        const world = decodeIsland(message.island)
        if (!world) return
        if (!current.synced) {
          current.synced = true
          // The server counts the first snapshot as this connection's last sync.
          lastSyncAt = deps.now()
          clear(current.snapshotTimer)
          current.snapshotTimer = null
          // Only a connection that lasts resets the backoff.
          current.stableTimer = deps.setTimeout(() => {
            if (attempt === current) failures = 0
          }, STABLE_CONNECTION_MS)
        }
        clear(syncTimer)
        syncTimer = null
        syncInFlight = false
        everSynced = true
        haveIsland = true
        state.initialFailed = false
        state.storageError = false
        state.revision = message.revision
        state.actor = message.actor
        actorSeenAt = message.serverNow
        state.global = message.global
        state.phase = 'synced'
        events.island(world, message.revision, 'snapshot')
        scheduleRecheck()
        emit()
        return
      }
      case 'patch':
        patch(message)
        return
      case 'result': {
        updateQuota(message.actor, message.global, message.serverNow)
        if (edit && message.requestId === edit.requestId) {
          clear(edit.timer)
          edit = null
          state.pending = false
          events.outcome({ status: message.status, result: message })
          if (message.code === 'ACTOR_STALE' || message.code === 'REVISION_AHEAD') requestSync()
        }
        scheduleRecheck()
        emit()
        return
      }
      case 'quota':
        updateQuota(message.actor, message.global, message.serverNow)
        scheduleRecheck()
        emit()
        return
      case 'error':
        if (message.code === 'STORAGE_UNAVAILABLE') {
          state.storageError = true
          if (edit && (!message.requestId || message.requestId === edit.requestId)) {
            clear(edit.timer)
            edit = null
            state.pending = false
            events.outcome({ status: 'unknown' })
          }
          emit()
          requestSync()
        }
        // The server closes the connection after these; act on them right away
        // rather than waiting for the close handshake to finish.
        {
          const closing: Partial<Record<string, number>> = {
            CONNECTION_LIMIT: CLOSE.tryAgainLater,
            RATE_LIMITED: CLOSE.rateLimited,
            SESSION_EXPIRED: CLOSE.sessionExpired,
            INVALID_MESSAGE: CLOSE.policy,
            MESSAGE_TOO_LARGE: CLOSE.tooLarge
          }
          const code = closing[message.code]
          if (code !== undefined) {
            abandon(current)
            closed(current, code)
          }
        }
        return
    }
  }

  // Late replies never move the counters back.
  let actorSeenAt = 0
  function updateQuota(actor: ActorQuota, global: GlobalQuota, serverNow: number) {
    if (
      !state.actor ||
      isNewerActor(
        { actorRevision: state.actor.actorRevision, serverNow: actorSeenAt },
        { actorRevision: actor.actorRevision, serverNow }
      )
    ) {
      state.actor = actor
      actorSeenAt = serverNow
    }
    if (isNewerGlobal(state.global, global)) state.global = global
  }

  function patch(message: PatchMessage) {
    if (state.phase !== 'synced' && state.phase !== 'syncing') return
    if (message.revision <= state.revision) return
    if (message.revision !== state.revision + 1) {
      // A gap: stop editing and fetch the whole island again.
      requestSync()
      return
    }
    state.revision = message.revision
    if (isNewerGlobal(state.global, message.global)) state.global = message.global
    events.patch(message.edits, message.revision)
    scheduleRecheck()
    emit()
  }

  // ---- Sending ------------------------------------------------------------------------

  function trySend(text: string) {
    const current = attempt
    if (!current?.synced) return false
    const next = takeFromBucket(bucket, deps.now())
    if (!next) return false
    try {
      current.socket.send(text)
    } catch {
      return false
    }
    bucket = next
    return true
  }

  function requestSync() {
    const current = attempt
    if (!current?.synced || syncInFlight) return
    if (state.phase === 'synced') setPhase('syncing')
    clear(syncDeferTimer)
    syncDeferTimer = null
    const at = Math.max(lastSyncAt + SYNC_INTERVAL_MS, bucketReadyAt(bucket, deps.now()))
    if (at > deps.now()) {
      syncDeferTimer = deps.setTimeout(() => {
        syncDeferTimer = null
        requestSync()
      }, at - deps.now())
      return
    }
    if (!trySend(JSON.stringify({ v: PROTOCOL_VERSION, type: 'sync' }))) return
    lastSyncAt = deps.now()
    syncInFlight = true
    syncTimer = deps.setTimeout(() => {
      if (attempt !== current) return
      // No answer: drop this connection and come back from a snapshot.
      abandon(current)
      wait(reconnectDelay(failures++, deps.random()), false)
    }, RESPONSE_TIMEOUT_MS)
  }

  function sendQueuedEdit() {
    if (!edit || edit.sent) return
    const current = edit
    const text = JSON.stringify({
      v: PROTOCOL_VERSION,
      type: 'edit',
      requestId: current.requestId,
      expectedActorRevision: state.actor?.actorRevision ?? 0,
      baseRevision: state.revision,
      command: current.command,
      indices: current.indices
    })
    if (!trySend(text)) {
      current.timer = deps.setTimeout(
        sendQueuedEdit,
        Math.max(50, bucketReadyAt(bucket, deps.now()) - deps.now())
      )
      return
    }
    current.sent = true
    current.timer = deps.setTimeout(() => {
      if (edit !== current) return
      // Unknown outcome: never resend, look at the island instead.
      edit = null
      state.pending = false
      events.outcome({ status: 'unknown' })
      emit()
      requestSync()
    }, RESPONSE_TIMEOUT_MS)
  }

  // ---- Rechecks for the daily limit and admission ------------------------------------

  function scheduleRecheck() {
    const targets: number[] = []
    if (state.global && state.global.used >= state.global.limit) targets.push(state.global.resetsAt)
    if (state.actor && !state.actor.admission.allowed) targets.push(state.actor.admission.retryAt)
    const target = targets.length ? Math.min(...targets) : null
    if (target === recheckTarget) return
    clear(recheckTimer)
    recheckTimer = null
    recheckTarget = target
    if (target === null) return
    const delay = target - (deps.now() + state.serverOffset)
    recheckTimer = deps.setTimeout(fireRecheck, Math.max(0, delay))
  }

  function fireRecheck() {
    recheckTimer = null
    if (recheckTarget === null) return
    if (deps.now() + state.serverOffset < recheckTarget) {
      recheckTimer = deps.setTimeout(fireRecheck, recheckTarget - (deps.now() + state.serverOffset))
      return
    }
    // One sync covers every recheck due now; its snapshot decides what is next.
    recheckTarget = null
    requestSync()
  }

  return {
    state: () => ({ ...state }) as ConnectionState,
    start() {
      if (!stopped) return
      stopped = false
      retry()
    },
    stop() {
      stopped = true
      abandonSession()
      clear(retryTimer)
      clear(recheckTimer)
      retryTimer = null
      recheckTimer = null
      recheckTarget = null
      if (attempt) abandon(attempt)
    },
    editBlock: () => editBlock(state, deps.now()),
    strokeLimit: () => strokeLimit(state, deps.now()),
    // Server time estimated from the latest message and the monotonic clock.
    serverNow: () => deps.now() + state.serverOffset,
    // A stroke may begin only when its batch could be sent right away.
    canSendSoon() {
      return bucketReadyAt(bucket, deps.now()) <= deps.now()
    },
    sendEdit(command: IslandCommand, indices: number[]) {
      if (edit || !attempt?.synced || editBlock(state, deps.now())) return false
      edit = { requestId: deps.requestId(), command, indices, timer: null, sent: false }
      state.pending = true
      emit()
      sendQueuedEdit()
      return true
    },
    // After the page comes back from the background, run an overdue recheck once.
    resume() {
      if (recheckTarget !== null && deps.now() + state.serverOffset >= recheckTarget) {
        clear(recheckTimer)
        fireRecheck()
      }
      if (state.phase === 'waiting' && blockedUntil <= deps.now()) {
        clear(retryTimer)
        retry()
      }
    }
  }
}

export type IslandConnection = ReturnType<typeof createIslandConnection>

// Wires the connection to the real browser.
export function createBrowserIslandConnection(events: ConnectionEvents) {
  const origin = window.location
  const socketUrl = `${origin.protocol === 'https:' ? 'wss:' : 'ws:'}//${origin.host}/api/island/ws`
  return createIslandConnection(
    {
      createSocket: (url) => new WebSocket(url) as unknown as WebSocketLike,
      fetch: (input, init) => window.fetch(input, init),
      now: () => performance.now(),
      random: Math.random,
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: (handle) => window.clearTimeout(handle as number),
      requestId: () => crypto.randomUUID(),
      urls: { session: '/api/island/session', socket: socketUrl, view: '/api/island' }
    },
    events
  )
}
