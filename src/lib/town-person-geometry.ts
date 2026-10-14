import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  SRGBColorSpace
} from 'three'

type Ring = readonly [y: number, radiusX: number, radiusZ: number, x?: number, z?: number]
const headSegments = 32
// Ellipsoidal latitude rings give the forehead and rear skull continuous curvature.
// Only the lower cheeks taper; the depth stays round through the jaw.
const headProfile: Ring[] = Array.from({ length: 17 }, (_, row) => {
  const latitude = -Math.PI / 2 + (row / 16) * Math.PI
  const y = Math.sin(latitude) * 0.5
  const radius = row === 0 || row === 16 ? 0 : Math.cos(latitude) * 0.5
  const jaw = y < -0.05 ? 1 - 0.22 * ((-0.05 - y) / 0.45) ** 1.5 : 1
  return [y, radius * jaw, radius]
})

function headRadius(y: number) {
  y = Math.max(-0.5, Math.min(0.5, y))
  const upper = headProfile.findIndex((ring) => ring[0] >= y)
  const b = headProfile[Math.max(1, upper)]
  const a = headProfile[Math.max(0, upper - 1)]
  const t = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])))
  return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function finish(positions: number[], indices: number[], uvs?: number[], soft = false) {
  let geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  if (uvs) geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  if (!soft) geometry = geometry.toNonIndexed()
  geometry.computeVertexNormals()
  const normals = geometry.getAttribute('normal')
  const shades: number[] = []
  for (let i = 0; i < normals.count; i++) {
    const light = normals.getX(i) * -0.3 + normals.getY(i) * 0.55 + normals.getZ(i) * 0.55
    const shade = soft ? 0.89 + Math.max(-0.65, light) * 0.11 : 0.82 + Math.max(-0.6, light) * 0.18
    shades.push(shade, shade, shade)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(shades, 3))
  return geometry
}

function connect(indices: number[], row: number, col: number, columns: number) {
  const a = row * (columns + 1) + col
  indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1)
}

function rings(profile: Ring[], segments = 12, soft = false, flattenFace = false) {
  const positions: number[] = []
  const indices: number[] = []
  for (const [row, [y, rx, rz, x = 0, z = 0]] of profile.entries()) {
    for (let col = 0; col <= segments; col++) {
      const angle = (col / segments) * Math.PI * 2
      const cos = Math.cos(angle)
      positions.push(
        x + Math.sin(angle) * rx,
        y,
        z + (flattenFace && cos > 0 ? cos ** 0.45 : cos) * rz
      )
      if (row < profile.length - 1 && col < segments) connect(indices, row, col, segments)
    }
  }
  return finish(positions, indices, undefined, soft)
}

function crownGeometry() {
  const positions: number[] = []
  const indices: number[] = []
  const segments = headSegments
  const rows = headProfile.length - 1
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= segments; col++) {
      const a = (col / segments) * Math.PI * 2
      // An open face, temples at the sides, and a nape that covers the rear skull.
      const bottom = -0.36 + Math.max(0, Math.cos(a)) * 0.55
      const y = Math.max(bottom, headProfile[row][0])
      const [rx, rz] = headRadius(y)
      positions.push(Math.sin(a) * rx, y, Math.cos(a) * rz)
      if (row < rows && col < segments) connect(indices, row, col, segments)
    }
  }
  return finish(positions, indices, undefined, true)
}

function faceGeometry(slot: number) {
  const positions: number[] = []
  const indices: number[] = []
  const uvs: number[] = []
  // Match the head's actual polygon grid, displaced outward to avoid z-fighting.
  const ys = headProfile.filter(([y]) => y >= -0.45 && y <= 0.2).map(([y]) => y)
  const columns = 12
  for (const [row, y] of ys.entries()) {
    const [rx, rz] = headRadius(y)
    for (let col = 0; col <= columns; col++) {
      const a = ((col - columns / 2) / headSegments) * Math.PI * 2
      const x = Math.sin(a) * rx
      positions.push(x * 1.006, y, Math.cos(a) * rz + 0.006)
      uvs.push((slot + x + 0.5) / 6, y + 0.5)
      if (row < ys.length - 1 && col < columns) connect(indices, row, col, columns)
    }
  }
  return finish(positions, indices, uvs, true)
}

export function createPersonGeometries() {
  return {
    girlHead: rings(headProfile, headSegments, true),
    girlCrown: crownGeometry(),
    girlLock: rings(
      [
        [-0.5, 0.015, 0.015, 0.18, 0.12],
        [-0.27, 0.3, 0.25, 0.1, 0.06],
        [0.1, 0.5, 0.45],
        [0.4, 0.4, 0.4, -0.08],
        [0.5, 0.12, 0.12, -0.12]
      ],
      8
    ),
    girlBody: rings(
      [
        [-0.5, 0.42, 0.46],
        [-0.2, 0.34, 0.4],
        [0.28, 0.5, 0.48],
        [0.5, 0.26, 0.3],
        [0.5, 0, 0]
      ],
      12
    ),
    girlLimb: rings(
      [
        [-0.5, 0, 0],
        [-0.42, 0.3, 0.32],
        [-0.1, 0.4, 0.42],
        [0.3, 0.49, 0.48],
        [0.5, 0.3, 0.3],
        [0.5, 0, 0]
      ],
      10,
      true
    ),
    girlRound: rings(
      [
        [-0.5, 0, 0],
        [-0.36, 0.35, 0.35],
        [0, 0.5, 0.5],
        [0.36, 0.35, 0.35],
        [0.5, 0, 0]
      ],
      12,
      true
    ),
    girlSkirt: rings(
      [
        [-0.5, 0, 0],
        [-0.5, 0.5, 0.5],
        [-0.35, 0.48, 0.48],
        [0.5, 0.29, 0.3],
        [0.5, 0, 0]
      ],
      16
    ),
    girlBrim: rings(
      [
        [-0.5, 0, 0],
        [-0.3, 0.48, 0.48],
        [0.3, 0.5, 0.5],
        [0.5, 0, 0]
      ],
      16
    ),
    girlCap: rings(
      [
        [-0.5, 0.5, 0.5],
        [0.05, 0.49, 0.48],
        [0.35, 0.35, 0.34],
        [0.5, 0, 0]
      ],
      16,
      false,
      true
    ),
    girlHat: rings(
      [
        [-0.5, 0, 0],
        [-0.5, 0.5, 0.5],
        [0.1, 0.27, 0.3, -0.08],
        [0.5, 0.01, 0.01, -0.3]
      ],
      12
    ),
    girlFace0: faceGeometry(0),
    girlFace1: faceGeometry(1),
    girlFace2: faceGeometry(2),
    girlFace3: faceGeometry(3),
    girlFace4: faceGeometry(4),
    girlFace5: faceGeometry(5)
  }
}
export type PersonShape = keyof ReturnType<typeof createPersonGeometries>

export const personBlinkFrames = 5

// Six eye shapes across, with progressively closed eyelids in each atlas row.
// Pure pixel generation also works in geometry tests
// without a DOM; the transparent face patch follows the cheeks instead of floating.
export function createPersonFaceTexture() {
  const size = 256
  const height = size * personBlinkFrames
  const pixels = new Uint8Array(size * 6 * height * 4)
  const irises = [
    [91, 139, 211],
    [173, 104, 184],
    [56, 162, 157],
    [181, 116, 62],
    [205, 97, 141],
    [115, 117, 204]
  ]
  // Round, droopy, bright, bead, sparkling and sleepy eyes share the same atlas.
  const eyes = [
    { width: 0.076, upper: 0.063, lower: 0.061, tilt: 0, irisX: 0.068, irisY: 0.066 },
    { width: 0.085, upper: 0.055, lower: 0.06, tilt: -0.022, irisX: 0.071, irisY: 0.065 },
    { width: 0.087, upper: 0.068, lower: 0.056, tilt: 0.012, irisX: 0.076, irisY: 0.069 },
    { width: 0.047, upper: 0.041, lower: 0.041, tilt: 0, irisX: 0.047, irisY: 0.043 },
    { width: 0.073, upper: 0.078, lower: 0.065, tilt: 0.005, irisX: 0.065, irisY: 0.079 },
    { width: 0.084, upper: 0.018, lower: 0.044, tilt: 0, irisX: 0.07, irisY: 0.062 }
  ]
  for (let slot = 0; slot < 6; slot++) {
    const eye = eyes[slot]
    const bead = slot === 3
    const sparkling = slot === 4
    for (let py = 0; py < height; py++) {
      const closed = Math.floor(py / size) / (personBlinkFrames - 1)
      for (let px = 0; px < size; px++) {
        const u = (px + 0.5) / size
        const v = ((py % size) + 0.5) / size
        let rgba = [0, 0, 0, 0]
        for (const side of [-1, 1]) {
          const ex = 0.5 + side * 0.17
          const dx = (u - ex) / eye.width
          const outer = side * dx
          const arch = Math.sqrt(Math.max(0, 1 - dx * dx))
          const corner = 0.45 + outer * eye.tilt
          const upper = corner + (eye.upper * (1 - closed) - closed * 0.018) * arch
          const lower = corner - (eye.lower * (1 - closed) + closed * 0.018) * arch
          // Irises nearly fill each opening; the upper lid covers them during a blink.
          if (Math.abs(dx) < 1 && v > lower && v < upper) {
            rgba = [255, 246, 237, 255]
            const iris = ((u - ex) / eye.irisX) ** 2 + ((v - 0.45) / eye.irisY) ** 2
            if (iris < 1) {
              const shade = Math.max(0.4, Math.min(1.25, 1.2 - (v - 0.39) * 6))
              rgba = [48, 35, 55, 255]
              if (!bead && iris < 0.8)
                rgba = [...irises[slot].map((channel) => Math.min(255, channel * shade)), 255]
              if (
                ((u - ex) / (eye.irisX * 0.53)) ** 2 + ((v - 0.457) / (eye.irisY * 0.64)) ** 2 <
                1
              )
                rgba = [38, 31, 51, 255]
              const glint = bead ? 0.009 : sparkling ? 0.023 : 0.017
              const glintY = 0.45 + eye.irisY * 0.35
              if (
                ((u - ex + eye.irisX * 0.26) / glint) ** 2 + ((v - glintY) / glint) ** 2 < 1 ||
                (!bead &&
                  ((u - ex - eye.irisX * 0.3) / 0.009) ** 2 +
                    ((v - (0.45 - eye.irisY * 0.5)) / (sparkling ? 0.017 : 0.01)) ** 2 <
                    1)
              )
                rgba = [255, 255, 253, 255]
            }
          }
          // Bead eyes have a fine rim; the other shapes carry a soft upper lash.
          if (
            Math.abs(dx) < 1 &&
            Math.abs(v - upper) < (bead ? 0.003 : 0.005 + Math.max(0, outer) * 0.002)
          )
            rgba = [53, 35, 55, 255]
          if (
            !bead &&
            closed < 1 &&
            outer > 0.94 &&
            outer < 1.17 &&
            Math.abs(v - (0.45 + eye.tilt + (outer - 1) * 0.08 * (1 - closed))) < 0.005
          )
            rgba = [53, 35, 55, 255]
          if (!bead && closed < 1 && Math.abs(dx) < 0.9 && Math.abs(v - lower) < 0.002)
            rgba = [133, 84, 87, 190]
          if (Math.abs(dx) < 0.7 && Math.abs(v - (0.58 + outer * eye.tilt * 0.4)) < 0.004)
            rgba = [101, 65, 83, 190]
          const blush = ((u - (0.5 + side * 0.255)) / 0.066) ** 2 + ((v - 0.3) / 0.028) ** 2
          if (blush < 1) rgba = [239, 123, 146, (1 - blush) * 95]
        }
        if (((u - 0.5) / 0.015) ** 2 + ((v - 0.285) / 0.011) ** 2 < 1) rgba = [201, 135, 128, 170]
        const mouthX = (u - 0.5) / 0.044
        const mouthY = 0.205 + mouthX * mouthX * 0.022
        if (Math.abs(mouthX) < 1 && Math.abs(v - mouthY) < 0.006) rgba = [152, 72, 93, 255]
        const index = (py * size * 6 + slot * size + px) * 4
        pixels.set(rgba, index)
      }
    }
  }
  const texture = new DataTexture(pixels, size * 6, height, RGBAFormat)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
