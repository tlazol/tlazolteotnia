// Connection and quota status shared by the connection and the toolbar.
// Pure: no browser APIs, safe to import from server-rendered components.

import { ACTOR_MAX_TOKENS, ACTOR_REFILL_MS, MAX_EDIT_TILES } from './island-policy'
import type { ActorQuota, GlobalQuota } from './island-protocol'

export type ConnectionPhase = 'connecting' | 'synced' | 'syncing' | 'waiting'

export type ConnectionState = {
  phase: ConnectionPhase
  // Monotonic time of the next connection attempt while waiting.
  retryAt: number | null
  // Waiting because the server or a limiter asked us to slow down.
  limited: boolean
  // The first connection gave up before any island arrived.
  initialFailed: boolean
  revision: number
  actor: ActorQuota | null
  global: GlobalQuota | null
  // serverNow − monotonic now, from the latest message.
  serverOffset: number
  pending: boolean
  storageError: boolean
}

// Personal quota as of a server time, counting refills since the message.
export function estimateActor(actor: ActorQuota, serverNow: number) {
  if (actor.nextRefillAt === null || actor.available >= ACTOR_MAX_TOKENS)
    return { available: Math.min(ACTOR_MAX_TOKENS, actor.available), nextRefillAt: null }
  if (serverNow < actor.nextRefillAt)
    return { available: actor.available, nextRefillAt: actor.nextRefillAt }
  const recovered = 1 + Math.floor((serverNow - actor.nextRefillAt) / ACTOR_REFILL_MS)
  const available = Math.min(ACTOR_MAX_TOKENS, actor.available + recovered)
  return {
    available,
    nextRefillAt:
      available >= ACTOR_MAX_TOKENS ? null : actor.nextRefillAt + recovered * ACTOR_REFILL_MS
  }
}

export type EditBlock =
  | 'connecting'
  | 'waiting'
  | 'limited'
  | 'syncing'
  | 'storage'
  | 'daily'
  | 'busy'
  | 'empty'
  | 'pending'
  | null

// Why editing is off right now, or null when a new edit may start.
export function editBlock(state: ConnectionState, monotonicNow: number): EditBlock {
  if (state.phase === 'waiting') return state.limited ? 'limited' : 'waiting'
  if (state.phase === 'connecting') return 'connecting'
  if (state.phase === 'syncing') return 'syncing'
  if (state.storageError) return 'storage'
  if (!state.actor || !state.global) return 'connecting'
  if (state.global.used >= state.global.limit) return 'daily'
  if (!state.actor.admission.allowed) return 'busy'
  const serverNow = monotonicNow + state.serverOffset
  if (estimateActor(state.actor, serverNow).available < 1) return 'empty'
  if (state.pending) return 'pending'
  return null
}

// How many tiles one stroke may change.
export function strokeLimit(state: ConnectionState, monotonicNow: number) {
  if (!state.actor || !state.global) return 0
  const serverNow = monotonicNow + state.serverOffset
  return Math.max(
    0,
    Math.min(
      MAX_EDIT_TILES,
      estimateActor(state.actor, serverNow).available,
      state.global.limit - state.global.used
    )
  )
}
