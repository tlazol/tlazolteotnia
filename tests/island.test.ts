import { describe, expect, it } from 'vitest'
import { createBuffer, paintTerrain, terrainClass } from '../src/lib/island-art'
import { clampView, stepZoom, tileAt, WORLD_WIDTH, zoomViewAt } from '../src/lib/island-camera'
import {
  createIslandHistory,
  type EditOptions,
  planBrush,
  tilesAlong
} from '../src/lib/island-edit'
import {
  createResidents,
  designResidents,
  paintResidentSheet,
  settleResidents
} from '../src/lib/island-residents'
import {
  createDefaultIsland,
  createIsland,
  decorCode,
  GRASS,
  ISLAND_SAVE_VERSION,
  ISLAND_STORAGE_KEY,
  isWalkable,
  layoutResidentHomes,
  loadIsland,
  PATH,
  parseIsland,
  SAND,
  serializeIsland,
  WATER
} from '../src/lib/island-world'

const options = (overrides: Partial<EditOptions> = {}): EditOptions => ({
  tool: 'land',
  ground: GRASS,
  decor: 'tree',
  brush: 1,
  ...overrides
})
const free = () => false

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

  it('round-trips saves and rejects broken, foreign or outdated data', () => {
    const world = createDefaultIsland()
    world.ground[10 * world.columns + 10] = GRASS
    const restored = parseIsland(serializeIsland(world))
    expect(restored && serializeIsland(restored)).toBe(serializeIsland(world))

    const save = JSON.parse(serializeIsland(world))
    expect(parseIsland(JSON.stringify({ ...save, version: ISLAND_SAVE_VERSION + 1 }))).toBeNull()
    expect(parseIsland(JSON.stringify({ ...save, columns: 10 }))).toBeNull()
    expect(parseIsland(JSON.stringify({ ...save, ground: '0*5' }))).toBeNull()
    expect(parseIsland(JSON.stringify({ ...save, decor: 'z*4800' }))).toBeNull()
    expect(parseIsland('{not json')).toBeNull()
    expect(parseIsland(null)).toBeNull()
  })

  it('keeps the outer ring of sea when a save paints land there', () => {
    const world = createIsland()
    world.ground.fill(GRASS)
    const restored = parseIsland(serializeIsland(world))
    expect(restored?.ground[0]).toBe(WATER)
    expect(restored?.ground[5 * world.columns + 5]).toBe(GRASS)
  })

  it('falls back to the default island when storage is unreadable or invalid', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      }
    }
    expect(loadIsland(throwing).restored).toBe(false)
    expect(loadIsland({ getItem: () => '{"version":0}' }).restored).toBe(false)
    const saved = serializeIsland(createIsland())
    const loaded = loadIsland({ getItem: (key) => (key === ISLAND_STORAGE_KEY ? saved : null) })
    expect(loaded.restored).toBe(true)
  })

  it('gives every resident a separate walkable home, the newest at the plaza', () => {
    const world = createDefaultIsland()
    const homes = layoutResidentHomes(50)
    expect(homes[0]).toEqual({ x: 40, y: 30 })
    expect(new Set(homes.map(({ x, y }) => `${x},${y}`)).size).toBe(50)
    for (const home of homes) expect(isWalkable(world, home.x, home.y)).toBe(true)
  })
})

describe('island editing', () => {
  it('adds land only to the sea and removes it only where nobody stands', () => {
    const world = createIsland()
    expect(planBrush(world, 10, 10, options(), free).edits).toHaveLength(1)
    world.ground[10 * world.columns + 10] = GRASS
    const again = planBrush(world, 10, 10, options(), free)
    expect(again.edits).toHaveLength(0)
    expect(again.soft).toBe(true)
    const blocked = planBrush(
      world,
      10,
      10,
      options({ tool: 'erase' }),
      (x, y) => x === 10 && y === 10
    )
    expect(blocked.edits).toHaveLength(0)
    expect(blocked.reason).toBe('住人の足もとは削れません')
    expect(blocked.soft).toBe(false)
    expect(planBrush(world, 0, 0, options(), free).reason).toBe('編集できる範囲の外です')
  })

  it('explains why ground and decorations cannot be placed', () => {
    const world = createIsland()
    expect(planBrush(world, 10, 10, options({ tool: 'ground' }), free).reason).toMatch(
      /海は塗れません/
    )
    expect(planBrush(world, 10, 10, options({ tool: 'decor' }), free).reason).toBe(
      '海の上には置けません'
    )
    world.ground[10 * world.columns + 10] = SAND
    world.decor[10 * world.columns + 10] = decorCode('rock')
    expect(planBrush(world, 10, 10, options({ tool: 'decor' }), free).reason).toMatch(
      /岩があります/
    )
    expect(planBrush(world, 10, 10, options({ tool: 'remove' }), free).edits).toHaveLength(1)
    world.decor[10 * world.columns + 10] = 0
    expect(planBrush(world, 10, 10, options({ tool: 'decor' }), () => true).reason).toBe(
      '住人が立っている場所には置けません'
    )
    expect(
      planBrush(world, 10, 10, options({ tool: 'decor', decor: 'flowers' }), () => true).edits
    ).toHaveLength(1)
  })

  it('uses the big brush for land but places decorations one at a time', () => {
    const world = createIsland()
    expect(planBrush(world, 10, 10, options({ brush: 3 }), free).edits).toHaveLength(9)
    world.ground.fill(GRASS)
    expect(planBrush(world, 10, 10, options({ tool: 'decor', brush: 3 }), free).edits).toHaveLength(
      1
    )
  })

  it('connects drag samples through edge-adjacent tiles', () => {
    const path = tilesAlong({ x: 0, y: 0 }, { x: 3, y: 2 })
    expect(path[0]).toEqual({ x: 0, y: 0 })
    expect(path.at(-1)).toEqual({ x: 3, y: 2 })
    for (let i = 1; i < path.length; i++)
      expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)).toBe(1)
  })

  it('undoes and redoes whole strokes, and cancels unfinished ones', () => {
    const world = createIsland()
    const history = createIslandHistory()
    const start = serializeIsland(world)
    history.begin()
    for (const x of [10, 11, 12])
      history.apply(world, planBrush(world, x, 10, options(), free).edits)
    history.commit()
    const drawn = serializeIsland(world)
    expect(drawn).not.toBe(start)
    history.undo(world)
    expect(serializeIsland(world)).toBe(start)
    history.redo(world)
    expect(serializeIsland(world)).toBe(drawn)
    expect(history.canRedo).toBe(false)

    history.begin()
    history.apply(world, planBrush(world, 20, 20, options(), free).edits)
    history.cancel(world)
    expect(serializeIsland(world)).toBe(drawn)

    history.replace(world, createDefaultIsland())
    expect(serializeIsland(world)).toBe(serializeIsland(createDefaultIsland()))
    history.undo(world)
    expect(serializeIsland(world)).toBe(drawn)
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

  it('paints a full sprite sheet for every design', () => {
    const design = designResidents(posts).get('post-0')
    if (!design) throw new Error('missing design')
    const sheet = paintResidentSheet(design)
    expect(sheet.data.some((value, i) => i % 4 === 3 && value > 0)).toBe(true)
  })

  it('moves residents off tiles that became sea', () => {
    const world = createDefaultIsland()
    const residents = createResidents(['a'], [{ x: 40, y: 30 }])
    world.ground[30 * world.columns + 40] = WATER
    expect(settleResidents(world, residents)).toEqual(['a'])
    expect(isWalkable(world, residents[0].tile.x, residents[0].tile.y)).toBe(true)
  })
})
