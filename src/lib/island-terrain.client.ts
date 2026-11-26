import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  type Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  type Scene,
  ShaderMaterial
} from 'three'
import { groundTexel } from './island-art'
import { type DecorPlacement, lightVolumes } from './island-lights.client'
import { tileHeight } from './island-relief'
import {
  CLOVER,
  DECK,
  DRYGRASS,
  GRASS,
  GROUND_COUNT,
  groundAt,
  hash2,
  type IslandWorld,
  isWetGround,
  MOSS,
  SOIL,
  STEPPING,
  TILE_SIZE,
  WATER
} from './island-world'

const PATCH = 8
const SWATCH = TILE_SIZE * 4
const BANDS = 5
const neighbors = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0]
]

function terrainTexture() {
  const size = BANDS * SWATCH
  const pixels = new Uint8ClampedArray(size * size * 4)
  for (let kind = 1; kind < GROUND_COUNT; kind++) {
    const ox = (kind % BANDS) * SWATCH
    const oy = Math.floor(kind / BANDS) * SWATCH
    for (let y = 0; y < SWATCH; y++)
      for (let x = 0; x < SWATCH; x++)
        pixels.set(
          groundTexel(kind, x, y, () => kind, false),
          ((oy + y) * size + ox + x) * 4
        )
  }
  const map = new DataTexture(new Uint8Array(pixels.buffer), size, size)
  map.minFilter = map.magFilter = NearestFilter
  map.needsUpdate = true
  return map
}

// Each patch owns its tops and only the walls exposed to lower neighbors.
function patchGeometry(
  world: IslandWorld,
  startX: number,
  startY: number,
  lamps: DecorPlacement[]
) {
  const positions: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    indices: number[] = []
  const grass = [GRASS, MOSS, DRYGRASS, CLOVER, STEPPING] as number[]
  for (let y = startY; y < Math.min(world.rows, startY + PATCH); y++)
    for (let x = startX; x < Math.min(world.columns, startX + PATCH); x++) {
      const kind = groundAt(world, x, y)
      const h = tileHeight(world, x, y)
      if (kind === WATER && !neighbors.some(([dx, dy]) => tileHeight(world, x + dx, y + dy) < 0))
        continue
      const left = x * TILE_SIZE,
        back = y * TILE_SIZE
      const right = left + TILE_SIZE,
        front = back + TILE_SIZE
      const corners = [
        [left, back],
        [right, back],
        [right, front],
        [left, front]
      ]
      const tint = 0.96 + hash2(x, y, 516) * 0.055
      function quad(vertices: number[][], material: number, light = 1, height = TILE_SIZE) {
        const first = positions.length / 3
        const u = ((material % BANDS) + (x % 4) / 4) / BANDS
        const v = (Math.floor(material / BANDS) + (y % 4) / 4) / BANDS
        for (let i = 0; i < 4; i++) {
          positions.push(...vertices[i])
          uv.push(
            u + (i === 1 || i === 2 ? 1 / (4 * BANDS) : 0),
            v + (i > 1 ? height / (SWATCH * BANDS) : 0)
          )
          colors.push(light * tint, light * tint, light * tint)
        }
        indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
      }
      if (kind !== WATER) {
        const top = isWetGround(kind) ? 0.12 : h
        quad(
          corners.map((c) => [...c, top]),
          kind
        )
      }
      for (let side = 0; side < 4; side++) {
        const [dx, dy] = neighbors[side]
        const floor = tileHeight(world, x + dx, y + dy)
        if (floor >= h) continue
        const a = corners[side],
          b = corners[(side + 1) % 4]
        const wall = (bottom: number, top: number, material: number, light: number) =>
          quad(
            [
              [...a, bottom],
              [...b, bottom],
              [...b, top],
              [...a, top]
            ],
            material,
            light,
            Math.min(16, top - bottom)
          )
        if (isWetGround(kind)) {
          wall(floor, h, SOIL, 0.81)
        } else if (kind === DECK && h > 0) {
          wall(Math.max(floor, h - 3), h, DECK, 0.86)
          // A low lantern every other tile along the water-facing rim.
          if ((dx ? y : x) % 2 === 0 && isWetGround(groundAt(world, x + dx, y + dy))) {
            lamps.push({
              tile: y * world.columns + x,
              x: (a[0] + b[0]) / 2 - dx * 1.5,
              y: (a[1] + b[1]) / 2 - dy * 1.5,
              z: h,
              scale: 1
            })
          }
          // Short square pilings below the exposed edge.
          const ax = a[0] + (b[0] - a[0]) * 0.15 - dx
          const ay = a[1] + (b[1] - a[1]) * 0.15 - dy
          const post = [
            [ax - 1, ay - 1],
            [ax + 1, ay - 1],
            [ax + 1, ay + 1],
            [ax - 1, ay + 1]
          ]
          for (let i = 0; i < 4; i++) {
            const p = post[i],
              q = post[(i + 1) % 4]
            quad(
              [
                [...p, Math.min(0, floor)],
                [...q, Math.min(0, floor)],
                [...q, h - 3],
                [...p, h - 3]
              ],
              DECK,
              0.62
            )
          }
        } else {
          const cap = Math.max(floor, h - 3)
          if (cap > floor) wall(floor, cap, grass.includes(kind) ? SOIL : kind, 0.81)
          wall(cap, h, kind, 0.93)
        }
      }
    }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(Float32Array.from(colors), 3))
  geometry.setAttribute('uv', new BufferAttribute(Float32Array.from(uv), 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createTerrain(
  world: IslandWorld,
  parent: Group,
  night: { value: number },
  lightScene: Scene,
  lightMaterial: ShaderMaterial
) {
  const map = terrainTexture()
  const material = new MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.5 })
  const patches = new Map<number, Mesh>()
  const lampsByPatch = new Map<number, InstancedMesh[]>()
  const lampBox = new BoxGeometry(2, 2, 2)
  const lampMaterial = new ShaderMaterial({
    uniforms: { uNight: night },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vLocal;
      uniform float uNight;
      void main() {
        float pane = min(abs(vLocal.x), abs(vLocal.y));
        bool glass = vLocal.z > -0.40 && vLocal.z < 0.74 && pane < 0.86;
        float core = exp(-2.8 * pane - 2.4 * abs(vLocal.z - 0.1));
        vec3 brass = vec3(0.36, 0.24, 0.14) * (0.82 + 0.3 * step(0.73, vLocal.z));
        vec3 amber = mix(vec3(0.92, 0.48, 0.15), vec3(1.0, 0.90, 0.60), core);
        amber = mix(vec3(0.72, 0.59, 0.43), amber, uNight);
        gl_FragColor = vec4(glass ? amber : brass, glass ? 1.0 - uNight : 1.0);
      }
    `
  })
  function removeLamps(key: number) {
    for (const mesh of lampsByPatch.get(key) ?? []) {
      mesh.removeFromParent()
      mesh.dispose()
    }
    lampsByPatch.delete(key)
  }
  const columns = Math.ceil(world.columns / PATCH)
  function rebuild(key: number) {
    const x = (key % columns) * PATCH,
      y = Math.floor(key / columns) * PATCH
    const mesh = patches.get(key)
    const lamps: DecorPlacement[] = []
    const geometry = patchGeometry(world, x, y, lamps)
    removeLamps(key)
    if (lamps.length) {
      const fixtures = new InstancedMesh(lampBox, lampMaterial, lamps.length)
      const matrix = new Matrix4().makeScale(1.5, 1.5, 2.6)
      lamps.forEach(({ x, y, z }, i) => {
        fixtures.setMatrixAt(i, matrix.setPosition(x, y, z + 2.6))
      })
      parent.add(fixtures)
      const pools = lightVolumes(lamps, lampBox, lightMaterial, [{ at: [0, 0, 3.2] }])
      lightScene.add(pools)
      lampsByPatch.set(key, [fixtures, pools])
    }
    if (mesh) {
      mesh.geometry.dispose()
      mesh.geometry = geometry
    } else {
      const next = new Mesh(geometry, material)
      next.castShadow = next.receiveShadow = true
      parent.add(next)
      patches.set(key, next)
    }
  }
  for (let key = 0; key < columns * Math.ceil(world.rows / PATCH); key++) rebuild(key)
  return {
    patches,
    update(indices: number[]) {
      const dirty = new Set<number>()
      for (const index of indices) {
        const x = index % world.columns,
          y = Math.floor(index / world.columns)
        for (const [px, py] of [
          [x, y],
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1]
        ]) {
          if (px >= 0 && py >= 0 && px < world.columns && py < world.rows)
            dirty.add(Math.floor(py / PATCH) * columns + Math.floor(px / PATCH))
        }
      }
      for (const key of dirty) rebuild(key)
    },
    dispose() {
      for (const key of lampsByPatch.keys()) removeLamps(key)
      lampBox.dispose()
      lampMaterial.dispose()
      for (const mesh of patches.values()) mesh.geometry.dispose()
      material.dispose()
      map.dispose()
    }
  }
}
