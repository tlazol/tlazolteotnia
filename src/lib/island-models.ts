// Every decoration as a shape made of distance functions. A model sits with
// its foot at the origin: x east, y south (toward the viewer), z up, in art
// pixels. Each part knows its distance, its bounds and how it is colored.

import { nearestSlot, type RampName, rampSlot } from './island-palette'
import {
  box,
  capsule,
  cylinder,
  ellipsoid,
  hash3,
  noise3,
  roundCone,
  smin,
  sphere,
  type Vec3
} from './island-sdf'
import { type DecorKind, decorLooks } from './island-world'

export type Glow = 'fire' | 'firefly'
export type Material = { slot: number; glow?: Glow; outline?: boolean }
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
function mat(ramp: RampName, step: number, glow?: Glow, outline = true): Material {
  const key = `${ramp}:${step}:${glow ?? ''}:${outline}`
  let found = materials.get(key)
  if (!found) {
    found = { slot: rampSlot(ramp, step), glow, outline }
    materials.set(key, found)
  }
  return found
}
function hexMat(value: string): Material {
  const n = Number.parseInt(value.slice(1), 16)
  const key = `hex:${value}`
  let found = materials.get(key)
  if (!found) {
    found = { slot: nearestSlot(n >> 16, (n >> 8) & 255, n & 255), outline: true }
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
function fire(): Painter {
  const hot = mat('fire', 3, 'fire', false)
  const mid = mat('fire', 2, 'fire', false)
  const edge = mat('fire', 1, 'fire', false)
  return (x, y, z) => {
    const r = Math.hypot(x, y)
    return r < 0.9 && z > -0.5 ? hot : r < 1.7 ? mid : edge
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
  holes = 0
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
      return d
    },
    paint,
    lo: [center[0] - reach, center[1] - reach, center[2] - reach],
    hi: [center[0] + reach, center[1] + reach, center[2] + reach]
  }
}
// A part with its surface roughened, its bounds grown to match.
function rough(part: Part, bump: Bump): Part {
  const [lo, hi] = grow(part.lo, part.hi, bump.amp)
  return { ...part, d: bumped(part.d, bump), lo, hi }
}
// Several parts drawn as one, joined by fillets of size k.
function merge(parts: Part[], k: number, paint = parts[0].paint): Part {
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
      let d = parts[0].d(x, y, z)
      for (let i = 1; i < parts.length; i++) d = smin(d, parts[i].d(x, y, z), k)
      return d
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
  return parts
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

// ---- Trees ------------------------------------------------------------------

const bark = (seed: number) => mottled('bark', 3, seed, 1.6, 0.18)
const leaves = (seed: number, ramp: RampName = 'leaf', step = 4) =>
  mottled(ramp, step, seed, 2.2, 0.17)

function acacia(lean: number, flip: boolean, seed: number) {
  const s = flip ? -1 : 1
  const top: Vec3 = [lean * s * 0.6, 0, 19]
  const paint = bark(seed)
  const canopy = leaves(seed + 1)
  return model(
    [
      taper([0, 0, -1], top, 2.6, 1.5, paint),
      taper(top, [(lean - 9) * s, -1, 28], 1.4, 0.8, paint),
      taper(top, [(lean + 8) * s, 1, 29], 1.4, 0.8, paint),
      taper(top, [lean * s * 0.8, -2, 31], 1.2, 0.7, paint),
      merge(
        [
          egg([lean * s, 0, 31], [22, 12, 4.2], canopy),
          egg([(lean - 6) * s, -2, 34], [12, 8, 3.4], canopy),
          egg([(lean + 9) * s, 2, 33], [9, 7, 3], canopy)
        ],
        3,
        canopy
      )
    ].map((part, i) => (i === 4 ? rough(part, { amp: 1.5, scale: 2.6, seed }) : part)),
    { sway: 1 }
  )
}

function broadleaf(seed: number) {
  const canopy = leaves(seed + 1)
  const crown = merge(
    [
      ball([0, 0, 27], 11, canopy),
      ball([-8, 1, 22], 7.5, canopy),
      ball([8, 0, 23], 8, canopy),
      ball([2, -3, 33], 7.5, canopy),
      ball([-3, 4, 22], 7, canopy)
    ],
    4,
    canopy
  )
  return model(
    [
      taper([0, 0, -1], [0, 0, 17], 2.8, 1.8, bark(seed)),
      taper([0, 0, 14], [-6, 1, 21], 1.2, 0.8, bark(seed)),
      rough(crown, { amp: 1.7, scale: 2.4, seed })
    ],
    { sway: 1 }
  )
}

function sapling(seed: number) {
  return model(
    [
      taper([0, 0, -1], [0.5, 0, 12], 1.3, 0.9, bark(seed)),
      egg([0.5, 0, 15], [6, 5.5, 5.5], leaves(seed + 1, 'leaf', 5), {
        amp: 1,
        scale: 2,
        seed
      })
    ],
    { sway: 1 }
  )
}

function tiered(seed: number) {
  const canopy = leaves(seed + 1, 'jungle', 3)
  const tiers: Part[] = [
    [16, 14, 3.4],
    [26, 11.5, 3],
    [35, 8.5, 2.8],
    [42, 5, 2.6]
  ].map(([z, r, h]) =>
    egg([0, 0, z], [r, r * 0.75, h], canopy, { amp: 1.2, scale: 2.2, seed: seed + z })
  )
  return model([taper([0, 0, -1], [0, 0, 42], 2.2, 1, bark(seed)), ...tiers], { sway: 1 })
}

function palm(height: number, leanX: number, leanY: number, fronds: number, seed: number) {
  const rand = random(seed)
  const top: Vec3 = [leanX, leanY, height]
  const trunkPaint: Painter = (_x, _y, z) =>
    Math.floor(z / 2.4) % 2 ? mat('palmBark', 3) : mat('palmBark', 2)
  const trunk = limb(
    curve([0, 0, -1], [leanX * 0.05, leanY * 0.05, height * 0.55], top, 6),
    2.2,
    1.5,
    trunkPaint
  )
  const frondPaint = leaves(seed, 'palmLeaf', 3)
  const parts: Part[] = [...trunk]
  for (let i = 0; i < fronds; i++) {
    const angle = (i / fronds) * Math.PI * 2 + rand() * 0.5
    const length = 15 + rand() * 5
    const lift = 2.5 + rand() * 2
    const droop = 9 + rand() * 4
    const points: Vec3[] = []
    for (let t = 0; t <= 1.001; t += 0.25)
      points.push([
        top[0] + Math.cos(angle) * length * t,
        top[1] + Math.sin(angle) * length * t * 0.85,
        top[2] + lift * t * 2 - droop * t * t
      ])
    parts.push(...limb(points, 2.3, 0.7, frondPaint))
  }
  const nut = plain(mat('bark', 2))
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.6
    parts.push(
      ball([top[0] + Math.cos(a) * 1.6, top[1] + Math.sin(a) * 1.6 + 1, top[2] - 1.8], 1.4, nut)
    )
  }
  return model(parts, { sway: 2 })
}

// ---- Undergrowth -------------------------------------------------------------

function thicket(dark: boolean, seed: number) {
  const canopy = dark ? leaves(seed, 'jungle', 3) : leaves(seed, 'leaf', 4)
  const body = merge(
    [
      ball([0, 0, 6], 7, canopy),
      ball([-6.5, 1, 4.5], 5.5, canopy),
      ball([6.5, 0, 4.5], 5.5, canopy),
      ball([1, -3, 9.5], 5, canopy)
    ],
    3,
    canopy
  )
  const parts: Part[] = [rough(body, { amp: 1.3, scale: 2, seed })]
  const berry = plain(mat('red', 3))
  const rand = random(seed + 7)
  if (dark)
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI - Math.PI * 0.1
      parts.push(ball([Math.cos(a) * 7, Math.sin(a) * 4 + 3, 4 + rand() * 6], 0.9, berry))
    }
  return model(parts, { sway: 1 })
}

function shrub(flowering: boolean, seed: number) {
  const parts: Part[] = [
    egg([0, 0, 5.5], [8, 6.5, 6], leaves(seed, 'palmLeaf', 3), { amp: 1.2, scale: 1.8, seed })
  ]
  if (flowering) {
    const rand = random(seed)
    const petal = plain(mat('bloom', 2))
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2
      const up = 0.3 + rand() * 0.7
      parts.push(
        ball(
          [Math.cos(a) * 7 * (1 - up * 0.5), Math.sin(a) * 5.5 * (1 - up * 0.5), 5.5 + up * 5.5],
          1,
          petal
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

const wood = (seed: number) => mottled('deadWood', 3, seed, 1.4, 0.2)

function driftwood(look: number, seed: number) {
  const paint = wood(seed)
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
  const paint = mottled('deadWood', 3, seed, 1.5, 0.2)
  const parts: Part[] = [taper([0, 0, -1], [0, 0, height], 2.6, 1.3, paint)]
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
      from[1] + Math.sin(yaw) * length * spread * 0.6,
      from[2] + rise
    ]
    parts.push(taper(from, to, r, r * 0.6, paint))
    if (depth > 0)
      for (const turn of [-0.6, 0.6])
        branch(to, yaw + turn + (rand() - 0.5) * 0.5, rise * 0.6, length * 0.6, r * 0.6, depth - 1)
  }
  branch([0, 0, height * 0.55], Math.PI + 0.3, height * 0.35, 10, 1.3, 1)
  branch([0, 0, height * 0.75], -0.2, height * 0.3, 9, 1.2, 1)
  branch([0, 0, height], -Math.PI / 2 + (rand() - 0.5), height * 0.25, 6, 1, 1)
  return model(parts, { sway: 1 })
}

function mangrove(seed: number, roots: number, lean: number) {
  const rand = random(seed)
  const paint = bark(seed)
  const parts: Part[] = []
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + rand() * 0.6
    const foot: Vec3 = [Math.cos(a) * (7 + rand() * 2), Math.sin(a) * (5 + rand() * 1.5), -1]
    parts.push(
      ...limb(
        curve(foot, [foot[0] * 0.8, foot[1] * 0.8, 8], [lean * 0.3, 0, 9], 4),
        0.9,
        1.4,
        paint
      )
    )
  }
  parts.push(taper([lean * 0.3, 0, 8], [lean, 0, 19], 2, 1.4, paint))
  const canopy = leaves(seed + 3, 'jungle', 3)
  const crown = merge(
    [
      ball([lean, 0, 23], 8, canopy),
      ball([lean - 7, 1, 21], 6, canopy),
      ball([lean + 7, -1, 21], 6, canopy),
      ball([lean + 1, -3, 27], 5.5, canopy)
    ],
    3,
    canopy
  )
  parts.push(rough(crown, { amp: 1.4, scale: 2.2, seed }))
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
    taper([0, 0, -1], [0, 0, height], 2.8, 1.8, mottled('bamboo', 2, seed, 2, 0.2))
  ]
  const leaf = leaves(seed, 'leaf', 4)
  for (let i = 0; i < leafCount; i++) {
    const yaw = (i / leafCount) * Math.PI * 2 + rand() * 0.5
    // Each leaf rises from the crown, then arches over and hangs.
    const rise = 6 + rand() * 2
    const pitch = (35 + rand() * 15) * deg
    const bend: Vec3 = [
      Math.cos(yaw) * Math.cos(pitch) * rise,
      Math.sin(yaw) * Math.cos(pitch) * rise,
      height - 1 + Math.sin(pitch) * rise
    ]
    parts.push(blade([0, 0, height - 1], yaw, pitch, rise + 1, 3.4, 0.7, leaf))
    parts.push(blade(bend, yaw, -(20 + rand() * 20) * deg, 9 + rand() * 4, 4.2, 0.7, leaf))
  }
  if (bunch) {
    const fruit = plain(mat('yellow', 3))
    for (let i = 0; i < 4; i++)
      parts.push(ball([2.6, 2.4, height - 4 - i * 1.4], 1.4 - i * 0.15, fruit))
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

function stone(seed: number, wet: boolean, step = 4): Painter {
  const rock = mottled('rock', step, seed, 2.2, 0.18)
  const lichen = mat('lichen', 1)
  const weed = mat('moss', 3)
  return (x, y, z) => {
    if (wet && z < 1.4) return weed
    if (noise3(x / 2, y / 2, z / 2, seed + 9) > 0.78) return lichen
    return rock(x, y, z)
  }
}

function rockPile(seed: number, wet: boolean, pieces: Array<[Vec3, Vec3]>) {
  const paint = stone(seed, wet)
  return model(
    pieces.map(([c, r], i) => egg(c, r, paint, { amp: 0.9, scale: 3, seed: seed + i })),
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
  const paint = stone(seed, wet, 3)
  return model([
    taper([0, 0, -1], [1.5, -1, 26], 6.5, 1.5, paint, { amp: 0.9, scale: 2.5, seed }),
    egg([5, 2, 1], [3.5, 3, 3], paint, { amp: 0.6, seed: seed + 1 })
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
  const paint = stone(seed, true, 3)
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
  return model(
    pieces.map(([c, r], i) => egg(c, r, paint, { amp: 0.8, scale: 2.5, seed: seed + i }))
  )
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

function fireParts(at: Vec3, size: number): Part[] {
  return [egg([at[0], at[1], at[2] + size * 1.2], [size * 0.8, size * 0.8, size * 1.6], fire())]
}

function torch(look: number, seed: number) {
  if (look === 0)
    return model(
      [
        taper([0, 0, -1], [0, 0, 18], 1.1, 0.9, bark(seed)),
        egg([0, 0, 18.5], [1.6, 1.6, 1.3], plain(mat('rust', 1))),
        ...fireParts([0, 0, 19], 1.6)
      ],
      { glow: { height: 22 } }
    )
  if (look === 1) {
    const carved: Painter = (_x, _y, z) => (Math.floor(z / 3) % 2 ? mat('tan', 2) : mat('bark', 3))
    return model(
      [
        taper([0, 0, -1], [0, 0, 19], 1.8, 1.4, carved),
        egg([0, 0, 20.5], [3, 3, 1.6], plain(mat('bark', 2))),
        ...fireParts([0, 0, 21], 2.2)
      ],
      { glow: { height: 25 } }
    )
  }
  if (look === 2) {
    const iron = plain(mat('steel', 2))
    return model(
      [
        stick([-3.5, 1.5, 0], [0, 0, 9], 0.6, iron),
        stick([3.5, 1.5, 0], [0, 0, 9], 0.6, iron),
        stick([0, -3.5, 0], [0, 0, 9], 0.6, iron),
        {
          d: (x, y, z) => Math.max(ellipsoid(x, y, z - 10.5, 4.6, 4.6, 2.4), z - 11.2),
          paint: plain(mat('steel', 3)),
          lo: [-5, -5, 8],
          hi: [5, 5, 12]
        },
        ...fireParts([0, 0, 11], 2.6)
      ],
      { glow: { height: 15 } }
    )
  }
  const paint = stone(seed, false)
  return model(
    [
      egg([0, 0, 2.5], [4.6, 4, 3], paint),
      egg([0.5, 0, 7.5], [3.6, 3.2, 2.6], paint),
      egg([0, 0, 11.5], [2.6, 2.4, 2], paint),
      ...fireParts([0, 0, 13], 1.8)
    ],
    { glow: { height: 17 } }
  )
}

function campfire(look: number, seed: number) {
  const logs = wood(seed)
  const parts: Part[] = []
  const ring = (radius: number) => {
    const paint = stone(seed, false)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      parts.push(
        egg([Math.cos(a) * radius, Math.sin(a) * radius * 0.75, 0.8], [1.9, 1.6, 1.6], paint)
      )
    }
  }
  const teepee = (r: number, h: number) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      parts.push(taper([Math.cos(a) * r, Math.sin(a) * r * 0.8, 0.5], [0, 0, h], 1, 0.6, logs))
    }
  }
  if (look === 0 || look === 1) {
    ring(6)
    teepee(4, 5)
    parts.push(...fireParts([0, 0, 1.5], look ? 2.4 : 2))
    if (look === 1) {
      parts.push(taper([-11, 4, 1.5], [-7, -3, 1.5], 1.8, 1.8, logs))
      parts.push(taper([8, -3, 1.5], [11, 4, 1.5], 1.8, 1.8, logs))
    }
    return model(parts, { glow: { height: look ? 8 : 7 } })
  }
  if (look === 2) {
    for (let k = 0; k < 4; k++) {
      const z = 0.9 + k * 1.6
      const along = k % 2 === 0
      for (const side of [-1, 1])
        parts.push(
          along
            ? taper([-5, side * 3.6, z], [5, side * 3.6, z], 1, 1, logs)
            : taper([side * 3.6, -5, z], [side * 3.6, 5, z], 1, 1, logs)
        )
    }
    parts.push(...fireParts([0, 0, 5], 2.4))
    return model(parts, { glow: { height: 11 } })
  }
  ring(5.5)
  parts.push(...fireParts([0, 0, 1], 1.8))
  if (look === 3) {
    const iron = plain(mat('steel', 2))
    parts.push(stick([-5, 2, 0], [0, 0, 13], 0.5, iron))
    parts.push(stick([5, 2, 0], [0, 0, 13], 0.5, iron))
    parts.push(stick([0, -5, 0], [0, 0, 13], 0.5, iron))
    parts.push({
      d: (x, y, z) => Math.max(ellipsoid(x, y, z - 8, 3.4, 3.4, 3), z - 9.6),
      paint: plain(mat('steel', 3)),
      lo: [-4, -4, 4],
      hi: [4, 4, 10]
    })
    return model(parts, { glow: { height: 6 } })
  }
  const fish = plain(mat('puddle', 3))
  for (const a of [0.5, 2.6, 4.4]) {
    const foot: Vec3 = [Math.cos(a) * 7, Math.sin(a) * 5, 0]
    const top: Vec3 = [Math.cos(a) * 3.5, Math.sin(a) * 2.5, 8]
    parts.push(stick(foot, top, 0.5, plain(mat('bark', 3))))
    parts.push(egg([top[0], top[1], top[2] - 1.5], [1.2, 1.2, 2.4], fish))
  }
  return model(parts, { glow: { height: 6 } })
}

function fireflies(seed: number) {
  const rand = random(seed)
  const glow = plain(mat('firefly', 2, 'firefly', false))
  const parts: Part[] = []
  for (let i = 0; i < 6; i++)
    parts.push(ball([(rand() - 0.5) * 20, (rand() - 0.5) * 12, 4 + rand() * 12], 0.7, glow))
  return model(parts, { glow: { height: 10, soft: true } })
}

function coralModel(light: string, seed: number) {
  const rand = random(seed)
  const top = hexMat(light)
  const parts: Part[] = [egg([0, 0, 0], [6, 4.5, 2], stone(seed, true, 3), { amp: 0.6, seed })]
  const branch = (from: Vec3, yaw: number, length: number, r: number, depth: number) => {
    const to: Vec3 = [
      from[0] + Math.cos(yaw) * length * 0.6,
      from[1] + Math.sin(yaw) * length * 0.3,
      from[2] + length
    ]
    parts.push(taper(from, to, r, r * 0.75, plain(top)))
    if (depth > 0)
      for (const turn of [-0.8, 0.8])
        branch(to, yaw + turn + (rand() - 0.5), length * 0.7, r * 0.75, depth - 1)
  }
  branch([-2, 0, 1], Math.PI + 0.4, 4.5, 1.3, 2)
  branch([2.5, 0.5, 1], -0.3, 5, 1.3, 2)
  return model(parts)
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
    () => tiered(540)
  ],
  palm: [
    () => palm(42, 4, -1, 7, 610),
    () => palm(48, -5, 0, 8, 620),
    () => palm(36, 7, 1, 6, 630),
    () => palm(52, -2, -2, 8, 640),
    () => palm(40, -7, 1, 7, 650)
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
  coral: [
    () => coralModel('#ff9fb5', 11),
    () => coralModel('#ffad5c', 12),
    () => coralModel('#b99af0', 13),
    () => coralModel('#f1ece0', 14)
  ],
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
    const d = part.d(x, y, z)
    if (d < best) {
      best = d
      found = part
    }
  }
  return found
}
