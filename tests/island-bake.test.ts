import { describe, expect, it } from 'vitest'
import {
  BAKE_CHUNK,
  bakeTemplate,
  DEPTH_UNIT,
  IslandBaker,
  REFERENCE_HEIGHT
} from '../src/lib/island-bake'
import { decorModel, GLOW_CODE, modelDistance, modelLookCount } from '../src/lib/island-models'
import {
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
  GRASS,
  SAND,
  TILE_SIZE
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
  it('draw every look of every kind', () => {
    for (const kind of decorKinds) {
      expect(modelLookCount(kind)).toBe(decorLooks[kind])
      for (let look = 0; look < decorLooks[kind]; look++) {
        const model = decorModel(kind, look)
        const template = bakeTemplate(model)
        // Fireflies are a few glowing specks; everything else has a body.
        expect(template.count, `${kind} ${look}`).toBeGreaterThan(kind === 'fireflies' ? 4 : 20)
        // Every point is colored from the palette.
        for (const slot of template.slot) expect(slot).toBeLessThan(palette.length)
      }
    }
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

describe('island baker', () => {
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
