import { describe, expect, it } from 'vitest'
import { brushIndices, collectStrokeTargets, planCommand } from '../src/lib/island-edit'
import {
  ACTOR_MAX_TOKENS,
  ACTOR_REFILL_MS,
  ADMIN_ROW_BUDGET_PER_DAY,
  bucketReadyAt,
  CAPACITY_RETRY_MS,
  type ControlCounters,
  countersFor,
  DAILY_TILE_LIMIT,
  evaluateAdmission,
  globalQuota,
  initialBucket,
  isProtectedTile,
  MAX_ACTOR_ROWS,
  MESSAGE_BURST,
  NEW_ACTORS_PER_DAY,
  nextRefillAt,
  nextUtcDayStart,
  normalizeProtectedArea,
  penaltyDelay,
  RECONNECT_MAX_MS,
  ROW_BUDGET_PER_DAY,
  ROWS_PER_COMMIT,
  reconnectDelay,
  refillTokens,
  spendTokens,
  takeFromBucket
} from '../src/lib/island-policy'
import { isNewerActor, isNewerGlobal, parseClientMessage } from '../src/lib/island-protocol'
import {
  createDefaultIsland,
  createIsland,
  decodeIsland,
  decorCode,
  encodeIsland,
  GRASS,
  ISLAND_CENTER,
  isWalkable,
  SAND,
  WATER
} from '../src/lib/island-world'

const T0 = Date.UTC(2026, 10, 12, 3, 0, 0)

describe('personal quota', () => {
  it('starts full and refills one tile per full minute', () => {
    expect(refillTokens(null, T0).available).toBe(30)
    const spent = spendTokens(null, 30, T0)
    expect(spent).toEqual({ tokens: 0, refillBaseMs: T0 })
    expect(refillTokens(spent, T0 + 59_999).available).toBe(0)
    expect(refillTokens(spent, T0 + 60_000).available).toBe(1)
    expect(nextRefillAt(spent, T0)).toBe(T0 + ACTOR_REFILL_MS)
  })

  it('does not bank waiting time while full', () => {
    // Full for an hour, then one tile is spent: the next refill is a minute away.
    const full = { tokens: 30, refillBaseMs: T0 - 3_600_000 }
    const after = spendTokens(full, 1, T0)
    expect(after).toEqual({ tokens: 29, refillBaseMs: T0 })
    expect(refillTokens(after, T0 + 59_999).available).toBe(29)
    expect(refillTokens(after, T0 + 60_000).available).toBe(30)
  })

  it('keeps the remainder of a minute and never exceeds 30', () => {
    const state = { tokens: 10, refillBaseMs: T0 }
    const later = spendTokens(state, 1, T0 + 90_000)
    // One refill happened at +60 s; the next is due at +120 s, not +150 s.
    expect(later).toEqual({ tokens: 10, refillBaseMs: T0 + 60_000 })
    expect(nextRefillAt(later, T0 + 90_000)).toBe(T0 + 120_000)
    expect(refillTokens(state, T0 + 10 * 86_400_000).available).toBe(ACTOR_MAX_TOKENS)
  })

  it('refuses a batch bigger than what is left without changing anything', () => {
    const state = { tokens: 2, refillBaseMs: T0 }
    expect(spendTokens(state, 3, T0)).toBeNull()
    expect(spendTokens(state, 2, T0)).toEqual({ tokens: 0, refillBaseMs: T0 })
  })
})

describe('island-wide limit', () => {
  it('is derived from half the free SQLite write allowance', () => {
    expect(DAILY_TILE_LIMIT * ROWS_PER_COMMIT).toBeLessThanOrEqual(
      ROW_BUDGET_PER_DAY - ADMIN_ROW_BUDGET_PER_DAY
    )
    expect(DAILY_TILE_LIMIT).toBeLessThanOrEqual(Math.floor(ROW_BUDGET_PER_DAY / ROWS_PER_COMMIT))
  })

  it('resets only the day counters at UTC midnight', () => {
    const control: ControlCounters = {
      day: '2026-11-12',
      used: 16_000,
      newActors: 4,
      adminRows: 9,
      cleaned: 3,
      actorRows: 120
    }
    const midnight = nextUtcDayStart(T0)
    expect(globalQuota(control, 16_000, midnight - 1).used).toBe(16_000)
    const next = countersFor(control, midnight)
    expect(next).toEqual({
      ...control,
      day: '2026-11-13',
      used: 0,
      newActors: 0,
      adminRows: 0,
      cleaned: 0
    })
    expect(globalQuota(control, 16_000, midnight)).toEqual({
      dayUtc: '2026-11-13',
      used: 0,
      limit: 16_000,
      resetsAt: midnight + 86_400_000
    })
  })
})

describe('admission of new visitor ids', () => {
  const base: ControlCounters = {
    day: '2026-11-12',
    used: 0,
    newActors: 0,
    adminRows: 0,
    cleaned: 0,
    actorRows: 0
  }
  const tomorrow = nextUtcDayStart(T0)

  it('lets existing ids through regardless of the new-id limits', () => {
    const crowded = { ...base, newActors: NEW_ACTORS_PER_DAY, actorRows: MAX_ACTOR_ROWS }
    expect(evaluateAdmission(true, crowded, T0)).toEqual({ allowed: true })
  })

  it('reports the right reason and when to check again', () => {
    expect(evaluateAdmission(false, { ...base, newActors: NEW_ACTORS_PER_DAY }, T0)).toEqual({
      allowed: false,
      code: 'NEW_ACTOR_LIMIT',
      retryAt: tomorrow
    })
    expect(evaluateAdmission(false, { ...base, adminRows: ADMIN_ROW_BUDGET_PER_DAY }, T0)).toEqual({
      allowed: false,
      code: 'STORAGE_CAPACITY',
      retryAt: tomorrow
    })
    expect(evaluateAdmission(false, { ...base, actorRows: MAX_ACTOR_ROWS }, T0)).toEqual({
      allowed: false,
      code: 'STORAGE_CAPACITY',
      retryAt: T0 + CAPACITY_RETRY_MS
    })
  })

  it('uses the latest time when several limits apply', () => {
    const both = { ...base, newActors: NEW_ACTORS_PER_DAY, actorRows: MAX_ACTOR_ROWS }
    expect(evaluateAdmission(false, both, T0)).toEqual({
      allowed: false,
      code: 'NEW_ACTOR_LIMIT',
      retryAt: tomorrow
    })
    // After midnight the new-id count is fresh but the row limit still holds.
    expect(evaluateAdmission(false, both, tomorrow)).toEqual({
      allowed: false,
      code: 'STORAGE_CAPACITY',
      retryAt: tomorrow + CAPACITY_RETRY_MS
    })
  })
})

describe('shared edit rules', () => {
  it('protects a walkable 3×3 shelter at the centre', () => {
    const world = normalizeProtectedArea(createIsland(), GRASS)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        expect(isProtectedTile(ISLAND_CENTER.x + dx, ISLAND_CENTER.y + dy)).toBe(true)
        expect(isWalkable(world, ISLAND_CENTER.x + dx, ISLAND_CENTER.y + dy)).toBe(true)
      }
    expect(isProtectedTile(ISLAND_CENTER.x + 2, ISLAND_CENTER.y)).toBe(false)
    const center = ISLAND_CENTER.y * world.columns + ISLAND_CENTER.x
    expect(planCommand(world, center, { tool: 'erase' }).code).toBe('PROTECTED_TILE')
    expect(planCommand(world, center, { tool: 'decor', decor: 'tree' }).code).toBe('PROTECTED_TILE')
    expect(planCommand(world, center, { tool: 'decor', decor: 'flowers' }).edit).not.toBeNull()
    expect(planCommand(world, center, { tool: 'land', ground: SAND }).edit).not.toBeNull()
  })

  it('names why a tile was skipped', () => {
    const world = createIsland()
    const index = 10 * world.columns + 10
    expect(planCommand(world, index, { tool: 'erase' }).code).toBe('NO_CHANGE')
    expect(planCommand(world, index, { tool: 'decor', decor: 'tree' }).code).toBe('INVALID_GROUND')
    world.ground[index] = GRASS
    world.decor[index] = decorCode('rock')
    expect(planCommand(world, index, { tool: 'decor', decor: 'tree' }).code).toBe('DECOR_CONFLICT')
    expect(planCommand(world, index, { tool: 'decor', decor: 'rock' }).code).toBe('NO_CHANGE')
  })

  it('restyles a decoration of the same kind when a look is picked', () => {
    const world = createIsland()
    const index = 10 * world.columns + 10
    world.ground[index] = GRASS
    world.decor[index] = decorCode('palm', 1)
    expect(planCommand(world, index, { tool: 'decor', decor: 'palm', look: 1 }).code).toBe(
      'NO_CHANGE'
    )
    expect(planCommand(world, index, { tool: 'decor', decor: 'palm', look: 3 }).edit).toEqual({
      index,
      ground: GRASS,
      decor: decorCode('palm', 3)
    })
    expect(planCommand(world, index, { tool: 'decor', decor: 'tree', look: 0 }).code).toBe(
      'DECOR_CONFLICT'
    )
    world.decor[index] = 0
    expect(planCommand(world, index, { tool: 'decor', decor: 'palm', look: 2 }).edit?.decor).toBe(
      decorCode('palm', 2)
    )
  })

  it('counts only tiles that really change under the big brush', () => {
    const world = createIsland()
    world.ground[10 * world.columns + 10] = GRASS
    const targets: number[] = []
    const options = { tool: 'land', ground: GRASS, decor: 'tree', brush: 3 } as const
    collectStrokeTargets(
      world,
      { tool: 'land', ground: GRASS },
      targets,
      brushIndices(world, 10, 10, options),
      30
    )
    expect(targets).toHaveLength(8)
    // Repeats and the cap are enforced.
    collectStrokeTargets(
      world,
      { tool: 'land', ground: GRASS },
      targets,
      brushIndices(world, 11, 10, options),
      10
    )
    expect(targets).toHaveLength(10)
    expect(new Set(targets).size).toBe(10)
    // Brush tiles outside the editable area are never sent.
    expect(brushIndices(world, 2, 2, options)).toHaveLength(4)
  })

  it('creates the shared island with a clean shelter and decodes only exact saves', () => {
    const world = normalizeProtectedArea(createDefaultIsland(), GRASS)
    const save = encodeIsland(world)
    expect(decodeIsland(save)?.ground).toEqual(world.ground)
    expect(decodeIsland({ ...save, version: 2 })).toBeNull()
    expect(decodeIsland({ ...save, ground: '0*5' })).toBeNull()
    // A broken outer ring or misplaced decoration is reported, not repaired.
    const ring = createIsland()
    ring.ground[0] = GRASS
    expect(decodeIsland(encodeIsland(ring))).toBeNull()
    const floating = createIsland()
    floating.decor[10 * floating.columns + 10] = decorCode('tree')
    expect(decodeIsland(encodeIsland(floating))).toBeNull()
    expect(floating.ground[10 * floating.columns + 10]).toBe(WATER)
  })
})

describe('edit request validation', () => {
  const valid = {
    v: 1,
    type: 'edit',
    requestId: 'a1',
    expectedActorRevision: 0,
    baseRevision: 0,
    command: { tool: 'land', ground: GRASS },
    indices: [810, 811]
  }
  const parse = (value: unknown) => parseClientMessage(JSON.stringify(value))

  it('accepts a well-formed edit and sync', () => {
    expect(parse(valid)?.type).toBe('edit')
    expect(parse({ v: 1, type: 'sync' })).toEqual({ v: 1, type: 'sync' })
  })

  it.each([
    ['duplicate indices', { indices: [810, 810] }],
    ['negative index', { indices: [-1] }],
    ['fractional index', { indices: [1.5] }],
    ['non-number index', { indices: ['810'] }],
    ['index past the island', { indices: [4800] }],
    ['31 indices', { indices: Array.from({ length: 31 }, (_, i) => 900 + i) }],
    ['no indices', { indices: [] }],
    ['unknown tool', { command: { tool: 'paint' } }],
    ['sea as land', { command: { tool: 'land', ground: WATER } }],
    ['unknown decoration', { command: { tool: 'decor', decor: 'castle' } }],
    ['look the kind lacks', { command: { tool: 'decor', decor: 'torch', look: 4 } }],
    ['negative look', { command: { tool: 'decor', decor: 'palm', look: -1 } }],
    ['fractional look', { command: { tool: 'decor', decor: 'palm', look: 0.5 } }],
    ['extra command key', { command: { tool: 'erase', ground: GRASS } }],
    ['unknown key', { actor: 'someone' }],
    ['wrong version', { v: 2 }],
    ['negative revision', { baseRevision: -1 }],
    ['long request id', { requestId: 'x'.repeat(65) }]
  ])('rejects %s', (_name, change) => {
    expect(parse({ ...valid, ...change })).toBeNull()
  })

  it('accepts a decoration with or without a picked look', () => {
    expect(parse({ ...valid, command: { tool: 'decor', decor: 'palm', look: 4 } })).not.toBeNull()
    expect(parse({ ...valid, command: { tool: 'decor', decor: 'palm' } })).not.toBeNull()
  })

  it('rejects NaN-like and non-JSON input', () => {
    expect(parseClientMessage('{"v":1,"type":"edit","indices":[NaN]}')).toBeNull()
    expect(parseClientMessage('nope')).toBeNull()
    expect(
      parseClientMessage(
        JSON.stringify(valid).replace('"baseRevision":0', '"baseRevision":9007199254740993')
      )
    ).toBeNull()
  })
})

describe('ordering of late replies', () => {
  it('never moves the counters back', () => {
    expect(
      isNewerActor({ actorRevision: 3, serverNow: 10 }, { actorRevision: 2, serverNow: 20 })
    ).toBe(false)
    expect(
      isNewerActor({ actorRevision: 3, serverNow: 10 }, { actorRevision: 3, serverNow: 5 })
    ).toBe(false)
    expect(
      isNewerActor({ actorRevision: 3, serverNow: 10 }, { actorRevision: 3, serverNow: 11 })
    ).toBe(true)
    const day = { dayUtc: '2026-11-12', used: 10, limit: 16_000, resetsAt: 0 }
    expect(isNewerGlobal(day, { ...day, used: 9 })).toBe(false)
    expect(isNewerGlobal(day, { ...day, dayUtc: '2026-11-13', used: 0 })).toBe(true)
  })
})

describe('connection pacing', () => {
  it('allows a burst of four, then two messages a second', () => {
    let bucket = initialBucket(T0)
    for (let i = 0; i < MESSAGE_BURST; i++) {
      const next = takeFromBucket(bucket, T0)
      expect(next).not.toBeNull()
      bucket = next ?? bucket
    }
    expect(takeFromBucket(bucket, T0)).toBeNull()
    expect(bucketReadyAt(bucket, T0)).toBe(T0 + 500)
    expect(takeFromBucket(bucket, T0 + 500)).not.toBeNull()
  })

  it('waits at least a minute after a penalty and caps ordinary backoff', () => {
    expect(penaltyDelay(0)).toBeGreaterThanOrEqual(60_000)
    expect(reconnectDelay(0, 0)).toBe(1_000)
    expect(reconnectDelay(3, 0)).toBe(8_000)
    expect(reconnectDelay(50, 0.999)).toBeLessThan(RECONNECT_MAX_MS + 1_000)
  })
})
