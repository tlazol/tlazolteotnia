import {
  BoxGeometry,
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  SRGBColorSpace
} from 'three'

// Every shape is authored in a unit box and scaled per part.
type Point = [x: number, y: number, z: number]
type Profile = readonly (readonly [y: number, radius: number])[]

const tau = Math.PI * 2
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const smooth = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from))
  return t * t * (3 - 2 * t)
}

function build(grid: Point[][], uvs?: number[][][]) {
  const positions: number[] = []
  const coords: number[] = []
  const indices: number[] = []
  const columns = grid[0].length
  for (const [row, points] of grid.entries()) {
    for (const [col, point] of points.entries()) {
      positions.push(...point)
      if (uvs) coords.push(...uvs[row][col])
      if (row < grid.length - 1 && col < columns - 1) {
        const a = row * columns + col
        indices.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  if (uvs) geometry.setAttribute('uv', new Float32BufferAttribute(coords, 2))
  // Profiles run either way; flip the winding when the surface faces inward.
  const center = [0, 1, 2].map(
    (axis) =>
      positions.filter((_, i) => i % 3 === axis).reduce((a, b) => a + b, 0) / (positions.length / 3)
  )
  let facing = 0
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]].map((index) =>
      positions.slice(index * 3, index * 3 + 3)
    )
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    facing +=
      (u[1] * v[2] - u[2] * v[1]) * (a[0] - center[0]) +
      (u[2] * v[0] - u[0] * v[2]) * (a[1] - center[1]) +
      (u[0] * v[1] - u[1] * v[0]) * (a[2] - center[2])
  }
  if (facing < 0)
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // A soft key from the camera's upper left; the toon ramp turns it into bands.
  const normals = geometry.getAttribute('normal')
  const shades: number[] = []
  for (let i = 0; i < normals.count; i++) {
    const light = -0.35 * normals.getX(i) + 0.7 * normals.getY(i) + 0.6 * normals.getZ(i)
    const shade = 0.9 + clamp(light, -1, 1) * 0.1
    shades.push(shade, shade, shade)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(shades, 3))
  return geometry
}

// Revolves a profile around Y. Angle 0 faces +Z; a partial sweep leaves the front open.
function lathe(profile: Profile, segments = 16, from = 0, to = tau, wobble = 0, lobes = 0) {
  return build(
    profile.map(([y, radius]) =>
      Array.from({ length: segments + 1 }, (_, col) => {
        const a = from + ((to - from) * col) / segments
        const r = radius * (1 + wobble * Math.cos(a * lobes))
        return [Math.sin(a) * r, y, Math.cos(a) * r] as Point
      })
    )
  )
}

// A round "mochi" head: full cheeks below the equator and a gently domed crown.
export function headPoint(a: number, latitude: number, inflate = 1): Point {
  const y = Math.sin(latitude) * 0.5
  const cheeks = 1 + 0.07 * Math.max(0, -Math.sin(latitude * 2))
  const radius = Math.cos(latitude) * 0.5 * cheeks * inflate
  return [Math.sin(a) * radius, y * (latitude > 0 ? inflate : 1), Math.cos(a) * radius]
}

const sphere = (rows = 12, segments = 16) =>
  build(
    Array.from({ length: rows + 1 }, (_, row) => {
      const latitude = -Math.PI / 2 + (row / rows) * Math.PI
      return Array.from({ length: segments + 1 }, (_, col) => {
        const a = (col / segments) * tau
        return [
          Math.sin(a) * Math.cos(latitude) * 0.5,
          Math.sin(latitude) * 0.5,
          Math.cos(a) * Math.cos(latitude) * 0.5
        ] as Point
      })
    })
  )

export const hairBangs = ['blunt', 'parted', 'swept', 'pointy', 'wispy'] as const
export type HairBangs = (typeof hairBangs)[number]

// Hem heights in head units (the head spans -0.5 to 0.5). The eyes stop at 0.035.
function bangHem(bangs: HairBangs, a: number) {
  switch (bangs) {
    case 'blunt':
      return 0.06 + 0.012 * Math.cos(a * 9)
    case 'parted':
      return 0.055 + 0.17 * clamp(1 - Math.abs(a) / 0.42) ** 1.4 + 0.02 * Math.abs(Math.sin(a * 6))
    case 'swept':
      return 0.055 + 0.15 * smooth(-0.7, 0.7, a) + 0.018 * Math.abs(Math.sin(a * 7))
    case 'pointy':
      return 0.1 - 0.065 * Math.abs(Math.sin(a * 5.2 + 0.3)) ** 0.6
    case 'wispy':
      return 0.11 - 0.07 * Math.max(0, Math.cos(a * 8.5)) ** 2.5
  }
}

// Hair cap over the head. The face window opens below the fringe; the sides fall to the
// jaw and the nape. A short inner lip gives the hem visible thickness.
function hairShell(hem: (a: number) => number, inflate: number, segments = 48, rows = 14) {
  const grid: Point[][] = []
  const columns = Array.from(
    { length: segments + 1 },
    (_, col) => -Math.PI + (col / segments) * tau
  )
  const bottoms = columns.map((a) => Math.asin(clamp(hem(a) * 2, -0.98, 0.98)))
  grid.push(columns.map((a, col) => headPoint(a, bottoms[col], 0.985)))
  for (let row = 0; row <= rows; row++) {
    const t = row / rows
    grid.push(
      columns.map((a, col) => {
        const latitude = bottoms[col] + (Math.PI / 2 - bottoms[col]) * t ** 0.85
        // Faint strands catch the toon light without a texture.
        const strands = 1 + 0.012 * Math.cos(a * 14) * Math.sin(t * Math.PI)
        return headPoint(a, latitude, inflate * strands)
      })
    )
  }
  return build(grid)
}

function sideHem(a: number, front: number) {
  const side = -0.2 - 0.17 * smooth(1.35, 2.3, Math.abs(a))
  const weight = 1 - smooth(0.8, 1.3, Math.abs(a))
  return weight * front + (1 - weight) * side
}

// A thin "angel ring" highlight across the front of the crown, tapering at both ends.
function hairHalo() {
  return build(
    [-1, 0, 1].map((row) =>
      Array.from({ length: 41 }, (_, col) => {
        const a = -1.9 + (col / 40) * 3.8
        const taper = Math.sin((col / 40) * Math.PI) ** 0.6
        const zig = row * (0.05 + 0.015 * Math.cos(a * 11)) * taper
        return headPoint(a, 0.78 + zig, 1.1 + (row === 0 ? 0.008 : 0))
      })
    )
  )
}

// A strip around the head at a fixed height: hairbands, beanie cuffs and headdresses.
function headBand(low: number, high: number, inflate: number, from = -Math.PI, to = Math.PI) {
  return build(
    [low, (low + high) / 2, high].map((latitude, row) =>
      Array.from({ length: 41 }, (_, col) => {
        const a = from + ((to - from) * col) / 40
        return headPoint(a, latitude, inflate + (row === 1 ? 0.012 : 0))
      })
    )
  )
}

const faceSlots = 6
const faceSpan = 1.7
const faceLow = -0.44
const faceHigh = 0.14

function faceGeometry(slot: number) {
  const grid: Point[][] = []
  const uvs: number[][][] = []
  for (let row = 0; row <= 12; row++) {
    const y = faceLow + ((faceHigh - faceLow) * row) / 12
    const latitude = Math.asin(y * 2)
    grid.push([])
    uvs.push([])
    for (let col = 0; col <= 16; col++) {
      const a = -faceSpan / 2 + (faceSpan * col) / 16
      grid[row].push(headPoint(a, latitude, 1.012))
      uvs[row].push([(slot + col / 16) / faceSlots, row / 12])
    }
  }
  return build(grid, uvs)
}

export function createPersonGeometries() {
  const shells = Object.fromEntries(
    hairBangs.map((bangs) => [
      `girlHair_${bangs}`,
      hairShell((a) => sideHem(a, bangHem(bangs, a)), 1.075)
    ])
  ) as Record<`girlHair_${HairBangs}`, BufferGeometry>
  return {
    ...shells,
    girlTrim: new BoxGeometry(1, 1, 1),
    girlBall: sphere(),
    girlHead: build(
      Array.from({ length: 19 }, (_, row) =>
        Array.from({ length: 33 }, (_, col) =>
          headPoint(-Math.PI + (col / 32) * tau, -Math.PI / 2 + (row / 18) * Math.PI)
        )
      )
    ),
    girlFace0: faceGeometry(0),
    girlFace1: faceGeometry(1),
    girlFace2: faceGeometry(2),
    girlFace3: faceGeometry(3),
    girlFace4: faceGeometry(4),
    girlFace5: faceGeometry(5),
    girlHalo: hairHalo(),
    girlHairband: headBand(0.32, 0.5, 1.1),
    girlCuff: headBand(0.16, 0.46, 1.16),
    // Hoods leave a wide face opening and drape down past the jaw.
    girlHood: hairShell((a) => sideHem(a, 0.26) - 0.12 * smooth(0.9, 1.8, Math.abs(a)), 1.2, 40),
    // A bob or long-hair mass behind and beside the face, open at the front.
    girlHairBell: lathe(
      [
        [0.5, 0.42],
        [0.3, 0.49],
        [-0.1, 0.5],
        [-0.42, 0.46],
        [-0.5, 0.38],
        [-0.46, 0.3]
      ],
      24,
      0.95,
      tau - 0.95,
      0.03,
      10
    ),
    // A hanging lock: rounded root, full body and a pointed tip.
    girlLock: lathe(
      [
        [0.5, 0],
        [0.44, 0.3],
        [0.25, 0.47],
        [-0.05, 0.5],
        [-0.3, 0.36],
        [-0.5, 0]
      ],
      10
    ),
    girlTorso: lathe(
      [
        [-0.5, 0],
        [-0.5, 0.44],
        [-0.12, 0.38],
        [0.22, 0.46],
        [0.42, 0.4],
        [0.5, 0.2],
        [0.5, 0]
      ],
      16
    ),
    // Pleats ripple the A-line hem.
    girlSkirt: lathe(
      [
        [0.5, 0],
        [0.5, 0.3],
        [0.1, 0.38],
        [-0.45, 0.5],
        [-0.5, 0.49],
        [-0.5, 0]
      ],
      32,
      0,
      tau,
      0.04,
      12
    ),
    girlLimb: lathe(
      [
        [0.5, 0],
        [0.45, 0.3],
        [0.3, 0.45],
        [-0.3, 0.45],
        [-0.45, 0.3],
        [-0.5, 0]
      ],
      10
    ),
    girlCone: lathe(
      [
        [-0.5, 0],
        [-0.5, 0.5],
        [-0.1, 0.32],
        [0.3, 0.12],
        [0.5, 0]
      ],
      16
    ),
    girlCap: lathe(
      [
        [-0.5, 0],
        [-0.5, 0.5],
        [0, 0.48],
        [0.3, 0.38],
        [0.5, 0]
      ],
      20
    ),
    girlDisc: lathe(
      [
        [-0.5, 0],
        [-0.5, 0.46],
        [-0.2, 0.5],
        [0.5, 0.42],
        [0.5, 0]
      ],
      24
    ),
    // A three-sided pyramid for cat ears and similar points.
    girlEar: lathe(
      [
        [-0.5, 0],
        [-0.5, 0.5],
        [0.5, 0]
      ],
      3,
      -Math.PI / 3,
      (5 * Math.PI) / 3
    )
  }
}
export type PersonShape = keyof ReturnType<typeof createPersonGeometries>

export const personBlinkFrames = 5
export const personFaceSlots = faceSlots

// Face layout in head units, shared by the model tests.
export const personFace = {
  eyeAngle: 0.4,
  eyeY: -0.09,
  eyeHalfHeight: 0.125,
  mouthY: -0.3
}

type Rgba = [number, number, number, number]
const ink: Rgba = [58, 30, 46, 255]

// Eye shapes: round, droopy, cat-like, sleepy, starry, and happy closed arcs.
const eyeStyles = [
  { iris: [74, 146, 232], lid: 0.92, tilt: 0, mouth: 'open' },
  { iris: [196, 120, 62], lid: 0.88, tilt: -0.22, mouth: 'line' },
  { iris: [62, 172, 128], lid: 0.86, tilt: 0.26, mouth: 'cat' },
  { iris: [150, 104, 214], lid: 0.42, tilt: -0.05, mouth: 'o' },
  { iris: [232, 92, 160], lid: 0.95, tilt: 0.06, mouth: 'open' },
  { iris: [0, 0, 0], lid: 0, tilt: 0, mouth: 'grin' }
] as const

function shadeIris(iris: readonly number[], y: number): Rgba {
  // Dark under the lash, glowing toward the lower rim.
  const light = 0.45 + clamp((0.6 - y) / 1.4) * 0.8
  return [...iris.map((channel) => Math.min(255, channel * light + 18 * (1 - light))), 255] as Rgba
}

function eyePixel(slot: number, x: number, y: number, closed: number): Rgba | undefined {
  const style = eyeStyles[slot]
  if (slot === 5) {
    // Happy arcs stay closed, so blinking leaves them unchanged.
    const arc = 0.05 + 0.5 * (1 - x * x)
    return Math.abs(x) < 1.05 && Math.abs(y - arc) < 0.17 ? ink : undefined
  }
  const inside = Math.abs(x) < 1
  const bottom = -Math.sqrt(Math.max(0, 1 - x * x))
  const open = style.lid - 0.32 * x * x + style.tilt * x
  const shut = -0.3 - 0.22 * (1 - x * x)
  const top = open + (shut - open) * closed
  const lash = 0.15 + 0.08 * clamp(x)
  if (inside && Math.abs(y - top) < lash) return ink
  // A short wing flicks up from the outer corner of the upper lash.
  const corner = style.lid - 0.32 + style.tilt
  if (closed < 0.5 && x > 0.8 && x < 1.22 && Math.abs(y - corner - (x - 0.8) * 0.5) < 0.1)
    return ink
  if (!inside || y > top || y < bottom) {
    if (closed < 0.5 && x > 0.35 && x < 0.95 && Math.abs(y - bottom + 0.06) < 0.06) return ink
    return undefined
  }
  const irisX = x / 0.74
  const irisY = (y + 0.1) / 0.98
  const ring = irisX * irisX + irisY * irisY
  if (ring > 1) return [255, 250, 246, 255]
  let rgba = ring > 0.8 ? shadeIris(style.iris, 1.2) : shadeIris(style.iris, y)
  if ((x / 0.3) ** 2 + ((y + 0.02) / 0.42) ** 2 < 1) rgba = shadeIris(style.iris, 2)
  // A pale crescent of reflected light along the bottom of the iris.
  if (ring > 0.45 && ring < 0.85 && y < -0.45)
    rgba = rgba.map((channel, i) => (i < 3 ? Math.min(255, channel + 70) : 255)) as Rgba
  const big = ((x + 0.3) / 0.27) ** 2 + ((y - 0.32) / 0.3) ** 2 < 1
  const small = ((x - 0.3) / 0.13) ** 2 + ((y + 0.52) / 0.13) ** 2 < 1
  // Starry eyes swap the round glint for a four-point sparkle.
  const star = slot === 4 && Math.abs(x + 0.28) ** 0.5 + Math.abs(y - 0.3) ** 0.5 < 0.62
  if ((slot === 4 ? star : big) || small) rgba = [255, 255, 255, 255]
  return rgba
}

function mouthPixel(slot: number, x: number, y: number): Rgba | undefined {
  const lip: Rgba = [150, 52, 74, 255]
  switch (eyeStyles[slot].mouth) {
    case 'open':
    case 'grin': {
      const width = eyeStyles[slot].mouth === 'grin' ? 1.35 : 1
      const nx = x / width
      if (Math.abs(nx) > 1 || y > 0.25 || y < 0.25 - 1.3 * Math.sqrt(1 - nx * nx)) return undefined
      return (x / width / 0.62) ** 2 + ((y + 0.75) / 0.45) ** 2 < 1 ? [238, 118, 138, 255] : lip
    }
    case 'cat': {
      const wave = 0.15 - 0.35 * Math.abs(Math.sin(x * Math.PI))
      return Math.abs(x) < 1 && Math.abs(y - wave) < 0.17 ? lip : undefined
    }
    case 'o':
      return (x / 0.42) ** 2 + ((y + 0.1) / 0.55) ** 2 < 1 ? lip : undefined
    default:
      return Math.abs(x) < 0.85 && Math.abs(y - (0.4 * x * x - 0.15)) < 0.16 ? lip : undefined
  }
}

// Six faces across, with progressively closed eyelids in each atlas row. Coordinates are
// in face-patch space: u spans the head angle, v spans head height, both linearly.
export function createPersonFaceTexture() {
  const size = 256
  const height = size * personBlinkFrames
  const pixels = new Uint8Array(size * faceSlots * height * 4)
  const angleToU = (a: number) => a / faceSpan + 0.5
  const heightToV = (y: number) => (y - faceLow) / (faceHigh - faceLow)
  const eyeV = heightToV(personFace.eyeY)
  const eyeHalfV = personFace.eyeHalfHeight / (faceHigh - faceLow)
  const eyeHalfU = 0.155 / faceSpan
  const mouthV = heightToV(personFace.mouthY)
  const blushV = heightToV(-0.255)
  const samples = [0.25, 0.75]
  for (let slot = 0; slot < faceSlots; slot++) {
    for (let py = 0; py < height; py++) {
      const closed = Math.floor(py / size) / (personBlinkFrames - 1)
      for (let px = 0; px < size; px++) {
        // 2x2 supersampling keeps lash curves smooth once the atlas is mipmapped.
        const sum = [0, 0, 0, 0]
        for (const sy of samples) {
          for (const sx of samples) {
            const u = (px + sx) / size
            const v = ((py % size) + sy) / size
            let rgba: Rgba | undefined
            for (const side of [-1, 1]) {
              const blush = ((u - angleToU(side * 0.68)) / 0.07) ** 2 + ((v - blushV) / 0.045) ** 2
              if (blush < 1) rgba = [244, 132, 150, Math.round((1 - blush) ** 0.7 * 120)]
              const x = (side * (u - angleToU(side * personFace.eyeAngle))) / eyeHalfU
              const eye = eyePixel(slot, x, (v - eyeV) / eyeHalfV, closed)
              if (eye) rgba = eye
            }
            const mouth = mouthPixel(slot, (u - 0.5) / 0.042, (v - mouthV) / 0.045)
            if (mouth) rgba = mouth
            if (!rgba) continue
            // Premultiply so transparent samples don't darken the edges.
            const alpha = rgba[3] / 255
            for (let i = 0; i < 3; i++) sum[i] += rgba[i] * alpha
            sum[3] += rgba[3]
          }
        }
        const index = (py * size * faceSlots + slot * size + px) * 4
        const coverage = sum[3] / 255
        pixels.set(
          coverage
            ? [sum[0] / coverage, sum[1] / coverage, sum[2] / coverage, sum[3] / 4]
            : [0, 0, 0, 0],
          index
        )
      }
    }
  }
  const texture = new DataTexture(pixels, size * faceSlots, height, RGBAFormat)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
