// Limits and quota arithmetic shared by the island's Durable Object, the
// browser and the tests. Everything here is pure: callers pass the time in.

import { ISLAND_CENTER, ISLAND_COLUMNS, type IslandWorld, WATER } from './island-world'

// ---- Personal quota (user requirement: 30 tiles, one more every 60 s) -------
export const ACTOR_MAX_TOKENS = 30
export const ACTOR_INITIAL_TOKENS = 30
export const ACTOR_REFILL_MS = 60_000

// ---- Island-wide daily limit ---------------------------------------------------
// Workers Free allows 100,000 SQLite rows written per day for Durable Objects.
// Half of that is 50,000. A committed batch writes at most 3 rows (island,
// actor, control), so the worst case is one tile per batch:
// floor(50,000 / 3) = 16,666 → 16,000 tiles, leaving 2,000 rows for upkeep.
export const FREE_ROWS_WRITTEN_PER_DAY = 100_000
export const ROW_BUDGET_PER_DAY = FREE_ROWS_WRITTEN_PER_DAY / 2
export const ROWS_PER_COMMIT = 3
export const DAILY_TILE_LIMIT = 16_000
export const ADMIN_ROW_BUDGET_PER_DAY = 2_000

// ---- Anonymous visitors --------------------------------------------------------
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const NEW_ACTORS_PER_DAY = 1_000
export const MAX_ACTOR_ROWS = 32_000
export const CLEANUP_ROWS_PER_DAY = 1_000
export const CAPACITY_RETRY_MS = 60_000

// ---- Connections ---------------------------------------------------------------
export const MAX_MESSAGE_BYTES = 4_096
export const MAX_EDIT_TILES = 30
export const MESSAGE_REFILL_PER_SECOND = 2
export const MESSAGE_BURST = 4
export const MAX_CONNECTIONS = 200
export const MAX_CONNECTIONS_PER_ACTOR = 2
export const SYNC_INTERVAL_MS = 5_000
// The server accepts a sync slightly early so network jitter between two
// compliant 5 s-spaced requests never closes a well-behaved socket.
export const SYNC_INTERVAL_TOLERANCE_MS = 1_000
export const INITIAL_SNAPSHOT_TIMEOUT_MS = 10_000
export const RESPONSE_TIMEOUT_MS = 10_000
export const SESSION_REQUESTS_PER_MINUTE = 10
export const CONNECT_REQUESTS_PER_MINUTE = 30

// ---- Reconnecting --------------------------------------------------------------
export const PENALTY_RETRY_MS = 60_000
export const PENALTY_JITTER_MS = 15_000
export const RECONNECT_STEPS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000]
export const RECONNECT_MAX_MS = 30_000
export const RECONNECT_JITTER_MS = 1_000
export const STABLE_CONNECTION_MS = 60_000

// ---- Shelter -------------------------------------------------------------------
// Residents walk independently in every browser, so instead of their feet a
// fixed 3×3 around the island centre stays walkable for everyone.
export const PROTECTED_RADIUS = 1

export function isProtectedTile(x: number, y: number) {
  return (
    Math.abs(x - ISLAND_CENTER.x) <= PROTECTED_RADIUS &&
    Math.abs(y - ISLAND_CENTER.y) <= PROTECTED_RADIUS
  )
}
export function isProtectedIndex(index: number) {
  return isProtectedTile(index % ISLAND_COLUMNS, Math.floor(index / ISLAND_COLUMNS))
}

// The shelter is land without decorations. Existing land is kept so the
// default plaza keeps its paving; only sea becomes the given ground (grass).
export function normalizeProtectedArea(world: IslandWorld, grass: number) {
  for (let dy = -PROTECTED_RADIUS; dy <= PROTECTED_RADIUS; dy++) {
    for (let dx = -PROTECTED_RADIUS; dx <= PROTECTED_RADIUS; dx++) {
      const index = (ISLAND_CENTER.y + dy) * world.columns + ISLAND_CENTER.x + dx
      if (world.ground[index] === WATER) world.ground[index] = grass
      world.decor[index] = 0
    }
  }
  return world
}

// ---- Token arithmetic ----------------------------------------------------------
export type ActorTokens = { tokens: number; refillBaseMs: number }

// What is available now, and the base the next refill counts from. A full
// bucket does not bank waiting time: spending from 30 starts a fresh minute.
export function refillTokens(state: ActorTokens | null, now: number) {
  if (!state || state.tokens >= ACTOR_MAX_TOKENS) {
    return { available: state ? ACTOR_MAX_TOKENS : ACTOR_INITIAL_TOKENS, base: now }
  }
  const elapsed = Math.max(0, now - state.refillBaseMs)
  const recovered = Math.floor(elapsed / ACTOR_REFILL_MS)
  const available = Math.min(ACTOR_MAX_TOKENS, state.tokens + recovered)
  const base =
    available === ACTOR_MAX_TOKENS ? now : state.refillBaseMs + recovered * ACTOR_REFILL_MS
  return { available, base }
}

export function spendTokens(state: ActorTokens | null, count: number, now: number) {
  const { available, base } = refillTokens(state, now)
  if (count > available) return null
  return { tokens: available - count, refillBaseMs: base }
}

export function nextRefillAt(state: ActorTokens | null, now: number) {
  const { available, base } = refillTokens(state, now)
  return available >= ACTOR_MAX_TOKENS ? null : base + ACTOR_REFILL_MS
}

// ---- UTC days ------------------------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000
export function utcDay(now: number) {
  return new Date(now).toISOString().slice(0, 10)
}
export function nextUtcDayStart(now: number) {
  return (Math.floor(now / DAY_MS) + 1) * DAY_MS
}

// The island-wide counters, as stored. A row from an earlier day reads as a
// fresh day without being written.
export type ControlCounters = {
  day: string
  used: number
  newActors: number
  adminRows: number
  cleaned: number
  actorRows: number
}

export function countersFor(control: ControlCounters, now: number): ControlCounters {
  const day = utcDay(now)
  if (control.day === day) return control
  return { ...control, day, used: 0, newActors: 0, adminRows: 0, cleaned: 0 }
}

export type GlobalQuota = { dayUtc: string; used: number; limit: number; resetsAt: number }

export function globalQuota(control: ControlCounters, limit: number, now: number): GlobalQuota {
  const today = countersFor(control, now)
  return { dayUtc: today.day, used: today.used, limit, resetsAt: nextUtcDayStart(now) }
}

export type AdmissionCode = 'NEW_ACTOR_LIMIT' | 'STORAGE_CAPACITY'
export type ActorAdmission =
  | { allowed: true }
  | { allowed: false; code: AdmissionCode; retryAt: number }

export type AdmissionLimits = { newActorsPerDay: number; maxActorRows: number; adminBudget: number }
export const defaultAdmissionLimits: AdmissionLimits = {
  newActorsPerDay: NEW_ACTORS_PER_DAY,
  maxActorRows: MAX_ACTOR_ROWS,
  adminBudget: ADMIN_ROW_BUDGET_PER_DAY
}

// Whether an id may write its first row. Ids that already have a row are never
// held back by the new-id or row-count limits.
export function evaluateAdmission(
  hasRow: boolean,
  control: ControlCounters,
  now: number,
  limits: AdmissionLimits = defaultAdmissionLimits
): ActorAdmission {
  if (hasRow) return { allowed: true }
  const today = countersFor(control, now)
  const blocks: Array<{ code: AdmissionCode; retryAt: number }> = []
  if (today.newActors >= limits.newActorsPerDay)
    blocks.push({ code: 'NEW_ACTOR_LIMIT', retryAt: nextUtcDayStart(now) })
  if (today.adminRows >= limits.adminBudget)
    blocks.push({ code: 'STORAGE_CAPACITY', retryAt: nextUtcDayStart(now) })
  if (today.actorRows >= limits.maxActorRows)
    blocks.push({ code: 'STORAGE_CAPACITY', retryAt: now + CAPACITY_RETRY_MS })
  if (!blocks.length) return { allowed: true }
  const latest = blocks.reduce((a, b) => (b.retryAt > a.retryAt ? b : a))
  return { allowed: false, code: latest.code, retryAt: latest.retryAt }
}

// ---- Per-connection message bucket ---------------------------------------------
export type MessageBucket = { tokens: number; at: number }

export function initialBucket(now: number): MessageBucket {
  return { tokens: MESSAGE_BURST, at: now }
}
export function refillBucket(bucket: MessageBucket, now: number): MessageBucket {
  const elapsed = Math.max(0, now - bucket.at)
  return {
    tokens: Math.min(MESSAGE_BURST, bucket.tokens + (elapsed / 1000) * MESSAGE_REFILL_PER_SECOND),
    at: Math.max(now, bucket.at)
  }
}
// Spends one message, or returns null when the sender is over the limit.
export function takeFromBucket(bucket: MessageBucket, now: number): MessageBucket | null {
  const refilled = refillBucket(bucket, now)
  if (refilled.tokens < 1) return null
  return { tokens: refilled.tokens - 1, at: refilled.at }
}
// When the next message may be sent.
export function bucketReadyAt(bucket: MessageBucket, now: number) {
  const refilled = refillBucket(bucket, now)
  if (refilled.tokens >= 1) return now
  return now + Math.ceil(((1 - refilled.tokens) / MESSAGE_REFILL_PER_SECOND) * 1000)
}

// ---- Reconnect delays ----------------------------------------------------------
export function penaltyDelay(random: number) {
  return PENALTY_RETRY_MS + Math.floor(random * PENALTY_JITTER_MS)
}
export function reconnectDelay(attempt: number, random: number) {
  const step = RECONNECT_STEPS_MS[Math.min(attempt, RECONNECT_STEPS_MS.length - 1)]
  return Math.min(RECONNECT_MAX_MS, step) + Math.floor(random * RECONNECT_JITTER_MS)
}
