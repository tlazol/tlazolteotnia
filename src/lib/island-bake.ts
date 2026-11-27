// Rasterize a decoration from the south for its editing-palette thumbnail.
// A surface point at (x, y, z) projects to (x, y - z), with depth y + z.
import { type Model, nearestPart, partsDistance } from './island-models'
import { lightSteps, type Outline, rimSlot, stepSlot, surfaceEmission } from './island-palette'

// Sunlight from the north-west, high in the sky.
const SUN = (() => {
  const x = -0.35
  const y = -0.5
  const z = 1
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l] as const
})()

function shade(nx: number, ny: number, nz: number, ao: number, shadow: number) {
  const sun = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) / SUN[2]
  return ao * (0.38 + 0.07 * nz) + 0.55 * sun * shadow
}

function softShadow(
  distance: (x: number, y: number, z: number) => number,
  px: number,
  py: number,
  pz: number,
  far: number
) {
  let result = 1
  let t = 0.6
  for (let i = 0; i < 48 && t < far; i++) {
    const h = distance(px + SUN[0] * t, py + SUN[1] * t, pz + SUN[2] * t)
    if (h < 0.02) return 0
    result = Math.min(result, (5 * h) / t)
    t += Math.max(0.35, Math.min(h, 5))
  }
  return Math.max(0, Math.min(1, result))
}

function occlusion(
  distance: (x: number, y: number, z: number) => number,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number
) {
  let occluded = 0
  let weight = 1
  for (let i = 1; i <= 4; i++) {
    const h = i * 1.4
    occluded += (h - distance(px + nx * h, py + ny * h, pz + nz * h)) * weight
    weight *= 0.6
  }
  return Math.max(0, Math.min(1, 1 - occluded * 0.16))
}

// Samples a model's surface once per screen pixel, lights each point and adds
// a dark rim around the silhouette, as the hand-drawn sprites had.
export function bakeTemplate(m: Model) {
  const x0 = Math.floor(m.lo[0])
  const x1 = Math.ceil(m.hi[0])
  const y0 = Math.floor(m.lo[1] - m.hi[2])
  const y1 = Math.ceil(m.hi[1] - Math.max(m.lo[2], -0.5))
  const width = x1 - x0 + 2
  const height = y1 - y0 + 2
  const hit = new Int32Array(width * height).fill(-1)
  const xs: number[] = []
  const ys: number[] = []
  const depths: number[] = []
  const slots: number[] = []
  const outlines: Outline[] = []
  const distance = (x: number, y: number, z: number) => partsDistance(m.parts, x, y, z)
  const ground = (x: number, y: number, z: number) => Math.min(distance(x, y, z), z)
  // A ray only meets the parts whose bounds it passes through, so it marches
  // just those, over just the stretch where it is inside one: most rays miss,
  // and a part it cannot reach must not shorten its steps. A hair of slack
  // keeps the surface a ray grazes.
  const slack = 0.05
  const column: Model['parts'] = []
  const along: Model['parts'] = []
  for (let sx = x0; sx < x1; sx++) {
    const X = sx + 0.5
    column.length = 0
    for (const part of m.parts)
      if (X >= part.lo[0] - slack && X <= part.hi[0] + slack) column.push(part)
    for (let sy = y0; sy < y1; sy++) {
      const S = sy + 0.5
      along.length = 0
      let zTop = Number.NEGATIVE_INFINITY
      let zBottom = Number.POSITIVE_INFINITY
      for (const part of column) {
        // On this ray y = S + z: inside the part's bounds for these z.
        const high = Math.min(part.hi[2], part.hi[1] - S) + slack
        const low = Math.max(part.lo[2], part.lo[1] - S) - slack
        if (high < low) continue
        along.push(part)
        zTop = Math.max(zTop, high)
        zBottom = Math.min(zBottom, low)
      }
      zTop = Math.min(zTop, m.hi[2], m.hi[1] - S)
      zBottom = Math.max(zBottom, m.lo[2], m.lo[1] - S, -0.5)
      if (zTop < zBottom) continue
      let z = zTop
      let found = false
      for (let i = 0; i < 200; i++) {
        const d = partsDistance(along, X, S + z, z)
        if (d < 0.04) {
          found = true
          break
        }
        z -= Math.max(d * 0.7, 0.1) / Math.SQRT2
        if (z < zBottom) break
      }
      if (!found) continue
      const Y = S + z
      const part = nearestPart(m, X, Y, z)
      const material = part.paint(X, Y, z)
      let slot = material.slot
      const emission = surfaceEmission(slot)
      if (!material.glow && emission < 1) {
        const e = 0.3
        let nx = distance(X + e, Y, z) - distance(X - e, Y, z)
        let ny = distance(X, Y + e, z) - distance(X, Y - e, z)
        let nz = distance(X, Y, z + e) - distance(X, Y, z - e)
        const l = Math.hypot(nx, ny, nz) || 1
        nx /= l
        ny /= l
        nz /= l
        const ao = occlusion(ground, X, Y, z, nx, ny, nz)
        const lit = softShadow(
          distance,
          X + nx * 0.4,
          Y + ny * 0.4,
          z + nz * 0.4,
          (m.hi[2] + 1 - z) / SUN[2]
        )
        const light = shade(nx, ny, nz, ao, lit)
        // Drawn as a sign: lit or in shade, nothing between.
        const steps = material.flat ? (light < 0.72 ? -1 : 0) : lightSteps(light, sx, sy)
        slot = stepSlot(slot, Math.round(steps * (1 - emission)))
      }
      hit[(sy - y0 + 1) * width + (sx - x0 + 1)] = xs.length
      xs.push(sx)
      ys.push(sy)
      depths.push(Y + z)
      slots.push(slot)
      outlines.push(material.outline ?? 'soft')
    }
  }
  // The rim: empty pixels beside a drawn one, a little behind it.
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (hit[gy * width + gx] >= 0) continue
      let best = -1
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const nx = gx + dx
        const ny = gy + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const index = hit[ny * width + nx]
        if (index >= 0 && outlines[index] !== 'none' && (best < 0 || depths[index] > depths[best]))
          best = index
      }
      if (best < 0) continue
      xs.push(gx + x0 - 1)
      ys.push(gy + y0 - 1)
      depths.push(depths[best] - 1)
      slots.push(rimSlot(slots[best], outlines[best]))
    }
  }
  return {
    count: xs.length,
    x: xs,
    y: ys,
    depth: Float32Array.from(depths),
    slot: slots
  }
}
