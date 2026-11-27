import { Group, InstancedMesh, Raycaster, Scene, ShaderMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { applyEdits, planStroke } from '../src/lib/island-edit'
import { decorModel, type Model } from '../src/lib/island-models'
import { surfaceEmission } from '../src/lib/island-palette'
import { box } from '../src/lib/island-sdf'
import { createTerrain } from '../src/lib/island-terrain.client'
import { voxelSurface } from '../src/lib/island-voxels'
import { createIsland, DECK, decorInfo, SAND, TILE_SIZE, WATER } from '../src/lib/island-world'

describe('live terrain mesh', () => {
  it('opens and fills a pit next to water across a patch boundary', () => {
    const world = createIsland(16, 8)
    const index = 3 * world.columns + 7
    world.ground[index] = SAND
    const scene = new Group()
    const lightMaterial = new ShaderMaterial()
    const terrain = createTerrain(world, scene, { value: 0 }, new Scene(), lightMaterial)
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
      lightMaterial.dispose()
    }
  })

  it('moves the pier lights with the edited shoreline across patch edges', () => {
    const world = createIsland(16, 8)
    const pier = 4 * world.columns + 7
    world.ground[pier] = DECK
    const lights = new Scene()
    const lightMaterial = new ShaderMaterial()
    const terrain = createTerrain(world, new Group(), { value: 1 }, lights, lightMaterial)
    const count = () =>
      lights.children.reduce(
        (sum, mesh) => sum + (mesh instanceof InstancedMesh ? mesh.count : 0),
        0
      )
    try {
      expect(count()).toBe(2)
      world.ground[pier + 1] = SAND
      terrain.update([pier + 1])
      expect(count()).toBe(1)
      world.ground[pier] = WATER
      terrain.update([pier])
      expect(count()).toBe(0)
    } finally {
      terrain.dispose()
      lightMaterial.dispose()
    }
  })
})

describe('decoration voxel mesh', () => {
  it('keeps the resort lamps luminous in the mesh and supplies colored light emitters', () => {
    const colors = new Set<string>()
    for (let look = 0; look < decorInfo.resortLight.looks; look++) {
      const model = decorModel('resortLight', look)
      const lamps = model.parts.flatMap((part) =>
        part.emitter?.kind === 'lamp' ? [part.emitter] : []
      )
      expect(lamps.length).toBeGreaterThan(0)
      for (const lamp of lamps) colors.add(lamp.glass)
      expect(voxelSurface(model, 1.25).slots.some((slot) => surfaceEmission(slot) > 0)).toBe(true)
    }
    expect(colors.size).toBeGreaterThanOrEqual(4)
  })

  it('keeps the exposed faces of adjacent solids and leaves luminous parts to the particles', () => {
    const model: Model = {
      lo: [0, 0, 0],
      hi: [3, 1, 1],
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
