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

function paintTree(variant: number): SpriteFrame {
  const buffer = createBuffer(68, 88)
  const seed = 470 + variant * 31
  const lean = variant === 0 ? -4 : variant === 1 ? 3 : -1
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
    const y =
      ty +
      Math.round((hash2(i, seed, 421) - 0.5) * 9) +
      (variant === 2 ? Math.round(Math.abs(tx - 34) * 0.35) : 0)
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
  if (variant === 1) {
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

// Palms lean out over the sand, about three residents tall.
function paintPalm(variant: number): SpriteFrame {
  const buffer = createBuffer(84, 90)
  const lean = variant === 1 ? -1 : 1
  const base = { x: 42, y: 87 }
  const crown = { x: 42 + lean * 11, y: 30 }
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
  for (const [degrees, length, droop] of fronds) {
    const angle = ((degrees + lean * 4) * Math.PI) / 180
    const back = Math.sin(angle) > 0.3
    const steps = length
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const d = length * t
      const x = crown.x + Math.cos(angle) * d
      const y = crown.y + Math.sin(angle) * d * 0.55 + droop * d * t * 0.9
      // Tangent, and the leaflets' direction: back along the frond and downward.
      const tx = Math.cos(angle)
      const ty = Math.sin(angle) * 0.55 + droop * t * 1.8
      const tl = Math.hypot(tx, ty)
      const leaflet = Math.round(
        (Math.sin(Math.PI * Math.min(1, t * 1.15)) * 7 + 1) * (1 - t * 0.35)
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
  for (const [dx, dy] of [
    [-2, 3],
    [2, 3],
    [0, 5]
  ]) {
    disc(buffer, crown.x + dx, crown.y + dy, 2.3, 2.3, (x, y) =>
      hex(x + y < crown.x + dx + crown.y + dy ? '#9a6a3c' : '#6b4426')
    )
  }

  return { buffer, shadow: 'large', sway: 3 }
}

function paintBush(variant: number): SpriteFrame {
  const buffer = createBuffer(34, 25)
  for (let i = 0; i < 7; i++) {
    const x = 5 + i * 4
    const y = 6 + hash2(i, variant, 520) * 11
    branch(buffer, 17, 24, x, y, 0.7)
    leafSpray(buffer, x, y, 4.5, 530 + i + variant * 10, i > 4)
    if (variant === 1 && i % 2 === 0) setPixel(buffer, x, Math.round(y), hex('#9d4e48'))
  }
  return { buffer, shadow: 'medium', sway: 1 }
}

// Fractured faces share edges, not overlapping ellipses.
function rockFaces(buffer: PixelBuffer, variant: number, wet = false) {
  const peak: [number, number] = variant ? [12, 3] : [17, 6]
  const left: [number, number] = [4, 13]
  const ridge: [number, number] = variant ? [20, 12] : [22, 14]
  const right: [number, number] = [31, 11 + variant * 4]
  const base: [number, number] = [27, 25]
  const tones = wet ? [124, 140, 137] : [157, 162, 149]
  const face = (points: Array<[number, number]>, light: number) =>
    polygon(buffer, points, (x, y) => {
      const grain = (hash2(x, y, 620 + variant) - 0.5) * 16
      const strata = Math.sin(y * 0.9 + x * 0.24) > 0.85 ? -12 : 0
      const shade = light + grain + strata - (wet ? y * 0.8 : 0)
      return [tones[0] + shade, tones[1] + shade, tones[2] + shade, 255]
    })
  face([left, peak, [25, 5 + variant * 3], right, ridge], 28)
  face([left, ridge, [16, 25], [3, 22]], -6)
  face([ridge, right, [34, 22], base, [16, 25]], -40)
  line(buffer, peak[0], peak[1] + 1, ridge[0], ridge[1], hex('#bec1ad'))
  line(buffer, 10, 15, 13, 18, hex('#505b50'))
  line(buffer, 13, 18, 11, 23, hex('#505b50'))
  for (let y = 15; y < 25; y++) {
    for (let x = 4; x < 29; x++) {
      if (alphaAt(buffer, x, y) && valueNoise(x / 4, y / 3, 630 + variant) > 0.65)
        setPixel(buffer, x, y, hex(hash2(x, y, 632) < 0.4 ? '#8e9870' : '#657456'))
    }
  }
}

function paintRock(variant: number): SpriteFrame {
  const buffer = createBuffer(36, 28)
  rockFaces(buffer, variant)
  return { buffer, shadow: 'medium' }
}

const flowerColors = [
  ['#f48fb4', '#d8577f'],
  ['#ffe07a', '#e3a93b'],
  ['#b9a2ff', '#7d64d6'],
  ['#fffaf0', '#d9cbb8']
] as const

function paintFlowers(variant: number): SpriteFrame {
  const buffer = createBuffer(16, 14)
  const stem = hex('#3f8a3d')
  const leaf = hex('#5aac46')
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
    setPixel(buffer, x - 1, y + 3, leaf)
    setPixel(buffer, x + 1, y + 3, leaf)
    setPixel(buffer, x, y - 1, petal)
    setPixel(buffer, x - 1, y, petal)
    setPixel(buffer, x + 1, y, petalDark)
    setPixel(buffer, x, y + 1, petalDark)
    setPixel(buffer, x, y, hex('#ffd34d'))
  }
  return { buffer: padded(buffer, 1), shadow: 'small', sway: 1 }
}

// ---- Drawing helpers --------------------------------------------------------

const ink = hex('#444638')

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

// ---- Castaway things --------------------------------------------------------

function paintCampfire(): SpriteFrame {
  const wood = shadesOf('#b07c4f', '#7d5236', '#553622')
  const pebble = shadesOf('#d6d2df', '#a39fb5', '#716c88')
  const stone = (buffer: PixelBuffer, cx: number, cy: number) => {
    disc(buffer, cx, cy, 2.6, 2.1, (x, y) =>
      y < cy - 0.6 ? pebble[0] : x > cx ? pebble[2] : pebble[1]
    )
  }
  const frames = [0, 1, 2].map((f) => {
    const buffer = createBuffer(26, 28)
    const ring = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 + 0.3)
    for (const a of ring)
      if (Math.sin(a) < 0) stone(buffer, 13 + Math.cos(a) * 9, 21 + Math.sin(a) * 3.4)
    line(buffer, 5, 22, 18, 17, (k) => wood[k], 2)
    line(buffer, 21, 22, 8, 17, (k) => wood[k + 1], 2)
    flame(buffer, 13, 20, 16, 5, f)
    for (const a of ring)
      if (Math.sin(a) >= 0) stone(buffer, 13 + Math.cos(a) * 9, 21 + Math.sin(a) * 3.4)

    return buffer
  })
  return { buffer: frames[0], frames: frames.slice(1), shadow: null }
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

// Palm-leaf lean-to with an open side and a roof resting on lashed poles.
function paintShelter(): SpriteFrame {
  const buffer = createBuffer(48, 40)
  polygon(
    buffer,
    [
      [7, 31],
      [29, 25],
      [43, 33],
      [21, 38]
    ],
    () => hex('#82734e')
  )
  line(buffer, 27, 8, 28, 34, hex('#665b40'), 2)
  line(buffer, 9, 11, 7, 34, hex('#b29a6c'), 2)
  polygon(
    buffer,
    [
      [9, 9],
      [28, 5],
      [45, 29],
      [23, 34]
    ],
    (x, y) => {
      const rib = (x + Math.floor(y * 0.65)) % 4
      const row = Math.floor(y / 6)
      const tone = hash2(x >> 1, row, 710) * 22 - (y % 6 === 5 ? 25 : 0)
      return [117 + tone + rib * 4, 120 + tone, 72 + tone, 255]
    }
  )
  line(buffer, 9, 9, 28, 5, hex('#c0a77a'))
  line(buffer, 23, 34, 45, 29, hex('#645c3c'), 2)
  line(buffer, 9, 10, 23, 34, hex('#a79568'))
  for (let y = 8; y < 12; y++) line(buffer, 8, y, 11, y, hex('#dfd1a6'))
  return { buffer, shadow: 'large' }
}

function paintChest(): SpriteFrame {
  const buffer = createBuffer(20, 18)
  rect(buffer, 2, 8, 16, 8, hex('#9a6238'))
  rect(buffer, 2, 14, 16, 2, hex('#6f4426'))
  rect(buffer, 2, 8, 1, 6, hex('#b97a48'))
  for (let y = 2; y <= 7; y++) {
    const inset = y < 4 ? 4 - y : 0
    rect(buffer, 2 + inset, y, 16 - inset * 2, 1, hex(y === 2 ? '#d4955a' : '#b0703f'))
  }
  for (const x of [5, 13]) {
    rect(buffer, x, 2, 1, 14, hex('#f3c545'))
    rect(buffer, x + 1, 2, 1, 14, hex('#c9962b'))
  }
  // The lid is ajar: a line of gold shows through.
  rect(buffer, 3, 8, 14, 1, hex('#3a2230'))
  for (const x of [7, 8, 10, 11, 15]) setPixel(buffer, x, 8, hex('#ffe680'))
  rect(buffer, 9, 8, 2, 3, hex('#ffe680'))
  rect(buffer, 9, 10, 2, 1, hex('#c9962b'))

  return { buffer, shadow: 'small' }
}

function paintDriftwood(variant: number): SpriteFrame {
  const buffer = createBuffer(32, 16)
  const wood = shadesOf('#eadbc0', '#c9b494', '#a18b6e', '#7e6a55')
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

// SOS spelled in dark stones, to be read from the sky.
function paintSos(): SpriteFrame {
  const buffer = createBuffer(48, 14)
  const letters = {
    S: ['.####', '#....', '.###.', '....#', '####.'],
    O: ['.###.', '#...#', '#...#', '#...#', '.###.']
  }
  ;(['S', 'O', 'S'] as const).forEach((letter, i) => {
    letters[letter].forEach((row, ry) => {
      for (let rx = 0; rx < 5; rx++) {
        if (row[rx] !== '#') continue
        const x = 3 + i * 16 + rx * 2
        const y = 2 + ry * 2
        const light = hash2(i * 5 + rx, ry, 721) < 0.35
        setPixel(buffer, x, y, hex(light ? '#a5a0b8' : '#77728c'))
        setPixel(buffer, x + 1, y, hex('#77728c'))
        setPixel(buffer, x, y + 1, hex('#4d4963'))
        setPixel(buffer, x + 1, y + 1, hex('#3d3a52'))
      }
    })
  })
  return { buffer, shadow: null, flat: true }
}

// ---- Resort things ----------------------------------------------------------

const cream = hex('#fff7e3')
const creamShade = hex('#d9cdb8')
const brights = [
  ['#ba7764', '#86544c'],
  ['#79a4a0', '#4e7675'],
  ['#c3aa72', '#96804f'],
  ['#c19591', '#926964']
].map(([light, dark]) => [hex(light), hex(dark)] as const)

// A striped parasol over a sun lounger.
function paintParasol(variant: number): SpriteFrame {
  const buffer = createBuffer(42, 44)
  const [color, colorShade] = brights[variant]
  const wood = shadesOf('#b98a55', '#8a5a36')
  // Lounger: legs, seat and a raised back.
  rect(buffer, 16, 38, 2, 4, wood[1])
  rect(buffer, 34, 38, 2, 4, wood[1])
  for (let x = 16; x <= 37; x++) {
    setPixel(buffer, x, 35, Math.floor(x / 3) % 2 ? color : cream)
    setPixel(buffer, x, 36, Math.floor(x / 3) % 2 ? colorShade : creamShade)
    setPixel(buffer, x, 37, wood[0])
  }
  line(buffer, 16, 34, 10, 26, (k) => (k === 2 ? wood[0] : k ? creamShade : cream), 3)
  // Pole and canopy.
  rect(buffer, 21, 15, 1, 27, cream)
  rect(buffer, 22, 15, 1, 27, hex('#a89c8a'))
  const cx = 21.5
  for (let y = 3; y <= 16; y++) {
    const t = Math.min(1, (y - 3) / 12)
    const half = 2 + 18 * t ** 0.8
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const u = (x + 0.5 - cx) / half
      if (Math.abs(u) > 1) continue
      const along = (u + 1) * 3.5
      const striped = Math.floor(along) % 2 === 0
      // The rim is scalloped: each panel dips a pixel lower in its middle.
      if (y === 16 && Math.abs((along % 1) - 0.5) > 0.3) continue
      const shaded = u > 0.4 || y >= 15 || along % 1 < 0.12
      setPixel(buffer, x, y, striped ? (shaded ? colorShade : color) : shaded ? creamShade : cream)
    }
  }
  rect(buffer, 21, 1, 2, 2, colorShade)

  return { buffer, shadow: 'large' }
}

function paintHammock(variant: number): SpriteFrame {
  const buffer = createBuffer(50, 30)
  const [color, colorShade] = brights[variant ? 1 : 0]
  const wood = shadesOf('#c79a62', '#8a6238', '#5f3d26')
  for (const x of [3, 44]) {
    rect(buffer, x, 4, 1, 24, wood[0])
    rect(buffer, x + 1, 4, 1, 24, wood[1])
    rect(buffer, x + 2, 4, 1, 24, wood[2])
    rect(buffer, x - 1, 3, 5, 1, wood[0])
  }
  for (let x = 6; x <= 43; x++) {
    const t = (x - 6) / 37
    const sag = Math.sin(Math.PI * t)
    const top = Math.round(8 + sag * 9)
    if (x < 10 || x > 39) {
      setPixel(buffer, x, top, hex('#e9dcc0'))
      continue
    }
    const depth = Math.round(3 + sag * 2)
    for (let k = 0; k < depth; k++) {
      const stripe = Math.floor(x / 3) % 2 === 0
      const low = k >= depth - 1
      setPixel(buffer, x, top + k, stripe ? (low ? colorShade : color) : low ? creamShade : cream)
    }
    if (x % 3 === 0) setPixel(buffer, x, top + depth, creamShade)
  }
  disc(buffer, 14, 12, 3, 2, (_x, y) => (y < 12 ? cream : creamShade))

  return { buffer, shadow: null }
}

// Three-quarter view: the front, shaded side, roof planes and veranda
// have a common vanishing direction, with supports visibly carrying the floor.
function paintBungalow(variant: number): SpriteFrame {
  const buffer = createBuffer(64, 68)
  const timber = (x: number, y: number, shade = 0): Rgba => {
    const plank = Math.floor(x / 4)
    const grain = Math.sin(x * 2.1 + Math.sin(y * 0.22)) * 6
    const joint = x % 4 === 0 ? -25 : 0
    const light = shade + grain + joint + hash2(plank, variant, 731) * 12
    return [161 + light, 139 + light, 105 + light, 255]
  }
  // Raised foundation, diagonal bracing and floor seen from above.
  for (const [x, y] of [
    [8, 58],
    [38, 61],
    [55, 54]
  ]) {
    rect(buffer, x, y, 2, 7, hex('#59503e'))
    setPixel(buffer, x, y + 6, hex('#3e4639'))
  }
  line(buffer, 10, 64, 36, 59, hex('#89775a'))
  line(buffer, 40, 64, 54, 55, hex('#75694f'))
  polygon(
    buffer,
    [
      [4, 53],
      [25, 46],
      [60, 51],
      [39, 61],
      [4, 58]
    ],
    (x, y) => timber(x, y, y % 3 === 0 ? -15 : 10)
  )
  polygon(
    buffer,
    [
      [8, 29],
      [40, 34],
      [40, 55],
      [8, 51]
    ],
    (x, y) => timber(x, y, y < 36 ? -25 : 0)
  )
  polygon(
    buffer,
    [
      [40, 34],
      [56, 26],
      [56, 48],
      [40, 55]
    ],
    (x, y) => timber(x, y, -35)
  )
  // Recessed doorway and separate shutters with hinges.
  polygon(
    buffer,
    [
      [21, 36],
      [31, 37],
      [31, 54],
      [21, 53]
    ],
    () => hex('#343d32')
  )
  line(buffer, 20, 35, 20, 53, hex('#c5b28c'))
  line(buffer, 20, 35, 32, 37, hex('#b19e78'))
  for (let x = 23; x < 29; x++) line(buffer, x, 38, x, 52, hex(x % 2 ? '#796650' : '#99815e'))
  setPixel(buffer, 27, 46, hex('#c1b487'))
  polygon(
    buffer,
    [
      [11, 37],
      [17, 38],
      [17, 44],
      [11, 43]
    ],
    () => hex('#486267')
  )
  line(buffer, 11, 37, 15, 38, hex('#b4c4b6'))
  line(buffer, 14, 38, 14, 43, hex('#a59575'))
  line(buffer, 10, 44, 18, 45, hex('#bfac89'))
  polygon(
    buffer,
    [
      [45, 36],
      [52, 32],
      [52, 39],
      [45, 43]
    ],
    () => hex('#303f3f')
  )
  line(buffer, 49, 35, 49, 40, hex('#887b5e'))
  // Roof ridge runs back into the scene; long straw falls down each slope.
  const thatch = (x: number, y: number, dark: boolean): Rgba => {
    const strand = hash2(Math.floor(x + y * 0.35), Math.floor(y / 9), 735)
    const seam = y % 8 === 7 ? -18 : 0
    const tone = strand * 31 + seam - (dark ? 36 : 0)
    return [151 + tone, 134 + tone, 94 + tone, 255]
  }
  polygon(
    buffer,
    [
      [3, 30],
      [19, 8],
      [39, 4],
      [43, 35]
    ],
    (x, y) => thatch(x, y, false)
  )
  polygon(
    buffer,
    [
      [39, 4],
      [61, 27],
      [43, 35]
    ],
    (x, y) => thatch(x, y, true)
  )
  line(buffer, 19, 8, 39, 4, hex('#c5b489'), 2)
  line(buffer, 3, 31, 43, 36, hex('#645940'), 2)
  line(buffer, 43, 36, 61, 28, hex('#4e4935'), 2)
  // Thin veranda posts and open railing leave the facade visible.
  for (const x of [6, 37]) {
    line(buffer, x, 34 + Math.round(x * 0.12), x, 58 + Math.round(x * 0.08), hex('#8c7958'))
  }
  line(buffer, 6, 50, 17, 52, hex('#b2a07a'))
  line(buffer, 32, 54, 38, 55, hex('#b2a07a'))
  for (let x = 8; x < 18; x += 3) line(buffer, x, 51, x, 57, hex('#7b6c50'))
  line(buffer, 20, 57, 31, 59, hex('#c0ab86'), 2)
  line(buffer, 19, 60, 30, 62, hex('#8c7958'), 2)
  return { buffer, shadow: 'huge' }
}

function paintSurfboard(variant: number): SpriteFrame {
  const buffer = createBuffer(16, 32)
  const looks = [
    [cream, brights[0][0], creamShade],
    [brights[2][0], brights[1][0], brights[2][1]],
    [brights[1][0], cream, brights[1][1]],
    [brights[3][0], cream, brights[3][1]]
  ] as const
  const [board, stripe, shade] = looks[variant]
  for (let y = 1; y <= 28; y++) {
    const half = 5.2 * Math.sqrt(Math.max(0, 1 - ((y - 15) / 14.5) ** 2))
    for (let x = Math.floor(8 - half); x < Math.ceil(8 + half); x++) {
      const u = (x + 0.5 - 8) / Math.max(1, half)
      if (Math.abs(u) > 1) continue
      const striped = x === 7 || x === 8 || (y >= 8 && y <= 10)
      setPixel(buffer, x, y, striped ? stripe : u > 0.45 ? shade : board)
    }
  }

  rect(buffer, 3, 29, 10, 1, hex('#e5d19e'))
  rect(buffer, 2, 30, 12, 1, hex('#d8bf8a'))
  return { buffer, shadow: 'small' }
}

// ---- Things in the sea ------------------------------------------------------

const white = hex('#ffffff')
const spray = hex('#c9f4f1')

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

// A wooden ship run aground: bow in the air, stern awash, sail in tatters.
function paintWreck(): SpriteFrame {
  const buffer = createBuffer(84, 64)
  const wood = shadesOf('#b98a55', '#946a45', '#74503a', '#553828', '#3d281f')
  const slope = 0.19
  polygon(
    buffer,
    [
      [6, 28],
      [58, 38],
      [58, 30],
      [75, 33],
      [77, 56],
      [22, 56],
      [11, 44]
    ],
    (x, y) => {
      const v = y - x * slope
      const plank = Math.floor(v / 4)
      const hole =
        ((x - 37) / 8) ** 2 + ((y - 47) / 5) ** 2 + (hash2(x >> 1, y >> 1, 751) - 0.5) * 0.5
      if (hole < 1) return x % 4 === 0 ? wood[2] : hex('#2a1b1e')
      if (Math.floor(v) % 4 === 0) return wood[4]
      if (y > 50 && hash2(x, y, 752) < 0.45) return hex('#4f7a5a')
      if (plank <= 6 && x < 58) return wood[1]
      return hash2(plank, x >> 3, 753) < 0.3
        ? wood[1]
        : hash2(plank, x >> 2, 754) < 0.15
          ? wood[3]
          : wood[2]
    }
  )
  line(buffer, 6, 27, 58, 37, (k) => wood[k], 2)
  line(buffer, 58, 29, 75, 32, (k) => wood[k], 2)
  rect(buffer, 63, 38, 5, 4, hex('#2a1b1e'))
  rect(buffer, 63, 37, 5, 1, hex('#f3c545'))
  // Mast, yard and what is left of the sail.
  line(buffer, 54, 35, 56, 22, (k) => wood[k + 1], 2)
  polygon(
    buffer,
    [
      [15, 18],
      [42, 13],
      [41, 30],
      [34, 26],
      [29, 34],
      [22, 27],
      [17, 31]
    ],
    (x, y) => {
      if (hash2(x >> 1, y >> 1, 755) < 0.07) return null
      return (x + Math.floor(y / 3)) % 7 === 0 || y > 27 ? hex('#d6caad') : hex('#f4ecd8')
    }
  )
  line(buffer, 35, 37, 28, 5, (k) => wood[k * 2], 2)
  line(buffer, 13, 17, 44, 11, (k) => wood[k + 1], 2)
  line(buffer, 28, 5, 8, 27, hex('#5f4a3a'))

  surf(buffer, 56, 1)
  return { buffer, shadow: null }
}

function paintSeaRock(variant: number): SpriteFrame {
  const buffer = createBuffer(36, 30)
  rockFaces(buffer, variant, true)
  surf(buffer, 24, 2 + variant)
  return { buffer, shadow: null }
}

function paintBoat(variant: number): SpriteFrame {
  const buffer = createBuffer(44, 26)
  const [trim, trimShade] = brights[variant ? 0 : 1]
  // A pointed bow, flat transom and tapered hull instead of a bathtub ellipse.
  polygon(
    buffer,
    [
      [2, 10],
      [13, 3],
      [37, 8],
      [41, 14],
      [33, 23],
      [11, 19]
    ],
    (x, y) => {
      if (y > 17) return hex('#6c6250')
      return y > 13 ? trimShade : x > 34 ? trim : hex('#b1a184')
    }
  )
  polygon(
    buffer,
    [
      [5, 10],
      [14, 5],
      [35, 9],
      [37, 13],
      [30, 18],
      [13, 15]
    ],
    (x, y) => hex((y + Math.floor(x * 0.16)) % 3 === 0 ? '#605441' : '#8e7958')
  )
  line(buffer, 2, 10, 13, 3, hex('#d0bea0'))
  line(buffer, 13, 3, 37, 8, hex('#b5a284'))
  line(buffer, 2, 11, 11, 19, hex('#b6a381'))
  line(buffer, 11, 19, 33, 23, hex('#a09071'))
  line(buffer, 15, 7, 12, 15, hex('#ba9d6c'), 2)
  line(buffer, 29, 9, 26, 17, hex('#ba9d6c'), 2)
  line(buffer, 21, 10, 38, 22, hex('#b6a07c'))
  line(buffer, 35, 20, 39, 23, hex('#b6a07c'), 2)
  return { buffer, shadow: null, bob: 1 }
}

function paintFloat(variant: number): SpriteFrame {
  const buffer = createBuffer(20, 16)
  const [color, colorShade] = brights[variant]
  disc(buffer, 10, 7, 8, 5, (x, y) => {
    const dx = x + 0.5 - 10
    const dy = y + 0.5 - 7
    if ((dx / 3.2) ** 2 + (dy / 1.7) ** 2 < 1) return null
    const striped = Math.floor((Math.atan2(dy * 1.6, dx) / Math.PI) * 4 + 8.5) % 2 === 0
    const low = dy > 1.2
    return striped ? (low ? colorShade : color) : low ? creamShade : cream
  })

  return { buffer, shadow: null, bob: 1 }
}

export const decorVariants = {
  tree: [0, 1, 2].map(paintTree),
  palm: [0, 1].map(paintPalm),
  bush: [0, 1].map(paintBush),
  rock: [0, 1].map(paintRock),
  flowers: [0, 1, 2].map(paintFlowers),
  campfire: [paintCampfire()],
  shelter: [paintShelter()],
  chest: [paintChest()],
  driftwood: [0, 1].map(paintDriftwood),
  sos: [paintSos()],
  parasol: [0, 1, 2].map(paintParasol),
  hammock: [0, 1].map(paintHammock),
  torch: [paintTorch()],
  bungalow: [0, 1].map(paintBungalow),
  surfboard: [0, 1, 2, 3].map(paintSurfboard),
  wreck: [paintWreck()],
  searock: [0, 1].map(paintSeaRock),
  boat: [0, 1].map(paintBoat),
  float: [0, 1, 2].map(paintFloat)
} satisfies Record<DecorKind, SpriteFrame[]>

export function decorVariantIndex(kind: DecorKind, x: number, y: number) {
  const roll = hash2(x, y, 211)
  // Fruit trees and berry bushes are the occasional treat.
  if (kind === 'tree') return roll < 0.2 ? 1 : roll < 0.6 ? 0 : 2
  if (kind === 'bush') return roll < 0.22 ? 1 : 0
  return Math.floor(roll * decorVariants[kind].length)
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
