import { describe, expect, it } from 'vitest'
import { decorModel, modelLookCount, partsDistance } from '../src/lib/island-models'
import {
  LEAF_TONES,
  leafToneSlot,
  nearestSlot,
  palette,
  rampSlot,
  slotOnRamp,
  stepSlot
} from '../src/lib/island-palette'
import { box, capsule, ellipsoid, smin, sphere } from '../src/lib/island-sdf'
import { decorVoxelStep, voxelSurface } from '../src/lib/island-voxels'
import {
  decorCode,
  decorInfo,
  decorKinds,
  decorScale,
  decorSizeAt,
  decorToneAt,
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

  it('keeps in-between ground tones on their own ramp', () => {
    const color = palette[slotOnRamp(240, 215, 150, 'sand')]
    expect(palette.indexOf(color)).toBe(nearestSlot(color.r, color.g, color.b))
    expect([rampSlot('sand', 4), rampSlot('sand', 5)]).toContain(slotOnRamp(245, 220, 160, 'sand'))
  })
})

describe('decoration models', () => {
  it.each(decorKinds)('draws every look of %s', (kind) => {
    expect(modelLookCount(kind)).toBe(decorInfo[kind].looks)
    for (let look = 0; look < decorInfo[kind].looks; look++) {
      const surface = voxelSurface(decorModel(kind, look), decorVoxelStep(kind), { glow: true })
      // Fireflies are a few glowing specks; everything else has a body.
      expect(surface.indices.length / 6, `look ${look}`).toBeGreaterThan(
        kind === 'fireflies' ? 4 : 20
      )
      expect(
        surface.slots.every((slot) => slot < palette.length),
        `look ${look}`
      ).toBe(true)
    }
  })

  it('grow trees up to 1.75 times their size, never alike beside each other', () => {
    const tree = decorCode('tree')
    expect(decorScale(0)).toBe(1)
    expect(decorScale(TREE_SIZES - 1)).toBe(1.75)
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
    expect(partsDistance(palm.parts, 0, -6, 5)).toBeLessThan(0)
    expect(partsDistance(palm.parts, 0, -6, -6)).toBeGreaterThan(0)
  })

  it('keep tree trunks within their tile', () => {
    for (const kind of ['tree', 'palm', 'deadtree'] as const)
      for (let look = 0; look < decorInfo[kind].looks; look++) {
        const model = decorModel(kind, look)
        // Just above the roots, nothing reaches past the tile's edges.
        for (let x = -12; x <= 12; x += 0.5)
          for (let y = -18; y <= 6; y += 0.5) {
            const inside = Math.abs(x) < 8 && y > -14 && y < 2
            if (!inside)
              expect(partsDistance(model.parts, x, y, 2), `${kind} ${look}`).toBeGreaterThan(0)
          }
      }
  })

  it('provides particle emitters for flames and fireflies', () => {
    for (const kind of ['torch', 'campfire', 'fireflies'] as const) {
      const expected = kind === 'fireflies' ? 'firefly' : 'flame'
      for (let look = 0; look < decorInfo[kind].looks; look++)
        expect(decorModel(kind, look).parts.some((part) => part.emitter?.kind === expected)).toBe(
          true
        )
    }
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
