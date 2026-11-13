// Messages between the browser and the island's Durable Object. Protocol
// version 1; unrelated to the island save version.

import type { IslandCommand, SkipCode, TileEdit } from './island-edit'
import type { ActorAdmission, GlobalQuota } from './island-policy'
import { MAX_EDIT_TILES, MAX_MESSAGE_BYTES } from './island-policy'
import {
  decorKinds,
  decorLooks,
  GROUND_COUNT,
  ISLAND_COLUMNS,
  ISLAND_ROWS,
  type IslandSave,
  isDecorCode,
  landGrounds
} from './island-world'

export const PROTOCOL_VERSION = 1

export type ActorQuota = {
  actorRevision: number
  available: number
  nextRefillAt: number | null
  expiresAt: number
  admission: ActorAdmission
}
export type { ActorAdmission, GlobalQuota }

export type EditRequest = {
  v: 1
  type: 'edit'
  requestId: string
  expectedActorRevision: number
  baseRevision: number
  command: IslandCommand
  indices: number[]
}
export type SyncRequest = { v: 1; type: 'sync' }
export type ClientMessage = EditRequest | SyncRequest

export type RejectCode =
  | 'ACTOR_STALE'
  | 'REVISION_AHEAD'
  | 'INSUFFICIENT_TOKENS'
  | 'INSUFFICIENT_GLOBAL_QUOTA'
  | 'DAILY_LIMIT'
  | 'NEW_ACTOR_LIMIT'
  | 'STORAGE_CAPACITY'
export type ErrorCode =
  | 'INVALID_MESSAGE'
  | 'MESSAGE_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED'
  | 'STORAGE_UNAVAILABLE'
  | 'CONNECTION_LIMIT'

export type IslandView = {
  v: 1
  serverNow: number
  revision: number
  island: IslandSave
  global: GlobalQuota
}
export type SnapshotMessage = IslandView & { type: 'snapshot'; actor: ActorQuota }
export type PatchMessage = {
  v: 1
  type: 'patch'
  revision: number
  edits: TileEdit[]
  global: GlobalQuota
  serverNow: number
}
export type ResultMessage = {
  v: 1
  type: 'result'
  requestId: string
  status: 'applied' | 'noop' | 'rejected'
  code?: RejectCode
  revision: number
  changedCount: number
  skipped: Array<{ index: number; code: SkipCode }>
  actor: ActorQuota
  global: GlobalQuota
  serverNow: number
}
export type QuotaMessage = {
  v: 1
  type: 'quota'
  actor: ActorQuota
  global: GlobalQuota
  serverNow: number
}
export type ErrorMessage = {
  v: 1
  type: 'error'
  code: ErrorCode
  requestId?: string
  retryAt?: number
}
export type ServerMessage =
  | SnapshotMessage
  | PatchMessage
  | ResultMessage
  | QuotaMessage
  | ErrorMessage

export const CLOSE = {
  normal: 1000,
  policy: 1008,
  tooLarge: 1009,
  tryAgainLater: 1013,
  sessionExpired: 4001,
  rateLimited: 4008
} as const

const TILE_COUNT = ISLAND_COLUMNS * ISLAND_ROWS
const requestIdPattern = /^[A-Za-z0-9_-]{1,64}$/

export function utf8Length(text: string) {
  return new TextEncoder().encode(text).byteLength
}
// Checked before any parsing; a long string cannot be short in bytes.
export function isWithinMessageLimit(text: string) {
  return text.length <= MAX_MESSAGE_BYTES && utf8Length(text) <= MAX_MESSAGE_BYTES
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key))

function parseCommand(value: unknown): IslandCommand | null {
  if (!isRecord(value)) return null
  switch (value.tool) {
    case 'land':
      return hasOnlyKeys(value, ['tool', 'ground']) &&
        landGrounds.includes(value.ground as (typeof landGrounds)[number])
        ? { tool: 'land', ground: value.ground as (typeof landGrounds)[number] }
        : null
    case 'decor': {
      if (
        !hasOnlyKeys(value, ['tool', 'decor', 'look']) ||
        typeof value.decor !== 'string' ||
        !(decorKinds as string[]).includes(value.decor)
      )
        return null
      const decor = value.decor as (typeof decorKinds)[number]
      if (value.look === undefined) return { tool: 'decor', decor }
      return isCount(value.look) && value.look < decorLooks[decor]
        ? { tool: 'decor', decor, look: value.look }
        : null
    }
    case 'erase':
    case 'remove':
      return hasOnlyKeys(value, ['tool']) ? { tool: value.tool } : null
    default:
      return null
  }
}

// Strict: unknown keys, wrong types, out-of-range or repeated indices all fail.
// Whether an index is inside the editable area is the island's call.
export function parseClientMessage(text: string): ClientMessage | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(data) || data.v !== PROTOCOL_VERSION) return null
  if (data.type === 'sync') return hasOnlyKeys(data, ['v', 'type']) ? { v: 1, type: 'sync' } : null
  if (data.type !== 'edit') return null
  if (
    !hasOnlyKeys(data, [
      'v',
      'type',
      'requestId',
      'expectedActorRevision',
      'baseRevision',
      'command',
      'indices'
    ])
  )
    return null
  const { requestId, expectedActorRevision, baseRevision, indices } = data
  if (typeof requestId !== 'string' || !requestIdPattern.test(requestId)) return null
  if (!isCount(expectedActorRevision) || !isCount(baseRevision)) return null
  const command = parseCommand(data.command)
  if (!command) return null
  if (!Array.isArray(indices) || indices.length < 1 || indices.length > MAX_EDIT_TILES) return null
  const seen = new Set<number>()
  for (const index of indices) {
    if (!isCount(index) || index >= TILE_COUNT || seen.has(index)) return null
    seen.add(index)
  }
  return {
    v: 1,
    type: 'edit',
    requestId,
    expectedActorRevision,
    baseRevision,
    command,
    indices: [...seen]
  }
}

// ---- Reading what the server sent (the browser trusts its origin, but a
// malformed message must not corrupt the drawn island) ------------------------

function isGlobalQuota(value: unknown): value is GlobalQuota {
  return (
    isRecord(value) &&
    typeof value.dayUtc === 'string' &&
    isCount(value.used) &&
    isCount(value.limit) &&
    isCount(value.resetsAt)
  )
}
function isAdmission(value: unknown): value is ActorAdmission {
  if (!isRecord(value)) return false
  if (value.allowed === true) return true
  return (
    value.allowed === false &&
    (value.code === 'NEW_ACTOR_LIMIT' || value.code === 'STORAGE_CAPACITY') &&
    isCount(value.retryAt)
  )
}
function isActorQuota(value: unknown): value is ActorQuota {
  return (
    isRecord(value) &&
    isCount(value.actorRevision) &&
    isCount(value.available) &&
    (value.nextRefillAt === null || isCount(value.nextRefillAt)) &&
    isCount(value.expiresAt) &&
    isAdmission(value.admission)
  )
}
function isTileEdit(value: unknown): value is TileEdit {
  return (
    isRecord(value) &&
    isCount(value.index) &&
    value.index < TILE_COUNT &&
    isCount(value.ground) &&
    value.ground < GROUND_COUNT &&
    isCount(value.decor) &&
    isDecorCode(value.decor)
  )
}

export function parseIslandView(data: unknown): IslandView | null {
  if (
    !isRecord(data) ||
    data.v !== PROTOCOL_VERSION ||
    !isCount(data.serverNow) ||
    !isCount(data.revision) ||
    !isRecord(data.island) ||
    !isGlobalQuota(data.global)
  )
    return null
  return data as unknown as IslandView
}

export function parseServerMessage(text: unknown): ServerMessage | null {
  if (typeof text !== 'string') return null
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(data) || data.v !== PROTOCOL_VERSION) return null
  switch (data.type) {
    case 'snapshot':
      return parseIslandView(data) && isActorQuota(data.actor) ? (data as SnapshotMessage) : null
    case 'patch':
      return isCount(data.revision) &&
        Array.isArray(data.edits) &&
        data.edits.every(isTileEdit) &&
        isGlobalQuota(data.global) &&
        isCount(data.serverNow)
        ? (data as PatchMessage)
        : null
    case 'result':
      return typeof data.requestId === 'string' &&
        (data.status === 'applied' || data.status === 'noop' || data.status === 'rejected') &&
        isCount(data.revision) &&
        isActorQuota(data.actor) &&
        isGlobalQuota(data.global) &&
        isCount(data.serverNow) &&
        Array.isArray(data.skipped)
        ? (data as ResultMessage)
        : null
    case 'quota':
      return isActorQuota(data.actor) && isGlobalQuota(data.global) && isCount(data.serverNow)
        ? (data as QuotaMessage)
        : null
    case 'error':
      return typeof data.code === 'string' ? (data as ErrorMessage) : null
    default:
      return null
  }
}

// Later answers win; a late reply never moves the counters back in time.
export function isNewerActor(
  current: { actorRevision: number; serverNow: number } | null,
  next: { actorRevision: number; serverNow: number }
) {
  if (!current) return true
  if (next.actorRevision !== current.actorRevision)
    return next.actorRevision > current.actorRevision
  return next.serverNow >= current.serverNow
}
export function isNewerGlobal(current: GlobalQuota | null, next: GlobalQuota) {
  if (!current) return true
  if (next.dayUtc !== current.dayUtc) return next.dayUtc > current.dayUtc
  return next.used >= current.used
}
