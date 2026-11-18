// Signed distance functions: each returns how far a point is from a shape's
// surface, negative inside. Coordinates are art pixels with x east, y south
// and z up. Formulas after Inigo Quilez's catalogue of distance functions.

export type Vec3 = readonly [number, number, number]

export function length3(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z)
}

export function sphere(x: number, y: number, z: number, r: number) {
  return length3(x, y, z) - r
}

// A bound rather than an exact distance, close enough near the surface.
export function ellipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const k0 = length3(x / rx, y / ry, z / rz)
  if (k0 === 0) return -Math.min(rx, ry, rz)
  const k1 = length3(x / (rx * rx), y / (ry * ry), z / (rz * rz))
  return (k0 * (k0 - 1)) / k1
}

export function box(
  x: number,
  y: number,
  z: number,
  bx: number,
  by: number,
  bz: number,
  round = 0
) {
  const qx = Math.abs(x) - bx + round
  const qy = Math.abs(y) - by + round
  const qz = Math.abs(z) - bz + round
  const outside = length3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0))
  return outside + Math.min(Math.max(qx, qy, qz), 0) - round
}

// A segment from a to b with radius r.
export function capsule(x: number, y: number, z: number, a: Vec3, b: Vec3, r: number) {
  const pax = x - a[0]
  const pay = y - a[1]
  const paz = z - a[2]
  const bax = b[0] - a[0]
  const bay = b[1] - a[1]
  const baz = b[2] - a[2]
  const h = Math.max(
    0,
    Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz))
  )
  return length3(pax - bax * h, pay - bay * h, paz - baz * h) - r
}

// A segment whose radius runs from r1 at a to r2 at b.
export function roundCone(
  x: number,
  y: number,
  z: number,
  a: Vec3,
  b: Vec3,
  r1: number,
  r2: number
) {
  const bax = b[0] - a[0]
  const bay = b[1] - a[1]
  const baz = b[2] - a[2]
  const l2 = bax * bax + bay * bay + baz * baz
  const rr = r1 - r2
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  const pax = x - a[0]
  const pay = y - a[1]
  const paz = z - a[2]
  const yy = pax * bax + pay * bay + paz * baz
  const zz = yy - l2
  const cx = pax * l2 - bax * yy
  const cy = pay * l2 - bay * yy
  const cz = paz * l2 - baz * yy
  const x2 = cx * cx + cy * cy + cz * cz
  const y2 = yy * yy * l2
  const z2 = zz * zz * l2
  const k = Math.sign(rr) * rr * rr * x2
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1
}

// An upright cylinder from z = 0 to z = h.
export function cylinder(x: number, y: number, z: number, r: number, h: number, round = 0) {
  const dx = Math.sqrt(x * x + y * y) - r + round
  const dz = Math.abs(z - h / 2) - h / 2 + round
  return (
    Math.min(Math.max(dx, dz), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dz, 0) ** 2) - round
  )
}

// Polynomial smooth minimum: joins two shapes with a fillet of size k.
export function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

// ---- Noise ------------------------------------------------------------------

function hash3(x: number, y: number, z: number, seed: number) {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 2147483647) ^
    Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

// Smooth value noise in [0, 1), for bumpy foliage and stone.
export function noise3(x: number, y: number, z: number, seed = 0) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = x - x0
  const fy = y - y0
  const fz = z - z0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const sz = fz * fz * (3 - 2 * fz)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const layer = (z1: number) =>
    lerp(
      lerp(hash3(x0, y0, z1, seed), hash3(x0 + 1, y0, z1, seed), sx),
      lerp(hash3(x0, y0 + 1, z1, seed), hash3(x0 + 1, y0 + 1, z1, seed), sx),
      sy
    )
  return lerp(layer(z0), layer(z0 + 1), sz)
}

export { hash3 }
