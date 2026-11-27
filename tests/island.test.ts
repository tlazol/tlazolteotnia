import { describe, expect, it, vi } from 'vitest'
import {
  createBuffer,
  createShoreField,
  POOL_MASK,
  paintTerrain,
  SHORE_CELL,
  SHORE_RANGE,
  terrainClass,
  updateShoreField
} from '../src/lib/island-art'
import {
  clampView,
  gridStep,
  projectGround,
  stepZoom,
  tileAt,
  WORLD_WIDTH,
  zoomViewAt
} from '../src/lib/island-camera'
import {
  applyEdits,
  cloneIsland,
  type EditOptions,
  overlayPreview,
  planBrush,
  planStroke,
  tilesAlong
} from '../src/lib/island-edit'
import { tileHeight } from '../src/lib/island-relief'
import {
  canResidentEnter,
  createResidentGreetings,
  createResidents,
  designResidents,
  dropResident,
  facings,
  footOf,
  paintResidentSheet,
  RESIDENT_FRAME,
  residentFootHeight,
  residentIsSwimming,
  residentOccupies,
  residentPose,
  settleResidents,
  stepManualResident,
  stepResidents,
  takeOverResident
} from '../src/lib/island-residents'
import { decorVariants } from '../src/lib/island-sprites'
import {
  BLACKSAND,
  BRICK,
  CLAY,
  CLOVER,
  COBBLE,
  createDefaultIsland,
  createIsland,
  DECK,
  DRYGRASS,
  decodeIsland,
  decorAt,
  decorBlocksWalking,
  decorCode,
  decorFits,
  decorGroups,
  decorKindOf,
  decorKinds,
  decorLookAt,
  decorLookOf,
  decorLooks,
  encodeIsland,
  GRASS,
  GRAVEL,
  GROUND_COUNT,
  type Ground,
  groundAt,
  HOTSPRING,
  hash2,
  ISLAND_CENTER,
  ISLAND_SAVE_VERSION,
  isWalkable,
  isWetGround,
  LAVA,
  landGrounds,
  layoutResidentHomes,
  MAX_ELEVATION_LEVEL,
  MIN_ELEVATION_LEVEL,
  MOSS,
  PATH,
  ROCK,
  SAND,
  SHALLOWS,
  SOIL,
  STEPPING,
  SWAMP,
  serializeIsland,
  TILE_SIZE,
  WATER,
  WHITESAND
} from '../src/lib/island-world'

const options = (overrides: Partial<EditOptions> = {}): EditOptions => ({
  tool: 'land',
  ground: GRASS,
  decor: 'tree',
  brush: 1,
  ...overrides
})

describe('island world', () => {
  it('builds the same default island every time, with land, paths and decorations', () => {
    const a = createDefaultIsland()
    const b = createDefaultIsland()
    expect(serializeIsland(a)).toBe(serializeIsland(b))
    expect(a.ground.includes(GRASS)).toBe(true)
    expect(a.ground.includes(SAND)).toBe(true)
    expect(a.ground.includes(PATH)).toBe(true)
    expect(a.decor.some((code) => code === decorCode('palm'))).toBe(true)
  })

  it('starts with every ground and every decoration, each on ground that suits it', () => {
    const world = createDefaultIsland()
    for (const ground of landGrounds) expect(world.ground.includes(ground)).toBe(true)
    for (const kind of decorKinds) expect(world.decor.includes(decorCode(kind))).toBe(true)
    world.decor.forEach((code, index) => {
      const kind = decorKindOf(code)
      if (kind) expect(decorFits(kind, world.ground[index] as Ground)).toBe(true)
    })
    expect(isWalkable(world, ISLAND_CENTER.x, ISLAND_CENTER.y)).toBe(true)
    world.decor.forEach((code, index) => {
      if (code === decorCode('searock')) expect(world.ground[index]).toBe(WATER)
    })
  })

  it('reserves retired seaweed codes without changing existing sea decorations', () => {
    expect(decorKinds).not.toContain('seaweed')
    expect(decorKindOf(22)).toBeNull()
    expect(decorCode('flotsam')).toBe(23)
    expect(decorCode('buoy')).toBe(24)
    expect(createDefaultIsland().decor.includes(22)).toBe(false)
    const world = createIsland()
    world.decor[10 * world.columns + 10] = 22
    world.decor[10 * world.columns + 11] = 23
    world.decor[10 * world.columns + 12] = 24
    const restored = decodeIsland(encodeIsland(world))
    expect(restored?.decor[10 * world.columns + 10]).toBe(0)
    expect(restored?.decor[10 * world.columns + 11]).toBe(23)
    expect(restored?.decor[10 * world.columns + 12]).toBe(24)
    expect(decorBlocksWalking(22)).toBe(false)
  })

  it('retires stone lanterns, clearing them from saves without shifting later kinds', () => {
    expect(decorKinds).not.toContain('lantern')
    expect(decorKindOf(19)).toBeNull()
    expect(decorCode('campfire')).toBe(18)
    expect(decorCode('fireflies')).toBe(20)
    expect(createDefaultIsland().decor.some((code) => (code & 31) === 19)).toBe(false)
    const world = createIsland()
    world.ground[10 * world.columns + 10] = GRASS
    world.ground[10 * world.columns + 11] = GRASS
    world.decor[10 * world.columns + 10] = 19
    // A lantern placed with its mossy look picked.
    world.decor[10 * world.columns + 11] = 19 | (2 << 5)
    const restored = decodeIsland(encodeIsland(world))
    expect(restored?.decor[10 * world.columns + 10]).toBe(0)
    expect(restored?.decor[10 * world.columns + 11]).toBe(0)
  })

  it('stores a picked look with the kind and keeps older codes picking by position', () => {
    for (const kind of decorKinds)
      for (let look = 0; look < decorLooks[kind]; look++) {
        const code = decorCode(kind, look)
        expect(code).toBeLessThan(256)
        expect(decorKindOf(code)).toBe(kind)
        expect(decorLookOf(code)).toBe(look)
        expect(decorLookAt(code, 3, 4)).toBe(look)
      }
    expect(decorLookOf(decorCode('palm'))).toBeNull()
    const auto = decorLookAt(decorCode('palm'), 3, 4)
    expect(auto).toBeGreaterThanOrEqual(0)
    expect(auto).toBeLessThan(decorLooks.palm)

    const world = createIsland()
    world.ground[10 * world.columns + 10] = GRASS
    world.ground[10 * world.columns + 11] = GRASS
    world.decor[10 * world.columns + 10] = decorCode('palm', 4)
    world.decor[10 * world.columns + 11] = decorCode('palm')
    const restored = decodeIsland(encodeIsland(world))
    expect(restored?.decor[10 * world.columns + 10]).toBe(decorCode('palm', 4))
    expect(restored?.decor[10 * world.columns + 11]).toBe(decorCode('palm'))
    // A look the kind does not have is refused.
    world.decor[10 * world.columns + 10] = decorCode('torch', decorLooks.torch)
    expect(decodeIsland(encodeIsland(world))).toBeNull()
  })

  it('keeps sea rocks on the sea and refuses saves with decorations on the wrong ground', () => {
    const world = createIsland()
    world.decor[10 * world.columns + 11] = decorCode('searock')
    expect(decodeIsland(encodeIsland(world))?.decor[10 * world.columns + 11]).toBe(
      decorCode('searock')
    )
    world.ground[10 * world.columns + 10] = SAND
    world.decor[10 * world.columns + 10] = decorCode('searock')
    expect(decodeIsland(encodeIsland(world))).toBeNull()
  })

  it('round-trips saves and rejects broken, foreign or outdated data', () => {
    const world = createDefaultIsland()
    world.ground[10 * world.columns + 10] = GRASS
    const restored = decodeIsland(encodeIsland(world))
    expect(restored && serializeIsland(restored)).toBe(serializeIsland(world))

    const save = encodeIsland(world)
    expect(decodeIsland({ ...save, version: ISLAND_SAVE_VERSION + 1 })).toBeNull()
    expect(decodeIsland({ ...save, columns: 10 })).toBeNull()
    expect(decodeIsland({ ...save, ground: '0*5' })).toBeNull()
    expect(decodeIsland({ ...save, decor: 'z*4800' })).toBeNull()
    expect(decodeIsland('{not json')).toBeNull()
    expect(decodeIsland(null)).toBeNull()
  })

  it('offers every ground once, in groups, and saves the newest grounds and decorations', () => {
    expect([...landGrounds].sort((a, b) => a - b)).toEqual(
      Array.from({ length: GROUND_COUNT - 1 }, (_, i) => i + 1)
    )
    expect(decorGroups.flatMap((group) => group.kinds).sort()).toEqual([...decorKinds].sort())
    const world = createIsland()
    world.ground[10 * world.columns + 10] = HOTSPRING
    world.decor[10 * world.columns + 10] = decorCode('fireflies')
    world.decor[10 * world.columns + 11] = decorCode('buoy')
    const restored = decodeIsland(encodeIsland(world))
    if (!restored) throw new Error('save rejected')
    expect(groundAt(restored, 10, 10)).toBe(HOTSPRING)
    expect(decorAt(restored, 10, 10)).toBe(decorCode('fireflies'))
    expect(decorAt(restored, 11, 10)).toBe(decorCode('buoy'))
  })

  it('refuses a save that paints land on the outer ring of sea', () => {
    const world = createIsland()
    world.ground[5 * world.columns + 5] = GRASS
    expect(decodeIsland(encodeIsland(world))?.ground[5 * world.columns + 5]).toBe(GRASS)
    world.ground[0] = GRASS
    expect(decodeIsland(encodeIsland(world))).toBeNull()
  })

  it('gives every resident a separate walkable home, the newest at the plaza', () => {
    const world = createDefaultIsland()
    const homes = layoutResidentHomes(50)
    expect(homes[0]).toEqual({ x: 40, y: 30 })
    expect(new Set(homes.map(({ x, y }) => `${x},${y}`)).size).toBe(50)
    for (const home of homes) {
      expect(isWalkable(world, home.x, home.y)).toBe(true)
      expect(isWetGround(groundAt(world, home.x, home.y))).toBe(false)
    }
  })
})

describe('island editing', () => {
  it('adds land and refuses to sink the shelter at the centre', () => {
    const world = createIsland()
    expect(planBrush(world, 10, 10, options()).edits).toHaveLength(1)
    world.ground[10 * world.columns + 10] = GRASS
    const again = planBrush(world, 10, 10, options())
    expect(again.edits).toHaveLength(0)
    expect(again.soft).toBe(true)
    world.ground[ISLAND_CENTER.y * world.columns + ISLAND_CENTER.x] = GRASS
    const blocked = planBrush(world, ISLAND_CENTER.x, ISLAND_CENTER.y, options({ tool: 'erase' }))
    expect(blocked.edits).toHaveLength(0)
    expect(blocked.reason).toBe('島の中心は削れません')
    expect(blocked.soft).toBe(false)
    expect(planBrush(world, 0, 0, options()).reason).toBe('編集できる範囲の外です')
  })

  it('explains why decorations cannot be placed', () => {
    const world = createIsland()
    expect(planBrush(world, 10, 10, options({ tool: 'decor' })).reason).toBe('海の上には置けません')
    world.ground[10 * world.columns + 10] = SAND
    world.decor[10 * world.columns + 10] = decorCode('rock')
    expect(planBrush(world, 10, 10, options({ tool: 'decor' })).reason).toMatch(/岩があります/)
    expect(planBrush(world, 10, 10, options({ tool: 'remove' })).edits).toHaveLength(1)
    const center = ISLAND_CENTER.y * world.columns + ISLAND_CENTER.x
    world.ground[center] = GRASS
    expect(
      planBrush(world, ISLAND_CENTER.x, ISLAND_CENTER.y, options({ tool: 'decor' })).reason
    ).toBe('島の中心には置けません')
    expect(
      planBrush(
        world,
        ISLAND_CENTER.x,
        ISLAND_CENTER.y,
        options({ tool: 'decor', decor: 'flowers' })
      ).edits
    ).toHaveLength(1)
  })

  it('floats sea decorations only on water and builds piers over it', () => {
    const world = createIsland()
    expect(planBrush(world, 10, 10, options({ tool: 'decor', decor: 'searock' })).edits).toEqual([
      { index: 10 * world.columns + 10, ground: WATER, decor: decorCode('searock', 0) }
    ])
    expect(planBrush(world, 10, 10, options({ ground: DECK })).edits[0].ground).toBe(DECK)
    world.ground[10 * world.columns + 10] = DECK
    expect(planBrush(world, 10, 10, options({ tool: 'decor', decor: 'searock' })).reason).toBe(
      '岩礁は海に浮かべてください'
    )
    expect(planBrush(world, 10, 10, options({ tool: 'decor', decor: 'torch' })).edits).toHaveLength(
      1
    )
    expect(decorBlocksWalking(22)).toBe(false)
  })

  it('uses the big brush for land but places decorations one at a time', () => {
    const world = createIsland()
    expect(planBrush(world, 10, 10, options({ brush: 3 })).edits).toHaveLength(9)
    world.ground.fill(GRASS)
    expect(planBrush(world, 10, 10, options({ tool: 'decor', brush: 3 })).edits).toHaveLength(1)
  })

  it('connects drag samples through edge-adjacent tiles', () => {
    const path = tilesAlong({ x: 0, y: 0 }, { x: 3, y: 2 })
    expect(path[0]).toEqual({ x: 0, y: 0 })
    expect(path.at(-1)).toEqual({ x: 3, y: 2 })
    for (let i = 1; i < path.length; i++)
      expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)).toBe(1)
  })

  it('overwrites land while preserving decorations and clearing sea decorations', () => {
    const world = createIsland()
    const index = 10 * world.columns + 10
    world.ground[index] = GRASS
    world.decor[index] = decorCode('tree')
    expect(planBrush(world, 10, 10, options({ ground: SAND })).edits).toEqual([
      { index, ground: SAND, decor: decorCode('tree') }
    ])
    world.ground[index] = WATER
    world.decor[index] = decorCode('searock')
    expect(planBrush(world, 10, 10, options()).edits).toEqual([{ index, ground: GRASS, decor: 0 }])
  })

  it('round-trips a height-only edit through preview, save and reversal', () => {
    const world = createIsland()
    const index = 10 * world.columns + 10
    world.ground[index] = BRICK
    world.decor[index] = decorCode('flowers')
    const { elevation: _, ...legacy } = encodeIsland(world)
    const original = decodeIsland(legacy)
    if (!original) throw new Error('legacy save rejected')
    const start = tileHeight(original, 10, 10)
    const preview = planStroke(original, { tool: 'raise' }, [index])
    const drawn = cloneIsland(original)
    expect(overlayPreview(drawn, original, [], preview)).toEqual([index])
    expect(tileHeight(drawn, 10, 10)).toBe(start + 4)
    expect(tileHeight(original, 10, 10)).toBe(start)
    expect(overlayPreview(drawn, original, [index], [])).toEqual([index])
    expect(tileHeight(drawn, 10, 10)).toBe(start)
    applyEdits(original, preview)
    const restored = decodeIsland(encodeIsland(original))
    if (!restored) throw new Error('edited save rejected')
    expect(tileHeight(restored, 10, 10)).toBe(start + 4)
    applyEdits(restored, planStroke(restored, { tool: 'lower' }, [index]))
    expect(restored).toEqual(world)
  })

  it('stops at both height limits and clears the level when the land becomes water', () => {
    const world = createIsland()
    const index = 10 * world.columns + 10
    world.ground[index] = SAND
    for (let level = 0; level >= MIN_ELEVATION_LEVEL; level--) {
      applyEdits(world, planStroke(world, { tool: 'lower' }, [index]))
      expect(tileHeight(world, 10, 10)).toBe(level * 4)
    }
    const restored = decodeIsland(encodeIsland(world))
    if (!restored) throw new Error('pit save rejected')
    expect(tileHeight(restored, 10, 10)).toBe(MIN_ELEVATION_LEVEL * 4)
    for (let level = MIN_ELEVATION_LEVEL + 1; level <= 1; level++) {
      applyEdits(restored, planStroke(restored, { tool: 'raise' }, [index]))
      expect(tileHeight(restored, 10, 10)).toBe(level * 4)
    }
    expect(restored.elevation[index]).toBe(0)
    expect(planStroke(world, { tool: 'lower' }, [index])).toEqual([])
    world.elevation[index] = MAX_ELEVATION_LEVEL
    expect(planStroke(world, { tool: 'raise' }, [index])).toEqual([])
    for (const tool of [{ tool: 'erase' }, { tool: 'land', ground: SHALLOWS }] as const) {
      const copy = cloneIsland(world)
      applyEdits(copy, planStroke(copy, tool, [index]))
      expect(copy.elevation[index]).toBe(0)
      expect(planStroke(copy, { tool: 'raise' }, [index])).toEqual([])
      expect(tileHeight(copy, 10, 10)).toBe(0)
    }
  })

  it('previews over the confirmed island without writing back stale tiles', () => {
    const confirmed = createIsland()
    const drawn = createIsland()
    const command = { tool: 'land', ground: SAND } as const
    const index = 10 * confirmed.columns + 10
    const preview = planStroke(confirmed, command, [index, index + 1])
    expect(overlayPreview(drawn, confirmed, [], preview)).toEqual([index, index + 1])
    expect(drawn.ground[index]).toBe(SAND)
    // Someone else paints a nearby tile and the same tile before this stroke is sent.
    confirmed.ground[index + 2] = GRASS
    confirmed.ground[index] = SAND
    const replanned = planStroke(confirmed, command, [index, index + 1])
    expect(replanned.map((edit) => edit.index)).toEqual([index + 1])
    overlayPreview(drawn, confirmed, [index + 2, index], replanned)
    // Cancelling drops only the preview: the other visitor's tiles stay.
    overlayPreview(drawn, confirmed, [index, index + 1], [])
    expect(serializeIsland(drawn)).toBe(serializeIsland(confirmed))
  })
})

describe('island rendering helpers', () => {
  it('rounds coastlines from neighboring tiles and paints only nearby pixels', () => {
    const world = createIsland()
    world.ground[10 * world.columns + 10] = GRASS
    // The tile center is land; its corner blends into the sea.
    expect(terrainClass(world, 168, 168)).not.toBe(WATER)
    expect(terrainClass(world, 160, 160)).toBe(WATER)
    const buffer = createBuffer(48, 48)
    paintTerrain(world, buffer, 144, 144, 48, 48)
    expect(buffer.data.some((value, i) => i % 4 === 3 && value > 0)).toBe(true)
  })

  it('shows every ground in the middle of its own patch and marks fresh water by kind', () => {
    for (const ground of landGrounds) {
      const world = createIsland(13, 13)
      for (let y = 9; y <= 11; y++)
        for (let x = 9; x <= 11; x++) world.ground[y * world.columns + x] = ground
      for (let py = 164; py < 172; py++)
        for (let px = 164; px < 172; px++) expect(terrainClass(world, px, py)).toBe(ground)
      const buffer = createBuffer(48, 48)
      paintTerrain(world, buffer, 144, 144, 48, 48)
      expect(buffer.data.some((value, i) => i % 4 === 3 && value > 0)).toBe(true)
      const field = createShoreField(world)
      updateShoreField(world, field)
      const mask = field.lake[(168 / SHORE_CELL) * field.width + 168 / SHORE_CELL]
      expect(mask).toBe(
        ground === SWAMP
          ? 255
          : ground === SHALLOWS
            ? POOL_MASK.shallows
            : ground === HOTSPRING
              ? POOL_MASK.spring
              : 0
      )
    }
  })

  it('keeps deck boards square to their tiles without growing a beach around them', () => {
    const world = createIsland()
    world.ground[10 * world.columns + 10] = DECK
    for (const [px, py] of [
      [160, 160],
      [175, 175],
      [168, 168]
    ])
      expect(terrainClass(world, px, py)).toBe(DECK)
    for (let py = 144; py < 192; py++)
      for (let px = 144; px < 192; px++)
        if (groundAt(world, px >> 4, py >> 4) !== DECK)
          expect(terrainClass(world, px, py)).toBe(WATER)
  })

  it('measures the distance to the shore exactly, treating piers as open water', () => {
    const world = createIsland()
    world.ground[10 * world.columns + 10] = GRASS
    world.ground[20 * world.columns + 30] = DECK
    const field = createShoreField(world)
    updateShoreField(world, field)
    const at = (px: number, py: number) =>
      (field.distance[Math.floor(py / SHORE_CELL) * field.width + Math.floor(px / SHORE_CELL)] /
        255) *
      SHORE_RANGE *
      SHORE_CELL
    expect(at(168, 168)).toBe(0)
    expect(at(168 + 40, 168)).toBeGreaterThan(30)
    expect(at(168 + 40, 168)).toBeLessThan(40)
    expect(at(30 * 16 + 8, 20 * 16 + 8)).toBe(SHORE_RANGE * SHORE_CELL)
    // Removing the land and updating only that corner clears the whole field.
    world.ground[10 * world.columns + 10] = WATER
    updateShoreField(world, field, 70, 70, 100, 100)
    expect(at(168, 168)).toBe(SHORE_RANGE * SHORE_CELL)
  })

  it('paints a sprite for every decoration, with animation frames of one size', () => {
    for (const kind of decorKinds) {
      // Only man-made things come in fewer than four designs.
      const manMade = ['buoy'].includes(kind)
      expect(decorVariants[kind].length).toBeGreaterThan(manMade ? 0 : 3)
      expect(decorVariants[kind].length).toBe(decorLooks[kind])
      for (const frame of decorVariants[kind] as Array<(typeof decorVariants)['torch'][number]>) {
        expect(frame.buffer.data.some((value, i) => i % 4 === 3 && value > 0)).toBe(true)
        for (const extra of frame.frames ?? []) {
          expect(extra.width).toBe(frame.buffer.width)
          expect(extra.height).toBe(frame.buffer.height)
        }
      }
    }
  })

  it('zooms in steps around a fixed point and clamps the view near the map', () => {
    const size = { width: 800, height: 600 }
    expect(stepZoom(2, 1)).toBe(2.5)
    expect(stepZoom(6, 1)).toBe(6)
    const view = { x: 600, y: 400, zoom: 2 }
    const point = { x: 100, y: 120 }
    const before = tileAt(view, size, point)
    expect(tileAt(zoomViewAt(view, size, 4, point), size, point)).toEqual(before)
    expect(clampView({ x: 99999, y: 0, zoom: 2 }, size).x).toBeLessThan(WORLD_WIDTH + 400)
  })
})

describe('island residents', () => {
  const posts = Array.from({ length: 60 }, (_, i) => ({
    slug: `post-${i}`,
    date: `2020-01-${String((i % 28) + 1).padStart(2, '0')}`
  }))

  it('never gives two residents the same silhouette, and keeps older looks stable', () => {
    const designs = designResidents(posts)
    const signatures = [...designs.values()].map((d) => `${d.hair}/${d.accessory}/${d.outfit}`)
    expect(new Set(signatures).size).toBe(posts.length)
    const withNewPost = designResidents([...posts, { slug: 'brand-new', date: '2030-01-01' }])
    for (const post of posts) expect(withNewPost.get(post.slug)).toEqual(designs.get(post.slug))
  })

  it.each([false, true])(
    'draws distinct facing rows in every animation frame (swimming: %s)',
    (swimming) => {
      const { width, height } = RESIDENT_FRAME
      for (const design of designResidents(posts).values()) {
        const sheet = paintResidentSheet(design, swimming)
        expect(sheet.height).toBe(height * 5)
        for (let frame = 0; frame < 3; frame++) {
          const poses = facings.map((_, row) => {
            const pixels = Buffer.alloc(width * height * 4)
            for (let y = 0; y < height; y++) {
              const start = ((row * height + y) * sheet.width + frame * width) * 4
              pixels.set(sheet.data.subarray(start, start + width * 4), y * width * 4)
            }
            expect(pixels.some((value) => value > 0)).toBe(true)
            return pixels.toString('base64')
          })
          expect(new Set(poses).size).toBe(5)
        }
      }
    }
  )

  it('faces the screen direction of travel at every camera turn', () => {
    for (const turn of [0, 1, 2, 3]) {
      const view = { x: 0, y: 0, zoom: 1, turn }
      for (const [dx, dy, facing, flip] of [
        [1, 1, 'down', false],
        [1, 0, 'downSide', false],
        [1, -1, 'side', false],
        [0, -1, 'upSide', false],
        [-1, -1, 'up', false],
        [-1, 0, 'upSide', true],
        [-1, 1, 'side', true],
        [0, 1, 'downSide', true]
      ] as const) {
        const step = gridStep(view, dx, dy)
        expect(residentPose(projectGround(view, step.x, step.y))).toEqual({ facing, flip })
      }
    }
  })

  it('greets on approach and face to face, with independent exchanges across the island', () => {
    const world = createIsland(16, 2)
    world.ground.fill(SAND)
    const residents = createResidents(
      ['walker', 'passerby', 'neighbor', 'friend'],
      [
        { x: 1, y: 0 },
        { x: 3, y: 1 },
        { x: 10, y: 0 },
        { x: 11, y: 0 }
      ],
      () => 0.1
    )
    const [walker, passerby, neighbor, friend] = residents
    neighbor.heading = { x: 1, y: 0 }
    friend.heading = { x: -1, y: 0 }
    const { byResident, step } = createResidentGreetings(world, residents)
    const available = () => true
    step(0, available)
    expect(byResident.size).toBe(2)
    expect(byResident.get(friend.slug)?.speaker).toBe(neighbor)

    // Two walkers on parallel paths approach from opposite directions.
    walker.x += 6
    passerby.x -= 6
    step(0.2, available)
    expect(byResident.size).toBe(4)
    expect(byResident.get(passerby.slug)?.speaker).toBe(walker)
    step(1.2, available)
    expect(byResident.get(walker.slug)?.speaker).toBe(passerby)
    expect(byResident.get(neighbor.slug)?.speaker).toBe(friend)
    step(0.05, (r) => r !== passerby)
    expect(byResident.has(walker.slug)).toBe(false)
    expect(byResident.has(friend.slug)).toBe(true)
    step(2, available)
    expect(byResident.size).toBe(0)

    // Standing together never repeats the greeting. Meeting again does.
    step(10, available)
    expect(byResident.size).toBe(0)
    friend.x += 3 * TILE_SIZE
    step(0.2, available)
    friend.x -= 3 * TILE_SIZE
    step(0.2, available)
    expect(byResident.size).toBe(2)
    expect(byResident.get(friend.slug)?.first).toBe(neighbor)
  })

  it('lets neighbors walk alongside or away from each other without stopping', () => {
    const world = createIsland(8, 2)
    world.ground.fill(SAND)
    const residents = createResidents(
      ['a', 'b'],
      [
        { x: 1, y: 0 },
        { x: 1, y: 1 }
      ],
      () => 0.1
    )
    const { step, byResident } = createResidentGreetings(world, residents)
    const available = () => true
    step(0, available)
    for (const resident of residents) resident.x += 4
    step(0.2, available)
    residents[1].y += 4
    step(0.2, available)
    expect(byResident.size).toBe(0)
  })

  it('walks diagonally at its usual speed and checks both sides of a reserved corner', () => {
    const world = createIsland(7, 7)
    world.ground.fill(GRASS)
    const residents = createResidents(['walker'], [{ x: 0, y: 0 }], () => 0.1)
    const resident = residents[0]
    resident.wait = 0
    const start = footOf(resident.tile)
    stepResidents(world, residents, 0.1, () => false)
    expect(resident.target).toEqual({ x: 1, y: 1 })
    expect(resident.heading).toEqual(resident.target)
    expect(Math.hypot(resident.x - start.x, resident.y - start.y)).toBeCloseTo(resident.speed * 0.1)
    world.decor[1] = decorCode('tree')
    settleResidents(world, residents)
    expect(resident.target).toBeNull()
    resident.route = [{ x: 1, y: 1 }]
    resident.wait = 0
    stepResidents(world, residents, 0.1, () => false)
    expect(resident.target).toBeNull()
    resident.wait = 0
    stepResidents(world, residents, 0.1, () => false)
    expect(resident.target).toEqual({ x: 0, y: 1 })
  })

  it('finishes a reserved step, strafes relative to the camera, and resumes walking from there', () => {
    const world = createIsland(5, 5)
    world.ground.fill(GRASS)
    const residents = createResidents(['walker'], [{ x: 1, y: 1 }])
    const [resident] = residents
    resident.target = { x: 1, y: 2 }
    resident.route = [{ x: 1, y: 3 }]
    takeOverResident(resident)
    expect(resident.route).toEqual([])
    const strafe = { x: 1, y: 0 }
    const facingSouth = Math.PI / 2
    stepManualResident(world, residents, resident, 2, facingSouth, strafe)
    expect(resident.tile).toEqual({ x: 1, y: 2 })
    stepManualResident(world, residents, resident, 0.1, facingSouth, strafe)
    expect(resident.target).toEqual({ x: 0, y: 2 })
    for (let i = 0; i < 3; i++)
      stepManualResident(world, residents, resident, 2, facingSouth, { x: 0, y: 0 })
    expect(resident.tile).toEqual({ x: 0, y: 2 })
    expect(resident.target).toBeNull()
    stepResidents(world, residents, 0.1, () => false)
    expect(resident.target).not.toBeNull()
  })

  it('keeps manual steps inside the island and out of blocked or reserved corners', () => {
    const world = createIsland(3, 3)
    const residents = createResidents(
      ['walker', 'neighbor'],
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 }
      ]
    )
    const [walker, neighbor] = residents
    neighbor.target = { x: 1, y: 0 }
    const forward = { x: 0, y: -1 }
    for (const yaw of [Math.PI, 0, Math.PI / 4]) {
      stepManualResident(world, residents, walker, 0.1, yaw, forward)
      expect(walker.target).toBeNull()
    }
    neighbor.target = null
    world.decor[1] = decorCode('tree')
    stepManualResident(world, residents, walker, 0.1, Math.PI / 4, forward)
    expect(walker.target).toBeNull()
    world.decor[1] = 0
    stepManualResident(world, residents, walker, 0.1, Math.PI / 4, forward)
    expect(walker.target).toEqual({ x: 1, y: 1 })
  })

  it.each([
    [1, 0],
    [0, -1],
    [-1, 1]
  ])('clears a ledge when stepping (%i, %i) and back', (dx, dy) => {
    const world = createIsland(3, 3)
    const low = { x: 1, y: 1 }
    const high = { x: low.x + dx, y: low.y + dy }
    world.ground[high.y * world.columns + high.x] = DECK
    const [walker] = createResidents(['walker'], [low])
    for (const [from, to] of [
      [low, high],
      [high, low]
    ]) {
      walker.tile = from
      walker.target = to
      for (const [progress, height] of [
        [0, 0],
        [0.125, 4],
        [0.25, 8],
        [0.5, 8],
        [0.75, 8],
        [1, 8]
      ]) {
        const t = from === low ? progress : 1 - progress
        walker.x = footOf(from).x + (footOf(to).x - footOf(from).x) * t
        walker.y = footOf(from).y + (footOf(to).y - footOf(from).y) * t
        expect(residentFootHeight(world, walker)).toBe(height)
        expect(residentIsSwimming(world, walker)).toBe(height === 0)
      }
    }
  })

  it('clears a raised side tile at a diagonal corner between two low tiles', () => {
    const world = createIsland(2, 2)
    world.ground.fill(SAND)
    world.ground[1] = DECK
    const [walker] = createResidents(['walker'], [{ x: 0, y: 0 }])
    walker.target = { x: 1, y: 1 }
    expect(residentFootHeight(world, walker)).toBe(4)
    walker.x = walker.y = 16
    expect(residentFootHeight(world, walker)).toBe(8)
    Object.assign(walker, footOf(walker.target))
    expect(residentFootHeight(world, walker)).toBe(4)
  })

  it.each([
    ['sea', WATER],
    ['lake', SWAMP],
    ['shallows', SHALLOWS],
    ['a hot spring', HOTSPRING]
  ] as const)('lets residents swim when their ground becomes %s', (_, ground) => {
    const world = createDefaultIsland()
    const residents = createResidents(['a'], [{ x: 40, y: 30 }])
    world.ground[30 * world.columns + 40] = ground
    expect(settleResidents(world, residents)).toEqual([])
    expect(residentIsSwimming(world, residents[0])).toBe(true)
  })

  it('assigns three walking speeds that stay stable when residents are reordered', () => {
    const slugs = posts.map((post) => post.slug)
    const residents = createResidents(slugs, [{ x: 0, y: 0 }])
    expect([...new Set(residents.map((resident) => resident.speed))].sort((a, b) => a - b)).toEqual(
      [14, 21, 28]
    )
    const reordered = createResidents([...slugs].reverse(), [{ x: 0, y: 0 }])
    for (const resident of residents)
      expect(reordered.find((other) => other.slug === resident.slug)?.speed).toBe(resident.speed)
  })

  it('moves at each walking speed and slows down in water', () => {
    const world = createIsland(20, 1)
    for (const ground of [GRASS, WATER, SWAMP]) {
      world.ground.fill(ground)
      for (const speed of [14, 21, 28]) {
        const residents = createResidents(['walker'], [{ x: 0, y: 0 }])
        const resident = residents[0]
        resident.speed = speed
        resident.target = { x: 1, y: 0 }
        const start = resident.x
        stepResidents(world, residents, 0.1, () => false)
        expect(resident.x - start).toBeCloseTo(speed * (ground === GRASS ? 1 : 0.65) * 0.1)
      }
    }
  })

  it('chooses fresh activities on creation and animates stationary residents in place', () => {
    const world = createIsland(20, 1)
    world.ground.fill(GRASS)
    const activities = ['walk', 'idle', 'dance', 'jump']
    const rolls = [0.1, 0.9, 0.01, 0.03]
    for (const [index, action] of activities.entries()) {
      const residents = createResidents(['performer'], [{ x: 0, y: 0 }], () => rolls[index])
      const resident = residents[0]
      expect(resident.action).toBe(action)
      resident.actionClock = 0
      resident.wait = 0
      const start = { x: resident.x, y: resident.y }
      stepResidents(world, residents, 0.2, () => false)
      if (action === 'walk') {
        expect(resident.x).toBeGreaterThan(start.x)
      } else {
        expect({ x: resident.x, y: resident.y }).toEqual(start)
        expect(resident.target).toBeNull()
        if (action === 'idle') expect(resident.offsetY).toBe(0)
        else expect(resident.offsetY).toBeLessThan(0)
        if (action === 'dance') expect(resident.tilt).not.toBe(0)
      }
      const clock = resident.actionClock
      stepResidents(world, residents, 1, () => true)
      expect(resident.actionClock).toBe(clock)
      expect(resident.offsetY).toBe(0)
      expect(resident.tilt).toBe(0)
    }
  })

  it.for([WATER, SHALLOWS])(
    'occasionally casts into water %i, then resumes the walk',
    (water, { onTestFinished }) => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.2)
      onTestFinished(() => random.mockRestore())
      const world = createIsland(3, 1)
      world.ground.set([water, SAND, GRASS])
      const residents = createResidents(['angler'], [{ x: 1, y: 0 }])
      const [angler] = residents
      angler.route = [{ x: 2, y: 0 }]
      angler.actionRemaining = 0
      stepResidents(world, residents, 0.1, () => false)
      expect(angler.action).toBe('fish')
      expect(angler.heading).toEqual({ x: -1, y: 0 })
      stepResidents(world, residents, 5, () => false)
      expect(angler.x).toBe(footOf(angler.tile).x)
      expect(angler.target).toBeNull()
      expect(angler.action).toBe('fish')
      stepResidents(world, residents, angler.actionRemaining, () => false)
      expect(angler.action).toBe('walk')
      expect(angler.tile.x).toBe(2)
    }
  )

  it('puts the rod away when a fishing spot is edited and keeps it away on dry ground', ({
    onTestFinished
  }) => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.2)
    onTestFinished(() => random.mockRestore())
    const world = createIsland(2, 1)
    world.ground.set([SHALLOWS, WATER])
    const residents = createResidents(['angler'], [{ x: 0, y: 0 }])
    const [angler] = residents
    angler.actionRemaining = 0
    stepResidents(world, residents, 0.1, () => false)
    expect(angler.action).toBe('fish')
    for (const ground of [GRASS, SWAMP, HOTSPRING]) {
      world.ground[1] = ground
      settleResidents(world, residents)
      expect(angler.action).not.toBe('fish')
      angler.action = 'walk'
      angler.actionRemaining = 0
      stepResidents(world, residents, 0.1, () => false)
      expect(angler.action).toBe('idle')
    }
  })

  it('changes activities after a timeout but finishes a reserved step first', () => {
    const world = createIsland(20, 1)
    world.ground.fill(GRASS)
    const residents = createResidents(['performer'], [{ x: 0, y: 0 }], () => 0.1)
    const resident = residents[0]
    resident.target = { x: 1, y: 0 }
    resident.actionRemaining = 0
    stepResidents(world, residents, 0.1, () => false)
    expect(resident.action).toBe('walk')
    expect(resident.target).toEqual({ x: 1, y: 0 })
    for (let i = 0; i < 30 && resident.target; i++)
      stepResidents(world, residents, 0.1, () => false)
    expect(resident.tile).toEqual({ x: 1, y: 0 })
    stepResidents(world, residents, 0.1, () => false)
    expect(resident.action).not.toBe('walk')
    expect(resident.actionRemaining).toBeGreaterThan(0)
    expect(resident.target).toBeNull()
    expect(resident.route).toEqual([])
  })

  it('travels well beyond home, swims across water and returns to land', () => {
    const world = createIsland(24, 1)
    world.ground.fill(GRASS)
    world.ground.fill(WATER, 4, 9)
    const residents = createResidents(['traveller'], [{ x: 0, y: 0 }])
    residents[0].action = 'walk'
    residents[0].actionRemaining = 1000
    let farthest = 0
    let swam = false
    let landed = false
    for (let i = 0; i < 1800; i++) {
      stepResidents(world, residents, 0.1, () => false)
      const resident = residents[0]
      farthest = Math.max(farthest, resident.tile.x)
      if (residentIsSwimming(world, resident)) swam = true
      if (swam && resident.tile.x >= 9 && !residentIsSwimming(world, resident)) landed = true
      expect(canResidentEnter(world, resident.tile.x, resident.tile.y)).toBe(true)
    }
    expect(farthest).toBeGreaterThan(16)
    expect(swam).toBe(true)
    expect(landed).toBe(true)
  })

  it('stays spread over dry land rather than crowding the plaza', () => {
    const world = createDefaultIsland()
    const slugs = Array.from({ length: 40 }, (_, i) => `resident-${i}`)
    const residents = createResidents(slugs, layoutResidentHomes(slugs.length), () => 0.1)
    settleResidents(world, residents)
    for (const resident of residents) {
      resident.action = 'walk'
      resident.actionRemaining = 1000
    }
    const fromCentre = () =>
      residents.reduce(
        (sum, { tile }) => sum + Math.hypot(tile.x - ISLAND_CENTER.x, tile.y - ISLAND_CENTER.y),
        0
      ) / residents.length
    const start = fromCentre()
    let afloat = 0
    let samples = 0
    for (let i = 0; i < 3000; i++) {
      stepResidents(world, residents, 0.1, () => false)
      if (i % 10) continue
      for (const { tile } of residents) {
        samples++
        if (isWetGround(groundAt(world, tile.x, tile.y))) afloat++
      }
    }
    expect(fromCentre()).toBeGreaterThan(start * 0.75)
    // Residents keep to dry land, only swimming on the way across water.
    expect(afloat / samples).toBeLessThan(0.06)
  }, 30_000)

  it('takes the trail in preference to a straight line over grass', () => {
    const world = createIsland(24, 2)
    world.ground.fill(GRASS, 0, 24)
    world.ground.fill(PATH, 24)
    const residents = createResidents(['stroller'], [{ x: 0, y: 0 }])
    const resident = residents[0]
    resident.action = 'walk'
    resident.actionRemaining = 1000
    const steps = [0, 0]
    let last = resident.tile
    for (let i = 0; i < 1800; i++) {
      stepResidents(world, residents, 0.1, () => false)
      if (resident.tile !== last) steps[resident.tile.y]++
      last = resident.tile
    }
    expect(steps[0]).toBeGreaterThan(0)
    expect(steps[1]).toBeGreaterThan(steps[0] * 3)
  })

  it('gathers on trails, spreads over the island and leaves a few residents in the sea', ({
    onTestFinished
  }) => {
    let sample = 0
    const random = vi.spyOn(Math, 'random').mockImplementation(() => hash2(sample++, 0, 1))
    onTestFinished(() => {
      random.mockRestore()
    })
    const world = createDefaultIsland()
    const slugs = Array.from({ length: 50 }, (_, i) => `post-${i}`)
    const residents = createResidents(slugs, layoutResidentHomes(slugs.length))
    const tiles = new Array<number>(GROUND_COUNT).fill(0)
    for (const ground of world.ground) tiles[ground]++
    const seen = new Array<number>(GROUND_COUNT).fill(0)
    for (let i = 0; i < 1200; i++) {
      stepResidents(world, residents, 0.2, () => false)
      if (i < 200 || i % 5) continue
      for (const resident of residents)
        seen[groundAt(world, Math.floor(resident.x / 16), Math.floor(resident.y / 16))]++
    }
    const total = seen.reduce((a, b) => a + b, 0)
    const sum = (counts: number[], grounds: Ground[]) =>
      grounds.reduce<number>((all, ground) => all + counts[ground], 0)
    // Tile for tile: trails and paving, then boards, greens, bare ground and, last, the sea.
    const trails: Ground[] = [PATH, COBBLE, BRICK]
    const footings: Ground[][] = [
      trails,
      [DECK, STEPPING],
      [GRASS, MOSS, DRYGRASS, CLOVER],
      [SAND, WHITESAND, BLACKSAND, SOIL, CLAY, GRAVEL, ROCK, LAVA],
      [WATER]
    ]
    const crowding = footings.map((grounds) => sum(seen, grounds) / sum(tiles, grounds))
    for (let i = 1; i < crowding.length; i++)
      expect(crowding[i - 1]).toBeGreaterThan(crowding[i] * 1.1)
    // Yet most residents are off the trail, and a handful are swimming.
    expect(sum(seen, trails) / total).toBeLessThan(0.4)
    expect(seen[WATER] / total).toBeGreaterThan(0.02)
    expect(seen[WATER] / total).toBeLessThan(0.15)
  }, 30_000)

  it('treats soil like sand, cobbles like trails and lakes like the sea underfoot', () => {
    // Two lanes side by side: the stroller keeps to whichever is better footing.
    const lanes = (top: Ground, bottom: Ground) => {
      const world = createIsland(24, 2)
      world.ground.fill(top, 0, 24)
      world.ground.fill(bottom, 24)
      const residents = createResidents(['stroller'], [{ x: 0, y: 0 }])
      const resident = residents[0]
      resident.action = 'walk'
      resident.actionRemaining = 1000
      const steps = [0, 0]
      let last = resident.tile
      for (let i = 0; i < 1800; i++) {
        stepResidents(world, residents, 0.1, () => false)
        if (resident.tile !== last) steps[resident.tile.y]++
        last = resident.tile
      }
      return steps
    }
    const cobbled = lanes(GRASS, COBBLE)
    expect(cobbled[1]).toBeGreaterThan(cobbled[0] * 3)
    const earthy = lanes(SOIL, GRASS)
    expect(earthy[1]).toBeGreaterThan(earthy[0] * 1.5)
    const lake = lanes(SWAMP, SAND)
    expect(lake[1]).toBeGreaterThan(lake[0] * 3)
    // Equal footing: neither lane is shunned.
    for (const [top, bottom] of [
      [SAND, SOIL],
      [PATH, COBBLE]
    ] as const) {
      const even = lanes(top, bottom)
      expect(Math.min(...even) / Math.max(...even)).toBeGreaterThan(0.4)
    }
  })

  it('saves the new grounds and draws each as itself', () => {
    const world = createIsland()
    for (const [i, ground] of [SOIL, COBBLE, SWAMP].entries())
      for (let y = 10; y < 16; y++)
        world.ground.fill(ground, y * world.columns + 10 + i * 10, y * world.columns + 16 + i * 10)
    const restored = decodeIsland(encodeIsland(world))
    expect(restored?.ground).toEqual(world.ground)
    for (const [i, ground] of [SOIL, COBBLE, SWAMP].entries())
      expect(terrainClass(world, (13 + i * 10) * 16, 13 * 16)).toBe(ground)
    expect(isWalkable(world, 33, 13)).toBe(true)
  })

  it('routes around solid objects and reserves steps without overlapping residents', () => {
    const world = createIsland(20, 12)
    world.ground.fill(GRASS)
    for (let y = 0; y < 10; y++) world.decor[y * world.columns + 5] = decorCode('tree')
    const residents = createResidents(
      ['a', 'b', 'c'],
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 }
      ]
    )
    for (const resident of residents) {
      resident.action = 'walk'
      resident.actionRemaining = 1000
    }
    let crossed = false
    for (let i = 0; i < 1800; i++) {
      stepResidents(world, residents, 0.1, () => false)
      for (const resident of residents) {
        expect(canResidentEnter(world, resident.tile.x, resident.tile.y)).toBe(true)
        if (resident.tile.x > 5) crossed = true
        for (const other of residents) {
          if (other === resident) continue
          expect(residentOccupies(other, resident.tile.x, resident.tile.y)).toBe(false)
          if (resident.target)
            expect(residentOccupies(other, resident.target.x, resident.target.y)).toBe(false)
        }
      }
    }
    expect(crossed).toBe(true)
  })

  it('pauses even mid-step while a resident is held', () => {
    const world = createIsland(20, 1)
    world.ground.fill(GRASS)
    const residents = createResidents(['a'], [{ x: 0, y: 0 }])
    residents[0].action = 'walk'
    residents[0].wait = 0
    stepResidents(world, residents, 0.1, () => false)
    const before = { ...residents[0] }
    stepResidents(world, residents, 1, () => true)
    expect(residents[0].x).toBe(before.x)
    expect(residents[0].target).toEqual(before.target)
  })

  it('drops onto land or water, rejects obstacles, occupied tiles and outside the map', () => {
    const world = createIsland(20, 2)
    world.ground[1] = GRASS
    world.decor[2] = decorCode('searock')
    const residents = createResidents(
      ['a', 'b'],
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 }
      ]
    )
    const resident = residents[0]
    expect(dropResident(world, residents, resident, footOf({ x: 1, y: 0 }))).toBe(true)
    expect(residentIsSwimming(world, resident)).toBe(false)
    expect(dropResident(world, residents, resident, footOf({ x: 7, y: 0 }))).toBe(true)
    expect(residentIsSwimming(world, resident)).toBe(true)
    for (const x of [-1, 2, 3, 20])
      expect(dropResident(world, residents, resident, footOf({ x, y: 0 }))).toBe(false)
    expect(resident.tile).toEqual({ x: 7, y: 0 })
    expect(resident.target).toBeNull()
    expect(resident.route).toEqual([])
  })
})
