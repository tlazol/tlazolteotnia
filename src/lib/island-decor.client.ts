import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  type Group,
  type InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  type MeshLambertMaterial,
  Scene,
  type ShaderMaterial
} from 'three'
import { type DecorPlacement, firelightVolumes, lightGeometry } from './island-lights.client'
import { leafToneSlot, palette } from './island-palette'
import { tileHeight } from './island-relief'
import type { VoxelResult } from './island-voxels.worker'
import {
  type DecorKind,
  decorKindOf,
  decorLookAt,
  decorScale,
  decorSizeAt,
  decorToneAt,
  type IslandWorld,
  TILE_SIZE
} from './island-world'

type Batch = {
  tiles: Set<number>
  particles?: Mesh<InstancedBufferGeometry>
  firelight?: InstancedMesh
  data?: VoxelResult
  geometry: Map<number, BufferGeometry>
  meshes: InstancedMesh[]
  material?: MeshLambertMaterial
}

export function createDecor(
  world: IslandWorld,
  parent: Group,
  material: MeshLambertMaterial,
  time: { value: number },
  lightMaterials: { particles: ShaderMaterial; firelight: ShaderMaterial },
  changed: () => void,
  failure: (error: unknown) => void
) {
  const worker = new Worker(new URL('./island-voxels.worker.ts', import.meta.url), {
    type: 'module'
  })
  const batches = new Map<string, Batch>()
  const tileKeys = new Map<number, string>()
  let pending = 0
  let loaded!: () => void
  const ready = new Promise<void>((resolve) => {
    loaded = resolve
  })
  const matrix = new Matrix4()
  const particleScene = new Scene()
  const firelightScene = new Scene()
  const lightBox = new BoxGeometry(2, 2, 2)
  function rebuild(batch: Batch) {
    const data = batch.data
    if (!data || !batch.material) return
    for (const mesh of batch.meshes) {
      parent.remove(mesh)
      mesh.dispose()
    }
    batch.meshes = []
    if (batch.particles) {
      particleScene.remove(batch.particles)
      batch.particles.geometry.dispose()
      batch.particles = undefined
    }
    if (batch.firelight) {
      firelightScene.remove(batch.firelight)
      batch.firelight.dispose()
      batch.firelight = undefined
    }
    const placements: DecorPlacement[] = []
    const tones = new Map<number, DecorPlacement[]>()
    for (const tile of batch.tiles) {
      const x = tile % world.columns,
        y = Math.floor(tile / world.columns)
      const code = world.decor[tile]
      const scale = decorScale(decorSizeAt(code, x, y))
      const placement = {
        tile,
        x: (x + 0.5) * TILE_SIZE,
        y: (y + 0.5) * TILE_SIZE + 6 * scale,
        z: tileHeight(world, x, y),
        scale
      }
      if (data.emitters.length) placements.push(placement)
      if (!data.surface.indices.length) continue
      const tone = decorToneAt(code, x, y)
      const group = tones.get(tone) ?? []
      group.push(placement)
      tones.set(tone, group)
    }
    for (const [tone, tiles] of tones) {
      let geo = batch.geometry.get(tone)
      if (!geo) {
        geo = new BufferGeometry()
        const { surface } = data
        geo.setAttribute('position', new BufferAttribute(surface.position, 3))
        geo.setAttribute('normal', new BufferAttribute(surface.normal, 3))
        geo.setIndex(new BufferAttribute(surface.indices, 1))
        const colors = new Uint8Array(surface.slots.length * 3)
        surface.slots.forEach((slot, i) => {
          const c = palette[leafToneSlot(slot, tone)]
          colors.set([c.r, c.g, c.b], i * 3)
        })
        geo.setAttribute('color', new BufferAttribute(colors, 3, true))
        batch.geometry.set(tone, geo)
      }
      const mesh = new InstancedMesh(geo, batch.material, tiles.length)
      tiles.forEach(({ x, y, z, scale }, i) => {
        matrix.makeScale(scale, scale, scale).setPosition(x, y, z)
        mesh.setMatrixAt(i, matrix)
      })
      mesh.castShadow = mesh.receiveShadow = true
      batch.meshes.push(mesh)
      parent.add(mesh)
    }
    if (placements.length) {
      batch.particles = new Mesh(
        lightGeometry(data.emitters, placements, data.kind === 'campfire'),
        lightMaterials.particles
      )
      // The shader positions quads across the island from per-instance origins.
      batch.particles.frustumCulled = false
      particleScene.add(batch.particles)
      batch.firelight = firelightVolumes(
        data.emitters,
        placements,
        lightBox,
        lightMaterials.firelight
      )
      if (batch.firelight) firelightScene.add(batch.firelight)
    }
  }

  worker.onmessage = ({ data }: MessageEvent<VoxelResult>) => {
    try {
      const batch = batches.get(`${data.kind}:${data.look}`)
      if (!batch) return
      batch.data = data
      const animated = material.clone()
      animated.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = time
        shader.vertexShader =
          'uniform float uTime;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
          #include <begin_vertex>
          float wave = sin(uTime * 1.8 + instanceMatrix[3].x * 0.3);
          transformed.x += wave * clamp(position.z / 30.0, 0.0, 1.0) * ${data.sway.toFixed(2)};
          transformed.z += wave * ${data.bob.toFixed(2)};
        `
          )
      }
      animated.customProgramCacheKey = () => `voxel:${data.sway}:${data.bob}`
      batch.material = animated
      rebuild(batch)
      changed()
      if (--pending === 0) loaded()
    } catch (error) {
      failure(error)
    }
  }
  worker.onerror = failure

  function update(indices: Iterable<number>) {
    const dirty = new Set<Batch>()
    for (const tile of indices) {
      const old = tileKeys.get(tile)
      if (old) {
        const batch = batches.get(old)
        if (batch) {
          batch.tiles.delete(tile)
          dirty.add(batch)
        }
        tileKeys.delete(tile)
      }
      const code = world.decor[tile]
      const kind: DecorKind | null = decorKindOf(code)
      const look = decorLookAt(code, tile % world.columns, Math.floor(tile / world.columns))
      if (!kind || look === null) continue
      const key = `${kind}:${look}`
      let batch = batches.get(key)
      if (!batch) {
        batch = { tiles: new Set(), geometry: new Map(), meshes: [] }
        batches.set(key, batch)
        pending++
        worker.postMessage({ kind, look })
      }
      tileKeys.set(tile, key)
      batch.tiles.add(tile)
      dirty.add(batch)
    }
    for (const batch of dirty) rebuild(batch)
  }
  update(world.decor.keys())
  if (!pending) loaded()
  return {
    ready,
    update,
    firelightScene,
    particleScene,
    dispose() {
      worker.terminate()
      lightBox.dispose()
      for (const batch of batches.values()) {
        for (const geometry of batch.geometry.values()) geometry.dispose()
        for (const mesh of batch.meshes) mesh.dispose()
        batch.material?.dispose()
        batch.particles?.geometry.dispose()
        batch.firelight?.dispose()
      }
    }
  }
}
