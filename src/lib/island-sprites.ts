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
  // Lights up at night: how far above the foot the light sits, and whether it
  // is the soft green of fireflies rather than firelight.
  glow?: { height: number; soft?: boolean }
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

const bark = ['#9a8565', '#524d35', '#776c4c']
const weathered = ['#d2c7b2', '#7f7668', '#a89d8a']

// Branches taper from a load-bearing base to a twig, with light on the left.
// `wood` is its lit, shaded and middle tone.
function branch(
  buffer: PixelBuffer,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  wood = bark
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
      return hex(grain > 0.55 ? wood[0] : grain < -0.6 ? wood[1] : wood[2])
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
    ? shadesOf('#345f2d', '#427131', '#56873a', '#71a344')
    : shadesOf('#3f7132', '#568f38', '#78ac46', '#a0c062')
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
const greens = shadesOf('#2c5329', '#3c6a2f', '#518437', '#71a344', '#9cc15e')
const deepGreens = shadesOf('#274331', '#35623b', '#3e7a41', '#599749', '#85b45e')
const freshGreens = shadesOf('#306e2c', '#438b30', '#60ac39', '#86c44f', '#b3dc71')

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
      setPixel(buffer, x, y, hex('#b6603a'))
      setPixel(buffer, x, y + 1, hex('#7e3e26'))
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
  const bark = shadesOf('#e3aa5f', '#c68b49', '#9f672e', '#784921')
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
  const leaf = shadesOf('#a2d974', '#6eb844', '#3c9038', '#2e6736')
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
      hex(x + y < crown.x + dx + crown.y + dy ? '#a66a30' : '#74431d')
    )
  }

  return {
    buffer,
    shadow: look.crownY > 50 ? 'medium' : 'large',
    sway: look.crownY > 50 ? 2 : 3
  }
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
    if (berries && i % 2 === 0) setPixel(buffer, x, Math.round(y), hex('#a8453d'))
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
      setPixel(buffer, x, y, hex('#fad3dc'))
      setPixel(buffer, x + 1, y, hex('#ee91ac'))
      setPixel(buffer, x, y + 1, hex('#ee91ac'))
    }
  }
  return { buffer, shadow: 'medium', sway: 1 }
}

// Arching fronds from one root, lowest ones lying almost flat.
function paintFern(): SpriteFrame {
  const buffer = createBuffer(38, 24)
  const tones = shadesOf('#307539', '#3b9c35', '#66bd48', '#99da6b')
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
  const tones = shadesOf('#3b7f31', '#57a338', '#7fc04a', '#bedb82')
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
        setPixel(buffer, x, y, hex(hash2(x, y, seed + 2) < 0.4 ? '#8aa66c' : '#5f8252'))
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
  line(buffer, peak[0], peak[1] + 1, ridge[0], ridge[1], hex('#bfcaae'))
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
  line(buffer, 13, 4, 16, 21, hex('#bfcaae'))
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
  ['#ff84b1', '#e84779'],
  ['#ffe07a', '#f8b026'],
  ['#b9a2ff', '#7556e4'],
  ['#fffaf0', '#ddccb4']
] as const
const stem = hex('#2ca53c')
const blade = hex('#2ece34')

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
  const leaves = shadesOf('#2a8036', '#35a940', '#60d24b')
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
  bloom(6, 6, '#ff9f51', '#f26220')
  bloom(14, 9, '#ff834d', '#e24725')
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
    setPixel(buffer, x + 1, y, hex('#ddccb4'))
    setPixel(buffer, x, y + 1, hex('#ddccb4'))
    setPixel(buffer, x, y, hex('#ffbb2d'))
  }
  return { buffer: padded(buffer, 1), shadow: 'small', sway: 1 }
}

// ---- Drawing helpers --------------------------------------------------------

const ink = hex('#474f39')
const white = hex('#ffffff')
const spray = hex('#c4f9f6')
const creamShade = hex('#ddceb4')

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
const fire = shadesOf('#fff6c2', '#ffd447', '#ff9a2e', '#ff4213')
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

const bleached = shadesOf('#efdcbb', '#d0b58d', '#a78c68', '#836a50')

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
      setPixel(buffer, 6, y, hex(band ? '#ab7e3a' : '#eebf66'))
      setPixel(buffer, 7, y, hex(band ? '#875d26' : '#b4863e'))
    }
    rect(buffer, 4, 11, 6, 1, hex('#a6602c'))
    rect(buffer, 4, 12, 6, 2, hex('#663c1f'))
    flame(buffer, 7, 10, 9, 3, f)

    return buffer
  })
  return {
    buffer: frames[0],
    frames: frames.slice(1),
    shadow: 'small',
    glow: { height: 26 }
  }
}

// ---- More greenery ----------------------------------------------------------

const bambooTones = shadesOf('#d3e58a', '#a4c957', '#6f9d3d', '#47722f')

// A stand of bamboo: jointed culms of uneven height, leafing from the upper
// joints. Each culm is its root, its height and how far its tip leans.
function paintBamboo(culms: Array<[number, number, number]>, seed: number): SpriteFrame {
  const buffer = createBuffer(46, 86)
  const foot = 84
  culms.forEach(([root, height, lean], n) => {
    for (let k = 0; k <= height; k++) {
      const t = k / height
      const x = Math.round(root + lean * t * t)
      const y = foot - k
      const joint = k % 8 === 7
      setPixel(buffer, x, y, bambooTones[joint ? 3 : n % 2])
      setPixel(buffer, x + 1, y, bambooTones[joint ? 3 : 2])
      if (joint && t > 0.3) {
        const side = hash2(k, n, seed) < 0.5 ? -1 : 1
        leafSpray(buffer, x + side * 4, y - 1, 4, seed + n * 10 + k, n % 2 === 0)
      }
    }
    leafSpray(buffer, root + lean, foot - height - 1, 5, seed + n * 7)
  })
  return { buffer: padded(buffer, 2), shadow: 'medium', sway: 2 }
}

// One broad leaf along a drooping midrib, torn here and there by the wind.
// `tones` are the midrib, the upper half and the lower half.
function paddle(
  buffer: PixelBuffer,
  x0: number,
  y0: number,
  degrees: number,
  length: number,
  droop: number,
  width: number,
  tones: Rgba[],
  seed: number
) {
  const angle = (degrees * Math.PI) / 180
  for (let i = 0; i <= length * 2; i++) {
    const d = i / 2
    const t = d / length
    const x = x0 + Math.cos(angle) * d
    const y = y0 + Math.sin(angle) * d + droop * d * t
    const tx = Math.cos(angle)
    const ty = Math.sin(angle) + droop * t * 2
    const tl = Math.hypot(tx, ty)
    const nx = -ty / tl
    const ny = tx / tl
    const torn = hash2(Math.floor(d), seed, 811) < 0.14
    const half = Math.sin(Math.PI * Math.min(1, t * 1.06 + 0.04)) * width
    for (let k = -half; k <= half; k += 0.5) {
      if (torn && Math.abs(k) > half * 0.35) continue
      const tone = Math.abs(k) < 0.5 ? tones[0] : ny * k < 0 ? tones[1] : tones[2]
      setPixel(buffer, Math.round(x + nx * k), Math.round(y + ny * k), tone)
    }
  }
}

type BananaLook = {
  crownY: number
  // Each leaf: its direction in degrees, its length and how hard it hangs.
  leaves: Array<[number, number, number]>
  fruit: boolean
}
const bananaLooks: BananaLook[] = [
  {
    crownY: 40,
    leaves: [
      [172, 22, 0.6],
      [8, 22, 0.6],
      [-158, 30, 0.42],
      [-22, 30, 0.42],
      [-122, 32, 0.2],
      [-58, 32, 0.2],
      [-92, 28, 0.06]
    ],
    fruit: true
  },
  {
    crownY: 44,
    leaves: [
      [176, 20, 0.65],
      [-150, 29, 0.36],
      [-30, 28, 0.4],
      [-112, 31, 0.14],
      [-66, 30, 0.18]
    ],
    fruit: false
  },
  // A sucker, not yet as tall as a resident's reach.
  {
    crownY: 58,
    leaves: [
      [-145, 17, 0.3],
      [-30, 16, 0.36],
      [-105, 20, 0.1],
      [-62, 19, 0.16]
    ],
    fruit: false
  },
  {
    crownY: 36,
    leaves: [
      [166, 23, 0.62],
      [14, 20, 0.7],
      [-168, 29, 0.46],
      [-12, 31, 0.42],
      [-134, 32, 0.26],
      [-48, 31, 0.26],
      [-86, 28, 0.04]
    ],
    fruit: true
  }
]

// A banana plant: a fleshy stem under a fountain of huge leaves.
function paintBanana(look: BananaLook, n: number): SpriteFrame {
  const buffer = createBuffer(88, 76)
  const foot = 74
  const stemTones = shadesOf('#c3cf74', '#94a852', '#6c803d', '#8a6a3c')
  for (let y = look.crownY; y <= foot; y++) {
    const half = 1.6 + ((y - look.crownY) / (foot - look.crownY)) * 1.6
    for (let x = Math.round(44 - half); x <= Math.round(44 + half); x++) {
      const u = (x - (44 - half)) / (half * 2)
      const sheath = hash2(x >> 1, y >> 2, 830 + n) < 0.16
      setPixel(buffer, x, y, stemTones[sheath ? 3 : u < 0.3 ? 0 : u < 0.7 ? 1 : 2])
    }
  }
  const back = shadesOf('#7fb04a', '#4f8f3a', '#356b33')
  const front = shadesOf('#d4ef8c', '#8fd052', '#55a53c')
  const small = look.crownY > 50
  look.leaves.forEach(([degrees, length, droop], i) => {
    const tones = i < 2 ? back : front
    paddle(
      buffer,
      44,
      look.crownY,
      degrees,
      length,
      droop,
      small ? 4.5 : 6.5,
      tones,
      840 + n * 9 + i
    )
  })
  if (look.fruit) {
    line(buffer, 46, look.crownY + 1, 50, look.crownY + 6, hex('#6c803d'))
    for (let row = 0; row < 4; row++) {
      const y = look.crownY + 7 + row * 2
      rect(buffer, 48 - (row % 2), y, 5, 2, hex('#f5d547'))
      rect(buffer, 51 - (row % 2), y + 1, 2, 1, hex('#c9a227'))
    }
    rect(buffer, 49, look.crownY + 15, 2, 3, hex('#7a3b5d'))
  }
  return {
    buffer: padded(buffer, 2),
    shadow: small ? 'medium' : 'large',
    sway: small ? 1 : 2
  }
}

// A dead tree, its bare limbs forking until they are twigs.
function paintDeadTree(seed: number, height: number, spread: number): SpriteFrame {
  const buffer = createBuffer(60, 74)
  const grow = (
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    depth: number
  ) => {
    const bx = x + Math.cos(angle) * length
    const by = y + Math.sin(angle) * length
    branch(buffer, x, y, bx, by, width, weathered)
    if (!depth || length < 4) return
    const key = Math.round(bx) * 3 + depth
    const forks = hash2(key, seed, 821) < 0.35 ? 3 : 2
    for (let i = 0; i < forks; i++) {
      const turn = (i - (forks - 1) / 2) * spread + (hash2(key + i * 7, seed, 822) - 0.5) * 0.5
      const next = length * (0.6 + hash2(key + i, seed, 823) * 0.18)
      grow(bx, by, angle + turn, next, Math.max(0.5, width * 0.6), depth - 1)
    }
  }
  grow(30, 72, -Math.PI / 2 + (hash2(seed, 0, 824) - 0.5) * 0.3, height, 3, 3)
  branch(buffer, 30, 67, 24, 72, 1.3, weathered)
  branch(buffer, 31, 68, 36, 72, 1.1, weathered)
  return { buffer, shadow: 'medium' }
}

// A mangrove standing on arching stilt roots under a low, dense crown.
function paintMangrove(seed: number, roots: number, lean: number): SpriteFrame {
  const buffer = createBuffer(64, 64)
  const rootTones = shadesOf('#9a8260', '#6a5a3e', '#463b2b')
  // Stilt roots leave the trunk at different heights and bow out before they
  // drop, the widest at the back and the nearest last.
  for (let i = 0; i < roots; i++) {
    const side = i % 2 ? 1 : -1
    const rank = Math.floor(i / 2)
    const reach = [21, 13, 7, 3][rank] + (hash2(i, seed, 851) - 0.5) * 5
    const sx = 32 + side
    const sy = 33 + rank * 5 + Math.floor(hash2(i, seed, 852) * 3)
    const ex = 32 + side * reach
    const ey = 59 + rank + Math.floor(hash2(i, seed, 853) * 2)
    for (let step = 0; step <= 60; step++) {
      const t = step / 60
      const x = Math.round(sx + (ex - sx) * (1 - (1 - t) ** 2.4))
      const y = Math.round(sy + (ey - sy) * t ** 1.7)
      setPixel(buffer, x, y, rootTones[side < 0 ? 0 : 1])
      setPixel(buffer, x + 1, y, rootTones[side < 0 ? 1 : 2])
    }
  }
  line(buffer, 31, 44, 31, 61, (k) => rootTones[k ? 2 : 1], 2)
  branch(buffer, 32, 46, 32 + lean, 24, 2.6)
  branch(buffer, 32 + lean * 0.5, 34, 20, 24, 1.3)
  branch(buffer, 32 + lean * 0.5, 33, 45, 23, 1.3)
  const lobes = [
    [32 + lean, 12, 15, 9],
    [19, 19, 11, 8],
    [46, 19, 11, 8],
    [32 + lean * 0.5, 23, 15, 7]
  ]
  lobes.forEach(([x, y, rx, ry], i) => {
    clump(buffer, x, y, rx, ry, seed * 31 + i * 7, deepGreens)
  })
  return { buffer: padded(buffer, 2), shadow: 'large', sway: 1 }
}

// A monstera: big split leaves on long stalks from one root. Each leaf is its
// direction in degrees, how far out it sits and its size.
function paintMonstera(leaves: Array<[number, number, number]>, seed: number): SpriteFrame {
  const buffer = createBuffer(50, 36)
  const stalk = hex('#3d7a36')
  leaves.forEach(([degrees, reach, size], n) => {
    const angle = (degrees * Math.PI) / 180
    const cx = 25 + Math.cos(angle) * reach
    const cy = 32 + Math.sin(angle) * reach * 0.8
    line(buffer, 25, 33, Math.round(cx), Math.round(cy), stalk)
    const tones = n < 2 ? deepGreens : freshGreens
    disc(buffer, cx, cy, size, size * 0.8, (x, y) => {
      const dx = x + 0.5 - cx
      const dy = (y + 0.5 - cy) / 0.8
      const r = Math.hypot(dx, dy) / size
      const around = Math.atan2(dy, dx) - angle
      // The notch where the stalk joins, and the slits between the lobes.
      if (Math.cos(around) < -0.9 && r > 0.2) return null
      if (r > 0.5 && Math.abs(Math.sin(around * 2.5)) > 0.96 && Math.cos(around) < 0.9) return null
      if (Math.abs(Math.sin(around)) * r < 0.1 && Math.cos(around) > 0) return tones[4]
      const light = -dy / size + (hash2(x, y, seed + n) - 0.5) * 0.5
      return tones[light > 0.35 ? 3 : light > -0.3 ? 2 : 1]
    })
  })
  return { buffer: padded(buffer, 1), shadow: 'medium', sway: 1 }
}

const cactusTones = shadesOf('#9fd884', '#5fae5c', '#3f8a4a', '#2c6640')
const spine = hex('#eef7cf')

// One ribbed, round-topped column of a cactus.
function cactusColumn(buffer: PixelBuffer, cx: number, top: number, bottom: number, half: number) {
  for (let y = top; y <= bottom; y++) {
    const h = Math.min(half, half - 2 + (y - top))
    for (let x = cx - h; x <= cx + h; x++) {
      const u = h ? (x - (cx - h)) / (h * 2) : 0.5
      const rib = Math.abs(x - cx) % 2 === 1
      const shade = (u < 0.25 ? 0 : u < 0.65 ? 1 : 2) + (rib ? 1 : 0)
      setPixel(buffer, x, y, rib && (y + x) % 4 === 0 ? spine : cactusTones[Math.min(3, shade)])
    }
  }
}

// A flat pad or a barrel, dotted with spines.
function cactusPad(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number
) {
  disc(buffer, cx, cy, rx, ry, (x, y) => {
    const light = -(x + 0.5 - cx) / rx - ((y + 0.5 - cy) / ry) * 0.8
    if (hash2(x, y, seed) < 0.1 && (x + y) % 2 === 0) return spine
    return cactusTones[light > 0.7 ? 0 : light > 0 ? 1 : light > -0.8 ? 2 : 3]
  })
}

function bloom(buffer: PixelBuffer, x: number, y: number, light: string, dark: string) {
  setPixel(buffer, x, y, hex(light))
  setPixel(buffer, x + 1, y, hex(dark))
  setPixel(buffer, x, y - 1, hex(light))
}

function paintCactus(variant: number): SpriteFrame {
  const buffer = createBuffer(32, 48)
  if (variant === 0) {
    // A tall one with an arm on either side.
    cactusColumn(buffer, 16, 6, 46, 3)
    rect(buffer, 8, 27, 5, 3, cactusTones[2])
    cactusColumn(buffer, 8, 17, 28, 2)
    rect(buffer, 20, 21, 5, 3, cactusTones[2])
    cactusColumn(buffer, 25, 12, 22, 2)
    return { buffer, shadow: 'medium' }
  }
  if (variant === 1) {
    // Shorter, one-armed, in flower.
    cactusColumn(buffer, 15, 18, 46, 3)
    rect(buffer, 19, 31, 5, 3, cactusTones[2])
    cactusColumn(buffer, 24, 23, 32, 2)
    bloom(buffer, 14, 17, '#ffd1e0', '#f07fa6')
    bloom(buffer, 24, 22, '#ffd1e0', '#f07fa6')
    return { buffer, shadow: 'small' }
  }
  if (variant === 2) {
    // Prickly pear: pads growing out of pads, red fruit along their rims.
    cactusPad(buffer, 16, 38, 6.5, 8.5, 871)
    cactusPad(buffer, 8, 28, 4.5, 6, 872)
    cactusPad(buffer, 23, 25, 5, 6.5, 873)
    cactusPad(buffer, 22, 13, 4, 5, 874)
    for (const [x, y] of [
      [6, 21],
      [10, 21],
      [26, 18],
      [20, 7]
    ])
      rect(buffer, x, y, 2, 2, hex('#d8434f'))
    return { buffer, shadow: 'medium' }
  }
  // A barrel, crowned with yellow flowers.
  cactusPad(buffer, 16, 37, 10, 10, 875)
  for (let y = 28; y <= 46; y++)
    for (let x = 7; x <= 25; x += 3)
      if (alphaAt(buffer, x, y)) setPixel(buffer, x, y, cactusTones[3])
  bloom(buffer, 13, 27, '#fff0a3', '#f2b632')
  bloom(buffer, 17, 26, '#fff0a3', '#f2b632')
  return { buffer, shadow: 'medium' }
}

// ---- Relics -----------------------------------------------------------------

// Stone worked by whoever lived here before: sandstone, basalt, limestone and
// granite.
const relicStone = [
  [198, 180, 142],
  [70, 76, 86],
  [196, 196, 180],
  [146, 150, 144]
]

// One dressed face: flat and even beside a fractured rock, streaked by rain.
function dressed(
  buffer: PixelBuffer,
  points: Array<[number, number]>,
  tone: number[],
  light: number,
  seed: number
) {
  polygon(buffer, points, (x, y) => {
    const streak = (valueNoise(x / 3, y / 10, seed + 1) - 0.5) * 22
    const shade = light + (hash2(x, y, seed) - 0.5) * 10 + streak
    return [tone[0] + shade, tone[1] + shade, tone[2] + shade, 255]
  })
}

// A squared block seen from the front left: lit top, front face, and a shaded
// side receding to the right. `inset` narrows the top of a tapering shaft.
function block(
  buffer: PixelBuffer,
  x: number,
  base: number,
  w: number,
  h: number,
  d: number,
  tone: number[],
  seed: number,
  inset = 0
) {
  const top = base - h
  const left = x + inset
  const right = x + w - inset
  const depth = (d * (w - inset * 2)) / w
  dressed(
    buffer,
    [
      [x, base],
      [x + w, base],
      [right, top],
      [left, top]
    ],
    tone,
    6,
    seed
  )
  dressed(
    buffer,
    [
      [x + w, base],
      [x + w + d, base - d / 2],
      [right + depth, top - depth / 2],
      [right, top]
    ],
    tone,
    -36,
    seed
  )
  dressed(
    buffer,
    [
      [left, top],
      [right, top],
      [right + depth, top - depth / 2],
      [left + depth, top - depth / 2]
    ],
    tone,
    30,
    seed
  )
}

// A run of carved signs, each a different 3×3 mark, down a face or `across` it.
function glyphs(
  buffer: PixelBuffer,
  x: number,
  y: number,
  count: number,
  seed: number,
  color: Rgba,
  across = false
) {
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 9; k++) {
      if (hash2(k, i, seed) > 0.55) continue
      setPixel(
        buffer,
        x + (k % 3) + (across ? i * 4 : 0),
        y + Math.floor(k / 3) + (across ? 0 : i * 4),
        color
      )
    }
  }
}

// A mossy stone lying against the foot of a relic.
function footStone(
  buffer: PixelBuffer,
  x: number,
  y: number,
  rx: number,
  ry: number,
  seed: number
) {
  const stone = createBuffer(buffer.width, buffer.height)
  boulder(stone, x, y, rx, ry, seed)
  moss(stone, Math.round(y - 1), seed + 4)
  blit(buffer, stone, 0, 0)
}

// An obelisk on a stepped plinth, signs cut down its face.
function paintObelisk(): SpriteFrame {
  const buffer = createBuffer(34, 62)
  const tone = relicStone[0]
  block(buffer, 5, 60, 20, 4, 6, tone, 880)
  block(buffer, 9, 55, 13, 3, 4, tone, 881)
  block(buffer, 11, 51, 9, 37, 4, tone, 882, 1.5)
  // The capstone is paler, as if it was once sheathed in metal.
  const cap = [tone[0] + 22, tone[1] + 22, tone[2] + 10]
  dressed(
    buffer,
    [
      [12.5, 14],
      [18.5, 14],
      [16.5, 5]
    ],
    cap,
    14,
    883
  )
  dressed(
    buffer,
    [
      [18.5, 14],
      [21.2, 12.7],
      [16.5, 5]
    ],
    cap,
    -30,
    883
  )
  glyphs(buffer, 14, 19, 7, 884, hex('#8f7c58'))
  line(buffer, 12, 47, 19, 47, hex('#8f7c58'))
  moss(buffer, 50, 885)
  footStone(buffer, 6, 59, 4.5, 3.5, 886)
  return { buffer, shadow: 'medium' }
}

// A black slab, sunk a little to one side, its inlaid signs still bright.
function paintMonolith(): SpriteFrame {
  const buffer = createBuffer(34, 52)
  const inlay = hex('#7fe0d0')
  block(buffer, 8, 50, 15, 40, 4, relicStone[1], 890)
  // A ring over a column of signs.
  for (const [x, y] of [
    [14, 15],
    [15, 15],
    [16, 15],
    [13, 16],
    [17, 16],
    [13, 17],
    [17, 17],
    [13, 18],
    [17, 18],
    [14, 19],
    [15, 19],
    [16, 19]
  ])
    setPixel(buffer, x, y, inlay)
  glyphs(buffer, 14, 23, 5, 891, inlay)
  moss(buffer, 44, 892)
  footStone(buffer, 8, 49, 5, 3.5, 893)
  footStone(buffer, 25, 49, 4, 3, 894)
  return { buffer, shadow: 'medium' }
}

// A pillar snapped off above its foot, the rest lying where it fell.
function paintBrokenPillar(): SpriteFrame {
  const buffer = createBuffer(44, 40)
  const tone = relicStone[2]
  block(buffer, 5, 37, 15, 3, 5, tone, 900)
  // The stump: a jagged break across the top, pale where the stone is fresh.
  dressed(
    buffer,
    [
      [8, 34],
      [18, 34],
      [18, 20],
      [15, 17],
      [12, 19],
      [10, 13],
      [8, 15]
    ],
    tone,
    6,
    901
  )
  dressed(
    buffer,
    [
      [18, 34],
      [22, 32],
      [22, 19],
      [18, 20]
    ],
    tone,
    -36,
    901
  )
  dressed(
    buffer,
    [
      [10, 13],
      [14, 11],
      [22, 19],
      [18, 20],
      [15, 17],
      [12, 19]
    ],
    tone,
    34,
    902
  )
  glyphs(buffer, 12, 22, 3, 903, hex('#8d8f7e'))
  // Two fallen drums, half sunk.
  block(buffer, 25, 38, 11, 6, 5, tone, 904)
  block(buffer, 30, 31, 7, 5, 4, tone, 905)
  glyphs(buffer, 27, 34, 2, 906, hex('#8d8f7e'), true)
  moss(buffer, 29, 907)
  footStone(buffer, 22, 37, 4, 3, 908)
  footStone(buffer, 6, 37, 3.5, 2.5, 909)
  return { buffer, shadow: 'medium' }
}

// Two uprights carrying a lintel: a gate with nothing left to open onto.
function paintTrilithon(): SpriteFrame {
  const buffer = createBuffer(44, 48)
  const tone = relicStone[3]
  block(buffer, 6, 46, 8, 28, 4, tone, 910, 0.5)
  block(buffer, 27, 46, 8, 28, 4, tone, 911, 0.5)
  block(buffer, 3, 18, 34, 6, 5, tone, 912)
  glyphs(buffer, 7, 14, 7, 913, hex('#6c706a'), true)
  glyphs(buffer, 9, 22, 4, 914, hex('#6c706a'))
  line(buffer, 31, 24, 29, 31, hex('#505b50'))
  line(buffer, 29, 31, 31, 36, hex('#505b50'))
  moss(buffer, 38, 915)
  // Moss has taken the top of the lintel too.
  for (let x = 6; x < 40; x++)
    if (valueNoise(x / 3, 0, 916) > 0.55 && alphaAt(buffer, x, 11))
      setPixel(buffer, x, 11, hex(hash2(x, 0, 917) < 0.4 ? '#8aa66c' : '#5f8252'))
  footStone(buffer, 19, 45, 4.5, 3, 918)
  footStone(buffer, 38, 45, 3.5, 2.5, 919)
  return { buffer, shadow: 'large' }
}

// ---- Small finds ------------------------------------------------------------

// A few mushrooms of different ages; `spots` dots the caps with white.
function paintMushrooms(light: string, dark: string, spots: boolean, seed: number): SpriteFrame {
  const buffer = createBuffer(18, 17)
  const caps: Array<[number, number, number, number]> = [
    [5, 9, 3.5, 5],
    [12, 7, 4.5, 8],
    [9, 13, 2.5, 2]
  ]
  for (const [cx, brim, r, stalk] of caps) {
    rect(buffer, cx - 1, brim, 1, stalk, hex('#f6edd8'))
    rect(buffer, cx, brim, 1, stalk, hex('#d6c7a6'))
    disc(buffer, cx, brim, r, r, (x, y) => {
      if (y >= brim) return null
      if (spots && hash2(x, y, seed) < 0.16) return white
      return hex(x + 0.5 < cx && y < brim - 1 ? light : dark)
    })
    rect(buffer, Math.round(cx - r), brim, Math.round(r * 2), 1, hex('#f6edd8'))
  }
  return { buffer, shadow: 'small' }
}

// Things the tide left on the beach.
function paintShell(variant: number): SpriteFrame {
  const buffer = createBuffer(18, 12)
  if (variant === 0) {
    // A scallop, ribbed from its hinge.
    disc(buffer, 9, 9, 7, 7, (x, y) => {
      if (y > 8) return null
      const rib = Math.floor((Math.atan2(y + 0.5 - 9, x + 0.5 - 9) / Math.PI) * 9)
      return hex(rib % 2 ? '#f7a9a0' : '#ffd9d2')
    })
    rect(buffer, 7, 9, 4, 1, hex('#d9837b'))
    rect(buffer, 8, 10, 2, 1, hex('#f7a9a0'))
  } else if (variant === 1) {
    // A conch, spiralling to a point.
    disc(buffer, 7, 6, 5.5, 4.5, (x, y) =>
      hex((x + y * 2) % 4 === 0 ? '#d9a877' : y < 5 ? '#fff4dc' : '#f1d6ac')
    )
    polygon(
      buffer,
      [
        [11, 3],
        [17, 6],
        [11, 9]
      ],
      (_, y) => hex(y < 6 ? '#fff4dc' : '#e2bd8c')
    )
    rect(buffer, 4, 6, 4, 2, hex('#f59fa8'))
  } else if (variant === 2) {
    // A starfish.
    for (let arm = 0; arm < 5; arm++) {
      const angle = -Math.PI / 2 + (arm * Math.PI * 2) / 5
      line(
        buffer,
        9,
        5,
        Math.round(9 + Math.cos(angle) * 6),
        Math.round(5 + Math.sin(angle) * 5),
        (k) => hex(k ? '#d9682c' : '#f08a4b'),
        2
      )
    }
    for (const [x, y] of [
      [9, 5],
      [9, 2],
      [12, 5],
      [6, 5]
    ])
      setPixel(buffer, x, y, hex('#ffc890'))
  } else {
    // A mussel and a little whelk.
    disc(buffer, 6, 6, 4.5, 3, (x, y) => hex(y < 5 ? '#6f86a8' : x % 2 ? '#3c4d6b' : '#4f6388'))
    disc(buffer, 13, 7, 3, 2.5, (_, y) => hex(y < 7 ? '#ffffff' : '#f3c9c0'))
    setPixel(buffer, 13, 4, hex('#f3c9c0'))
  }
  return { buffer, shadow: null, flat: true }
}

// ---- More lights ------------------------------------------------------------

const logTones = shadesOf('#8a5a32', '#6b4226', '#4a2c18')
const log = (k: number) => logTones[Math.min(2, k)]

// A fire of crossed logs in a ring of stones, or a bonfire stacked tall.
function paintCampfire(tall: boolean): SpriteFrame {
  const frames = [0, 1, 2].map((f) => {
    const buffer = createBuffer(30, tall ? 40 : 28)
    const base = buffer.height - 3
    if (tall) {
      line(buffer, 5, base, 14, base - 17, log, 3)
      line(buffer, 24, base, 15, base - 17, log, 3)
      flame(buffer, 15, base - 6, 24, 5.5, f)
      line(buffer, 10, base, 14, base - 13, log, 3)
      line(buffer, 20, base, 16, base - 13, log, 3)
    } else {
      for (const [x, y] of [
        [6, base - 5],
        [15, base - 7],
        [24, base - 5]
      ])
        boulder(buffer, x, y, 3.5, 3, 890 + x)
      line(buffer, 7, base - 2, 22, base - 6, log, 3)
      line(buffer, 22, base - 2, 8, base - 6, log, 3)
      flame(buffer, 15, base - 5, 12, 4.5, f)
      for (const [x, y] of [
        [4, base - 1],
        [11, base],
        [19, base],
        [26, base - 1]
      ])
        boulder(buffer, x, y, 3.5, 3, 895 + x)
    }
    setPixel(buffer, 11 + f * 3, base - 3, fire[1])
    setPixel(buffer, 18 - f * 2, base - 2, fire[2])
    return buffer
  })
  return {
    buffer: frames[0],
    frames: frames.slice(1),
    shadow: 'medium',
    glow: { height: tall ? 16 : 10 }
  }
}

// A stone lantern, a flame wavering behind its window.
function paintLantern(mossy: boolean): SpriteFrame {
  const stone = shadesOf('#c9cdbd', '#a2a799', '#787d70', '#565b52')
  const lit = shadesOf('#fff6c2', '#ffd447', '#ffb93a')
  const frames = [0, 1, 2].map((f) => {
    const buffer = createBuffer(26, 40)
    rect(buffer, 6, 35, 14, 3, stone[2])
    rect(buffer, 6, 35, 14, 1, stone[1])
    rect(buffer, 8, 33, 10, 2, stone[1])
    rect(buffer, 11, 22, 4, 11, stone[2])
    rect(buffer, 11, 22, 2, 11, stone[0])
    rect(buffer, 7, 20, 12, 2, stone[1])
    rect(buffer, 7, 21, 12, 1, stone[3])
    rect(buffer, 9, 12, 8, 8, stone[2])
    rect(buffer, 9, 12, 2, 8, stone[1])
    rect(buffer, 11, 14, 4, 5, lit[1 + ((f + 1) % 2)])
    rect(buffer, 12, 15 + (f % 2), 2, 3, lit[0])
    polygon(
      buffer,
      [
        [3, 12],
        [23, 12],
        [17, 6],
        [9, 6]
      ],
      (x, y) => (y > 10 ? stone[3] : x < 13 ? stone[0] : stone[1])
    )
    setPixel(buffer, 2, 11, stone[1])
    setPixel(buffer, 23, 11, stone[2])
    rect(buffer, 12, 3, 2, 3, stone[1])
    rect(buffer, 11, 2, 4, 2, stone[0])
    if (mossy) moss(buffer, 4, 901)
    // Moss never grows over the flame.
    if (mossy) rect(buffer, 12, 15 + (f % 2), 2, 3, lit[0])
    return buffer
  })
  return {
    buffer: frames[0],
    frames: frames.slice(1),
    shadow: 'medium',
    glow: { height: 22 }
  }
}

// Fireflies drifting over a tuft of grass, each blinking in its own time.
function paintFireflies(seed: number): SpriteFrame {
  const blades = shadesOf('#3b7f31', '#57a338', '#7fc04a')
  const frames = [0, 1, 2, 3].map((f) => {
    const buffer = createBuffer(28, 26)
    for (let i = 0; i < 12; i++) {
      const root = 8 + hash2(i, 1, seed) * 12
      const height = 5 + hash2(i, 2, seed) * 9
      const lean = (root - 14) * 0.3 + (hash2(i, 3, seed) - 0.5) * 4
      for (let k = 0; k <= height; k++) {
        const t = k / height
        setPixel(buffer, Math.round(root + lean * t * t), 24 - k, blades[t > 0.8 ? 2 : i % 2])
      }
    }
    for (let i = 0; i < 6; i++) {
      if ((i + f) % 4 > 1) continue
      const x = 3 + Math.floor(hash2(i, 4, seed) * 21) + ((i + f) % 2)
      const y = 2 + Math.floor(hash2(i, 5, seed) * 15)
      setPixel(buffer, x, y, hex('#fbffb0'))
      setPixel(buffer, x + ((i + f) % 4 ? 1 : -1), y, hex('#c9ec5a'))
      setPixel(buffer, x, y + 1, hex('#c9ec5a'))
    }
    return buffer
  })
  return {
    buffer: frames[0],
    frames: frames.slice(1),
    shadow: 'small',
    glow: { height: 14, soft: true }
  }
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

// Coral grown up to the surface, branching like a little tree.
function paintCoral(tones: Rgba[], seed: number): SpriteFrame {
  const buffer = createBuffer(34, 28)
  const grow = (x: number, y: number, angle: number, length: number, depth: number) => {
    const bx = Math.round(x + Math.cos(angle) * length)
    const by = Math.round(y + Math.sin(angle) * length)
    line(buffer, x, y, bx, by, (k) => tones[k ? 2 : 1], 2)
    if (!depth) {
      setPixel(buffer, bx, by - 1, tones[0])
      return
    }
    for (const side of [-1, 1]) {
      const turn = side * (0.45 + hash2(bx + side, by + depth, seed) * 0.4)
      grow(bx, by, angle + turn, length * 0.72, depth - 1)
    }
  }
  grow(10, 24, -Math.PI / 2 - 0.25, 6, 2)
  grow(17, 25, -Math.PI / 2, 8, 2)
  grow(24, 24, -Math.PI / 2 + 0.3, 6, 2)
  return seaRock(buffer, 22, seed)
}

// A raft of seaweed, its fronds rising and falling with the swell.
function paintSeaweed(tones: Rgba[], seed: number): SpriteFrame {
  const frames = [0, 1].map((f) => {
    const buffer = createBuffer(30, 18)
    for (let strand = 0; strand < 5; strand++) {
      const from = 2 + Math.floor(hash2(strand, 1, seed) * 6)
      const to = 21 + Math.floor(hash2(strand, 2, seed) * 7)
      for (let x = from; x <= to; x++) {
        const y = Math.round(
          4 + strand * 2.4 + Math.sin(x * 0.55 + strand * 1.7 + seed + f * 1.3) * 1.4
        )
        setPixel(buffer, x, y, tones[(x + strand) % 5 === 0 ? 0 : 1 + (strand % 2)])
        setPixel(buffer, x, y + 1, tones[3])
        if ((x + strand * 3) % 7 === 0) setPixel(buffer, x, y - 1, tones[0])
      }
      setPixel(buffer, from - 1, Math.round(4 + strand * 2.4) + f, white)
      setPixel(buffer, to + 1, Math.round(4 + strand * 2.4) + 1 - f, spray)
    }
    return buffer
  })
  return { buffer: frames[0], frames: frames.slice(1), shadow: null, bob: 1 }
}

// Driftwood still at sea, riding low in the water.
function afloat(frame: SpriteFrame, waterline: number, seed: number): SpriteFrame {
  const buffer = createBuffer(frame.buffer.width, frame.buffer.height)
  blit(buffer, frame.buffer, 0, 0)
  surf(buffer, waterline, seed)
  return { buffer, shadow: null, bob: 1 }
}

// A marker buoy: a banded float under a tapering tower and a lamp.
function paintBuoy(band: string, other: string, seed: number): SpriteFrame {
  const buffer = createBuffer(20, 32)
  const tones = [hex(band), hex(other)]
  const shade = (color: Rgba, dark: boolean): Rgba =>
    dark ? [color[0] * 0.78, color[1] * 0.78, color[2] * 0.78, 255] : color
  for (let y = 9; y <= 20; y++) {
    const half = 1 + ((y - 9) / 11) * 2.6
    for (let x = Math.round(10 - half); x <= Math.round(9 + half); x++)
      setPixel(buffer, x, y, shade(tones[Math.floor((y - 9) / 4) % 2], x > 10))
  }
  disc(buffer, 10, 23, 7, 5, (x, y) => shade(tones[y < 23 ? 0 : 1], x > 11 || y > 25))
  rect(buffer, 9, 5, 2, 4, hex('#4b4f57'))
  rect(buffer, 8, 3, 4, 3, hex('#ffd447'))
  rect(buffer, 9, 3, 1, 1, white)
  return { ...seaRock(buffer, 26, seed), bob: 1 }
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
  ],
  bamboo: [
    paintBamboo(
      [
        [14, 70, -3],
        [22, 78, 1],
        [30, 66, 4]
      ],
      1300
    ),
    paintBamboo(
      [
        [10, 60, -4],
        [17, 76, -1],
        [24, 80, 1],
        [31, 70, 3],
        [36, 56, 5]
      ],
      1320
    ),
    paintBamboo(
      [
        [18, 46, -2],
        [25, 52, 2]
      ],
      1340
    ),
    paintBamboo(
      [
        [12, 74, -5],
        [20, 80, -2],
        [27, 72, 2],
        [33, 62, 6]
      ],
      1360
    )
  ],
  banana: bananaLooks.map(paintBanana),
  deadtree: [
    paintDeadTree(1, 26, 0.75),
    paintDeadTree(2, 22, 0.9),
    paintDeadTree(3, 28, 0.6),
    paintDeadTree(4, 16, 1)
  ],
  mangrove: [
    paintMangrove(1, 6, 0),
    paintMangrove(2, 5, 3),
    paintMangrove(3, 7, -3),
    paintMangrove(4, 4, 1)
  ],
  monstera: [
    paintMonstera(
      [
        [-155, 13, 7],
        [-25, 13, 7],
        [-115, 15, 8],
        [-62, 16, 8]
      ],
      1400
    ),
    paintMonstera(
      [
        [-165, 14, 7],
        [-90, 17, 7.5],
        [-20, 14, 7.5],
        [-128, 11, 7.5],
        [-52, 11, 7.5]
      ],
      1410
    ),
    paintMonstera(
      [
        [-140, 10, 6.5],
        [-40, 10, 6.5],
        [-90, 13, 7]
      ],
      1420
    ),
    paintMonstera(
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
  cactus: [0, 1, 2, 3].map(paintCactus),
  relic: [paintObelisk(), paintMonolith(), paintBrokenPillar(), paintTrilithon()],
  mushroom: [
    paintMushrooms('#f0604d', '#c23a35', true, 1500),
    paintMushrooms('#c99a6a', '#9a6e45', false, 1501),
    paintMushrooms('#b79ae8', '#8565c4', true, 1502),
    paintMushrooms('#ffc04d', '#e08a2a', false, 1503)
  ],
  shell: [0, 1, 2, 3].map(paintShell),
  campfire: [paintCampfire(false), paintCampfire(true)],
  lantern: [paintLantern(false), paintLantern(true)],
  fireflies: [1600, 1610, 1620, 1630].map(paintFireflies),
  coral: [
    paintCoral(shadesOf('#ffd9e2', '#ff9fb5', '#e0668a'), 11),
    paintCoral(shadesOf('#ffe2b8', '#ffad5c', '#e07a2a'), 12),
    paintCoral(shadesOf('#e9d9ff', '#b99af0', '#8660cf'), 13),
    paintCoral(shadesOf('#ffffff', '#f1ece0', '#cfc6b2'), 14)
  ],
  seaweed: [
    paintSeaweed(shadesOf('#b9d06a', '#7fa843', '#5a8238', '#34572f'), 21),
    paintSeaweed(shadesOf('#d1bd76', '#a08a4a', '#77623a', '#4b3c22'), 22),
    paintSeaweed(shadesOf('#a8d87a', '#62a84a', '#3f8640', '#27592f'), 23),
    paintSeaweed(shadesOf('#c7b46a', '#8c8a44', '#5f6a36', '#3a4526'), 24)
  ],
  flotsam: [
    afloat(paintDriftwood(0), 10, 31),
    afloat(paintDriftwood(1), 10, 32),
    afloat(paintBough(), 14, 33),
    afloat(paintStump(), 12, 34)
  ],
  buoy: [paintBuoy('#e5483f', '#fbf6ea', 41), paintBuoy('#f2c230', '#3d424b', 42)]
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
  const tip = hex('#7b88a7')
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
  const shell = shadesOf('#6fe76d', '#4ebe5d', '#2f993d')
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
