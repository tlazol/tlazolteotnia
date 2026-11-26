import { Group, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { applyEdits, planStroke } from '../src/lib/island-edit'
import type { Model } from '../src/lib/island-models'
import { box } from '../src/lib/island-sdf'
import { createTerrain } from '../src/lib/island-terrain.client'
import { voxelSurface } from '../src/lib/island-voxels'
import { createIsland, SAND, TILE_SIZE } from '../src/lib/island-world'

describe('live terrain mesh', () => {
  it('opens and fills a pit next to water across a patch boundary', () => {
    const world = createIsland(16, 8)
    const index = 3 * world.columns + 7
    world.ground[index] = SAND
    const scene = new Group()
    const terrain = createTerrain(world, scene)
    const center = new Vector3(7.5 * TILE_SIZE, 3.5 * TILE_SIZE, 0)
    function floor() {
      const ray = new Raycaster(center.clone().setZ(30), new Vector3(0, 0, -1))
      return ray.intersectObjects(scene.children)[0]?.point.z
    }
    function pitWall() {
      const ray = new Raycaster(center.clone().setZ(-2), new Vector3(1, 0, 0))
      return ray.intersectObjects(scene.children)[0]?.point.x
    }
    function edit(tool: 'lower' | 'raise') {
      const changes = planStroke(world, { tool }, [index])
      applyEdits(world, changes)
      terrain.update(changes.map((change) => change.index))
    }
    try {
      expect(floor()).toBe(4)
      expect(pitWall()).toBeUndefined()
      edit('lower')
      edit('lower')
      expect(floor()).toBe(-4)
      expect(pitWall()).toBe(8 * TILE_SIZE)
      edit('raise')
      expect(floor()).toBe(0)
      expect(pitWall()).toBeUndefined()
    } finally {
      terrain.dispose()
    }
  })
})

describe('decoration voxel mesh', () => {
  it('keeps the exposed faces of adjacent solids and leaves luminous parts to the particles', () => {
    const model: Model = {
      lo: [0, 0, 0],
      hi: [3, 1, 1],
      glow: null,
      sway: 0,
      bob: 0,
      parts: [0, 1, 2].map((x) => ({
        lo: [x, 0, 0],
        hi: [x + 1, 1, 1],
        d: (px, py, pz) => box(px - x - 0.5, py - 0.5, pz - 0.5, 0.5, 0.5, 0.5),
        paint: () => (x === 2 ? { slot: 9, glow: 'flame' } : { slot: x + 1 })
      }))
    }
    const mesh = voxelSurface(model)
    expect(mesh.indices).toHaveLength(10 * 6)
    expect(new Set(mesh.slots)).toEqual(new Set([1, 2]))
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = Array.from(mesh.indices.subarray(i, i + 3), (index) =>
        new Vector3().fromArray(mesh.position, index * 3)
      )
      const normal = b.sub(a).cross(c.sub(a)).normalize()
      const storedNormal = new Vector3().fromArray(mesh.normal, mesh.indices[i] * 3)
      expect(normal.equals(storedNormal)).toBe(true)
      if (normal.x !== 0) expect(a.x).toBe(normal.x > 0 ? 2 : 0)
    }
  })
})
