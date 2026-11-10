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
import { type DecorKind, hash2 } from './island-world'

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

type Lump = { x: number; y: number; rx: number; ry: number }

// Paints overlapping lumps (leaf clumps, boulders) lit from the upper left.
// Each pixel takes the lump bulging nearest the viewer, so clumps read as
// separate rounded masses with darker undersides.
function lumps(
  buffer: PixelBuffer,
  shapes: Lump[],
  shades: readonly Rgba[],
  seed: number,
  options: { grain?: number; base?: number; fade?: number } = {}
) {
  const { grain = 0.12, base = 0, fade = 0.3 } = options
  const light = [-0.55, -0.72, 0.42]
  const length = Math.hypot(light[0], light[1], light[2])
  const top = Math.min(...shapes.map((s) => s.y - s.ry))
  const bottom = Math.max(...shapes.map((s) => s.y + s.ry))
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      let best = -Infinity
      let normal: [number, number, number] = [0, 0, 1]
      for (const s of shapes) {
        const dx = (x + 0.5 - s.x) / s.rx
        const dy = (y + 0.5 - s.y) / s.ry
        const d2 = dx * dx + dy * dy
        if (d2 > 1) continue
        const nz = Math.sqrt(1 - d2)
        const depth = s.y + nz * Math.min(s.rx, s.ry) * 0.7
        if (depth > best) {
          best = depth
          normal = [dx, dy, nz]
        }
      }
      if (best === -Infinity) continue
      let lit = (normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]) / length + base
      lit -= ((y - top) / Math.max(1, bottom - top)) * fade
      lit += (hash2(x >> 1, y, seed) - 0.5) * grain + ((x + y) % 2 ? 0.04 : -0.04)
      const index = lit > 0.78 ? 0 : lit > 0.48 ? 1 : lit > 0.16 ? 2 : 3
      setPixel(buffer, x, y, shades[Math.min(index, shades.length - 1)])
    }
  }
}

const shadesOf = (...values: string[]) => values.map((value) => hex(value))
const leafOutline = hex('#1d3a2a')

const treeLooks = [
  {
    leaves: shadesOf('#a6e06c', '#6cba50', '#478f45', '#2c6338'),
    shapes: [
      { x: 28, y: 24, rx: 17, ry: 15 },
      { x: 14, y: 33, rx: 12, ry: 10 },
      { x: 42, y: 33, rx: 12, ry: 10 },
      { x: 20, y: 15, rx: 11, ry: 9 },
      { x: 37, y: 14, rx: 10, ry: 9 },
      { x: 28, y: 42, rx: 15, ry: 8 },
      { x: 8, y: 25, rx: 7, ry: 7 },
      { x: 48, y: 25, rx: 7, ry: 7 }
    ]
  },
  {
    leaves: shadesOf('#9fdb69', '#62b04e', '#3f8744', '#285b36'),
    shapes: [
      { x: 28, y: 22, rx: 18, ry: 16 },
      { x: 13, y: 32, rx: 11, ry: 10 },
      { x: 43, y: 31, rx: 12, ry: 10 },
      { x: 27, y: 9, rx: 11, ry: 8 },
      { x: 28, y: 41, rx: 16, ry: 8 }
    ]
  },
  {
    leaves: shadesOf('#bde27a', '#82c25a', '#55974a', '#36693d'),
    shapes: [
      { x: 28, y: 18, rx: 14, ry: 15 },
      { x: 17, y: 30, rx: 12, ry: 11 },
      { x: 40, y: 30, rx: 12, ry: 11 },
      { x: 28, y: 39, rx: 14, ry: 9 },
      { x: 28, y: 6, rx: 8, ry: 6 }
    ]
  }
]

// Broadleaf trees, about two and a half residents tall.
function paintTree(variant: number): SpriteFrame {
  const buffer = createBuffer(56, 76)
  const look = treeLooks[variant]
  const bark = shadesOf('#a8754a', '#875a39', '#66412a', '#4a2e1f')
  // Trunk with a flared root and a fork that disappears into the canopy.
  for (let y = 36; y <= 74; y++) {
    const flare = y > 68 ? Math.round((y - 68) * 0.8) : 0
    const left = 24 - flare - (y < 46 ? 1 : 0)
    const right = 31 + flare + (y < 46 ? 1 : 0)
    for (let x = left; x <= right; x++) {
      const u = (x - left) / Math.max(1, right - left)
      const groove = hash2(x, y >> 2, 401) < 0.18 && u > 0.2 && u < 0.8
      const shade = u < 0.22 ? 0 : u < 0.6 ? 1 : u < 0.85 ? 2 : 3
      setPixel(buffer, x, y, bark[Math.min(3, shade + (groove ? 1 : 0))])
    }
  }
  for (const [sx, dir] of [
    [25, -1],
    [30, 1]
  ]) {
    for (let i = 0; i < 9; i++) {
      const x = sx + dir * Math.round(i * 0.8)
      setPixel(buffer, x, 40 - i, bark[dir < 0 ? 0 : 2])
      setPixel(buffer, x + dir, 40 - i, bark[dir < 0 ? 1 : 3])
    }
  }
  const canopy = createBuffer(56, 76)
  lumps(canopy, look.shapes, look.leaves, 470 + variant)
  blit(buffer, canopy, 0, 0)
  if (variant === 1) {
    // Fruit tree: apples on the sunny side of the clumps.
    for (const [x, y] of [
      [15, 22],
      [24, 13],
      [36, 19],
      [43, 30],
      [30, 33],
      [12, 34],
      [21, 41],
      [37, 41]
    ]) {
      if (!alphaAt(buffer, x, y)) continue
      setPixel(buffer, x, y, hex('#e0503f'))
      setPixel(buffer, x + 1, y, hex('#b83a36'))
      setPixel(buffer, x, y + 1, hex('#b83a36'))
      setPixel(buffer, x + 1, y + 1, hex('#8e2b2e'))
      setPixel(buffer, x, y - 1, hex('#ff9a7a'))
    }
  }
  outline(buffer, leafOutline)
  return { buffer: padded(buffer, 3), shadow: 'huge', sway: 2 }
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
  const leaf = shadesOf('#a8e46e', '#6ec556', '#46a04a', '#2d7440')
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
    const steps = length * 2
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
        (Math.sin(Math.PI * Math.min(1, t * 1.15)) * 6 + 1) * (1 - t * 0.35)
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
      setPixel(buffer, Math.round(x), Math.round(y) + 1, leaf[back ? 3 : 1])
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
  outline(buffer, leafOutline)
  return { buffer, shadow: 'large', sway: 3 }
}

const bushLooks = [
  shadesOf('#a2dc6c', '#63b551', '#428f47', '#2b6638'),
  shadesOf('#9bd667', '#5aa94e', '#3b8545', '#275d35')
]

// Bushes come up to a resident's chest.
function paintBush(variant: number): SpriteFrame {
  const buffer = createBuffer(34, 24)
  lumps(
    buffer,
    [
      { x: 9, y: 15, rx: 8, ry: 7 },
      { x: 25, y: 15, rx: 8, ry: 7 },
      { x: 17, y: 10, rx: 9.5, ry: 8 },
      { x: 17, y: 18, rx: 11, ry: 5 }
    ],
    bushLooks[variant],
    520 + variant,
    { fade: 0.25 }
  )
  const dots: Array<[number, number]> = [
    [8, 11],
    [15, 6],
    [21, 9],
    [26, 13],
    [12, 16],
    [19, 15],
    [28, 18],
    [6, 18]
  ]
  for (const [x, y] of dots) {
    if (!alphaAt(buffer, x, y)) continue
    if (variant === 1) {
      setPixel(buffer, x, y, hex('#d9415a'))
      setPixel(buffer, x + 1, y, hex('#a82f48'))
      setPixel(buffer, x, y - 1, hex('#ff9fae'))
    } else {
      setPixel(buffer, x, y, hex('#fff6e0'))
      setPixel(buffer, x - 1, y, hex('#fff6e0'))
      setPixel(buffer, x + 1, y, hex('#fff6e0'))
      setPixel(buffer, x, y - 1, hex('#fff6e0'))
      setPixel(buffer, x, y + 1, hex('#f1d76a'))
    }
  }
  outline(buffer, leafOutline)
  return { buffer, shadow: 'medium' }
}

const stone = shadesOf('#e2dfe9', '#b9b4c8', '#8f89a6', '#676183')

// Boulders about as tall as a resident's shoulder.
function paintRock(variant: number): SpriteFrame {
  const buffer = createBuffer(36, 28)
  if (variant === 1) {
    lumps(
      buffer,
      [
        { x: 14, y: 14, rx: 12, ry: 11 },
        { x: 26, y: 20, rx: 8.5, ry: 6.5 },
        { x: 8, y: 21, rx: 6, ry: 5 }
      ],
      stone,
      610,
      { grain: 0.1, fade: 0.2 }
    )
    // A cap of moss on the big stone.
    for (let x = 6; x <= 20; x++) {
      let top = 0
      while (top < buffer.height && !alphaAt(buffer, x, top)) top++
      const depth = 1 + Math.round(Math.sin(((x - 6) / 14) * Math.PI) * 2.5 + hash2(x, 0, 611))
      for (let y = 0; y < depth; y++) {
        const color = y === 0 ? '#a6dc6e' : y < depth - 1 ? '#6fb553' : '#4c8f45'
        setPixel(buffer, x, top + y, hex(color))
      }
    }
  } else {
    lumps(
      buffer,
      [
        { x: 17, y: 15, rx: 15, ry: 11 },
        { x: 11, y: 11, rx: 8, ry: 7 },
        { x: 25, y: 19, rx: 9, ry: 6 }
      ],
      stone,
      612,
      { grain: 0.1, fade: 0.2 }
    )
    // A crack running down the face.
    for (const [x, y] of [
      [19, 9],
      [19, 10],
      [20, 11],
      [20, 12],
      [21, 13],
      [20, 14]
    ]) {
      setPixel(buffer, x, y, stone[3])
      setPixel(buffer, x - 1, y, stone[1])
    }
  }
  // Rest the stones flat on the ground.
  for (let y = 26; y < buffer.height; y++)
    for (let x = 0; x < buffer.width; x++) setPixel(buffer, x, y, [0, 0, 0, 0])
  outline(buffer, hex('#3a3450'))
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

const ink = hex('#2b2236')

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
    outline(buffer, hex('#3a2230'))
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
    outline(buffer, hex('#3a2230'))
    return buffer
  })
  return { buffer: frames[0], frames: frames.slice(1), shadow: 'small' }
}

// A lean-to of sticks and palm leaves with a sleeping mat inside.
function paintShelter(): SpriteFrame {
  const buffer = createBuffer(46, 38)
  const leaves = shadesOf('#c3cf62', '#9bb850', '#77993f', '#d0b85c', '#a9933f')
  const apex = { x: 23, y: 6 }
  for (let y = apex.y; y <= 34; y++) {
    const half = 1 + ((y - apex.y) / 28) * 20
    for (let x = Math.round(apex.x - half); x <= Math.round(apex.x + half); x++) {
      const inside = y >= 15 && Math.abs(x - apex.x) <= ((y - 15) / 19) * 9 + 1
      if (inside) {
        const mat = y >= 31 && Math.abs(x - apex.x) <= 6
        setPixel(buffer, x, y, hex(mat ? (y === 33 ? '#b8894a' : '#e6c877') : '#2e2434'))
        continue
      }
      const right = x > apex.x
      const strip = Math.floor((x + (right ? -1 : 1) * y * 0.6) / 3)
      const band = Math.floor((y - apex.y) / 7)
      let color = leaves[Math.floor(hash2(strip, band, 701) * leaves.length)]
      if ((y - apex.y) % 7 === 6) color = hex(right ? '#4f6b30' : '#5f8236')
      else if (right && hash2(x, y, 702) < 0.5) color = hex('#6a8a3a')
      setPixel(buffer, x, y, color)
    }
  }
  const stick = shadesOf('#c79a62', '#8a6238')
  line(buffer, 23, 14, 13, 34, stick[0])
  line(buffer, 23, 14, 33, 34, stick[1])
  line(buffer, 18, 1, 26, 10, stick[0], 2)
  line(buffer, 28, 1, 20, 10, stick[1], 2)
  outline(buffer, ink)
  return { buffer, shadow: 'huge' }
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
  outline(buffer, ink)
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
  outline(buffer, hex('#4a3d36'))
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
  ['#f25a52', '#c53a45'],
  ['#2fbcc6', '#1f8f9e'],
  ['#ffc83d', '#e09a25'],
  ['#ff8fb4', '#d8577f']
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
    const half = 20 * Math.sqrt(1 - (1 - t) ** 2)
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const u = (x + 0.5 - cx) / half
      if (Math.abs(u) > 1) continue
      const along = (u + 1) * 3.5
      const striped = Math.floor(along) % 2 === 0
      // The rim is scalloped: each panel dips a pixel lower in its middle.
      if (y === 16 && Math.abs((along % 1) - 0.5) > 0.3) continue
      const shaded = u > 0.4 || y >= 15
      setPixel(buffer, x, y, striped ? (shaded ? colorShade : color) : shaded ? creamShade : cream)
    }
  }
  rect(buffer, 21, 1, 2, 2, colorShade)
  outline(buffer, ink)
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
  outline(buffer, ink)
  return { buffer, shadow: null }
}

// A thatched cottage on stilts; on a deck over the lagoon it is a water villa.
function paintBungalow(variant: number): SpriteFrame {
  const buffer = createBuffer(50, 60)
  const thatch = shadesOf('#f6dc8c', '#e0bb63', '#bd9345', '#8f6a30')
  const [curtain, curtainShade] = brights[variant ? 0 : 1]
  // Walls.
  for (let y = 29; y <= 50; y++) {
    for (let x = 7; x <= 42; x++) {
      const seam = (x - 7) % 5 === 4
      setPixel(buffer, x, y, hex(y <= 31 ? '#8a5a36' : seam ? '#b07a45' : '#dba568'))
    }
  }
  // Door with a curtain drawn to one side.
  rect(buffer, 20, 35, 10, 16, thatch[0])
  rect(buffer, 21, 36, 8, 15, hex('#3f2a2e'))
  for (let y = 36; y <= 50; y++) {
    const width = y < 44 ? 4 : 3
    for (let x = 0; x < width; x++)
      setPixel(buffer, 21 + x, y, x === width - 1 || x === 1 ? curtainShade : curtain)
  }
  // Windows with flower boxes.
  for (const x of [10, 33]) {
    rect(buffer, x - 1, 35, 9, 9, thatch[0])
    rect(buffer, x, 36, 7, 7, hex('#bdf3ee'))
    rect(buffer, x, 36, 7, 1, hex('#8fdcdc'))
    rect(buffer, x + 3, 36, 1, 7, thatch[0])
    setPixel(buffer, x + 1, 38, hex('#ffffff'))
    setPixel(buffer, x + 2, 37, hex('#ffffff'))
    rect(buffer, x - 1, 44, 9, 2, hex('#8a5a36'))
    for (let i = 0; i < 9; i += 2) {
      setPixel(buffer, x - 1 + i, 43, hex(i % 4 ? '#ff8fb4' : '#f25a52'))
      setPixel(buffer, x + i, 43, hex('#5aac46'))
    }
  }
  // Porch boards and stilts.
  rect(buffer, 4, 51, 42, 2, hex('#e3ae70'))
  rect(buffer, 4, 53, 42, 1, hex('#a87240'))
  for (const x of [6, 24, 42]) rect(buffer, x, 54, 2, 5, hex('#5c3a25'))
  // Roof: layered thatch, lit from the left.
  for (let y = 4; y <= 28; y++) {
    const t = (y - 4) / 24
    const left = Math.round(16 - t * 15)
    const right = Math.round(33 + t * 15)
    for (let x = left; x <= right; x++) {
      const u = (x - left) / (right - left)
      const base = u < 0.35 ? 0 : u < 0.72 ? 1 : 2
      const band = Math.floor((y - 4) / 5)
      const row = (y - 4) % 5
      let shade = base
      if (row === 4 && hash2(x, band, 731) < 0.85) shade = base + 1
      else if (row === 3 && hash2(x, band, 732) < 0.3) shade = base + 1
      else if (hash2(x >> 1, y, 733) < 0.16) shade = Math.max(0, base - 1)
      setPixel(buffer, x, y, thatch[Math.min(3, shade)])
    }
  }
  rect(buffer, 15, 2, 20, 2, thatch[2])
  rect(buffer, 15, 4, 20, 1, thatch[3])
  rect(buffer, 15, 2, 8, 1, thatch[1])
  outline(buffer, ink)
  return { buffer, shadow: null }
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
  outline(buffer, ink)
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
  outline(buffer, ink)
  surf(buffer, 56, 1)
  return { buffer, shadow: null }
}

const reefStone = shadesOf('#b4b0c6', '#8a86a0', '#636079', '#454259')

function paintSeaRock(variant: number): SpriteFrame {
  const buffer = createBuffer(36, 30)
  lumps(
    buffer,
    variant === 0
      ? [
          { x: 18, y: 14, rx: 11, ry: 10 },
          { x: 9, y: 19, rx: 7, ry: 6 },
          { x: 27, y: 19, rx: 7, ry: 5 }
        ]
      : [
          { x: 15, y: 11, rx: 7, ry: 10 },
          { x: 24, y: 17, rx: 8, ry: 7 },
          { x: 9, y: 20, rx: 6, ry: 4 }
        ],
    reefStone,
    760 + variant,
    { grain: 0.1, fade: 0.25 }
  )
  for (let y = 24; y < buffer.height; y++)
    for (let x = 0; x < buffer.width; x++) setPixel(buffer, x, y, [0, 0, 0, 0])
  outline(buffer, hex('#2f2c42'))
  surf(buffer, 24, 2 + variant)
  return { buffer, shadow: null }
}

function paintBoat(variant: number): SpriteFrame {
  const buffer = createBuffer(40, 24)
  const [trim] = brights[variant ? 0 : 1]
  const cx = 20
  for (let x = 4; x < 36; x++) {
    const u = (x + 0.5 - cx) / 16
    const rim = 10 + 6 * Math.sqrt(Math.max(0, 1 - u * u))
    for (let y = 10; y <= Math.round(rim) + 5; y++) {
      const below = y - Math.round(rim)
      setPixel(buffer, x, y, below >= 5 ? creamShade : below >= 2 && below <= 3 ? trim : cream)
    }
  }
  disc(buffer, cx, 10, 16, 6, (x, y) => {
    const d = ((x + 0.5 - cx) / 16) ** 2 + ((y + 0.5 - 10) / 6) ** 2
    if (d > 0.62) return hex(y < 10 ? '#f1c98a' : '#e3ae70')
    if (Math.abs(x - 13) <= 1 || Math.abs(x - 26) <= 1) return hex('#cb9159')
    return hex(y < 9 ? '#6f4a30' : '#8a5a36')
  })
  outline(buffer, ink)
  for (let x = 6; x < 34; x++) if (hash2(x, variant, 771) < 0.55) setPixel(buffer, x, 22, white)
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
  outline(buffer, ink)
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
  disc(buffer, width / 2, height / 2, width / 2, height / 2, () => [10, 50, 60, 70])
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
