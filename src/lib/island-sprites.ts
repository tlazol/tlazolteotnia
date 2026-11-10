import {
  alphaAt,
  blit,
  createBuffer,
  hex,
  outline,
  type PixelBuffer,
  type Rgba,
  setPixel
} from './island-art'
import { type DecorKind, hash2, valueNoise } from './island-world'

// ---- Decorations ----------------------------------------------------------

// Trees and rocks stand taller than residents (a resident is 20×28): the trunk
// or base fills one tile and blocks walking, while canopies spread over the
// tiles behind it so residents can walk round the back.
export type ShadowSize = 'small' | 'medium' | 'large' | 'huge'
export type SpriteFrame = {
  buffer: PixelBuffer
  shadow: ShadowSize | null
  // Extra animation frames after `buffer`, all the same size.
  frames?: PixelBuffer[]
  // Pixels the top sways in the wind, and pixels a floating thing bobs.
  sway?: number
  bob?: number
  // Lies on the ground: residents walk over it.
  flat?: boolean
}

function disc(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  paint: (x: number, y: number) => Rgba | null
) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      if (dx * dx + dy * dy > 1) continue
      const color = paint(x, y)
      if (color) setPixel(buffer, x, y, color)
    }
  }
}

const shadesOf = (...values: string[]) => values.map((value) => hex(value))

// Branches taper from a load-bearing base to a twig, with light on the left.
function branch(
  buffer: PixelBuffer,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number
) {
  const dx = bx - ax
  const dy = by - ay
  const length = Math.hypot(dx, dy)
  const nx = -dy / length
  const ny = dx / length
  polygon(
    buffer,
    [
      [ax - nx * width, ay - ny * width],
      [ax + nx * width, ay + ny * width],
      [bx + nx * 0.4, by + ny * 0.4],
      [bx - nx * 0.4, by - ny * 0.4]
    ],
    (x, y) => {
      const grain = Math.sin(y * 0.4 + x * 2.1)
      return hex(grain > 0.55 ? '#95846a' : grain < -0.6 ? '#4f4b38' : '#736a50')
    }
  )
}

// Small leaves grow around twig ends. Uneven density leaves sky visible
// between branches; there is deliberately no solid canopy underneath.
function leafSpray(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  dark = false
) {
  const palette = dark
    ? shadesOf('#3d5031', '#4c6038', '#607443', '#7b8d50')
    : shadesOf('#4a6039', '#637a43', '#829453', '#a6ad6b')
  for (let i = 0; i < radius * 5; i++) {
    const angle = hash2(i, seed, 410) * Math.PI * 2
    const distance = Math.sqrt(hash2(i, seed, 411)) * radius
    const x = Math.round(cx + Math.cos(angle) * distance)
    const y = Math.round(cy + Math.sin(angle) * distance * 0.65)
    const shade = Math.floor(hash2(i, seed, 412) * 4)
    const lean = hash2(i, seed, 413) < 0.5 ? -1 : 1
    line(buffer, x, y, x + lean * 2, y - 1, palette[shade])
    if (i % 3 === 0) setPixel(buffer, x + lean, y + 1, palette[Math.max(0, shade - 1)])
  }
}

// Foliage tones, darkest first.
const greens = shadesOf('#34462c', '#465a35', '#5c7140', '#7b8d50', '#a3ad68')
const deepGreens = shadesOf('#2a4032', '#38543a', '#4b6a44', '#688452', '#8fa266')
const freshGreens = shadesOf('#3f5c33', '#55753c', '#739249', '#95ad5c', '#bcc77c')

// A dense mass of leaves with a ragged edge, lit from the upper left. Several
// overlapping clumps, painted top first, make a lobed canopy.
function clump(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  tones = greens
) {
  for (let y = Math.floor(cy - ry) - 2; y <= Math.ceil(cy + ry) + 2; y++) {
    for (let x = Math.floor(cx - rx) - 2; x <= Math.ceil(cx + rx) + 2; x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      const edge = 1 + (valueNoise(x / 2.2, y / 2.2, seed) - 0.5) * 0.55
      if (Math.hypot(dx, dy) > edge) continue
      const light =
        -dx * 0.45 -
        dy * 0.8 +
        (hash2(x >> 1, y, seed + 1) - 0.5) * 0.8 +
        (valueNoise(x / 3, y / 2, seed + 2) - 0.5) * 0.9
      const shade = light > 0.8 ? 4 : light > 0.35 ? 3 : light > -0.2 ? 2 : light > -0.65 ? 1 : 0
      setPixel(buffer, x, y, tones[shade])
    }
  }
}

// ---- Trees ------------------------------------------------------------------

// Trees and rocks stand taller than residents (a resident is 20×28): the trunk
// or base fills one tile and blocks walking, while canopies spread over the
// tiles behind it so residents can walk round the back.

// An open, wind-shaped crown on angled limbs; `fruit` hangs a few in it.
function paintAcacia(lean: number, seed: number, fruit: boolean): SpriteFrame {
  const buffer = createBuffer(68, 88)
  const forkX = 34 + lean
  // Unequal, angled limbs rather than a straight pole supporting green balls.
  branch(buffer, 34, 86, forkX, 52, 3.4)
  branch(buffer, forkX, 56, forkX + 3, 29, 2.1)
  const tips: Array<[number, number]> = [
    [12, 40],
    [8, 29],
    [19, 20],
    [26, 10],
    [39, 12],
    [48, 21],
    [58, 28],
    [55, 42],
    [41, 35],
    [28, 32]
  ]
  tips.forEach(([tx, ty], i) => {
    const x = tx + Math.round((hash2(i, seed, 420) - 0.5) * 7)
    const y = ty + Math.round((hash2(i, seed, 421) - 0.5) * 9)
    const joinY = 52 - (i % 4) * 5
    const elbowX = forkX + (x - forkX) * 0.52
    const elbowY = joinY + (y - joinY) * 0.52 + 4
    branch(buffer, forkX, joinY, elbowX, elbowY, 1.6)
    branch(buffer, elbowX, elbowY, x, y, 1)
    if (i % 2 === 0) leafSpray(buffer, elbowX + 2, elbowY - 2, 5, seed + 90 + i, true)
    for (let j = 0; j < 3; j++) {
      const tipX = x + (j - 1) * 5
      const tipY = y - 4 - hash2(i, j, seed) * 5
      branch(buffer, x, y + 2, tipX, tipY, 0.5)
      leafSpray(buffer, tipX, tipY, 5 + hash2(i, j, seed + 1) * 3, seed + i * 3 + j, i > 6)
    }
  })
  // Short roots disappear into the soil instead of forming a triangular pedestal.
  branch(buffer, 34, 81, 27, 86, 1.4)
  branch(buffer, 35, 82, 40, 86, 1.2)
  if (fruit) {
    for (const [x, y] of [
      [16, 29],
      [38, 17],
      [49, 33],
      [28, 36]
    ]) {
      setPixel(buffer, x, y, hex('#aa6546'))
      setPixel(buffer, x, y + 1, hex('#75422f'))
    }
  }
  return { buffer: padded(buffer, 3), shadow: 'huge', sway: 1 }
}

// A broad, round crown of heavy foliage on a short thick trunk.
function paintBroadleaf(): SpriteFrame {
  const buffer = createBuffer(64, 76)
  branch(buffer, 32, 74, 32, 40, 3.8)
  branch(buffer, 32, 54, 19, 38, 1.9)
  branch(buffer, 32, 52, 45, 37, 1.9)
  branch(buffer, 32, 69, 25, 74, 1.5)
  branch(buffer, 33, 70, 40, 74, 1.3)
  const lobes = [
    [32, 13, 12, 9],
    [21, 19, 13, 10],
    [43, 19, 12, 10],
    [14, 31, 11, 9],
    [50, 31, 11, 9],
    [32, 30, 18, 12],
    [23, 40, 9, 6],
    [42, 40, 9, 6]
  ]
  lobes.forEach(([x, y, rx, ry], i) => {
    clump(buffer, x, y, rx, ry, 800 + i * 7)
  })
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI + (i / 8) * Math.PI
    leafSpray(buffer, 32 + Math.cos(angle) * 25, 27 + Math.sin(angle) * 21, 4, 860 + i, i % 3 === 0)
  }
  return { buffer: padded(buffer, 3), shadow: 'huge', sway: 1 }
}

// A young tree, barely taller than a resident.
function paintSapling(): SpriteFrame {
  const buffer = createBuffer(34, 46)
  branch(buffer, 17, 44, 16, 22, 1.7)
  branch(buffer, 17, 32, 10, 22, 0.9)
  branch(buffer, 17, 30, 24, 21, 0.9)
  clump(buffer, 16, 10, 8, 7, 900, freshGreens)
  clump(buffer, 9, 18, 7, 6, 907, freshGreens)
  clump(buffer, 24, 17, 7, 6, 914, freshGreens)
  clump(buffer, 17, 20, 8, 5, 921, freshGreens)
  return { buffer: padded(buffer, 2), shadow: 'medium', sway: 1 }
}

// A tall bare trunk carrying flat tiers of dark foliage.
function paintTiered(): SpriteFrame {
  const buffer = createBuffer(60, 94)
  branch(buffer, 29, 92, 31, 20, 2.8)
  branch(buffer, 30, 58, 14, 40, 1.4)
  branch(buffer, 30, 52, 47, 38, 1.4)
  branch(buffer, 31, 36, 16, 22, 1.2)
  branch(buffer, 31, 34, 46, 21, 1.2)
  branch(buffer, 29, 88, 23, 92, 1.3)
  branch(buffer, 30, 88, 36, 92, 1.2)
  const tiers = [
    [31, 9, 14, 6],
    [17, 19, 13, 6],
    [45, 18, 12, 6],
    [31, 22, 13, 5],
    [13, 37, 11, 5],
    [48, 35, 10, 5]
  ]
  tiers.forEach(([x, y, rx, ry], i) => {
    clump(buffer, x, y, rx, ry, 950 + i * 7, deepGreens)
  })
  return { buffer: padded(buffer, 3), shadow: 'large', sway: 1 }
}

type PalmLook = {
  // How far the crown sits to the side of the foot, and how high it is.
  bend: number
  crownY: number
  // Frond length and how hard the fronds hang, relative to a grown palm.
  reach: number
  droop: number
  nuts: number
}
const palmLooks: PalmLook[] = [
  { bend: 11, crownY: 30, reach: 1, droop: 1, nuts: 3 },
  { bend: -11, crownY: 30, reach: 1, droop: 1, nuts: 3 },
  // A young palm: short, upright, no coconuts yet.
  { bend: 3, crownY: 54, reach: 0.8, droop: 0.6, nuts: 0 },
  // Blown half over, its fronds hanging.
  { bend: -23, crownY: 40, reach: 1.05, droop: 1.3, nuts: 2 },
  // The tallest, nearly straight.
  { bend: 3, crownY: 19, reach: 0.88, droop: 1.15, nuts: 3 }
]

// Palms lean out over the sand, up to three residents tall.
function paintPalm(look: PalmLook): SpriteFrame {
  const buffer = createBuffer(104, 90)
  const lean = Math.sign(look.bend)
  const base = { x: 52, y: 87 }
  const crown = { x: 52 + look.bend, y: look.crownY }
  const bark = shadesOf('#d6a86c', '#b98a55', '#946739', '#6f4a2a')
  // Trunk: a gentle curve, ringed every few pixels, tapering toward the crown.
  for (let y = crown.y; y <= base.y; y++) {
    const t = (base.y - y) / (base.y - crown.y)
    const cx = base.x + (crown.x - base.x) * t * t
    const half = 3 - t * 1.2
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const u = (x + 0.5 - (cx - half)) / (half * 2)
      if (u < 0 || u > 1) continue
      const ring = (y + Math.round(cx)) % 5 === 0
      const shade = u < 0.3 ? 0 : u < 0.68 ? 1 : 2
      setPixel(buffer, x, y, bark[Math.min(3, shade + (ring ? 1 : 0))])
    }
  }
  for (let y = crown.y + 6; y < base.y; y += 5) {
    const t = (base.y - y) / (base.y - crown.y)
    const x = Math.round(base.x + (crown.x - base.x) * t * t)
    line(buffer, x - 1, y, x + 1, y + 1, bark[3])
    setPixel(buffer, x - 2, y - 1, bark[0])
  }
  const leaf = shadesOf('#afc57e', '#809e54', '#537b43', '#34573a')
  // Fronds fan out from the crown and droop; leaflets hang from each spine.
  const fronds: Array<[number, number, number]> = [
    [-178, 28, 0.55],
    [-150, 25, 0.35],
    [-118, 20, 0.2],
    [-80, 18, 0.18],
    [-45, 24, 0.32],
    [-8, 28, 0.55],
    [150, 22, 0.75],
    [118, 18, 0.7],
    [62, 18, 0.7],
    [30, 22, 0.75]
  ]
  fronds.sort((a, b) => Math.sin((b[0] * Math.PI) / 180) - Math.sin((a[0] * Math.PI) / 180))
  for (const [degrees, reach, hang] of fronds) {
    const angle = ((degrees + lean * 4) * Math.PI) / 180
    const back = Math.sin(angle) > 0.3
    const length = Math.round(reach * look.reach)
    const droop = hang * look.droop
    for (let i = 0; i <= length; i++) {
      const t = i / length
      const d = length * t
      const x = crown.x + Math.cos(angle) * d
      const y = crown.y + Math.sin(angle) * d * 0.55 + droop * d * t * 0.9
      // Tangent, and the leaflets' direction: back along the frond and downward.
      const tx = Math.cos(angle)
      const ty = Math.sin(angle) * 0.55 + droop * t * 1.8
      const tl = Math.hypot(tx, ty)
      const leaflet = Math.round(
        (Math.sin(Math.PI * Math.min(1, t * 1.15)) * 7 + 1) * (1 - t * 0.35) * look.reach
      )
      for (const side of [-1, 1]) {
        let nx = (-ty / tl) * side
        let ny = (tx / tl) * side
        // Leaflets on the upper side are short; both sides sweep down.
        const upper = ny < 0
        const len = upper ? Math.round(leaflet * 0.6) : leaflet
        nx = nx * 0.75 - (tx / tl) * 0.45
        ny = ny * 0.75 - (ty / tl) * 0.45 + 0.35
        for (let k = 1; k <= len; k++) {
          const shade = back ? 3 : upper ? 1 : k > len * 0.6 ? 3 : 2
          setPixel(buffer, Math.round(x + nx * k), Math.round(y + ny * k), leaf[shade])
        }
      }
      setPixel(buffer, Math.round(x), Math.round(y), leaf[back ? 2 : t < 0.15 ? 2 : 0])
    }
  }
  // Coconuts tucked under the crown.
  const nuts = [
    [-2, 3],
    [2, 3],
    [0, 5]
  ]
  for (const [dx, dy] of nuts.slice(0, look.nuts)) {
    disc(buffer, crown.x + dx, crown.y + dy, 2.3, 2.3, (x, y) =>
      hex(x + y < crown.x + dx + crown.y + dy ? '#9a6a3c' : '#6b4426')
    )
  }

  return { buffer, shadow: look.crownY > 50 ? 'medium' : 'large', sway: look.crownY > 50 ? 2 : 3 }
}

// ---- Undergrowth ------------------------------------------------------------

// A thicket of twigs; `berries` dots it with red.
function paintThicket(berries: boolean): SpriteFrame {
  const buffer = createBuffer(34, 25)
  const variant = berries ? 1 : 0
  for (let i = 0; i < 7; i++) {
    const x = 5 + i * 4
    const y = 6 + hash2(i, variant, 520) * 11
    branch(buffer, 17, 24, x, y, 0.7)
    leafSpray(buffer, x, y, 4.5, 530 + i + variant * 10, i > 4)
    if (berries && i % 2 === 0) setPixel(buffer, x, Math.round(y), hex('#9d4e48'))
  }
  return { buffer, shadow: 'medium', sway: 1 }
}

// A rounded shrub, clipped by the wind; `blooms` scatters flowers over it.
function paintShrub(blooms: boolean): SpriteFrame {
  const buffer = createBuffer(34, 24)
  const tones = blooms ? freshGreens : greens
  const seed = blooms ? 1040 : 1000
  clump(buffer, 17, 10, 10, 8, seed, tones)
  clump(buffer, 9, 15, 7, 6, seed + 7, tones)
  clump(buffer, 25, 15, 7, 6, seed + 14, tones)
  clump(buffer, 17, 17, 9, 5, seed + 21, tones)
  if (blooms) {
    for (let i = 0; i < 7; i++) {
      const x = 6 + Math.floor(hash2(i, 1, 1050) * 23)
      const y = 5 + Math.floor(hash2(i, 2, 1050) * 13)
      if (!alphaAt(buffer, x, y) || !alphaAt(buffer, x + 1, y + 1)) continue
      setPixel(buffer, x, y, hex('#f6d7de'))
      setPixel(buffer, x + 1, y, hex('#e59ab0'))
      setPixel(buffer, x, y + 1, hex('#e59ab0'))
    }
  }
  return { buffer, shadow: 'medium', sway: 1 }
}

// Arching fronds from one root, lowest ones lying almost flat.
function paintFern(): SpriteFrame {
  const buffer = createBuffer(38, 24)
  const tones = shadesOf('#3c6338', '#568443', '#7da556', '#a9c476')
  const fronds: Array<[number, number]> = [
    [-90, 15],
    [-118, 15],
    [-62, 15],
    [-143, 15],
    [-37, 15],
    [-166, 14],
    [-14, 14]
  ]
  fronds.forEach(([degrees, length], n) => {
    const angle = (degrees * Math.PI) / 180
    const droop = 0.08 + Math.abs(Math.cos(angle)) * 0.4
    const shade = n % 2 ? 1 : 2
    for (let d = 0; d <= length; d++) {
      const t = d / length
      const x = 19 + Math.cos(angle) * d
      const y = 22 + Math.sin(angle) * d + droop * d * t
      // Leaflets in pairs with gaps between, so the frond reads as feathered.
      const leaflet = d % 2 ? 0 : Math.round(Math.sin(Math.PI * Math.min(1, t + 0.1)) * 2.6)
      for (let k = 1; k <= leaflet; k++) {
        setPixel(
          buffer,
          Math.round(x + Math.sin(angle) * k),
          Math.round(y - Math.cos(angle) * k - k * 0.3),
          tones[shade]
        )
        setPixel(
          buffer,
          Math.round(x - Math.sin(angle) * k),
          Math.round(y + Math.cos(angle) * k + k * 0.3),
          tones[shade - 1]
        )
      }
      setPixel(buffer, Math.round(x), Math.round(y), tones[t > 0.7 ? 3 : shade + 1])
    }
  })
  return { buffer, shadow: 'medium', sway: 1 }
}

// A stand of tall grass, pale at the tips.
function paintTallGrass(): SpriteFrame {
  const buffer = createBuffer(28, 26)
  const tones = shadesOf('#4c6b3a', '#6a8a46', '#8fa957', '#c3c98a')
  for (let i = 0; i < 17; i++) {
    const root = 6 + hash2(i, 1, 1100) * 16
    const height = 10 + hash2(i, 2, 1100) * 13
    const lean = (root - 14) * 0.35 + (hash2(i, 3, 1100) - 0.5) * 5
    const shade = Math.floor(hash2(i, 4, 1100) * 3)
    for (let k = 0; k <= height; k++) {
      const t = k / height
      const x = Math.round(root + lean * t * t)
      setPixel(buffer, x, 24 - k, tones[t > 0.85 ? 3 : shade])
    }
  }
  for (let x = 5; x < 23; x++) if (hash2(x, 5, 1100) < 0.7) setPixel(buffer, x, 25, tones[0])
  return { buffer: padded(buffer, 2), shadow: 'medium', sway: 2 }
}

// ---- Rocks ------------------------------------------------------------------

const rockTone = (wet: boolean) => (wet ? [124, 140, 137] : [157, 162, 149])

// One flat face of a fractured rock; `light` sets how much sun it catches.
function facet(
  buffer: PixelBuffer,
  points: Array<[number, number]>,
  light: number,
  seed: number,
  wet: boolean
) {
  const tones = rockTone(wet)
  polygon(buffer, points, (x, y) => {
    const grain = (hash2(x, y, seed) - 0.5) * 16
    const strata = Math.sin(y * 0.9 + x * 0.24) > 0.85 ? -12 : 0
    const shade = light + grain + strata - (wet ? y * 0.8 : 0)
    return [tones[0] + shade, tones[1] + shade, tones[2] + shade, 255]
  })
}

// Moss creeping up from the foot of a rock.
function moss(buffer: PixelBuffer, top: number, seed: number) {
  for (let y = top; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      if (alphaAt(buffer, x, y) && valueNoise(x / 4, y / 3, seed) > 0.65)
        setPixel(buffer, x, y, hex(hash2(x, y, seed + 2) < 0.4 ? '#8e9870' : '#657456'))
    }
  }
}

// Fractured faces share edges, not overlapping ellipses.
function rockFaces(buffer: PixelBuffer, variant: number, wet = false) {
  const peak: [number, number] = variant ? [12, 3] : [17, 6]
  const left: [number, number] = [4, 13]
  const ridge: [number, number] = variant ? [20, 12] : [22, 14]
  const right: [number, number] = [31, 11 + variant * 4]
  const base: [number, number] = [27, 25]
  const seed = 620 + variant
  facet(buffer, [left, peak, [25, 5 + variant * 3], right, ridge], 28, seed, wet)
  facet(buffer, [left, ridge, [16, 25], [3, 22]], -6, seed, wet)
  facet(buffer, [ridge, right, [34, 22], base, [16, 25]], -40, seed, wet)
  line(buffer, peak[0], peak[1] + 1, ridge[0], ridge[1], hex('#bec1ad'))
  line(buffer, 10, 15, 13, 18, hex('#505b50'))
  line(buffer, 13, 18, 11, 23, hex('#505b50'))
  moss(buffer, 15, 630 + variant)
}

// A boulder worn round by the sea: no edges, just light sliding into shadow.
function boulder(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  wet = false
) {
  const tones = rockTone(wet)
  const foot = cy + ry * 0.72
  for (let y = Math.floor(cy - ry) - 1; y <= foot; y++) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      const edge = 1 + (valueNoise(x / 5, y / 5, seed) - 0.5) * 0.22
      if (Math.hypot(dx, dy) > edge) continue
      const light = -dx * 0.6 - dy * 0.9 + (valueNoise(x / 4, y / 3, seed + 1) - 0.5) * 0.5
      const band = light > 0.62 ? 30 : light > 0.12 ? 10 : light > -0.42 ? -14 : -40
      const shade = band + (hash2(x, y, seed + 2) - 0.5) * 12 - (wet ? Math.max(0, y - cy) * 2 : 0)
      setPixel(buffer, x, y, [tones[0] + shade, tones[1] + shade, tones[2] + shade, 255])
    }
  }
}

function paintBoulder(wet = false) {
  const buffer = createBuffer(32, 30)
  boulder(buffer, 15, 13, 13, 11, 660, wet)
  boulder(buffer, 26, 18, 5, 4.5, 664, wet)
  line(buffer, 17, 6, 20, 11, hex('#505b50'))
  line(buffer, 20, 11, 19, 16, hex('#505b50'))
  return buffer
}

function paintStones(wet = false) {
  const buffer = createBuffer(34, 26)
  boulder(buffer, 9, 12, 7.5, 6.5, 670, wet)
  boulder(buffer, 23, 10, 9, 8, 674, wet)
  boulder(buffer, 16, 16, 5.5, 4.5, 678, wet)
  return buffer
}

// A standing stone, split down its length.
function paintSpire(wet = false) {
  const buffer = createBuffer(28, 48)
  const seed = 684
  facet(
    buffer,
    [
      [5, 37],
      [8, 14],
      [13, 3],
      [16, 21],
      [13, 41]
    ],
    26,
    seed,
    wet
  )
  facet(
    buffer,
    [
      [13, 3],
      [19, 11],
      [23, 35],
      [20, 41],
      [13, 41],
      [16, 21]
    ],
    -34,
    seed,
    wet
  )
  facet(
    buffer,
    [
      [5, 37],
      [13, 41],
      [20, 41],
      [14, 44],
      [7, 42]
    ],
    -12,
    seed,
    wet
  )
  line(buffer, 13, 4, 16, 21, hex('#bec1ad'))
  line(buffer, 9, 20, 11, 27, hex('#505b50'))
  boulder(buffer, 22, 39, 5, 4.5, 688, wet)
  return buffer
}

function paintRock(variant: number): SpriteFrame {
  const buffer = createBuffer(36, 28)
  rockFaces(buffer, variant)
  return { buffer, shadow: 'medium' }
}

// A rounded rock keeps the pixels down to its foot and grows moss there.
function landRock(buffer: PixelBuffer, foot: number, seed: number): SpriteFrame {
  const cut = createBuffer(buffer.width, foot)
  blit(cut, buffer, 0, 0)
  moss(cut, Math.round(foot * 0.6), seed)
  return { buffer: cut, shadow: 'medium' }
}

// ---- Flowers ----------------------------------------------------------------

const flowerColors = [
  ['#f48fb4', '#d8577f'],
  ['#ffe07a', '#e3a93b'],
  ['#b9a2ff', '#7d64d6'],
  ['#fffaf0', '#d9cbb8']
] as const
const stem = hex('#3f8a3d')
const blade = hex('#5aac46')

// A patch of small mixed blooms.
function paintFlowers(variant: number): SpriteFrame {
  const buffer = createBuffer(16, 14)
  const spots: Array<[number, number, number]> = [
    [4, 5, 0],
    [10, 3, 1],
    [12, 9, 0],
    [6, 10, 1],
    [8, 7, 2]
  ]
  for (const [x, y, k] of spots) {
    const [petal, petalDark] = flowerColors[(variant + k) % flowerColors.length].map((v) => hex(v))
    setPixel(buffer, x, y + 2, stem)
    setPixel(buffer, x - 1, y + 3, blade)
    setPixel(buffer, x + 1, y + 3, blade)
    setPixel(buffer, x, y - 1, petal)
    setPixel(buffer, x - 1, y, petal)
    setPixel(buffer, x + 1, y, petalDark)
    setPixel(buffer, x, y + 1, petalDark)
    setPixel(buffer, x, y, hex('#ffd34d'))
  }
  return { buffer: padded(buffer, 1), shadow: 'small', sway: 1 }
}

// Two big tropical blooms over broad leaves.
function paintTropical(): SpriteFrame {
  const buffer = createBuffer(22, 18)
  const leaves = shadesOf('#356b3a', '#4f8f45', '#7fb85a')
  for (const [dx, dy] of [
    [-9, -4],
    [-5, -9],
    [1, -11],
    [6, -8],
    [9, -3]
  ]) {
    line(buffer, 11, 16, 11 + dx, 16 + dy, (k) => leaves[k ? 0 : 1], 2)
    setPixel(buffer, 11 + dx, 16 + dy, leaves[2])
  }
  const bloom = (x: number, y: number, light: string, dark: string) => {
    for (const [dx, dy, shaded] of [
      [0, -2, 0],
      [-2, -1, 0],
      [2, -1, 1],
      [-1, 1, 1],
      [1, 1, 1]
    ]) {
      rect(buffer, x + dx, y + dy, 2, 2, hex(shaded ? dark : light))
    }
    rect(buffer, x, y, 2, 1, hex('#ffe680'))
  }
  bloom(6, 6, '#f6a05a', '#dd6a35')
  bloom(14, 9, '#f2885a', '#cf5338')
  return { buffer: padded(buffer, 1), shadow: 'small', sway: 1 }
}

// Tall spikes of blossom, each a different height.
function paintSpikes(): SpriteFrame {
  const buffer = createBuffer(16, 20)
  const stalks: Array<[number, number, number]> = [
    [3, 8, 2],
    [8, 3, 0],
    [12, 10, 2]
  ]
  for (const [x, top, k] of stalks) {
    const [petal, petalDark] = flowerColors[k].map((v) => hex(v))
    for (let y = top; y <= 18; y++) setPixel(buffer, x, y, stem)
    for (let y = top; y < top + 7; y++) {
      const wide = y - top > 1
      setPixel(buffer, x, y, (y + x) % 2 ? petal : petalDark)
      if (wide && (y + x) % 2) setPixel(buffer, x - 1, y, petal)
      if (wide && (y + x) % 2 === 0) setPixel(buffer, x + 1, y, petalDark)
    }
    setPixel(buffer, x - 1, 16, blade)
    setPixel(buffer, x + 1, 17, blade)
    setPixel(buffer, x - 2, 15, blade)
  }
  return { buffer: padded(buffer, 1), shadow: 'small', sway: 1 }
}

// Daisies nodding in a tuft of grass.
function paintDaisies(): SpriteFrame {
  const buffer = createBuffer(18, 15)
  for (let i = 0; i < 9; i++) {
    const x = 2 + i * 1.7
    const height = 4 + hash2(i, 1, 1200) * 5
    line(
      buffer,
      Math.round(x),
      13,
      Math.round(x + (i - 4) * 0.5),
      Math.round(13 - height),
      i % 2 ? stem : blade
    )
  }
  for (const [x, y] of [
    [4, 4],
    [10, 2],
    [14, 6],
    [8, 8]
  ]) {
    const petal = hex('#fffaf0')
    setPixel(buffer, x, y - 1, petal)
    setPixel(buffer, x - 1, y, petal)
    setPixel(buffer, x + 1, y, hex('#d9cbb8'))
    setPixel(buffer, x, y + 1, hex('#d9cbb8'))
    setPixel(buffer, x, y, hex('#f0b63c'))
  }
  return { buffer: padded(buffer, 1), shadow: 'small', sway: 1 }
}

// ---- Drawing helpers --------------------------------------------------------

const ink = hex('#444638')
const white = hex('#ffffff')
const spray = hex('#c9f4f1')
const creamShade = hex('#d9cdb8')

// Adds empty columns on both sides so a swaying sprite is not cut off.
function padded(buffer: PixelBuffer, columns: number) {
  const wide = createBuffer(buffer.width + columns * 2, buffer.height)
  blit(wide, buffer, columns, 0)
  return wide
}

function rect(buffer: PixelBuffer, x: number, y: number, w: number, h: number, color: Rgba) {
  for (let py = y; py < y + h; py++)
    for (let px = x; px < x + w; px++) setPixel(buffer, px, py, color)
}

// A line `thick` pixels tall, optionally shaded per pixel.
function line(
  buffer: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Rgba | ((k: number) => Rgba),
  thick = 1
) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0
    const x = Math.round(x0 + (x1 - x0) * t)
    const y = Math.round(y0 + (y1 - y0) * t)
    for (let k = 0; k < thick; k++)
      setPixel(buffer, x, y + k, typeof color === 'function' ? color(k) : color)
  }
}

function polygon(
  buffer: PixelBuffer,
  points: Array<[number, number]>,
  paint: (x: number, y: number) => Rgba | null
) {
  const top = Math.floor(Math.min(...points.map((p) => p[1])))
  const bottom = Math.ceil(Math.max(...points.map((p) => p[1])))
  for (let y = top; y <= bottom; y++) {
    const crossings: number[] = []
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i]
      const [bx, by] = points[(i + 1) % points.length]
      const cy = y + 0.5
      if (ay <= cy === by <= cy) continue
      crossings.push(ax + ((cy - ay) / (by - ay)) * (bx - ax))
    }
    crossings.sort((a, b) => a - b)
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      for (let x = Math.round(crossings[i]); x < Math.round(crossings[i + 1]); x++) {
        const color = paint(x, y)
        if (color) setPixel(buffer, x, y, color)
      }
    }
  }
}

// A flame in three flickering frames: red tip, orange body, pale core.
const fire = shadesOf('#fff6c2', '#ffd447', '#ff9a2e', '#e8502a')
function flame(
  buffer: PixelBuffer,
  cx: number,
  base: number,
  height: number,
  width: number,
  f: number
) {
  for (let y = base - height; y <= base; y++) {
    const t = (base - y) / height
    const half = t < 0.25 ? width * (0.75 + t) : width * (1 - t) ** 0.8 + 0.3
    const lean = Math.sin(y * 0.9 + f * 2.1) * t * 1.6
    for (let x = Math.round(cx + lean - half); x <= Math.round(cx + lean + half - 1); x++) {
      const u = Math.abs(x + 0.5 - cx - lean) / half
      const shade = t > 0.82 ? 3 : u < 0.4 && t < 0.5 ? 0 : u < 0.72 && t < 0.72 ? 1 : 2
      setPixel(buffer, x, y, fire[shade])
    }
  }
  setPixel(buffer, Math.round(cx - 3 + f * 3), base - height - 2 - f, fire[2])
}

// ---- Washed up and lit ------------------------------------------------------

const bleached = shadesOf('#eadbc0', '#c9b494', '#a18b6e', '#7e6a55')

// A long sun-bleached log with one broken-off branch.
function paintDriftwood(variant: number): SpriteFrame {
  const buffer = createBuffer(32, 16)
  const wood = bleached
  for (let x = 3; x <= 28; x++) {
    const yc = Math.round(10 - (x - 3) * 0.1 + Math.sin(x * 0.35 + variant) * 0.9)
    const thin = x > 24 ? 1 : 0
    setPixel(buffer, x, yc - 2 + thin, wood[0])
    setPixel(buffer, x, yc - 1, wood[1])
    setPixel(buffer, x, yc, hash2(x, variant, 711) < 0.2 ? wood[3] : wood[1])
    setPixel(buffer, x, yc + 1 - thin, wood[2])
  }
  rect(buffer, 3, 8, 1, 4, wood[3])
  if (variant === 0) line(buffer, 18, 6, 22, 2, (k) => wood[k + 1], 2)
  else line(buffer, 11, 7, 8, 3, (k) => wood[k + 1], 2)

  return { buffer, shadow: null }
}

// A forked bough, twigs still on it.
function paintBough(): SpriteFrame {
  const buffer = createBuffer(34, 20)
  const wood = bleached
  const limb = (x0: number, y0: number, x1: number, y1: number, thick: number) =>
    line(buffer, x0, y0, x1, y1, (k) => wood[k === 0 ? 0 : k === thick - 1 ? 2 : 1], thick)
  limb(4, 14, 18, 11, 4)
  limb(18, 11, 30, 4, 3)
  limb(18, 12, 31, 14, 3)
  limb(24, 7, 25, 2, 2)
  limb(10, 12, 7, 6, 2)
  limb(26, 14, 29, 17, 1)
  rect(buffer, 4, 14, 1, 4, wood[3])
  return { buffer, shadow: null }
}

// A short thick trunk, its sawn-off end showing rings.
function paintStump(): SpriteFrame {
  const buffer = createBuffer(30, 18)
  const wood = bleached
  for (let x = 8; x <= 25; x++) {
    for (let y = 5; y <= 14; y++) {
      const shade = y < 7 ? 0 : y > 12 ? 2 : hash2(x >> 2, y, 715) < 0.18 ? 3 : 1
      if (x > 23 && (y < 6 || y > 13)) continue
      setPixel(buffer, x, y, wood[shade])
    }
  }
  disc(buffer, 8, 10, 4, 5.4, (x, y) => {
    const ring = Math.round(Math.hypot((x + 0.5 - 8) * 1.3, y + 0.5 - 10))
    return ring % 2 ? wood[2] : wood[1]
  })
  setPixel(buffer, 8, 10, wood[3])
  line(buffer, 17, 5, 20, 1, (k) => wood[k + 1], 2)
  line(buffer, 3, 15, 7, 16, wood[2])
  return { buffer, shadow: null }
}

function paintTorch(): SpriteFrame {
  const frames = [0, 1, 2].map((f) => {
    const buffer = createBuffer(14, 34)
    for (let y = 13; y <= 32; y++) {
      const band = y % 6 === 0
      setPixel(buffer, 6, y, hex(band ? '#a07c45' : '#e0bb74'))
      setPixel(buffer, 7, y, hex(band ? '#7d5c30' : '#a8834a'))
    }
    rect(buffer, 4, 11, 6, 1, hex('#9a6238'))
    rect(buffer, 4, 12, 6, 2, hex('#5f3d26'))
    flame(buffer, 7, 10, 9, 3, f)

    return buffer
  })
  return { buffer: frames[0], frames: frames.slice(1), shadow: 'small' }
}

// ---- Things in the sea ------------------------------------------------------

// Surf breaking along the foot of something standing in the water.
function surf(buffer: PixelBuffer, waterline: number, seed: number) {
  for (let x = 0; x < buffer.width; x++) {
    let near = false
    for (let dx = -2; dx <= 2; dx++) if (alphaAt(buffer, x + dx, waterline - 1)) near = true
    if (!near) continue
    const roll = hash2(x, seed, 741)
    if (roll < 0.8) setPixel(buffer, x, waterline, white)
    if (roll < 0.45) setPixel(buffer, x, waterline + 1, roll < 0.2 ? white : spray)
  }
  for (let y = waterline + 2; y < buffer.height; y++)
    for (let x = 0; x < buffer.width; x++) setPixel(buffer, x, y, [0, 0, 0, 0])
}

// Rocks standing in the sea, surf breaking round each.
function seaRock(buffer: PixelBuffer, waterline: number, seed: number): SpriteFrame {
  surf(buffer, waterline, seed)
  return { buffer, shadow: null }
}

function paintReef(variant: number): SpriteFrame {
  const buffer = createBuffer(36, 30)
  rockFaces(buffer, variant, true)
  return seaRock(buffer, 24, 2 + variant)
}

// Each kind's designs. Which one a tile shows is drawn from its position, so
// the visitor places a kind and the island picks the look.
export const decorVariants = {
  tree: [
    paintAcacia(-4, 470, false),
    paintAcacia(3, 501, true),
    paintBroadleaf(),
    paintSapling(),
    paintTiered()
  ],
  palm: palmLooks.map(paintPalm),
  bush: [
    paintThicket(false),
    paintThicket(true),
    paintShrub(false),
    paintShrub(true),
    paintFern(),
    paintTallGrass()
  ],
  rock: [
    paintRock(0),
    paintRock(1),
    landRock(paintBoulder(), 22, 661),
    landRock(paintStones(), 21, 671),
    landRock(paintSpire(), 45, 685)
  ],
  flowers: [
    paintFlowers(0),
    paintFlowers(1),
    paintFlowers(2),
    paintTropical(),
    paintSpikes(),
    paintDaisies()
  ],
  driftwood: [paintDriftwood(0), paintDriftwood(1), paintBough(), paintStump()],
  torch: [paintTorch()],
  searock: [
    paintReef(0),
    paintReef(1),
    seaRock(paintBoulder(true), 20, 5),
    seaRock(paintStones(true), 18, 6),
    seaRock(paintSpire(true), 40, 7)
  ]
} satisfies Record<DecorKind, SpriteFrame[]>

export function decorVariantIndex(kind: DecorKind, x: number, y: number) {
  return Math.floor(hash2(x, y, 211) * decorVariants[kind].length)
}

export const shadowSizes = {
  small: [12, 4],
  medium: [28, 7],
  large: [34, 9],
  huge: [46, 12]
} as const satisfies Record<ShadowSize, readonly [number, number]>

export function paintShadow(size: ShadowSize) {
  const [width, height] = shadowSizes[size]
  const buffer = createBuffer(width, height)
  disc(buffer, width / 2, height / 2, width / 2, height / 2, (x, y) => {
    const distance = ((x - width / 2) / (width / 2)) ** 2 + ((y - height / 2) / (height / 2)) ** 2
    return [22, 35, 28, Math.round(88 * (1 - distance * 0.8))]
  })
  return buffer
}

// ---- Wildlife ---------------------------------------------------------------

// A gull seen from above in two wingbeats, side by side in one sheet.
export const GULL_FRAME = { width: 16, height: 11 } as const
export function paintGull() {
  const sheet = createBuffer(GULL_FRAME.width * 2, GULL_FRAME.height)
  const tip = hex('#7f8aa3')
  ;[0, 1].forEach((f) => {
    const frame = createBuffer(GULL_FRAME.width, GULL_FRAME.height)
    const wing = f === 0 ? 2 : 8
    line(frame, 7, 5, 2, wing, white)
    line(frame, 8, 5, 13, wing, white)
    line(frame, 7, 6, 3, wing + 1, creamShade)
    line(frame, 8, 6, 12, wing + 1, creamShade)
    setPixel(frame, 1, wing, tip)
    setPixel(frame, 14, wing, tip)
    rect(frame, 6, 4, 4, 3, white)
    rect(frame, 9, 4, 2, 2, white)
    setPixel(frame, 11, 5, hex('#ffb13d'))
    outline(frame, ink)
    blit(sheet, frame, f * GULL_FRAME.width, 0)
  })
  return sheet
}

// Shapes under the water, tinted and faded by their material.
export function paintFishSchool() {
  const buffer = createBuffer(22, 14)
  for (const [x, y] of [
    [2, 3],
    [9, 1],
    [14, 5],
    [5, 8],
    [12, 10],
    [17, 9]
  ]) {
    rect(buffer, x + 1, y, 3, 1, white)
    setPixel(buffer, x + 2, y + 1, white)
    setPixel(buffer, x, y - 1, white)
    setPixel(buffer, x, y + 1, white)
  }
  return buffer
}

export function paintTurtle() {
  const buffer = createBuffer(16, 12)
  const shell = shadesOf('#8fd07a', '#5aa85a', '#3d8050')
  for (const [x, y] of [
    [3, 1],
    [10, 1],
    [3, 9],
    [10, 9]
  ])
    rect(buffer, x, y, 3, 2, shell[1])
  rect(buffer, 12, 5, 3, 2, shell[0])
  disc(buffer, 7, 6, 5, 4, (x, y) => ((x + y) % 3 === 0 ? shell[2] : y < 5 ? shell[0] : shell[1]))
  return buffer
}
