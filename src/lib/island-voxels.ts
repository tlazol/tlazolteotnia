import type { Model } from './island-models'
import type { DecorKind } from './island-world'

export type VoxelSurface = {
  position: Float32Array
  normal: Int8Array
  slots: Uint16Array
  indices: Uint32Array
  // Per vertex, 1 where the face belongs to a luminous part. Only with `glow`.
  glow?: Uint8Array
}

// The lattice spacing a decoration is drawn at, on the island and in the palette.
// Fine brass hardware and the pore rows on the relic's shell need a finer one.
export function decorVoxelStep(kind: DecorKind) {
  return kind === 'resortLight' ? 0.72 : kind === 'relic' ? 1.25 : undefined
}

// Sample each bounded SDF part onto the same lattice. A small shell catches
// thin palm leaves and flower stems that fall between voxel centers.
// The live scene renders luminous parts as particles, so they are left out
// unless `glow` asks for them as solid blocks, as the palette shows them.
export function voxelSurface(model: Model, maxStep = 4, { glow = false } = {}): VoxelSurface {
  const extent = model.hi.map((v, i) => v - model.lo[i])
  const step = Math.min(maxStep, Math.max(1, Math.max(...extent) / 15))
  const origin = model.lo.map((v) => Math.floor(v / step - 1) * step)
  const dims = model.hi.map((v, i) => Math.ceil((v - origin[i]) / step) + 1)
  const stride = [1, dims[0], dims[0] * dims[1]]
  const cells = new Int32Array(stride[2] * dims[2]).fill(-1)
  const distance = new Float32Array(cells.length).fill(Infinity)
  const glowing = new Uint8Array(cells.length)
  for (const part of model.parts) {
    const lo = part.lo.map((v, i) => Math.max(0, Math.floor((v - origin[i]) / step - 0.25)))
    const hi = part.hi.map((v, i) => Math.min(dims[i], Math.ceil((v - origin[i]) / step + 0.25)))
    for (let z = lo[2]; z < hi[2]; z++)
      for (let y = lo[1]; y < hi[1]; y++)
        for (let x = lo[0]; x < hi[0]; x++) {
          const px = origin[0] + (x + 0.5) * step
          const py = origin[1] + (y + 0.5) * step
          const pz = origin[2] + (z + 0.5) * step
          const d = part.d(px, py, pz)
          const cell = x + y * stride[1] + z * stride[2]
          if (d > step * 0.24 || d >= distance[cell]) continue
          const material = part.paint(px, py, pz)
          if (material.glow && !glow) continue
          distance[cell] = d
          cells[cell] = material.slot
          glowing[cell] = material.glow ? 1 : 0
        }
  }
  // Only exposed faces enter the mesh. Neighboring blocks share no inner walls.
  const position: number[] = []
  const normal: number[] = []
  const slots: number[] = []
  const lit: number[] = []
  const indices: number[] = []
  for (let z = 0; z < dims[2]; z++)
    for (let y = 0; y < dims[1]; y++)
      for (let x = 0; x < dims[0]; x++) {
        const cell = x + y * stride[1] + z * stride[2]
        if (cells[cell] < 0) continue
        const xyz = [x, y, z]
        for (let axis = 0; axis < 3; axis++)
          for (const sign of [-1, 1]) {
            const neighbor = xyz[axis] + sign
            if (neighbor >= 0 && neighbor < dims[axis] && cells[cell + stride[axis] * sign] >= 0)
              continue
            const first = slots.length
            for (const [u, v] of [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1]
            ]) {
              const p = [...xyz]
              if (sign > 0) p[axis]++
              p[(axis + 1) % 3] += u
              p[(axis + 2) % 3] += v
              for (let i = 0; i < 3; i++) {
                position.push(origin[i] + p[i] * step)
                normal.push(i === axis ? sign : 0)
              }
              slots.push(cells[cell])
              lit.push(glowing[cell])
            }
            if (sign > 0) indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
            else indices.push(first, first + 2, first + 1, first, first + 3, first + 2)
          }
      }
  return {
    position: Float32Array.from(position),
    normal: Int8Array.from(normal),
    slots: Uint16Array.from(slots),
    indices: Uint32Array.from(indices),
    ...(glow && { glow: Uint8Array.from(lit) })
  }
}
