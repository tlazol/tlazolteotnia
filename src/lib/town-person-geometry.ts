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
const headProfile: Ring[] = [
  [-0.5, 0.08, 0.12],
  [-0.43, 0.29, 0.29],
  [-0.28, 0.45, 0.43],
  [-0.05, 0.5, 0.5],
  [0.2, 0.49, 0.48],
  [0.38, 0.39, 0.38],
  [0.5, 0, 0]
]

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
  const segments = 24
  const rows = headProfile.length - 1
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= segments; col++) {
      const a = (col / segments) * Math.PI * 2
      // An open face, temples at the sides, and a nape that covers the rear skull.
      const bottom = -0.36 + Math.max(0, Math.cos(a)) * 0.55
      const y = Math.max(bottom, headProfile[row][0])
      const [rx, rz] = headRadius(y)
      const cos = Math.cos(a)
      positions.push(Math.sin(a) * rx, y, (cos > 0 ? cos ** 0.45 : cos) * rz)
      if (row < rows && col < segments) connect(indices, row, col, segments)
    }
  }
  return finish(positions, indices)
}

function faceGeometry(slot: number) {
  const positions: number[] = []
  const indices: number[] = []
  const uvs: number[] = []
  // Match the head's actual polygon grid, displaced outward to avoid z-fighting.
  const ys = [-0.43, -0.28, -0.05, 0.2]
  for (const [row, y] of ys.entries()) {
    const [rx, rz] = headRadius(y)
    for (let col = 0; col <= 8; col++) {
      const a = ((col - 4) / 24) * Math.PI * 2
      const x = Math.sin(a) * rx
      positions.push(x * 1.006, y, Math.cos(a) ** 0.45 * rz + 0.006)
      uvs.push((slot + x + 0.5) / 6, y + 0.5)
      if (row < ys.length - 1 && col < 8) connect(indices, row, col, 8)
    }
  }
  return finish(positions, indices, uvs, true)
}

export function createPersonGeometries() {
  return {
    girlHead: rings(headProfile, 24, true, true),
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

// Six eyes/expressions in one atlas. Pure pixel generation also works in geometry tests
// without a DOM; the transparent face patch follows the cheeks instead of floating.
export function createPersonFaceTexture() {
  const size = 256
  const pixels = new Uint8Array(size * 6 * size * 4)
  const irises = [
    [91, 139, 211],
    [173, 104, 184],
    [56, 162, 157],
    [181, 116, 62],
    [205, 97, 141],
    [115, 117, 204]
  ]
  for (let slot = 0; slot < 6; slot++) {
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const u = (px + 0.5) / size
        const v = (py + 0.5) / size
        let rgba = [0, 0, 0, 0]
        for (const side of [-1, 1]) {
          const ex = 0.5 + side * 0.205
          const dx = (u - ex) / 0.114
          const dy = (v - 0.435) / (slot === 3 ? 0.115 : 0.14)
          const eye = dx * dx + dy * dy
          if (eye < 1) {
            rgba = [255, 248, 242, 255]
            const iris = ((u - ex) / 0.071) ** 2 + ((v - 0.428) / 0.128) ** 2
            if (iris < 1) {
              const shade = Math.max(0.32, Math.min(1.25, 1.2 - (v - 0.31) * 3.4))
              rgba = [...irises[slot].map((channel) => Math.min(255, channel * shade)), 255]
              if (((u - ex) / 0.028) ** 2 + ((v - 0.45) / 0.071) ** 2 < 1) rgba = [38, 31, 59, 255]
              if (
                ((u - ex + 0.024) / 0.025) ** 2 + ((v - 0.488) / 0.033) ** 2 < 1 ||
                ((u - ex - 0.029) / 0.013) ** 2 + ((v - 0.378) / 0.016) ** 2 < 1
              )
                rgba = [255, 255, 253, 255]
            }
          }
          // Swept upper lash and a small outer flick; lower lid stays light.
          const lid = 0.435 + (slot === 3 ? 0.115 : 0.14) * Math.sqrt(Math.max(0, 1 - dx * dx))
          if (Math.abs(dx) < 1.05 && Math.abs(v - lid) < 0.012) rgba = [53, 35, 55, 255]
          const outer = side * (u - ex)
          if (outer > 0.095 && outer < 0.14 && Math.abs(v - (0.49 + (outer - 0.095) * 0.6)) < 0.013)
            rgba = [53, 35, 55, 255]
          if (Math.abs(dx) < 0.65 && Math.abs(v - (0.615 - side * dx * 0.016)) < 0.007)
            rgba = [101, 65, 83, 220]
          const blush = ((u - (0.5 + side * 0.29)) / 0.07) ** 2 + ((v - 0.28) / 0.036) ** 2
          if (blush < 1) rgba = [239, 123, 146, (1 - blush) * 130]
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
  const texture = new DataTexture(pixels, size * 6, size, RGBAFormat)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
