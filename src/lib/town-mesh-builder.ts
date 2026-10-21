import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix3,
  Matrix4,
  Quaternion,
  Vector3
} from 'three'

// Procedural surface patterns, evaluated in world space by the town material.
export const surface = {
  plain: 0,
  paving: 1,
  asphalt: 2,
  grass: 3,
  tiles: 4,
  brick: 5,
  siding: 6,
  planks: 7,
  sand: 8,
  crops: 9,
  stone: 10,
  pond: 11,
  metal: 12,
  ballast: 13
} as const

export type PartOptions = {
  rx?: number
  ry?: number
  rz?: number
  surface?: number
  // Positive values light windows warmly at night; negative values glow in their own color.
  glow?: number
  sway?: number
  shade?: number
  uv?: readonly [number, number, number, number]
  faces?: number
  flat?: boolean
}

type Template = { position: Float32Array; normal: Float32Array; uv: Float32Array }

export const face = { px: 1, nx: 2, py: 4, ny: 8, pz: 16, nz: 32 } as const
const allButBottom = face.px | face.nx | face.py | face.pz | face.nz

function fromGeometry(geometry: BufferGeometry): Template {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  flat.computeVertexNormals()
  const template = {
    position: Float32Array.from(flat.getAttribute('position').array),
    normal: Float32Array.from(flat.getAttribute('normal').array),
    uv: flat.getAttribute('uv')
      ? Float32Array.from(flat.getAttribute('uv').array)
      : new Float32Array((flat.getAttribute('position').count * 2) | 0)
  }
  geometry.dispose()
  if (flat !== geometry) flat.dispose()
  return template
}

// Assemble a template from convex polygons, orienting each face away from `center`.
function fromPolygons(polygons: [number, number, number][][], center: [number, number, number]) {
  const position: number[] = []
  const normal: number[] = []
  const uv: number[] = []
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const n = new Vector3()
  for (const polygon of polygons) {
    a.fromArray(polygon[0])
    b.fromArray(polygon[1])
    c.fromArray(polygon[2])
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize()
    const centroid = polygon
      .reduce((sum, point) => sum.add(new Vector3().fromArray(point)), new Vector3())
      .divideScalar(polygon.length)
    const ordered =
      n.dot(centroid.sub(new Vector3(...center))) < 0 ? [...polygon].reverse() : polygon
    if (ordered !== polygon) n.negate()
    for (let index = 1; index < ordered.length - 1; index++) {
      for (const point of [ordered[0], ordered[index], ordered[index + 1]]) {
        position.push(...point)
        normal.push(n.x, n.y, n.z)
        uv.push(point[0] + 0.5, point[1])
      }
    }
  }
  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    uv: new Float32Array(uv)
  }
}

function boxTemplate(mask: number) {
  const faces: [number, [number, number, number][]][] = [
    [
      face.px,
      [
        [0.5, -0.5, 0.5],
        [0.5, -0.5, -0.5],
        [0.5, 0.5, -0.5],
        [0.5, 0.5, 0.5]
      ]
    ],
    [
      face.nx,
      [
        [-0.5, -0.5, -0.5],
        [-0.5, -0.5, 0.5],
        [-0.5, 0.5, 0.5],
        [-0.5, 0.5, -0.5]
      ]
    ],
    [
      face.py,
      [
        [-0.5, 0.5, 0.5],
        [0.5, 0.5, 0.5],
        [0.5, 0.5, -0.5],
        [-0.5, 0.5, -0.5]
      ]
    ],
    [
      face.ny,
      [
        [-0.5, -0.5, -0.5],
        [0.5, -0.5, -0.5],
        [0.5, -0.5, 0.5],
        [-0.5, -0.5, 0.5]
      ]
    ],
    [
      face.pz,
      [
        [-0.5, -0.5, 0.5],
        [0.5, -0.5, 0.5],
        [0.5, 0.5, 0.5],
        [-0.5, 0.5, 0.5]
      ]
    ],
    [
      face.nz,
      [
        [0.5, -0.5, -0.5],
        [-0.5, -0.5, -0.5],
        [-0.5, 0.5, -0.5],
        [0.5, 0.5, -0.5]
      ]
    ]
  ]
  const position: number[] = []
  const normal: number[] = []
  const uv: number[] = []
  const corners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ]
  for (const [bit, quad] of faces) {
    if (!(mask & bit)) continue
    const n = new Vector3()
      .subVectors(new Vector3(...quad[1]), new Vector3(...quad[0]))
      .cross(new Vector3().subVectors(new Vector3(...quad[2]), new Vector3(...quad[0])))
      .normalize()
    for (const index of [0, 1, 2, 0, 2, 3]) {
      position.push(...quad[index])
      normal.push(n.x, n.y, n.z)
      uv.push(...corners[index])
    }
  }
  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    uv: new Float32Array(uv)
  }
}

const templates = new Map<string, Template>()
function template(key: string, create: () => Template) {
  let item = templates.get(key)
  if (!item) {
    item = create()
    templates.set(key, item)
  }
  return item
}

class Growable {
  data = new Float32Array(4096)
  length = 0
  reserve(count: number) {
    if (this.length + count <= this.data.length) return
    let size = this.data.length
    while (size < this.length + count) size *= 2
    const next = new Float32Array(size)
    next.set(this.data.subarray(0, this.length))
    this.data = next
  }
}

type Layer = {
  position: Growable
  normal: Growable
  color: Growable
  uv: Growable
  extra: Growable
}

export type TownGeometryChunk = { geometry: BufferGeometry; flat: boolean }

const linear = new Map<number, [number, number, number]>()
function linearColor(hex: number) {
  let value = linear.get(hex)
  if (!value) {
    const color = new Color().setHex(hex)
    value = [color.r, color.g, color.b]
    linear.set(hex, value)
  }
  return value
}

export function createTownBuilder(chunkSize = 2400, whiteUv: readonly [number, number] = [0, 0]) {
  const layers = new Map<string, Layer>()
  const stack: Matrix4[] = [new Matrix4()]
  const local = new Matrix4()
  const world = new Matrix4()
  const normalMatrix = new Matrix3()
  const quaternion = new Quaternion()
  const euler = new Euler()
  const position = new Vector3()
  const scale = new Vector3()
  let vertices = 0

  function layer(x: number, z: number, flat: boolean) {
    const key = `${Math.floor(x / chunkSize)}:${Math.floor(z / chunkSize)}:${flat ? 1 : 0}`
    let item = layers.get(key)
    if (!item) {
      item = {
        position: new Growable(),
        normal: new Growable(),
        color: new Growable(),
        uv: new Growable(),
        extra: new Growable()
      }
      layers.set(key, item)
    }
    return item
  }

  function emit(shape: Template, matrix: Matrix4, hex: number, options: PartOptions = {}) {
    const e = matrix.elements
    normalMatrix.getNormalMatrix(matrix)
    const n = normalMatrix.elements
    const target = layer(e[12], e[14], options.flat ?? false)
    const count = shape.position.length / 3
    vertices += count
    target.position.reserve(count * 3)
    target.normal.reserve(count * 3)
    target.color.reserve(count * 3)
    target.uv.reserve(count * 2)
    target.extra.reserve(count * 3)
    const [r, g, b] = linearColor(hex)
    const shade = options.shade ?? 1
    const uvRect = options.uv
    const surfaceId = options.surface ?? 0
    const glow = options.glow ?? 0
    const sway = options.sway ?? 0
    for (let index = 0; index < count; index++) {
      const x = shape.position[index * 3]
      const y = shape.position[index * 3 + 1]
      const z = shape.position[index * 3 + 2]
      let offset = target.position.length
      target.position.data[offset] = e[0] * x + e[4] * y + e[8] * z + e[12]
      target.position.data[offset + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]
      target.position.data[offset + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]
      target.position.length += 3
      const nx = shape.normal[index * 3]
      const ny = shape.normal[index * 3 + 1]
      const nz = shape.normal[index * 3 + 2]
      const tx = n[0] * nx + n[3] * ny + n[6] * nz
      const ty = n[1] * nx + n[4] * ny + n[7] * nz
      const tz = n[2] * nx + n[5] * ny + n[8] * nz
      const length = Math.hypot(tx, ty, tz) || 1
      offset = target.normal.length
      target.normal.data[offset] = tx / length
      target.normal.data[offset + 1] = ty / length
      target.normal.data[offset + 2] = tz / length
      target.normal.length += 3
      offset = target.color.length
      target.color.data[offset] = r * shade
      target.color.data[offset + 1] = g * shade
      target.color.data[offset + 2] = b * shade
      target.color.length += 3
      offset = target.uv.length
      if (uvRect) {
        target.uv.data[offset] = uvRect[0] + (uvRect[2] - uvRect[0]) * shape.uv[index * 2]
        target.uv.data[offset + 1] = uvRect[1] + (uvRect[3] - uvRect[1]) * shape.uv[index * 2 + 1]
      } else {
        target.uv.data[offset] = whiteUv[0]
        target.uv.data[offset + 1] = whiteUv[1]
      }
      target.uv.length += 2
      offset = target.extra.length
      // Sway follows the part's height so trunks stay planted while crowns move.
      target.extra.data[offset] = surfaceId
      target.extra.data[offset + 1] = glow
      target.extra.data[offset + 2] = sway * Math.max(0, Math.min(1, y + 0.5))
      target.extra.length += 3
    }
  }

  function place(
    shape: Template,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    hex: number,
    options: PartOptions = {}
  ) {
    euler.set(options.rx ?? 0, options.ry ?? 0, options.rz ?? 0, 'YXZ')
    quaternion.setFromEuler(euler)
    local.compose(position.set(x, y, z), quaternion, scale.set(width, height, depth))
    world.multiplyMatrices(stack[stack.length - 1], local)
    emit(shape, world, hex, options)
  }

  const api = {
    get vertices() {
      return vertices
    },
    push(x: number, y: number, z: number, yaw = 0, uniformScale = 1) {
      const frame = new Matrix4().compose(
        new Vector3(x, y, z),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw),
        new Vector3(uniformScale, uniformScale, uniformScale)
      )
      stack.push(new Matrix4().multiplyMatrices(stack[stack.length - 1], frame))
    },
    pop() {
      if (stack.length > 1) stack.pop()
    },
    frame(x: number, z: number, yaw: number, draw: () => void, y = 0, uniformScale = 1) {
      api.push(x, y, z, yaw, uniformScale)
      try {
        draw()
      } finally {
        api.pop()
      }
    },
    // Boxes are centered; their invisible underside is omitted unless rotated onto a side.
    box(
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      hex: number,
      options: PartOptions = {}
    ) {
      const tilted =
        Math.abs(options.rx ?? 0) > Math.PI / 4 || Math.abs(options.rz ?? 0) > Math.PI / 4
      const mask = options.faces ?? (tilted ? 63 : allButBottom)
      place(
        template(`box:${mask}`, () => boxTemplate(mask)),
        x,
        y,
        z,
        width,
        height,
        depth,
        hex,
        options
      )
    },
    // A textured quad facing +z, used for signs and posters.
    quad(
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      hex: number,
      options: PartOptions = {}
    ) {
      place(
        template('quad', () => boxTemplate(face.pz)),
        x,
        y,
        z - 0.5,
        width,
        height,
        1,
        hex,
        options
      )
    },
    // A flat quad facing up.
    plate(
      x: number,
      y: number,
      z: number,
      width: number,
      depth: number,
      hex: number,
      options: PartOptions = {}
    ) {
      place(
        template('plate', () => boxTemplate(face.py)),
        x,
        y - 0.5,
        z,
        width,
        1,
        depth,
        hex,
        options
      )
    },
    cylinder(
      x: number,
      y: number,
      z: number,
      radius: number,
      height: number,
      hex: number,
      options: PartOptions & {
        segments?: number
        top?: number
        arc?: number
        radiusZ?: number
      } = {}
    ) {
      const segments = options.segments ?? 8
      const top = options.top ?? 1
      const arc = options.arc ?? Math.PI * 2
      place(
        template(`cylinder:${segments}:${top}:${arc}`, () =>
          fromGeometry(new CylinderGeometry(0.5 * top, 0.5, 1, segments, 1, false, 0, arc))
        ),
        x,
        y,
        z,
        radius * 2,
        height,
        (options.radiusZ ?? radius) * 2,
        hex,
        options
      )
    },
    cone(
      x: number,
      y: number,
      z: number,
      radius: number,
      height: number,
      hex: number,
      options: PartOptions & { segments?: number } = {}
    ) {
      api.cylinder(x, y, z, radius, height, hex, { ...options, top: 0 })
    },
    blob(
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      hex: number,
      options: PartOptions & { detail?: number } = {}
    ) {
      const detail = options.detail ?? 0
      place(
        template(`ico:${detail}`, () => fromGeometry(new IcosahedronGeometry(0.5, detail))),
        x,
        y,
        z,
        width,
        height,
        depth,
        hex,
        options
      )
    },
    rock(
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      hex: number,
      options: PartOptions = {}
    ) {
      place(
        template('dodeca', () => fromGeometry(new DodecahedronGeometry(0.5))),
        x,
        y,
        z,
        width,
        height,
        depth,
        hex,
        options
      )
    },
    // A triangular prism: base on y, apex at y + height, ridge along x.
    prism(
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      hex: number,
      options: PartOptions = {}
    ) {
      place(
        template('prism', () =>
          fromPolygons(
            [
              [
                [-0.5, 0, -0.5],
                [-0.5, 0, 0.5],
                [-0.5, 1, 0]
              ],
              [
                [0.5, 0, -0.5],
                [0.5, 0, 0.5],
                [0.5, 1, 0]
              ],
              [
                [-0.5, 0, 0.5],
                [0.5, 0, 0.5],
                [0.5, 1, 0],
                [-0.5, 1, 0]
              ],
              [
                [-0.5, 0, -0.5],
                [0.5, 0, -0.5],
                [0.5, 1, 0],
                [-0.5, 1, 0]
              ]
            ],
            [0, 0.3, 0]
          )
        ),
        x,
        y,
        z,
        width,
        height,
        depth,
        hex,
        options
      )
    },
    // A hipped roof whose 45° hips meet a ridge along x.
    hip(
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      hex: number,
      options: PartOptions = {}
    ) {
      const ridge = Math.round(Math.max(0, (width - depth) / width) * 50) / 100
      place(
        template(`hip:${ridge}`, () =>
          fromPolygons(
            [
              [
                [-0.5, 0, 0.5],
                [0.5, 0, 0.5],
                [ridge, 1, 0],
                [-ridge, 1, 0]
              ],
              [
                [-0.5, 0, -0.5],
                [0.5, 0, -0.5],
                [ridge, 1, 0],
                [-ridge, 1, 0]
              ],
              [
                [-0.5, 0, -0.5],
                [-0.5, 0, 0.5],
                [-ridge, 1, 0]
              ],
              [
                [0.5, 0, -0.5],
                [0.5, 0, 0.5],
                [ridge, 1, 0]
              ]
            ].map(
              (polygon) =>
                polygon.filter(
                  (point, index, all) =>
                    all.findIndex((other) =>
                      other.every((value, axis) => value === point[axis])
                    ) === index
                ) as [number, number, number][]
            ),
            [0, 0.3, 0]
          )
        ),
        x,
        y,
        z,
        width,
        height,
        depth,
        hex,
        options
      )
    },
    // A single world-space triangle; used for terrain.
    triangle(
      a: readonly [number, number, number],
      b: readonly [number, number, number],
      c: readonly [number, number, number],
      hex: number,
      options: PartOptions = {}
    ) {
      const ab = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      const ac = new Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2])
      const normal = ab.cross(ac).normalize()
      const flip = normal.y < 0
      if (flip) normal.negate()
      const shape: Template = {
        position: new Float32Array([...a, ...(flip ? [...c, ...b] : [...b, ...c])]),
        normal: new Float32Array([...normal.toArray(), ...normal.toArray(), ...normal.toArray()]),
        uv: new Float32Array(6)
      }
      const center = new Matrix4().makeTranslation(0, 0, 0)
      // Chunk by the triangle's centroid rather than the origin.
      const cx = (a[0] + b[0] + c[0]) / 3
      const cz = (a[2] + b[2] + c[2]) / 3
      for (let index = 0; index < 9; index += 3) {
        shape.position[index] -= cx
        shape.position[index + 2] -= cz
      }
      center.makeTranslation(cx, 0, cz)
      world.multiplyMatrices(stack[stack.length - 1], center)
      emit(shape, world, hex, options)
    },
    build(): TownGeometryChunk[] {
      return [...layers.entries()].flatMap(([key, item]) => {
        if (!item.position.length) return []
        const geometry = new BufferGeometry()
        geometry.setAttribute(
          'position',
          new Float32BufferAttribute(item.position.data.slice(0, item.position.length), 3)
        )
        geometry.setAttribute(
          'normal',
          new Float32BufferAttribute(item.normal.data.slice(0, item.normal.length), 3)
        )
        geometry.setAttribute(
          'color',
          new Float32BufferAttribute(item.color.data.slice(0, item.color.length), 3)
        )
        geometry.setAttribute(
          'uv',
          new Float32BufferAttribute(item.uv.data.slice(0, item.uv.length), 2)
        )
        geometry.setAttribute(
          'townExtra',
          new Float32BufferAttribute(item.extra.data.slice(0, item.extra.length), 3)
        )
        geometry.computeBoundingSphere()
        geometry.computeBoundingBox()
        return [{ geometry, flat: key.endsWith(':1') }]
      })
    }
  }
  return api
}

export type TownBuilder = ReturnType<typeof createTownBuilder>
