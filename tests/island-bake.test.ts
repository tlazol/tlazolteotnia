import { describe, expect, it } from 'vitest'
import {
  BAKE_CHUNK,
  bakeModel,
  bakeTemplate,
  DEPTH_UNIT,
  IslandBaker,
  isViewportBaked,
  modelKeysByPriority,
  prioritizeChunks,
  REFERENCE_HEIGHT
} from '../src/lib/island-bake'
import { decorModel, GLOW_CODE, modelDistance, modelLookCount } from '../src/lib/island-models'
import {
  LEAF_TONES,
  leafToneSlot,
  lightSteps,
  nearestSlot,
  palette,
  rampSlot,
  slotOnRamp,
  stepSlot
} from '../src/lib/island-palette'
import { box, capsule, ellipsoid, smin, sphere } from '../src/lib/island-sdf'
import {
  createDefaultIsland,
  createIsland,
  DECK,
  decorCode,
  decorKinds,
  decorLooks,
  decorSizeAt,
  decorToneAt,
  GRASS,
  SAND,
  TILE_SIZE,
  TREE_SIZES
} from '../src/lib/island-world'

describe('distance functions', () => {
  it('measure from the surface, negative inside', () => {
    expect(sphere(3, 4, 0, 2)).toBeCloseTo(3)
    expect(sphere(0, 0, 0, 2)).toBeCloseTo(-2)
    expect(box(5, 0, 0, 2, 2, 2)).toBeCloseTo(3)
    expect(box(0, 0, 0, 2, 3, 4)).toBeCloseTo(-2)
    expect(capsule(0, 3, 5, [0, 0, 0], [0, 0, 10], 1)).toBeCloseTo(2)
    expect(ellipsoid(4, 0, 0, 2, 1, 1)).toBeCloseTo(2, 0)
    expect(ellipsoid(0, 0, 0.5, 2, 1, 1)).toBeLessThan(0)
  })

  it('join shapes with a fillet no further out than either', () => {
    for (const [a, b] of [
      [1, 2],
      [0.5, 0.6],
      [-1, 3]
    ])
      expect(smin(a, b, 2)).toBeLessThanOrEqual(Math.min(a, b))
  })
})

describe('palette', () => {
  it('steps along a ramp and stops at its ends', () => {
    const base = rampSlot('grass', 4)
    expect(stepSlot(base, 0)).toBe(base)
    expect(stepSlot(base, -1)).toBe(rampSlot('grass', 3))
    expect(stepSlot(base, -20)).toBe(rampSlot('grass', 0))
    expect(stepSlot(base, 20)).toBe(rampSlot('grass', 7))
  })

  it('leaves full sun on flat ground as it is and darkens shade', () => {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        expect(lightSteps(1, x, y)).toBe(0)
        expect(lightSteps(0.45, x, y)).toBeLessThan(-1)
      }
  })

  it('keeps in-between ground tones on their own ramp', () => {
    const color = palette[slotOnRamp(240, 215, 150, 'sand')]
    expect(palette.indexOf(color)).toBe(nearestSlot(color.r, color.g, color.b))
    expect([rampSlot('sand', 4), rampSlot('sand', 5)]).toContain(slotOnRamp(245, 220, 160, 'sand'))
  })
})

describe('decoration models', () => {
  it.each(decorKinds)('draws every look of %s', (kind) => {
    expect(modelLookCount(kind)).toBe(decorLooks[kind])
    for (let look = 0; look < decorLooks[kind]; look++) {
      const template = bakeTemplate(decorModel(kind, look))
      // Fireflies are a few glowing specks; everything else has a body.
      expect(template.count, `look ${look}`).toBeGreaterThan(kind === 'fireflies' ? 4 : 20)
      expect(
        template.slot.every((slot) => slot < palette.length),
        `look ${look}`
      ).toBe(true)
    }
  })

  it('grow trees up to 1.75 times their size, never alike beside each other', () => {
    const tree = decorCode('tree')
    for (let look = 0; look < decorLooks.tree; look++) {
      const drawn = decorModel('tree', look)
      const biggest = decorModel('tree', look, TREE_SIZES - 1)
      const s = 1.75
      expect(biggest.hi[2] / drawn.hi[2]).toBeCloseTo(s)
      // Grown about the middle of the tile, so the trunk stays where it was.
      for (const [x, y, z] of [
        [0, -6, 5],
        [3, -4, 20],
        [-8, -9, 40]
      ])
        expect(modelDistance(biggest, x * s, -6 + (y + 6) * s, z * s)).toBeCloseTo(
          modelDistance(drawn, x, y, z) * s
        )
    }
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (dx || dy)
              expect(decorSizeAt(tree, x, y)).not.toBe(decorSizeAt(tree, x + dx, y + dy))
    expect(decorSizeAt(decorCode('palm'), 3, 4)).toBe(0)
  })

  it('stand on their foot', () => {
    // Big plants root in the middle of their tile, half a tile behind the foot.
    const palm = decorModel('palm', 0)
    expect(modelDistance(palm, 0, -6, 5)).toBeLessThan(0)
    expect(modelDistance(palm, 0, -6, -6)).toBeGreaterThan(0)
  })

  it('keep tree trunks within their tile', () => {
    for (const kind of ['tree', 'palm', 'deadtree'] as const)
      for (let look = 0; look < decorLooks[kind]; look++) {
        const model = decorModel(kind, look)
        // Just above the roots, nothing reaches past the tile's edges.
        for (let x = -12; x <= 12; x += 0.5)
          for (let y = -18; y <= 6; y += 0.5) {
            const inside = Math.abs(x) < 8 && y > -14 && y < 2
            if (!inside) expect(modelDistance(model, x, y, 2), `${kind} ${look}`).toBeGreaterThan(0)
          }
      }
  })

  it('draw small fires as signs: bold lines around flat colors', () => {
    const template = bakeTemplate(decorModel('campfire', 0))
    const flame = template.glow.filter((glow) => glow === GLOW_CODE.flame).length
    expect(flame).toBeGreaterThan(20)
  })

  it('give flames and fireflies glowing points', () => {
    for (const kind of ['torch', 'campfire', 'fireflies'] as const) {
      const template = bakeTemplate(decorModel(kind, 0))
      expect(
        template.glow.some((glow) => glow > 0),
        kind
      ).toBe(true)
      expect(decorModel(kind, 0).glow).not.toBeNull()
    }
  })
})

describe('initial viewport baking', () => {
  it('prioritizes intersecting chunks and still bakes the entire island', () => {
    const chunks = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    expect(
      prioritizeChunks(chunks, 3, {
        left: 128,
        top: 128,
        right: 256,
        bottom: 256
      })
    ).toEqual({ chunks: [4, 0, 1, 2, 3, 5, 6, 7, 8], visibleCount: 1 })
    expect(chunks).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('waits for the current viewport after a resize or camera change', () => {
    const available = new Set([4])
    const initial = { left: 128, top: 128, right: 256, bottom: 256 }
    expect(isViewportBaked(available, 3, 3, initial)).toBe(true)
    const resized = { ...initial, right: 300, bottom: 300 }
    expect(isViewportBaked(available, 3, 3, resized)).toBe(false)
    for (const index of [5, 7, 8]) available.add(index)
    expect(isViewportBaked(available, 3, 3, resized)).toBe(true)
    expect(isViewportBaked(available, 3, 3, { ...initial, left: 0 })).toBe(false)
    expect(isViewportBaked(available, 3, 3)).toBe(false)
  })

  it('includes partially visible chunks and falls back when no viewport is available', () => {
    const chunks = [0, 1, 2, 3]
    expect(
      prioritizeChunks(chunks, 2, {
        left: 127,
        top: 127,
        right: 129,
        bottom: 129
      })
    ).toEqual({ chunks, visibleCount: 4 })
    expect(prioritizeChunks(chunks, 2)).toEqual({ chunks, visibleCount: 4 })
    expect(
      prioritizeChunks(chunks, 2, {
        left: -256,
        top: -256,
        right: -128,
        bottom: -128
      })
    ).toEqual({ chunks, visibleCount: 0 })
  })
})

describe('leaf tones', () => {
  it('recolor leaves only, keeping their place from dark to light', () => {
    for (let slot = 0; slot < palette.length; slot++) expect(leafToneSlot(slot, 0)).toBe(slot)
    for (let tone = 1; tone < LEAF_TONES; tone++) {
      expect(leafToneSlot(rampSlot('trunk', 4), tone)).toBe(rampSlot('trunk', 4))
      expect(leafToneSlot(rampSlot('birch', 5), tone)).toBe(rampSlot('birch', 5))
      expect(leafToneSlot(rampSlot('flame', 2), tone)).toBe(rampSlot('flame', 2))
      const dark = palette[leafToneSlot(rampSlot('oak', 1), tone)]
      const light = palette[leafToneSlot(rampSlot('oak', 7), tone)]
      expect(dark.r + dark.g + dark.b).toBeLessThan(light.r + light.g + light.b)
    }
    const tones = new Set(
      Array.from({ length: LEAF_TONES }, (_, tone) => leafToneSlot(rampSlot('oak', 6), tone))
    )
    expect(tones.size).toBe(LEAF_TONES)
  })

  it('vary leafy trees by position and leave everything else alone', () => {
    const seen = new Set<number>()
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 20; x++) {
        seen.add(decorToneAt(decorCode('tree'), x, y))
        expect(decorToneAt(decorCode('rock'), x, y)).toBe(0)
        expect(decorToneAt(decorCode('deadtree'), x, y)).toBe(0)
      }
    expect([...seen].sort()).toEqual(Array.from({ length: LEAF_TONES }, (_, i) => i))
    expect(decorToneAt(0, 3, 4)).toBe(0)
  })
})

describe('island baker', () => {
  it('shades terrain across a chunk boundary only for nearby decorations', () => {
    const tilesPerChunk = BAKE_CHUNK / TILE_SIZE
    const world = createIsland(tilesPerChunk * 3, 4)
    world.ground.fill(GRASS)
    const baker = new IslandBaker(world.columns, world.rows)
    function groundColors() {
      baker.update(world.ground, world.decor)
      return baker.bakeChunk(1).terrain.color
    }
    const bare = groundColors()
    const row = 2 * world.columns
    world.decor[row + tilesPerChunk - 1] = decorCode('tree')
    const shaded = groundColors()
    expect(shaded.some((channel, i) => channel < bare[i])).toBe(true)
    world.decor[row + world.columns - 1] = decorCode('rock')
    expect(groundColors()).toEqual(shaded)
  })

  it('interpolates heights at centers, between columns, and outside the island', () => {
    const baker = new IslandBaker(1, 1)
    baker.heights.set([2, 4], 0)
    baker.heights.set([6, 8], TILE_SIZE)
    expect(baker.heightAt(0.5, 0.5)).toBe(2)
    expect(baker.heightAt(0.5, 1)).toBe(4)
    expect(baker.heightAt(1, 1)).toBe(5)
    expect(baker.heightAt(-0.5, 0.5)).toBe(0)
    expect(baker.heightAt(0, 0.5)).toBe(1)
    expect(baker.heightAt(TILE_SIZE + 0.5, TILE_SIZE + 0.5)).toBe(0)
  })

  it('raises grass above sand, sand above the sea, and decks on stilts', () => {
    const world = createIsland(12, 12)
    for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) world.ground[y * 12 + x] = SAND
    for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) world.ground[y * 12 + x] = GRASS
    world.ground[1 * 12 + 6] = DECK
    const baker = new IslandBaker(12, 12)
    baker.update(world.ground, world.decor)
    const at = (tx: number, ty: number) =>
      baker.heightAt(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2)
    expect(at(5, 5)).toBeGreaterThan(at(3, 3))
    expect(at(3, 3)).toBeGreaterThan(at(0, 0))
    expect(at(0, 0)).toBe(0)
    expect(at(6, 1)).toBeGreaterThan(0)
  })

  it('bakes the same chunks from models baked elsewhere, reading only those it names', () => {
    const tilesPerChunk = BAKE_CHUNK / TILE_SIZE
    const world = createIsland(tilesPerChunk * 2, 4)
    world.ground.fill(GRASS)
    const row = 2 * world.columns
    world.decor[row + tilesPerChunk - 1] = decorCode('tree')
    world.decor[row + tilesPerChunk] = decorCode('rock')
    world.decor[row + tilesPerChunk + 2] = decorCode('flowers')
    const local = new IslandBaker(world.columns, world.rows)
    local.update(world.ground, world.decor)
    const given = new IslandBaker(world.columns, world.rows)
    given.update(world.ground, world.decor)
    const named = new Set<string>()
    for (let index = 0; index < given.chunkColumns; index++) {
      const keys = given.chunkModels(index)
      expect(keys.size).toBeGreaterThan(0)
      for (const key of keys) {
        named.add(key)
        if (!given.hasModel(key)) given.addModel(bakeModel(key))
      }
      expect(given.bakeChunk(index)).toEqual(local.bakeChunk(index))
      // Nothing was baked in place: every model read was one handed over.
      expect(new Set(given.models().map((model) => model.key))).toEqual(named)
    }
  }, 15_000)

  it('lists the models standing in earlier chunks first, each once', () => {
    const world = createIsland(30, 10)
    world.ground.fill(GRASS)
    // 480 pixels across: four chunks to a row.
    world.decor[2 * 30 + 1] = decorCode('rock')
    world.decor[2 * 30 + 3] = decorCode('rock')
    world.decor[2 * 30 + 25] = decorCode('palm')
    const rock = modelKeysByPriority(30, world.decor, 4, [0, 1, 2, 3])
    expect(rock).toHaveLength(2)
    expect(rock[0]).toMatch(/^rock:/)
    expect(modelKeysByPriority(30, world.decor, 4, [3, 0, 1, 2])[0]).toMatch(/^palm:/)
    expect(() => bakeModel('nothing:0:0')).toThrow()
  })

  it('bakes only what changed', () => {
    const world = createDefaultIsland()
    const baker = new IslandBaker(world.columns, world.rows)
    const first = baker.update(world.ground, world.decor)
    expect(first?.chunks.length).toBe(baker.chunkColumns * baker.chunkRows)
    expect(baker.update(world.ground, world.decor)).toBeNull()
    const tile = 30 * world.columns + 45
    world.decor[tile] = decorCode('rock')
    const next = baker.update(world.ground, world.decor)
    expect(next).not.toBeNull()
    const chunk =
      Math.floor((30 * TILE_SIZE) / BAKE_CHUNK) * baker.chunkColumns +
      Math.floor((45 * TILE_SIZE) / BAKE_CHUNK)
    expect(next?.chunks).toContain(chunk)
    expect(next?.chunks.length).toBeLessThan(10)
  })

  it('covers the land with one lit point per screen pixel', () => {
    const world = createDefaultIsland()
    const baker = new IslandBaker(world.columns, world.rows)
    baker.update(world.ground, world.decor)
    // The plaza's chunk: solid land, decorations around it.
    const cx = Math.floor((40 * TILE_SIZE) / BAKE_CHUNK)
    const cy = Math.floor((30 * TILE_SIZE) / BAKE_CHUNK)
    const chunk = baker.bakeChunk(cy * baker.chunkColumns + cx)
    const { position, color } = chunk.terrain
    const seen = new Set<string>()
    const colors = new Set(palette.map((c) => (c.r << 16) | (c.g << 8) | c.b))
    for (let i = 0; i < position.length; i += 3) {
      const key = `${position[i]},${position[i + 1]}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
      expect(colors.has((color[i] << 16) | (color[i + 1] << 8) | color[i + 2])).toBe(true)
    }
    // Every column of the chunk is covered without gaps across its middle.
    for (let x = cx * BAKE_CHUNK; x < (cx + 1) * BAKE_CHUNK; x += 7)
      for (let y = cy * BAKE_CHUNK + 16; y < (cy + 1) * BAKE_CHUNK - 16; y++)
        expect(seen.has(`${x},${y}`), `${x},${y}`).toBe(true)
    expect(chunk.decor.position.length).toBeGreaterThan(0)
    // Depths grow toward the viewer: a point's depth is its world y plus z.
    const row = cy * BAKE_CHUNK + 64
    for (let i = 0; i < position.length; i += 3)
      if (position[i + 1] === row)
        expect(position[i + 2] / DEPTH_UNIT).toBeGreaterThan(row - REFERENCE_HEIGHT)
  })
})
