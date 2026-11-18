// Every decoration as a shape made of distance functions. A model sits with
// its foot at the origin: x east, y south (toward the viewer), z up, in art
// pixels. Each part knows its distance, its bounds and how it is colored.

import { nearestSlot, type Outline, type RampName, rampSlot } from './island-palette'
import {
  box,
  capsule,
  cylinder,
  ellipsoid,
  hash3,
  noise3,
  roundCone,
  sphere,
  type Vec3
} from './island-sdf'
import { type DecorKind, decorLooks } from './island-world'

// 'flame' is a drawn flame: steady colors, its tip leaning from side to side.
export type Glow = 'fire' | 'firefly' | 'flame'
export const GLOW_CODE = { fire: 1, firefly: 2, flame: 3 } as const satisfies Record<Glow, number>
// `flat` lights a surface in two tones only, as a sign rather than a thing.
export type Material = { slot: number; glow?: Glow; outline?: Outline; flat?: boolean }
export type Painter = (x: number, y: number, z: number) => Material
export type Part = {
  d: (x: number, y: number, z: number) => number
  paint: Painter
  lo: Vec3
  hi: Vec3
}
export type Model = {
  parts: Part[]
  // Pixels the top sways in the wind, and pixels a floating thing bobs.
  sway: number
  bob: number
  // Where a flame burns, for the glow around it at night.
  glow: { height: number; soft?: boolean } | null
  // Bounds of all parts together.
  lo: Vec3
  hi: Vec3
}

// ---- Materials --------------------------------------------------------------

const materials = new Map<string, Material>()
function mat(
  ramp: RampName,
  step: number,
  glow?: Glow,
  outline: Outline = 'soft',
  flat = false
): Material {
  const key = `${ramp}:${step}:${glow ?? ''}:${outline}:${flat}`
  let found = materials.get(key)
  if (!found) {
    found = { slot: rampSlot(ramp, step), glow, outline, flat }
    materials.set(key, found)
  }
  return found
}
// A material for the signlike things: flat light, bold ink line.
const toon = (ramp: RampName, step: number) => mat(ramp, step, undefined, 'ink', true)
function hexMat(value: string): Material {
  const n = Number.parseInt(value.slice(1), 16)
  const key = `hex:${value}`
  let found = materials.get(key)
  if (!found) {
    found = { slot: nearestSlot(n >> 16, (n >> 8) & 255, n & 255), outline: 'soft' }
    materials.set(key, found)
  }
  return found
}
const plain =
  (m: Material): Painter =>
  () =>
    m
// Noise picks a step either side of the base, in clumps `scale` pixels across.
function mottled(ramp: RampName, step: number, seed: number, scale = 2.5, spread = 0.2): Painter {
  const dark = mat(ramp, step - 1)
  const base = mat(ramp, step)
  const light = mat(ramp, step + 1)
  return (x, y, z) => {
    const n = noise3(x / scale, y / scale, z / scale, seed)
    return n < 0.5 - spread ? dark : n > 0.5 + spread ? light : base
  }
}
// Leaves as a painter sees them: clumps of light and shade broken by a fine
// speckle of single leaves, a step or two either side of the base.
function foliage(ramp: RampName, step: number, seed: number): Painter {
  const tones = [-2, -1, 0, 1, 2].map((k) => mat(ramp, step + k))
  return (x, y, z) => {
    const clump = noise3(x / 4.5, y / 4.5, z / 4.5, seed) - 0.5
    const leaf = noise3(x / 1.05, y / 1.05, z / 1.05, seed + 17) - 0.5
    const v = clump * 1.6 + leaf * 1.3
    return tones[v < -0.42 ? 0 : v < -0.13 ? 1 : v < 0.16 ? 2 : v < 0.42 ? 3 : 4]
  }
}
// Bark in furrows that run along the trunk, with the odd pale ridge.
function barkOf(seed: number, ramp: RampName = 'trunk', step = 5): Painter {
  const furrow = mat(ramp, step - 2)
  const shade = mat(ramp, step - 1)
  const base = mat(ramp, step)
  const ridge = mat(ramp, step + 1)
  return (x, y, z) => {
    const n =
      noise3(x / 1.1, y / 1.1, z / 5, seed) * 0.75 + noise3(x / 3, y / 3, z / 3, seed + 3) * 0.25
    return n < 0.33 ? furrow : n < 0.45 ? shade : n > 0.66 ? ridge : base
  }
}

// ---- Parts ------------------------------------------------------------------

type Bump = { amp: number; scale?: number; seed?: number }
function bumped(d: Part['d'], bump?: Bump): Part['d'] {
  if (!bump) return d
  const { amp, scale = 2.5, seed = 0 } = bump
  return (x, y, z) => d(x, y, z) + (noise3(x / scale, y / scale, z / scale, seed) - 0.5) * 2 * amp
}
const grow = (lo: Vec3, hi: Vec3, by: number): [Vec3, Vec3] => [
  [lo[0] - by, lo[1] - by, lo[2] - by],
  [hi[0] + by, hi[1] + by, hi[2] + by]
]

function ball(c: Vec3, r: number, paint: Painter, bump?: Bump): Part {
  const [lo, hi] = grow(c, c, r + (bump?.amp ?? 0))
  return {
    d: bumped((x, y, z) => sphere(x - c[0], y - c[1], z - c[2], r), bump),
    paint,
    lo,
    hi
  }
}
function egg(c: Vec3, r: Vec3, paint: Painter, bump?: Bump): Part {
  const pad = bump?.amp ?? 0
  return {
    d: bumped((x, y, z) => ellipsoid(x - c[0], y - c[1], z - c[2], r[0], r[1], r[2]), bump),
    paint,
    lo: [c[0] - r[0] - pad, c[1] - r[1] - pad, c[2] - r[2] - pad],
    hi: [c[0] + r[0] + pad, c[1] + r[1] + pad, c[2] + r[2] + pad]
  }
}
function segmentBounds(a: Vec3, b: Vec3, r: number): [Vec3, Vec3] {
  return grow(
    [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
    r
  )
}
function stick(a: Vec3, b: Vec3, r: number, paint: Painter): Part {
  const [lo, hi] = segmentBounds(a, b, r)
  return { d: (x, y, z) => capsule(x, y, z, a, b, r), paint, lo, hi }
}
function taper(a: Vec3, b: Vec3, r1: number, r2: number, paint: Painter, bump?: Bump): Part {
  const [lo, hi] = segmentBounds(a, b, Math.max(r1, r2) + (bump?.amp ?? 0))
  return { d: bumped((x, y, z) => roundCone(x, y, z, a, b, r1, r2), bump), paint, lo, hi }
}
function block(c: Vec3, half: Vec3, paint: Painter, round = 0.4, yaw = 0): Part {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const reach = Math.hypot(half[0], half[1])
  return {
    d: (x, y, z) => {
      const dx = x - c[0]
      const dy = y - c[1]
      return box(
        dx * cos + dy * sin,
        -dx * sin + dy * cos,
        z - c[2],
        half[0],
        half[1],
        half[2],
        round
      )
    },
    paint,
    lo: [c[0] - reach, c[1] - reach, c[2] - half[2]],
    hi: [c[0] + reach, c[1] + reach, c[2] + half[2]]
  }
}
// A flat blade from `base`, pointing `yaw` round from east (toward +y is
// south) and `pitch` up from level, `length` long and `width` across.
function blade(
  base: Vec3,
  yaw: number,
  pitch: number,
  length: number,
  width: number,
  thick: number,
  paint: Painter,
  holes = 0,
  // Leaflets `comb` pixels apart, swept forward from a rib down the middle.
  comb = 0
): Part {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const half = length / 2
  const reach = half + width
  const center: Vec3 = [base[0] + cy * cp * half, base[1] + sy * cp * half, base[2] + sp * half]
  return {
    d: (x, y, z) => {
      const dx = x - center[0]
      const dy = y - center[1]
      const dz = z - center[2]
      // Into the blade's frame: u along it, v across, w through it.
      const flat = dx * cy + dy * sy
      const v = -dx * sy + dy * cy
      const u = flat * cp + dz * sp
      const w = -flat * sp + dz * cp
      let d = ellipsoid(u, v, w, half, width, thick)
      // Splits along the edges, as a monstera leaf has.
      for (let i = 0; i < holes; i++) {
        const at = -half * 0.5 + (i >> 1) * ((half * 1.1) / Math.max(1, (holes >> 1) - 0.5))
        const side = i % 2 ? 1 : -1
        d = Math.max(d, -sphere(u - at, v - side * width * 0.85, w, width * 0.32))
      }
      if (comb > 0 && Math.abs(v) > width * 0.18) {
        const f = ((((u - Math.abs(v) * 0.9) / comb) % 1) + 1) % 1
        if (f < 0.42) d = Math.max(d, Math.min(f, 0.42 - f) * comb * 0.7)
      }
      return d
    },
    paint,
    lo: [center[0] - reach, center[1] - reach, center[2] - reach],
    hi: [center[0] + reach, center[1] + reach, center[2] + reach]
  }
}
// Several parts in one painter, measured as one: only those whose bounds
// could hold the nearest surface are asked.
function group(parts: Part[], paint = parts[0].paint): Part {
  const lo: Vec3 = [
    Math.min(...parts.map((p) => p.lo[0])),
    Math.min(...parts.map((p) => p.lo[1])),
    Math.min(...parts.map((p) => p.lo[2]))
  ]
  const hi: Vec3 = [
    Math.max(...parts.map((p) => p.hi[0])),
    Math.max(...parts.map((p) => p.hi[1])),
    Math.max(...parts.map((p) => p.hi[2]))
  ]
  return {
    d: (x, y, z) => {
      let best = Number.POSITIVE_INFINITY
      for (const part of parts) {
        const ox = Math.max(part.lo[0] - x, 0, x - part.hi[0])
        const oy = Math.max(part.lo[1] - y, 0, y - part.hi[1])
        const oz = Math.max(part.lo[2] - z, 0, z - part.hi[2])
        if (best > 0 && ox * ox + oy * oy + oz * oz >= best * best) continue
        const d = part.d(x, y, z)
        if (d < best) best = d
      }
      return best
    },
    paint,
    lo,
    hi
  }
}
// Points along a quadratic curve from a through control c to b.
function curve(a: Vec3, c: Vec3, b: Vec3, steps: number): Vec3[] {
  const out: Vec3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
      u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]
    ])
  }
  return out
}
// A tapering limb along a curve.
function limb(points: Vec3[], r1: number, r2: number, paint: Painter): Part[] {
  const parts: Part[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const t0 = i / (points.length - 1)
    const t1 = (i + 1) / (points.length - 1)
    parts.push(taper(points[i], points[i + 1], r1 + (r2 - r1) * t0, r1 + (r2 - r1) * t1, paint))
  }
  return [group(parts, paint)]
}

function model(
  parts: Part[],
  options: { sway?: number; bob?: number; glow?: Model['glow'] } = {}
): Model {
  const lo: Vec3 = [
    Math.min(...parts.map((p) => p.lo[0])),
    Math.min(...parts.map((p) => p.lo[1])),
    Math.min(...parts.map((p) => p.lo[2]))
  ]
  const hi: Vec3 = [
    Math.max(...parts.map((p) => p.hi[0])),
    Math.max(...parts.map((p) => p.hi[1])),
    Math.max(...parts.map((p) => p.hi[2]))
  ]
  return {
    parts,
    sway: options.sway ?? 0,
    bob: options.bob ?? 0,
    glow: options.glow ?? null,
    lo,
    hi
  }
}

function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const deg = Math.PI / 180

// Big plants stand in the middle of their tile, so the trunk keeps to it.
const MID = -6

// A crown of leaf clumps filling an ellipsoid, most of them out at its skin,
// around a dark heart so the gaps between them show shade, not the ground.
function crown(
  c: Vec3,
  r: Vec3,
  count: number,
  clump: number,
  paint: Painter,
  heart: Painter,
  seed: number,
  squash = 1,
  // How much of the crown the dark heart fills: less for an airy crown, whose
  // limbs show between the clumps.
  hollow = 0.7
): Part[] {
  const rand = random(seed)
  const heartPart = egg(c, [r[0] * hollow, r[1] * hollow, r[2] * hollow * 0.95], heart, {
    amp: 1.2,
    scale: 2.4,
    seed
  })
  // The clumps are one part: a single pass of noise roughens all their edges,
  // and only clumps that could be nearest are measured.
  const clumps: Array<{ at: Vec3; size: number }> = []
  const lo: [number, number, number] = [c[0], c[1], c[2]]
  const hi: [number, number, number] = [c[0], c[1], c[2]]
  for (let i = 0; i < count; i++) {
    // More clumps on the sunlit top and sides than underneath.
    const a = rand() * Math.PI * 2
    const up = Math.min(1, -0.55 + rand() * 1.75)
    const around = Math.sqrt(1 - up * up)
    const reach = 0.55 + rand() * 0.33
    const at: Vec3 = [
      c[0] + Math.cos(a) * around * r[0] * reach,
      c[1] + Math.sin(a) * around * r[1] * reach,
      c[2] + up * r[2] * reach
    ]
    const size = clump * (0.75 + rand() * 0.5)
    clumps.push({ at, size })
    for (let axis = 0; axis < 3; axis++) {
      lo[axis] = Math.min(lo[axis], at[axis] - size)
      hi[axis] = Math.max(hi[axis], at[axis] + size)
    }
  }
  const amp = clump * 0.18
  const [low, high] = grow(lo, hi, amp)
  const leaves: Part = {
    d: (x, y, z) => {
      let best = Number.POSITIVE_INFINITY
      for (const { at, size } of clumps) {
        const dx = x - at[0]
        const dy = y - at[1]
        const dz = z - at[2]
        // A sphere round the clump bounds it from below.
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) - size >= best) continue
        const d = ellipsoid(dx, dy, dz, size, size, size * squash)
        if (d < best) best = d
      }
      return best + (noise3(x / 1.3, y / 1.3, z / 1.3, seed) - 0.5) * 2 * amp
    },
    paint,
    lo: low,
    hi: high
  }
  return [heartPart, leaves]
}

// A trunk that flares into roots at its foot, all within half a tile.
function trunk(
  top: Vec3,
  r0: number,
  r1: number,
  paint: Painter,
  seed: number,
  roots = 5,
  base: Vec3 = [0, MID, -1]
): Part[] {
  const rand = random(seed + 5)
  const parts: Part[] = [taper(base, top, r0, r1, paint, { amp: 0.3, scale: 1.4, seed })]
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + rand() * 0.7
    const reach = Math.min(6.8 - 0.9, r0 + 1.8)
    parts.push(
      taper(
        [base[0] + Math.cos(a) * r0 * 0.4, base[1] + Math.sin(a) * r0 * 0.4, 3 + rand() * 2],
        [base[0] + Math.cos(a) * reach, base[1] + Math.sin(a) * reach, -0.4],
        r0 * 0.5,
        0.9,
        paint
      )
    )
  }
  return parts
}

// ---- Trees ------------------------------------------------------------------

const leaves = (seed: number, ramp: RampName = 'leaf', step = 4) =>
  mottled(ramp, step, seed, 2.2, 0.17)

// A savanna tree: a leaning trunk forks into limbs under a wide, flat roof.
function acacia(lean: number, flip: boolean, seed: number) {
  const s = flip ? -1 : 1
  const paint = barkOf(seed)
  const fork: Vec3 = [lean * s, MID, 24]
  const parts: Part[] = [...trunk(fork, 3.6, 2.4, paint, seed, 4)]
  const ends: Vec3[] = [
    [(lean - 17) * s, MID - 2, 40],
    [(lean + 15) * s, MID + 1, 42],
    [lean * s * 1.2 + 2, MID - 5, 45],
    [(lean - 4) * s, MID + 5, 41]
  ]
  for (const end of ends)
    parts.push(
      ...limb(curve(fork, [(fork[0] + end[0]) / 2, MID, end[2] - 4], end, 3), 1.9, 0.9, paint)
    )
  const canopy = foliage('savanna', 5, seed + 1)
  const heart = plain(mat('savanna', 2))
  parts.push(
    ...crown([lean * s, MID, 45], [31, 9, 4.5], 30, 5.5, canopy, heart, seed + 2, 0.6),
    ...crown([(lean - 9) * s, MID - 1, 49], [16, 7, 3], 10, 5, canopy, heart, seed + 3, 0.6)
  )
  return model(parts, { sway: 1 })
}

// A broad shade tree: thick limbs into a tall, round crown of many clumps.
function broadleaf(seed: number) {
  const paint = barkOf(seed)
  const top: Vec3 = [0.5, MID, 30]
  const parts: Part[] = [...trunk(top, 4.6, 3, paint, seed, 6)]
  for (const end of [
    [-12, MID + 1, 44],
    [12, MID - 2, 46],
    [2, MID + 4, 52],
    [-4, MID - 5, 50]
  ] as Vec3[])
    parts.push(...limb(curve(top, [end[0] * 0.4, MID, end[2] - 8], end, 3), 2.4, 1.1, paint))
  parts.push(
    ...crown(
      [0, MID, 54],
      [25, 19, 19],
      34,
      7.5,
      foliage('oak', 6, seed + 1),
      plain(mat('oak', 2)),
      seed + 2
    )
  )
  return model(parts, { sway: 1 })
}

function sapling(seed: number) {
  const paint = barkOf(seed, 'trunk', 6)
  return model(
    [
      ...trunk([0.6, MID, 24], 2.2, 1.3, paint, seed, 3),
      ...limb(curve([0.4, MID, 16], [-3, MID, 20], [-6, MID - 1, 25], 2), 0.9, 0.5, paint),
      ...crown(
        [0.5, MID, 30],
        [12, 9, 11],
        17,
        4.6,
        foliage('oak', 7, seed + 1),
        plain(mat('oak', 3)),
        seed + 2
      )
    ],
    { sway: 1 }
  )
}

// Birch bark: chalk white, ringed with short dark marks that crowd together
// into rough black bark near the foot.
function birchBark(seed: number): Painter {
  const black = mat('birch', 1)
  const dark = mat('birch', 3)
  const tones = [mat('birch', 5), mat('birch', 6), mat('birch', 6)]
  return (x, y, z) => {
    const rough = Math.max(0, 1 - z / 9)
    // Stretched round the trunk and squeezed up it: marks run across.
    const mark = noise3(x / 1.4, y / 1.4, z * 1.6, seed)
    if (mark > 0.79 - rough * 0.32) return mark > 0.86 - rough * 0.22 ? black : dark
    const n = noise3(x / 2, y / 2, z / 6, seed + 1)
    return tones[n < 0.4 ? 0 : n > 0.62 ? 2 : 1]
  }
}

// A clump of birches: three slender white stems from one foot, leaning apart,
// each under its own small, airy crown of bright leaves.
function birch(seed: number) {
  const rand = random(seed)
  const paint = birchBark(seed)
  const canopy = foliage('birchLeaf', 6, seed + 1)
  const heart = plain(mat('birchLeaf', 3))
  const parts: Part[] = []
  const stems: Array<{ foot: Vec3; top: Vec3; r: number }> = [
    { foot: [-2.6, MID + 0.5, -1], top: [-15, MID - 1, 60], r: 1.7 },
    { foot: [2.4, MID - 1.5, -1], top: [12, MID - 3, 70], r: 1.9 },
    { foot: [0.6, MID + 2.4, -1], top: [1, MID + 4, 46], r: 1.5 }
  ]
  for (const { foot, top, r } of stems) {
    const bend: Vec3 = [foot[0] + (top[0] - foot[0]) * 0.35, (foot[1] + top[1]) / 2, top[2] * 0.5]
    parts.push(...limb(curve(foot, bend, top, 6), r, r * 0.4, paint))
    // Fine twigs fan up from the upper stem into the crown.
    for (let k = 0; k < 3; k++) {
      const t = 0.6 + k * 0.12
      const from: Vec3 = [
        foot[0] + (top[0] - foot[0]) * t,
        foot[1] + (top[1] - foot[1]) * t,
        top[2] * t
      ]
      const side = k % 2 ? 1 : -1
      parts.push(
        taper(
          from,
          [
            from[0] + side * (5 + rand() * 3),
            from[1] + (rand() - 0.5) * 3,
            from[2] + 6 + rand() * 4
          ],
          r * 0.45,
          0.35,
          paint
        )
      )
    }
    parts.push(
      ...crown(
        [top[0], top[1], top[2] - 5],
        [13, 8, 15],
        28,
        2.8,
        canopy,
        heart,
        seed + Math.round(top[2]),
        1,
        0.35
      )
    )
  }
  return model(parts, { sway: 2 })
}

// A frond: a rib that rises and arches over, its leaflets combed along it.
function frond(
  top: Vec3,
  yaw: number,
  length: number,
  lift: number,
  droop: number,
  width: number,
  paint: Painter
): Part[] {
  const at = (t: number): Vec3 => [
    top[0] + Math.cos(yaw) * length * t,
    top[1] + Math.sin(yaw) * length * t * 0.85,
    top[2] + lift * t * 2 - droop * t * t
  ]
  const parts: Part[] = []
  const segments = 5
  for (let i = 0; i < segments; i++) {
    const a = at(i / segments)
    const b = at((i + 1) / segments)
    const flat = Math.hypot(b[0] - a[0], b[1] - a[1])
    const t = (i + 0.5) / segments
    const half = width * Math.sin(Math.PI * Math.min(0.95, 0.18 + t * 0.85))
    parts.push(
      blade(
        a,
        Math.atan2(b[1] - a[1], b[0] - a[0]),
        Math.atan2(b[2] - a[2], flat),
        Math.hypot(flat, b[2] - a[2]) * 1.3,
        Math.max(0.7, half),
        0.45,
        paint,
        0,
        2.1
      )
    )
  }
  return [group(parts, paint)]
}

function palm(height: number, leanX: number, leanY: number, fronds: number, seed: number) {
  const rand = random(seed)
  const top: Vec3 = [leanX, MID + leanY, height]
  // Leaf scars ring the trunk, closer together toward the crown.
  const scar = mat('palmTrunk', 2)
  const tones = [mat('palmTrunk', 3), mat('palmTrunk', 4), mat('palmTrunk', 5)]
  const trunkPaint: Painter = (x, y, z) => {
    const ring = (z * (1 + z / height) + noise3(x, y, z, seed) * 1.6) % 3.4
    if (ring < 0.65) return scar
    const n = noise3(x / 1.2, y / 1.2, z / 4, seed + 1)
    return tones[n < 0.4 ? 0 : n > 0.62 ? 2 : 1]
  }
  const parts: Part[] = [
    ...limb(
      curve([0, MID, -1], [leanX * 0.05, MID + leanY * 0.05, height * 0.55], top, 8),
      3.4,
      2.3,
      trunkPaint
    ),
    egg([0, MID, 1.5], [4.6, 4.2, 3], trunkPaint)
  ]
  const green = foliage('frond', 5, seed)
  for (let i = 0; i < fronds; i++) {
    const yaw = (i / fronds) * Math.PI * 2 + rand() * 0.5
    parts.push(...frond(top, yaw, 30 + rand() * 8, 4 + rand() * 2.5, 20 + rand() * 6, 4.4, green))
  }
  // A couple of old fronds hang dead against the trunk.
  const dead = mottled('dryGrass', 2, seed + 4, 1.2, 0.25)
  for (const yaw of [rand() * Math.PI * 2, rand() * Math.PI * 2])
    parts.push(...frond([top[0], top[1], top[2] - 1.5], yaw, 9, -2, 9, 2.4, dead))
  const nut = mottled('palmTrunk', 2, seed + 7, 1, 0.2)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6
    parts.push(
      ball([top[0] + Math.cos(a) * 2.2, top[1] + Math.sin(a) * 2.2 + 1, top[2] - 2.2], 1.8, nut)
    )
  }
  return model(parts, { sway: 2 })
}

// ---- Undergrowth -------------------------------------------------------------

function thicket(dark: boolean, seed: number) {
  const canopy = dark ? foliage('pine', 6, seed) : foliage('oak', 6, seed)
  const heart = plain(dark ? mat('pine', 2) : mat('oak', 2))
  const parts: Part[] = crown([0, -2, 7], [12, 7, 7], 14, 4.2, canopy, heart, seed)
  const berry = plain(mat('red', 2))
  const shine = plain(mat('red', 4))
  const rand = random(seed + 7)
  if (dark)
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI - Math.PI * 0.05
      const at: Vec3 = [Math.cos(a) * 10, Math.sin(a) * 6 - 1, 4 + rand() * 7]
      parts.push(ball(at, 0.85, berry), ball([at[0] - 0.4, at[1] + 0.5, at[2] + 0.5], 0.35, shine))
    }
  return model(parts, { sway: 1 })
}

function shrub(flowering: boolean, seed: number) {
  const parts: Part[] = crown(
    [0, -1, 6],
    [9, 6, 6],
    11,
    3.6,
    foliage('frond', 5, seed),
    plain(mat('frond', 1)),
    seed
  )
  if (flowering) {
    const rand = random(seed)
    const petals = [plain(mat('bloom', 2)), plain(mat('bloom', 3)), plain(mat('coral', 3))]
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2
      const up = 0.2 + rand() * 0.8
      parts.push(
        ball(
          [Math.cos(a) * 9 * (1 - up * 0.45), Math.sin(a) * 6 * (1 - up * 0.45) - 1, 6 + up * 6.5],
          0.75,
          petals[i % 3]
        )
      )
    }
  }
  return model(parts, { sway: 1 })
}

function fern(seed: number) {
  const rand = random(seed)
  const paint = leaves(seed, 'jungle', 4)
  const parts: Part[] = []
  for (let i = 0; i < 9; i++) {
    const yaw = (i / 9) * Math.PI * 2 + rand() * 0.4
    parts.push(blade([0, 0, 1], yaw, (20 + rand() * 25) * deg, 10 + rand() * 3, 2.4, 0.6, paint))
  }
  return model(parts, { sway: 1 })
}

function tallGrass(seed: number) {
  const rand = random(seed)
  const parts: Part[] = []
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2
    const r = rand() * 5
    const base: Vec3 = [Math.cos(a) * r, Math.sin(a) * r * 0.7, 0]
    const tip: Vec3 = [base[0] * 1.5 + (rand() - 0.5) * 3, base[1] * 1.3, 8 + rand() * 6]
    const paint = plain(mat(rand() < 0.25 ? 'dryGrass' : 'grass', rand() < 0.5 ? 4 : 5))
    parts.push(taper(base, tip, 0.8, 0.3, paint))
  }
  return model(parts, { sway: 2 })
}

function flowers(look: number, seed: number) {
  const rand = random(seed)
  const parts: Part[] = []
  const stem = plain(mat('grass', 4))
  const heads: Record<number, Material[]> = {
    0: [mat('bloom', 2), mat('coral', 3), mat('white', 3)],
    1: [mat('yellow', 3), mat('amber', 3)],
    2: [mat('blue', 3), mat('violet', 3), mat('white', 3)],
    3: [mat('red', 3), mat('amber', 3)],
    4: [mat('violet', 3), mat('lilac', 3)],
    5: [mat('white', 3)]
  }
  const count = look === 3 ? 4 : 8
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2
    const r = 1 + rand() * 5.5
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r * 0.7
    const h = 3 + rand() * (look === 4 ? 6 : 4)
    parts.push(stick([x, y, 0], [x, y, h], 0.45, stem))
    const color = heads[look][Math.floor(rand() * heads[look].length)]
    if (look === 4) {
      // Lupine spikes: florets stacked up the stem.
      for (let k = 0; k < 4; k++) parts.push(ball([x, y, h - k * 1.3], 1.1 - k * 0.1, plain(color)))
    } else if (look === 3) {
      // Big tropical heads over broad leaves.
      parts.push(ball([x, y, h + 1], 2, plain(color)))
      parts.push(blade([x, y, 1], a, 15 * deg, 5, 1.6, 0.5, plain(mat('jungle', 4))))
    } else {
      parts.push(ball([x, y, h], 1.3, plain(color)))
      if (look === 5) parts.push(ball([x, y + 0.4, h + 0.6], 0.6, plain(mat('yellow', 3))))
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand()
    parts.push(blade([0, 0, 0.5], a, 10 * deg, 6, 1.4, 0.5, plain(mat('grass', 3))))
  }
  return model(parts, { sway: 1 })
}

// ---- Wood --------------------------------------------------------------------

const wood = (seed: number) => barkOf(seed, 'deadWood', 4)

function driftwood(look: number, seed: number) {
  const paint = barkOf(seed, 'deadWood', 4)
  if (look === 0)
    return model([
      taper([-10, 1, 1.6], [10, -1, 1.4], 2.4, 1.6, paint),
      taper([4, -0.5, 2], [8, -5, 3], 1, 0.6, paint)
    ])
  return model([
    taper([-9, -2, 1.5], [9, 2, 1.5], 2, 1.4, paint),
    taper([-6, 4, 1.3], [7, -3, 3], 1.5, 1.1, paint)
  ])
}

function bough(seed: number) {
  const paint = wood(seed)
  return model([
    taper([-11, 0, 1.6], [10, 1, 1.6], 2.2, 1.2, paint),
    taper([-3, 0, 2], [1, -6, 3.5], 1.1, 0.6, paint),
    taper([3, 1, 2], [8, 6, 3], 1, 0.6, paint),
    taper([6, 1, 2], [11, -4, 4], 0.9, 0.5, paint)
  ])
}
function stump(seed: number) {
  const side = wood(seed)
  const ring: Painter = (x, y, z) =>
    z > 4.6
      ? Math.floor(Math.hypot(x, y) * 1.3) % 2
        ? mat('tan', 3)
        : mat('tan', 2)
      : side(x, y, z)
  const parts: Part[] = [
    {
      d: (x, y, z) => cylinder(x, y, z + 1, 4.2, 6, 0.5),
      paint: ring,
      lo: [-4.5, -4.5, -1],
      hi: [4.5, 4.5, 5]
    }
  ]
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    parts.push(
      taper(
        [Math.cos(a) * 3, Math.sin(a) * 3, 1.5],
        [Math.cos(a) * 7, Math.sin(a) * 6, 0],
        1.3,
        0.6,
        side
      )
    )
  }
  return model(parts)
}

function deadTree(seed: number, height: number, spread: number) {
  const rand = random(seed)
  const paint = barkOf(seed, 'deadWood', 4)
  const parts: Part[] = [...trunk([0, MID, height], 3.6, 1.6, paint, seed, 5)]
  const branch = (
    from: Vec3,
    yaw: number,
    rise: number,
    length: number,
    r: number,
    depth: number
  ) => {
    const to: Vec3 = [
      from[0] + Math.cos(yaw) * length * spread,
      from[1] + Math.sin(yaw) * length * spread * 0.45,
      from[2] + rise
    ]
    parts.push(
      ...limb(
        curve(from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, to[2] - rise * 0.15], to, 2),
        r,
        r * 0.6,
        paint
      )
    )
    if (depth > 0)
      for (const turn of [-0.55, 0.6])
        branch(to, yaw + turn + (rand() - 0.5) * 0.5, rise * 0.65, length * 0.6, r * 0.6, depth - 1)
  }
  branch([0, MID, height * 0.5], Math.PI + 0.3, height * 0.3, 15, 1.7, 2)
  branch([0, MID, height * 0.72], -0.2, height * 0.28, 14, 1.5, 2)
  branch([0, MID, height], -Math.PI / 2 + (rand() - 0.5), height * 0.22, 9, 1.2, 1)
  return model(parts, { sway: 1 })
}

function mangrove(seed: number, roots: number, lean: number) {
  const rand = random(seed)
  const paint = barkOf(seed, 'trunk', 5)
  const parts: Part[] = []
  // Stilt roots arch out from the trunk and down into the water.
  for (let i = 0; i < roots + 2; i++) {
    const a = (i / (roots + 2)) * Math.PI * 2 + rand() * 0.5
    const foot: Vec3 = [Math.cos(a) * (9 + rand() * 3), MID + Math.sin(a) * (5 + rand() * 2), -1]
    parts.push(
      ...limb(
        curve(foot, [foot[0] * 0.9, MID + (foot[1] - MID) * 0.9, 12], [lean * 0.3, MID, 13], 4),
        0.9,
        1.6,
        paint
      )
    )
  }
  parts.push(
    ...limb(
      curve([lean * 0.3, MID, 11], [lean * 0.5, MID, 20], [lean, MID, 28], 3),
      2.6,
      1.8,
      paint
    )
  )
  parts.push(
    ...crown(
      [lean, MID, 36],
      [22, 13, 10],
      22,
      5.5,
      foliage('pine', 6, seed + 3),
      plain(mat('pine', 2)),
      seed + 4
    )
  )
  return model(parts, { sway: 1 })
}

function bamboo(stalks: Array<[number, number, number]>, seed: number) {
  const rand = random(seed)
  const parts: Part[] = []
  const leaf = leaves(seed, 'palmLeaf', 4)
  for (const [x, height, lean] of stalks) {
    const dx = x - 22
    const dy = (rand() - 0.5) * 6
    const h = height * 0.85
    const node: Painter = (_x, _y, z) =>
      (z + dx * 3) % 9 < 0.9
        ? mat('bamboo', 1)
        : (z + dx) % 9 < 3
          ? mat('bamboo', 4)
          : mat('bamboo', 3)
    parts.push(taper([dx, dy, -1], [dx + lean, dy, h], 1.5, 1.1, node))
    for (let k = 0; k < 5; k++) {
      const t = 0.45 + k * 0.12
      const at: Vec3 = [dx + lean * t, dy, h * t]
      const yaw = (k % 2 ? 0 : Math.PI) + (rand() - 0.5) * 0.8
      parts.push(blade(at, yaw, -15 * deg, 7 + rand() * 2, 1.5, 0.45, leaf))
    }
  }
  return model(parts, { sway: 2 })
}

function banana(leafCount: number, height: number, bunch: boolean, seed: number) {
  const rand = random(seed)
  const parts: Part[] = [
    taper([0, MID, -1], [0, MID, height], 3.4, 2.2, mottled('bamboo', 2, seed, 2, 0.2))
  ]
  const leaf = foliage('frond', 5, seed)
  const top: Vec3 = [0, MID, height - 1]
  for (let i = 0; i < leafCount; i++) {
    const yaw = (i / leafCount) * Math.PI * 2 + rand() * 0.5
    // Each leaf rises from the crown, then arches over and hangs.
    const rise = 8 + rand() * 3
    const pitch = (35 + rand() * 15) * deg
    const bend: Vec3 = [
      Math.cos(yaw) * Math.cos(pitch) * rise,
      MID + Math.sin(yaw) * Math.cos(pitch) * rise,
      top[2] + Math.sin(pitch) * rise
    ]
    parts.push(blade(top, yaw, pitch, rise + 1, 4.2, 0.6, leaf))
    // Wind tears the broad blades into strips.
    parts.push(blade(bend, yaw, -(20 + rand() * 20) * deg, 12 + rand() * 5, 5.2, 0.6, leaf, 0, 3.4))
  }
  if (bunch) {
    const fruit = mottled('yellow', 2, seed, 1, 0.2)
    for (let i = 0; i < 5; i++)
      parts.push(ball([3.2, MID + 3, height - 5 - i * 1.6], 1.8 - i * 0.18, fruit))
  }
  return model(parts, { sway: 1 })
}

function monstera(leafs: Array<[number, number, number]>, seed: number) {
  const parts: Part[] = []
  const stem = plain(mat('jungle', 3))
  const leaf = leaves(seed, 'jungle', 4)
  for (const [angle, length, size] of leafs) {
    const a = angle * deg
    const reach = length * 0.55
    const tip: Vec3 = [Math.cos(a) * reach, Math.sin(a) * reach * 0.8, length * 0.45 + 2]
    parts.push(stick([0, 0, 0], tip, 0.55, stem))
    parts.push(blade(tip, a, -18 * deg, size * 2, size * 0.75, 0.6, leaf, 4))
  }
  return model(parts, { sway: 1 })
}

function cactus(look: number, seed: number) {
  const rib: Painter = (x, y, z) => {
    const ridge = Math.cos(Math.atan2(y, x) * 8)
    if (hash3(Math.round(x * 2), Math.round(y * 2), Math.round(z * 2), seed) < 0.05)
      return mat('white', 3)
    return ridge > 0.6 ? mat('cactus', 4) : ridge < -0.6 ? mat('cactus', 2) : mat('cactus', 3)
  }
  if (look === 0)
    return model([
      stick([0, 0, 0], [0, 0, 22], 3, rib),
      ...limb(
        [
          [0, 0, 9],
          [5.5, 0, 10],
          [6, 0, 17]
        ],
        2,
        2,
        rib
      ),
      ...limb(
        [
          [0, 0, 12],
          [-4.5, 0, 13],
          [-5, 0, 18]
        ],
        1.8,
        1.8,
        rib
      )
    ])
  if (look === 1)
    return model([
      egg([0, 0, 5], [5.5, 5, 6.5], rib),
      ball([0, 0, 11.3], 1.5, plain(mat('bloom', 2))),
      ball([1.6, 0.6, 11], 1, plain(mat('red', 3)))
    ])
  if (look === 2) {
    const pad = mottled('cactus', 3, seed, 1.5, 0.25)
    return model([
      egg([0, 0, 5], [4.2, 1.6, 5.2], pad),
      egg([-4, 0.5, 11], [3.4, 1.4, 4], pad),
      egg([3.6, -0.5, 12], [3.2, 1.4, 4.2], pad),
      ball([-5, 0.5, 15.5], 1.1, plain(mat('red', 3))),
      ball([4, -0.2, 16.8], 1.1, plain(mat('red', 3)))
    ])
  }
  return model([
    stick([-3, 1, 0], [-3, 1, 9], 2.2, rib),
    stick([2.5, -1, 0], [2.5, -1, 13], 2.4, rib),
    stick([4, 3, 0], [4, 3, 6], 1.8, rib)
  ])
}

// ---- Stone ---------------------------------------------------------------------

// Weathered stone: grain, the odd dark crack, lichen in patches, and weed at
// the waterline when wet.
function stone(seed: number, wet: boolean, step = 4): Painter {
  const dark = mat('rock', step - 2)
  const tones = [mat('rock', step - 1), mat('rock', step), mat('rock', step + 1)]
  const lichen = [mat('lichen', 0), mat('lichen', 1)]
  const weed = mat('moss', 3)
  return (x, y, z) => {
    if (wet && z < 1.4 + noise3(x, y, 0, seed) * 1.2) return weed
    const crack = Math.abs(noise3(x / 4, y / 4, z / 4, seed + 5) - 0.5)
    if (crack < 0.018) return dark
    const patch = noise3(x / 2.2, y / 2.2, z / 2.2, seed + 9)
    if (patch > 0.74 && z > 2) return lichen[patch > 0.82 ? 1 : 0]
    const grain =
      noise3(x / 1.1, y / 1.1, z / 1.1, seed) * 0.6 + noise3(x / 3, y / 3, z / 3, seed + 1) * 0.4
    return tones[grain < 0.42 ? 0 : grain > 0.6 ? 2 : 1]
  }
}

// A rock with broken faces: an ellipsoid cut by a few planes, then pitted.
function slab(c: Vec3, r: Vec3, paint: Painter, seed: number): Part {
  const rand = random(seed)
  const cuts: Array<[number, number, number, number]> = []
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2
    const up = i === 0 ? 0.95 : -0.1 + rand() * 0.8
    const around = Math.sqrt(1 - up * up)
    const n: Vec3 = [Math.cos(a) * around, Math.sin(a) * around, up]
    // How far the face sits out along its normal, as a share of the reach.
    const reach = Math.hypot(n[0] * r[0], n[1] * r[1], n[2] * r[2])
    cuts.push([n[0], n[1], n[2], reach * (0.72 + rand() * 0.18)])
  }
  return {
    d: (x, y, z) => {
      const px = x - c[0]
      const py = y - c[1]
      const pz = z - c[2]
      let d = ellipsoid(px, py, pz, r[0], r[1], r[2])
      for (const [nx, ny, nz, off] of cuts) d = Math.max(d, px * nx + py * ny + pz * nz - off)
      return d + (noise3(x / 1.8, y / 1.8, z / 1.8, seed) - 0.5) * 0.9
    },
    paint,
    lo: [c[0] - r[0] - 0.5, c[1] - r[1] - 0.5, c[2] - r[2] - 0.5],
    hi: [c[0] + r[0] + 0.5, c[1] + r[1] + 0.5, c[2] + r[2] + 0.5]
  }
}

function rockPile(seed: number, wet: boolean, pieces: Array<[Vec3, Vec3]>) {
  const paint = stone(seed, wet, 5)
  return model(
    pieces.map(([c, r], i) => slab(c, r, paint, seed + i * 13)),
    { bob: 0 }
  )
}

function boulderModel(seed: number, wet: boolean) {
  return rockPile(seed, wet, [
    [
      [0, 0, wet ? 2 : 3],
      [9, 7, 7]
    ],
    [
      [6, 3, 1.5],
      [4, 3, 3]
    ]
  ])
}
function stonesModel(seed: number, wet: boolean) {
  return rockPile(seed, wet, [
    [
      [-5, -1, 2],
      [4.5, 3.5, 3.5]
    ],
    [
      [3, 1, 2.5],
      [5, 4, 4]
    ],
    [
      [0, 5, 1],
      [2.5, 2, 2]
    ]
  ])
}
function spireModel(seed: number, wet: boolean) {
  const paint = stone(seed, wet, 4)
  return model([
    taper([0, 0, -1], [1.5, -1, 26], 6.5, 1.5, paint, { amp: 1.1, scale: 2.2, seed }),
    slab([5, 2, 1.5], [3.8, 3, 3.2], paint, seed + 1)
  ])
}

function rockModel(look: number, seed: number) {
  if (look === 0)
    return rockPile(seed, false, [
      [
        [0, 0, 3],
        [8, 6.5, 5.5]
      ],
      [
        [-5, 2, 1.5],
        [3.5, 2.8, 2.5]
      ]
    ])
  return rockPile(seed, false, [
    [
      [-2, 0, 3.5],
      [6.5, 5.5, 6]
    ],
    [
      [5, 1, 2],
      [4.5, 3.5, 3.5]
    ]
  ])
}
function reef(look: number, seed: number) {
  const paint = stone(seed, true, 4)
  const pieces: Array<[Vec3, Vec3]> =
    look === 0
      ? [
          [
            [0, 0, 0.5],
            [10, 6.5, 3]
          ],
          [
            [-6, 2, 0.5],
            [4, 3, 2.5]
          ]
        ]
      : [
          [
            [-4, 0, 0.5],
            [6, 5, 3.5]
          ],
          [
            [5, 1, 0.3],
            [5, 4, 2.5]
          ],
          [
            [1, -4, 0.2],
            [3, 2.5, 2]
          ]
        ]
  return model(pieces.map(([c, r], i) => slab(c, r, paint, seed + i * 7)))
}

const dressed = (seed: number) => {
  const face = mottled('relic', 5, seed, 2.5, 0.2)
  const moss = mat('moss', 4)
  return (x: number, y: number, z: number) =>
    z < 3 && noise3(x / 2, y / 2, z, seed + 3) > 0.5 ? moss : face(x, y, z)
}
function relic(look: number, seed: number) {
  const paint = dressed(seed)
  if (look === 0)
    return model([
      {
        d: (x, y, z) => {
          // A tapering shaft capped by a pyramid.
          const half = 3.6 - z * 0.07
          const shaft = Math.max(Math.max(Math.abs(x), Math.abs(y)) - half, Math.abs(z - 14) - 14)
          const cap = Math.max((Math.abs(x) + Math.abs(y) + (z - 28) * 0.9) * 0.7, 26 - z)
          return Math.min(shaft, cap)
        },
        paint,
        lo: [-4, -4, 0],
        hi: [4, 4, 33]
      },
      block([0, 0, 0.8], [5.5, 5.5, 1.2], paint, 0.4)
    ])
  if (look === 1) {
    const glyph: Painter = (x, y, z) =>
      y > 1.6 &&
      Math.abs(x) < 3.2 &&
      z > 5 &&
      z < 20 &&
      Math.floor(z / 2) % 2 &&
      hash3(Math.floor(x), Math.floor(z / 2), 0, seed) < 0.5
        ? mat('relic', 3)
        : paint(x, y, z)
    return model([block([0, 0, 11], [5, 2.2, 11], glyph, 0.8)])
  }
  if (look === 2)
    return model([
      {
        d: (x, y, z) =>
          Math.max(
            cylinder(x, y, z, 4.2, 16, 0.4),
            z - 12 - x * 0.35 - (noise3(x, y, z, seed) - 0.5) * 3
          ),
        paint: (x, y, z) =>
          Math.cos(Math.atan2(y, x) * 10) > 0.7 ? mat('relic', 4) : paint(x, y, z),
        lo: [-4.5, -4.5, 0],
        hi: [4.5, 4.5, 16]
      },
      block([8, 4, 2.2], [3, 2.6, 2.2], paint, 0.6, 0.4)
    ])
  return model([
    block([-6.5, 0, 9], [2.6, 2.6, 9], paint, 0.5),
    block([6.5, 0, 9], [2.6, 2.6, 9], paint, 0.5),
    block([0, 0, 20], [10.5, 3, 2.3], paint, 0.5)
  ])
}

// ---- Small things ------------------------------------------------------------

function mushrooms(cap: string, spotted: boolean, seed: number) {
  const rand = random(seed)
  const capColor = hexMat(cap)
  const spot = mat('white', 3)
  const stem = plain(mat('white', 2))
  const parts: Part[] = []
  for (const [x, y, size] of [
    [-3, 0, 1],
    [2.5, 1.5, 0.75],
    [0.5, -3, 0.6]
  ]) {
    const h = (3 + rand() * 2) * size + 1
    const r = 3.4 * size + 0.6
    parts.push(stick([x, y, 0], [x, y, h], 0.8 * size + 0.3, stem))
    parts.push({
      d: (px, py, pz) => Math.max(ellipsoid(px - x, py - y, pz - h, r, r, r * 0.6), h - 0.4 - pz),
      paint: (px, py, pz) =>
        spotted && noise3(px * 0.9, py * 0.9, pz * 0.9, seed) > 0.7 ? spot : capColor,
      lo: [x - r, y - r, h - 1],
      hi: [x + r, y + r, h + r * 0.6]
    })
  }
  return model(parts)
}

function shellModel(look: number) {
  if (look === 0)
    return model([
      taper([-2.4, 0, 1], [2.6, 0.5, 0.7], 1.9, 0.5, (x) =>
        Math.floor(x * 1.2) % 2 ? mat('shell', 1) : mat('white', 3)
      )
    ])
  if (look === 1)
    return model([
      egg([0, 0, 0.6], [2.8, 2.3, 1], (x, y) =>
        Math.cos(Math.atan2(y + 2, x) * 12) > 0.3 ? mat('shell', 2) : mat('shell', 1)
      )
    ])
  if (look === 2) {
    const arm = plain(mat('star', 1))
    return model(
      [0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        return taper([0, 0, 0.6], [Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0.4], 1.1, 0.5, arm)
      })
    )
  }
  return model([
    egg([-1.5, 0, 0.5], [1.8, 1.5, 0.8], plain(mat('white', 3))),
    egg([2, 1, 0.5], [1.5, 1.3, 0.7], plain(mat('bloom', 2))),
    ball([0.5, -2, 0.4], 0.8, plain(mat('shellSand', 1)))
  ])
}

// A flame drawn as a sign: a teardrop with a hotter teardrop inside it and a
// white-hot heart, each a little nearer the viewer so it shows in front.
function fireParts(at: Vec3, size: number, lean = 0): Part[] {
  const layer = (step: number, scale: number, forward: number): Part => {
    const s = size * scale
    // Forward and up by the same amount: the same place on screen, but nearer.
    const base: Vec3 = [at[0], at[1] + forward, at[2] + forward + s * 0.95]
    const tip: Vec3 = [base[0] + lean * scale, base[1], base[2] + s * 1.9]
    return taper(base, tip, s, s * 0.08, plain(mat('flame', step, 'flame', 'ramp')))
  }
  return [
    layer(1, 1, 0),
    layer(2, 0.72, size * 0.5),
    layer(3, 0.45, size * 0.9),
    layer(4, 0.2, size * 1.15)
  ]
}

// Two embers that drift up and wink out.
function embers(at: Vec3, seed: number): Part[] {
  const rand = random(seed)
  const glow = plain(mat('flame', 3, 'firefly', 'none'))
  return [0, 1].map(() =>
    ball([at[0] + (rand() - 0.5) * 7, at[1] + 1, at[2] + 4 + rand() * 4], 0.6, glow)
  )
}

// A chunky log, rounded at the ends, its cut faces showing rings.
function cuteLog(a: Vec3, b: Vec3, r: number): Part {
  const bark0 = toon('cuteLog', 2)
  const bark1 = toon('cuteLog', 3)
  const ring = toon('cuteRing', 1)
  const core = toon('cuteRing', 2)
  const ax = b[0] - a[0]
  const ay = b[1] - a[1]
  const az = b[2] - a[2]
  const l2 = ax * ax + ay * ay + az * az
  return {
    ...stick(a, b, r, plain(bark0)),
    paint: (x, y, z) => {
      const t = ((x - a[0]) * ax + (y - a[1]) * ay + (z - a[2]) * az) / l2
      if (t < 0 || t > 1) {
        const end = t < 0 ? a : b
        return Math.hypot(x - end[0], y - end[1], z - end[2]) < r * 0.45 ? ring : core
      }
      return Math.floor(t * 6) % 2 ? bark0 : bark1
    }
  }
}

// A plump stone with a shine on top.
function cuteStone(c: Vec3, r: Vec3, tone = 2): Part {
  const body = toon('cuteStone', tone)
  const shine = toon('cuteStone', tone + 2)
  return egg(c, r, (x, y, z) =>
    z > c[2] + r[2] * 0.55 && x < c[0] && y < c[1] + r[1] * 0.2 ? shine : body
  )
}

function torch(look: number, seed: number) {
  const C = -4
  if (look === 0) {
    const wrap = toon('cuteRing', 1)
    return model(
      [
        cuteLog([0, C, -1], [0, C, 13], 1.5),
        egg([0, C, 13.5], [2.6, 2.6, 2], (_x, _y, z) =>
          Math.floor(z) % 2 ? wrap : toon('tan', 3)
        ),
        ...fireParts([0, C, 14], 3),
        ...embers([0, C, 22], seed)
      ],
      { glow: { height: 22 } }
    )
  }
  if (look === 1) {
    // A carved post: stacked blocks, a bowl, and the flame above.
    const parts: Part[] = []
    for (let k = 0; k < 3; k++)
      parts.push(
        block(
          [0, C, 2.3 + k * 4.4],
          [3 - k * 0.3, 2.6 - k * 0.3, 2],
          plain(toon(k % 2 ? 'cuteLog' : 'cuteRing', k % 2 ? 2 : 1)),
          1
        )
      )
    parts.push(
      egg([0, C, 15], [4, 3.4, 1.8], plain(toon('cuteLog', 2))),
      ...fireParts([0, C, 15.5], 3.4),
      ...embers([0, C, 24], seed)
    )
    return model(parts, { glow: { height: 24 } })
  }
  if (look === 2) {
    const iron = plain(toon('steel', 3))
    return model(
      [
        stick([-3.5, C + 1.5, 0], [0, C, 8], 0.8, iron),
        stick([3.5, C + 1.5, 0], [0, C, 8], 0.8, iron),
        stick([0, C - 3.5, 0], [0, C, 8], 0.8, iron),
        {
          d: (x, y, z) => Math.max(ellipsoid(x, y - C, z - 10, 5, 4.4, 2.8), z - 10.8),
          paint: (_x, _y, z) => (z > 10.2 ? toon('steel', 4) : toon('steel', 3)),
          lo: [-5.5, C - 5, 7],
          hi: [5.5, C + 5, 11]
        },
        ...fireParts([0, C, 10], 3.6),
        ...embers([0, C, 19], seed)
      ],
      { glow: { height: 19 } }
    )
  }
  return model(
    [
      cuteStone([0, C, 2.6], [5, 4.2, 3], 1),
      cuteStone([0.4, C, 7.6], [3.8, 3.3, 2.4], 2),
      cuteStone([0, C, 11.4], [2.8, 2.5, 2], 1),
      ...fireParts([0, C, 13], 2.6),
      ...embers([0, C, 20], seed)
    ],
    { glow: { height: 20 } }
  )
}

function campfire(look: number, seed: number) {
  const C = -5
  const parts: Part[] = []
  const ring = (radius: number) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2
      // Every other stone a shade darker, so each reads on its own.
      parts.push(
        cuteStone(
          [Math.cos(a) * radius, C + Math.sin(a) * radius * 0.62, 1.2],
          [2.2, 1.8, 1.8],
          1 + (i % 2)
        )
      )
    }
  }
  // Two logs crossed under the flame.
  const crossed = () => {
    parts.push(cuteLog([-4.5, C - 1.5, 1.4], [4.5, C + 1.5, 1.4], 1.4))
    parts.push(cuteLog([-4, C + 2, 1.6], [4, C - 2, 2.6], 1.4))
  }
  if (look === 0 || look === 1) {
    ring(6.5)
    crossed()
    const size = look ? 3.6 : 3.1
    parts.push(
      ...fireParts([0, C + 0.5, 2], size),
      // Two little tongues either side of the big one.
      ...fireParts([-4.2, C + 1, 1.4], size * 0.55, -1.6),
      ...fireParts([4.2, C + 1, 1.4], size * 0.55, 1.6),
      ...embers([0, C, 12], seed)
    )
    if (look === 1) {
      parts.push(cuteLog([-14, C + 3, 1.8], [-10, C - 5, 1.8], 2))
      parts.push(cuteLog([10, C - 5, 1.8], [14, C + 3, 1.8], 2))
    }
    return model(parts, { glow: { height: look ? 13 : 11 } })
  }
  if (look === 2) {
    // Logs stacked like a little cabin, the flame on top.
    for (let k = 0; k < 3; k++) {
      const z = 1.3 + k * 2.3
      for (const side of [-1, 1])
        parts.push(
          k % 2 === 0
            ? cuteLog([-5, C + side * 3.4, z], [5, C + side * 3.4, z], 1.25)
            : cuteLog([side * 3.4, C - 5, z], [side * 3.4, C + 5, z], 1.25)
        )
    }
    parts.push(...fireParts([0, C, 7], 3.3), ...embers([0, C, 18], seed))
    return model(parts, { glow: { height: 16 } })
  }
  ring(6)
  parts.push(...fireParts([0, C + 0.5, 1.2], 2.7))
  if (look === 3) {
    // A round pot over the fire, steam curling from its lid.
    const leg = plain(toon('cuteLog', 2))
    parts.push(
      stick([-6.5, C + 2, 0], [0, C, 16], 0.7, leg),
      stick([6.5, C + 2, 0], [0, C, 16], 0.7, leg),
      stick([0, C - 5, 0], [0, C, 16], 0.7, leg),
      egg([0, C, 9.5], [4.4, 4, 3.4], (_x, _y, z) =>
        z > 11.2 ? toon('steel', 4) : toon('steel', 3)
      ),
      ball([0, C, 13.2], 0.9, plain(toon('cuteStone', 3)))
    )
    return model(parts, { glow: { height: 8 } })
  }
  // Fish on skewers, leaning in to cook.
  const stickPaint = plain(toon('cuteLog', 3))
  for (const a of [0.5, 2.6, 4.4]) {
    const foot: Vec3 = [Math.cos(a) * 8, C + Math.sin(a) * 5, 0]
    const top: Vec3 = [Math.cos(a) * 3.5, C + Math.sin(a) * 2.2, 10]
    parts.push(stick(foot, top, 0.55, stickPaint))
    parts.push(
      egg([top[0], top[1], top[2] - 1.6], [1.4, 1.2, 2.8], (_x, _y, z) =>
        z > top[2] - 0.2
          ? toon('cuteStone', 3)
          : z < top[2] - 3.4
            ? toon('cuteRing', 0)
            : toon('blue', 3)
      )
    )
  }
  parts.push(...embers([0, C, 11], seed))
  return model(parts, { glow: { height: 8 } })
}

function fireflies(seed: number) {
  const rand = random(seed)
  const glow = plain(mat('firefly', 2, 'firefly', 'none'))
  const parts: Part[] = []
  for (let i = 0; i < 6; i++)
    parts.push(ball([(rand() - 0.5) * 20, (rand() - 0.5) * 12, 4 + rand() * 12], 0.7, glow))
  return model(parts, { glow: { height: 10, soft: true } })
}

function afloat(base: Model) {
  return { ...base, bob: 1, sway: 0 }
}

function buoy(body: string, band: string) {
  const main = hexMat(body)
  const stripe = hexMat(band)
  return model(
    [
      egg([0, 0, 0.6], [4.4, 3.6, 1], plain(mat('steel', 2))),
      egg([0, 0, 3.6], [3.3, 3.1, 3.6], (_x, _y, z) => (z > 3 && z < 4.8 ? stripe : main)),
      stick([0, 0, 6.5], [0, 0, 10.5], 0.5, plain(mat('steel', 3))),
      ball([0, 0, 11], 1, plain(mat('fire', 2)))
    ],
    { bob: 1 }
  )
}

// ---- Catalogue -----------------------------------------------------------------

const makers: Record<DecorKind, Array<() => Model>> = {
  tree: [
    () => acacia(-4, false, 470),
    () => acacia(3, true, 501),
    () => broadleaf(520),
    () => sapling(530),
    () => birch(540)
  ],
  palm: [
    () => palm(66, 6, -1, 10, 610),
    () => palm(76, -8, 0, 11, 620),
    () => palm(56, 10, 1, 9, 630),
    () => palm(82, -3, -2, 11, 640),
    () => palm(62, -10, 1, 10, 650)
  ],
  bush: [
    () => thicket(false, 700),
    () => thicket(true, 710),
    () => shrub(false, 720),
    () => shrub(true, 730),
    () => fern(740),
    () => tallGrass(750)
  ],
  rock: [
    () => rockModel(0, 800),
    () => rockModel(1, 810),
    () => boulderModel(661, false),
    () => stonesModel(671, false),
    () => spireModel(685, false)
  ],
  flowers: [0, 1, 2, 3, 4, 5].map((look) => () => flowers(look, 900 + look * 7)),
  driftwood: [
    () => driftwood(0, 1000),
    () => driftwood(1, 1010),
    () => bough(1020),
    () => stump(1030)
  ],
  torch: [0, 1, 2, 3].map((look) => () => torch(look, 1100 + look)),
  searock: [
    () => reef(0, 1200),
    () => reef(1, 1210),
    () => boulderModel(5, true),
    () => stonesModel(6, true),
    () => spireModel(7, true)
  ],
  bamboo: [
    () =>
      bamboo(
        [
          [14, 70, -3],
          [22, 78, 1],
          [30, 66, 4]
        ],
        1300
      ),
    () =>
      bamboo(
        [
          [10, 60, -4],
          [17, 76, -1],
          [24, 80, 1],
          [31, 70, 3],
          [36, 56, 5]
        ],
        1320
      ),
    () =>
      bamboo(
        [
          [18, 46, -2],
          [25, 52, 2]
        ],
        1340
      ),
    () =>
      bamboo(
        [
          [12, 74, -5],
          [20, 80, -2],
          [27, 72, 2],
          [33, 62, 6]
        ],
        1360
      )
  ],
  banana: [
    () => banana(6, 16, true, 1370),
    () => banana(5, 13, false, 1380),
    () => banana(7, 19, true, 1390),
    () => banana(4, 11, false, 1395)
  ],
  deadtree: [
    () => deadTree(1, 26, 0.75),
    () => deadTree(2, 22, 0.9),
    () => deadTree(3, 28, 0.6),
    () => deadTree(4, 16, 1)
  ],
  mangrove: [
    () => mangrove(1, 6, 0),
    () => mangrove(2, 5, 3),
    () => mangrove(3, 7, -3),
    () => mangrove(4, 4, 1)
  ],
  monstera: [
    () =>
      monstera(
        [
          [-155, 13, 7],
          [-25, 13, 7],
          [-115, 15, 8],
          [-62, 16, 8]
        ],
        1400
      ),
    () =>
      monstera(
        [
          [-165, 14, 7],
          [-90, 17, 7.5],
          [-20, 14, 7.5],
          [-128, 11, 7.5],
          [-52, 11, 7.5]
        ],
        1410
      ),
    () =>
      monstera(
        [
          [-140, 10, 6.5],
          [-40, 10, 6.5],
          [-90, 13, 7]
        ],
        1420
      ),
    () =>
      monstera(
        [
          [-172, 14, 6.5],
          [-8, 14, 6.5],
          [-135, 16, 7.5],
          [-45, 16, 7.5],
          [-90, 10, 7.5]
        ],
        1430
      )
  ],
  cactus: [0, 1, 2, 3].map((look) => () => cactus(look, 1450 + look)),
  relic: [0, 1, 2, 3].map((look) => () => relic(look, 1470 + look)),
  mushroom: [
    () => mushrooms('#f0604d', true, 1500),
    () => mushrooms('#c99a6a', false, 1501),
    () => mushrooms('#b79ae8', true, 1502),
    () => mushrooms('#ffc04d', false, 1503)
  ],
  shell: [0, 1, 2, 3].map((look) => () => shellModel(look)),
  campfire: [0, 1, 2, 3, 4].map((look) => () => campfire(look, 1560 + look)),
  fireflies: [1600, 1610, 1620, 1630].map((seed) => () => fireflies(seed)),
  flotsam: [
    () => afloat(driftwood(0, 31)),
    () => afloat(driftwood(1, 32)),
    () => afloat(bough(33)),
    () => afloat(stump(34))
  ],
  buoy: [() => buoy('#e5483f', '#fbf6ea'), () => buoy('#f2c230', '#3d424b')]
}

const built = new Map<string, Model>()
export function decorModel(kind: DecorKind, look: number): Model {
  const key = `${kind}:${look}`
  let found = built.get(key)
  if (!found) {
    const make = makers[kind][Math.max(0, Math.min(decorLooks[kind] - 1, look))]
    found = make()
    built.set(key, found)
  }
  return found
}

export function modelLookCount(kind: DecorKind) {
  return makers[kind].length
}

// Distance from a model's surface, and the part nearest, at a point.
export function modelDistance(m: Model, x: number, y: number, z: number) {
  let best = Number.POSITIVE_INFINITY
  for (const part of m.parts) {
    const ox = Math.max(part.lo[0] - x, 0, x - part.hi[0])
    const oy = Math.max(part.lo[1] - y, 0, y - part.hi[1])
    const oz = Math.max(part.lo[2] - z, 0, z - part.hi[2])
    // Bounds are a lower bound on the distance: skip parts that cannot win.
    if (ox * ox + oy * oy + oz * oz >= best * best && best > 0) continue
    const d = part.d(x, y, z)
    if (d < best) best = d
  }
  return best
}

export function nearestPart(m: Model, x: number, y: number, z: number) {
  let best = Number.POSITIVE_INFINITY
  let found = m.parts[0]
  for (const part of m.parts) {
    const ox = Math.max(part.lo[0] - x, 0, x - part.hi[0])
    const oy = Math.max(part.lo[1] - y, 0, y - part.hi[1])
    const oz = Math.max(part.lo[2] - z, 0, z - part.hi[2])
    if (ox * ox + oy * oy + oz * oz > best * best && best > 0) continue
    const d = part.d(x, y, z)
    if (d < best) {
      best = d
      found = part
    }
  }
  return found
}
