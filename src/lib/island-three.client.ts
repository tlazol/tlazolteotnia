import {
  AlwaysStencilFunc,
  CanvasTexture,
  Color,
  DataTexture,
  EqualStencilFunc,
  GreaterDepth,
  InstancedMesh,
  LinearFilter,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  ReplaceStencilOp,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  UnsignedByteType,
  WebGLRenderer
} from 'three'
import {
  createBuffer,
  createShoreField,
  decorVariantIndex,
  decorVariants,
  hex,
  islandPalette,
  outline,
  type PixelBuffer,
  paintShadow,
  paintTerrain,
  SHORE_CELL,
  SHORE_RANGE,
  type ShadowSize,
  setPixel,
  shadowSizes,
  updateShoreField
} from './island-art'
import { type IslandView, WORLD_HEIGHT, WORLD_WIDTH } from './island-camera'
import {
  facings,
  paintResidentSheet,
  RESIDENT_FOOT_PAD,
  RESIDENT_FRAME,
  RESIDENT_FRAMES,
  RESIDENT_SCALE,
  type Resident,
  type ResidentDesign,
  residentOccupies,
  settleResidents,
  stepResidents
} from './island-residents'
import { decorKindOf, EDIT_MARGIN, type IslandWorld, TILE_SIZE } from './island-world'
import type { SceneSize } from './scene-math'

export type ResidentScreen = {
  slug: string
  // Foot position and sprite box in CSS pixels.
  x: number
  y: number
  width: number
  height: number
}
export type CursorTile = { x: number; y: number; allowed: boolean }
export type IslandCursor = { tiles: CursorTile[]; soft: boolean; center: { x: number; y: number } }

const CHUNK = 256
const Z = { water: -10, terrain: 0, grid: 0.3, shadow: 0.5, ring: 0.6, sprite: 1, cursor: 5 }
const spriteZ = (footY: number) => Z.sprite + footY / 4000

function textureFrom(buffer: PixelBuffer) {
  const canvas = document.createElement('canvas')
  canvas.width = buffer.width
  canvas.height = buffer.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas unavailable')
  context.putImageData(
    new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height),
    0,
    0
  )
  return pixelTexture(new CanvasTexture(canvas))
}

function pixelTexture<T extends Texture>(texture: T) {
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = SRGBColorSpace
  return texture
}

// Instanced sprites keyed by an id (tile index or resident index). Adding and
// removing touches only that instance; capacity grows by doubling.
class SpriteLayer {
  mesh: InstancedMesh
  private keys: number[] = []
  private slots = new Map<number, number>()
  private matrix = new Matrix4()
  constructor(
    private scene: Scene,
    private geometry: PlaneGeometry,
    private material: Material,
    private width: number,
    private height: number,
    capacity = 32
  ) {
    this.mesh = this.create(capacity)
  }
  private create(capacity: number) {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity)
    mesh.count = 0
    mesh.frustumCulled = false
    this.scene.add(mesh)
    return mesh
  }
  // Places the sprite with its bottom-center at (x, y) in art pixels.
  set(key: number, x: number, y: number, z: number, flip = false) {
    let slot = this.slots.get(key)
    if (slot === undefined) {
      slot = this.keys.length
      if (slot >= this.mesh.instanceMatrix.count) {
        const next = this.create(this.mesh.instanceMatrix.count * 2)
        for (let i = 0; i < this.keys.length; i++) {
          this.mesh.getMatrixAt(i, this.matrix)
          next.setMatrixAt(i, this.matrix)
        }
        this.scene.remove(this.mesh)
        this.mesh.dispose()
        this.mesh = next
      }
      this.keys.push(key)
      this.slots.set(key, slot)
      this.mesh.count = this.keys.length
    }
    const left = Math.round(x) - Math.floor(this.width / 2)
    const top = Math.round(y) - this.height
    this.matrix.makeScale(flip ? -1 : 1, 1, 1)
    this.matrix.setPosition(left + this.width / 2, -(top + this.height / 2), z)
    this.mesh.setMatrixAt(slot, this.matrix)
    this.mesh.instanceMatrix.needsUpdate = true
  }
  remove(key: number) {
    const slot = this.slots.get(key)
    if (slot === undefined) return
    const last = this.keys.length - 1
    if (slot !== last) {
      this.mesh.getMatrixAt(last, this.matrix)
      this.mesh.setMatrixAt(slot, this.matrix)
      this.keys[slot] = this.keys[last]
      this.slots.set(this.keys[slot], slot)
    }
    this.keys.pop()
    this.slots.delete(key)
    this.mesh.count = this.keys.length
    this.mesh.instanceMatrix.needsUpdate = true
  }
  clear() {
    for (const key of [...this.keys]) this.remove(key)
  }
  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.dispose()
  }
}

const waterVertex = /* glsl */ `
varying vec2 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = vec2(world.x, -world.y);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const vec3Of = (value: string) => {
  const [r, g, b] = hex(value)
  return `vec3(${(r / 255).toFixed(3)}, ${(g / 255).toFixed(3)}, ${(b / 255).toFixed(3)})`
}

const waterFragment = /* glsl */ `
uniform sampler2D uShore;
uniform vec2 uWorld;
uniform float uRange;
uniform float uTime;
varying vec2 vWorld;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 p = floor(vWorld);
  vec2 uv = (p + 0.5) / uWorld;
  float d = 1.0;
  if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) d = texture2D(uShore, uv).r;
  float dist = d * uRange;
  float checker = mod(p.x + p.y, 2.0);
  float dd = dist + (checker - 0.5) * 2.5;
  vec3 col = ${vec3Of(islandPalette.deep)};
  if (dd < 44.0) col = ${vec3Of(islandPalette.mid)};
  if (dd < 22.0) col = ${vec3Of(islandPalette.shallow)};
  if (dd < 9.0) col = ${vec3Of(islandPalette.lagoon)};
  vec3 foam = ${vec3Of(islandPalette.foam)};
  vec3 wave = ${vec3Of(islandPalette.wave)};

  // Short wave dashes drifting in open water.
  vec2 size = vec2(22.0, 11.0);
  vec2 cell = floor(p / size);
  float h = hash(cell);
  vec2 local = p - cell * size;
  float sway = floor(sin(uTime * 0.9 + h * 6.283) * 1.5 + 0.5);
  float start = 3.0 + floor(h * 9.0) + sway;
  float len = 3.0 + floor(hash(cell + 7.0) * 3.0);
  bool visible = fract(uTime * 0.18 + h) < 0.72;
  if (h > 0.7 && visible && dd > 12.0 && local.y == 5.0 && local.x >= start && local.x < start + len) col = wave;
  if (h > 0.7 && visible && dd > 12.0 && local.y == 6.0 && (local.x == start - 1.0 || local.x == start + len)) col = mix(col, wave, 0.55);

  // Foam hugging the shore, breathing in and out.
  float edge = 2.5 + 1.2 * sin(uTime * 1.4 + (p.x + p.y * 0.7) * 0.11);
  if (dist < edge + (checker - 0.5) * 0.8) col = foam;
  // A ripple that leaves the coast and fades as it travels.
  float phase = fract(uTime * 0.2);
  float ring = 4.0 + phase * 11.0;
  if (abs(dist - ring) < 0.75 && hash(p + floor(uTime * 3.0)) > phase * 1.15) col = mix(col, foam, 0.75);

  // Occasional glints far from land.
  vec2 g = floor(p / 26.0);
  float gh = hash(g + 3.1);
  vec2 gp = g * 26.0 + floor(vec2(hash(g + 1.7), hash(g + 9.2)) * 20.0) + 3.0;
  float blink = fract(uTime * 0.35 + gh * 5.0);
  if (dd > 30.0 && gh > 0.55 && blink < 0.12) {
    vec2 q = abs(p - gp);
    if ((q.x == 0.0 && q.y <= 1.0) || (q.y == 0.0 && q.x <= 1.0)) col = vec3(1.0);
  }
  gl_FragColor = vec4(col, 1.0);
}
`

const gridFragment = /* glsl */ `
uniform vec2 uCursor;
uniform float uRadius;
uniform vec2 uWorld;
uniform float uMargin;
uniform float uShowCursor;
varying vec2 vWorld;

void main() {
  vec2 p = floor(vWorld);
  vec2 m = mod(p, ${TILE_SIZE.toFixed(1)});
  float a = 0.0;
  bool corner = (m.x == 0.0 || m.x == ${(TILE_SIZE - 1).toFixed(1)}) && (m.y == 0.0 || m.y == ${(TILE_SIZE - 1).toFixed(1)});
  float fall = uShowCursor * (1.0 - smoothstep(uRadius * 0.45, uRadius, distance(vWorld, uCursor)));
  if (corner) a = 0.7 * fall;
  vec2 lo = vec2(uMargin * ${TILE_SIZE.toFixed(1)});
  vec2 hi = uWorld - lo;
  bool vertical = (p.x == lo.x - 1.0 || p.x == hi.x) && p.y >= lo.y - 1.0 && p.y <= hi.y;
  bool horizontal = (p.y == lo.y - 1.0 || p.y == hi.y) && p.x >= lo.x - 1.0 && p.x <= hi.x;
  if ((vertical && mod(floor(p.y / 4.0), 2.0) == 0.0) || (horizontal && mod(floor(p.x / 4.0), 2.0) == 0.0)) a = max(a, 0.55);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, a);
}
`

function cursorBuffer(blocked: boolean) {
  const buffer = createBuffer(TILE_SIZE, TILE_SIZE)
  const solid = hex('#ffffff')
  const fill = hex('#ffffff', blocked ? 70 : 46)
  for (let y = 1; y < TILE_SIZE - 1; y++)
    for (let x = 1; x < TILE_SIZE - 1; x++) setPixel(buffer, x, y, fill)
  for (const [cx, cy, sx, sy] of [
    [0, 0, 1, 1],
    [TILE_SIZE - 1, 0, -1, 1],
    [0, TILE_SIZE - 1, 1, -1],
    [TILE_SIZE - 1, TILE_SIZE - 1, -1, -1]
  ]) {
    for (let i = 0; i < 4; i++) {
      setPixel(buffer, cx + sx * i, cy, solid)
      setPixel(buffer, cx, cy + sy * i, solid)
    }
  }
  if (blocked) {
    for (let i = 4; i < TILE_SIZE - 4; i++) {
      setPixel(buffer, i, i, solid)
      setPixel(buffer, TILE_SIZE - 1 - i, i, solid)
    }
  }
  return buffer
}

function ringBuffer() {
  const buffer = createBuffer(18, 8)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 18; x++) {
      const d = ((x + 0.5 - 9) / 8.5) ** 2 + ((y + 0.5 - 4) / 3.5) ** 2
      if (d <= 1 && d > 0.45) setPixel(buffer, x, y, hex('#ffffff'))
    }
  }
  outline(buffer, hex('#2b2236', 160))
  return buffer
}

// Stencil marks: decorations stamp 1 where they are drawn, residents stamp 0,
// so a resident's silhouette shows only where a tree or rock hides them.
const BEHIND_DECOR = 1
const stampStencil = (material: Material, ref: number) => {
  material.stencilWrite = true
  material.stencilRef = ref
  material.stencilFunc = AlwaysStencilFunc
  material.stencilZPass = ReplaceStencilOp
  return material
}

const silhouetteVertex = /* glsl */ `
uniform mat3 uvTransform;
varying vec2 vUv;
void main() {
  vUv = (uvTransform * vec3(uv, 1.0)).xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const silhouetteFragment = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(map, vUv);
  if (texel.a < 0.5) discard;
  // A flat, see-through shadow of the resident.
  gl_FragColor = vec4(${vec3Of(islandPalette.outline)}, 0.5);
}
`

export type IslandRendererOptions = {
  world: IslandWorld
  residents: Resident[]
  designs: Map<string, ResidentDesign>
  onFrame: (positions: ResidentScreen[]) => void
  onFailure: () => void
}

export function createIslandRenderer(canvas: HTMLCanvasElement, options: IslandRendererOptions) {
  const { world, residents, designs, onFrame, onFailure } = options
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: true })
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(new Color(islandPalette.deep))
  const scene = new Scene()
  const camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 100)
  camera.position.z = 50
  const disposables: Array<{ dispose: () => void }> = []
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item)
    return item
  }

  // Sea.
  const field = createShoreField(world)
  updateShoreField(world, field)
  const shoreTexture = track(
    new DataTexture(field.distance, field.width, field.height, RedFormat, UnsignedByteType)
  )
  shoreTexture.magFilter = LinearFilter
  shoreTexture.minFilter = LinearFilter
  shoreTexture.needsUpdate = true
  const waterMaterial = track(
    new ShaderMaterial({
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
      uniforms: {
        uShore: { value: shoreTexture },
        uWorld: { value: [WORLD_WIDTH, WORLD_HEIGHT] },
        uRange: { value: SHORE_RANGE * SHORE_CELL },
        uTime: { value: 0 }
      }
    })
  )
  const seaSize = 6000
  const water = new Mesh(
    track(new PlaneGeometry(WORLD_WIDTH + seaSize, WORLD_HEIGHT + seaSize)),
    waterMaterial
  )
  water.position.set(WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, Z.water)
  scene.add(water)

  // Terrain, painted into canvas chunks so an edit repaints only nearby pixels.
  const chunkGeometry = track(new PlaneGeometry(CHUNK, CHUNK))
  const chunks: Array<{
    x: number
    y: number
    context: CanvasRenderingContext2D
    texture: CanvasTexture
  }> = []
  for (let cy = 0; cy < Math.ceil(WORLD_HEIGHT / CHUNK); cy++) {
    for (let cx = 0; cx < Math.ceil(WORLD_WIDTH / CHUNK); cx++) {
      const chunkCanvas = document.createElement('canvas')
      chunkCanvas.width = CHUNK
      chunkCanvas.height = CHUNK
      const context = chunkCanvas.getContext('2d')
      if (!context) throw new Error('2D canvas unavailable')
      const texture = track(pixelTexture(new CanvasTexture(chunkCanvas)))
      const material = track(
        new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
      )
      const mesh = new Mesh(chunkGeometry, material)
      mesh.position.set(cx * CHUNK + CHUNK / 2, -(cy * CHUNK + CHUNK / 2), Z.terrain)
      scene.add(mesh)
      chunks.push({ x: cx * CHUNK, y: cy * CHUNK, context, texture })
    }
  }
  function paintRegion(x0: number, y0: number, x1: number, y1: number) {
    for (const chunk of chunks) {
      const left = Math.max(x0, chunk.x)
      const top = Math.max(y0, chunk.y)
      const right = Math.min(x1, chunk.x + CHUNK)
      const bottom = Math.min(y1, chunk.y + CHUNK)
      if (right <= left || bottom <= top) continue
      const buffer = createBuffer(right - left, bottom - top)
      paintTerrain(world, buffer, left, top, buffer.width, buffer.height)
      chunk.context.putImageData(
        new ImageData(buffer.data as Uint8ClampedArray<ArrayBuffer>, buffer.width, buffer.height),
        left - chunk.x,
        top - chunk.y
      )
      chunk.texture.needsUpdate = true
    }
  }
  paintRegion(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  // Editing aids: corner dots near the cursor and the edge of the editable area.
  const gridMaterial = track(
    new ShaderMaterial({
      vertexShader: waterVertex,
      fragmentShader: gridFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCursor: { value: [-999, -999] },
        uRadius: { value: TILE_SIZE * 4 },
        uWorld: { value: [WORLD_WIDTH, WORLD_HEIGHT] },
        uMargin: { value: EDIT_MARGIN },
        uShowCursor: { value: 0 }
      }
    })
  )
  const grid = new Mesh(track(new PlaneGeometry(WORLD_WIDTH + 64, WORLD_HEIGHT + 64)), gridMaterial)
  grid.position.set(WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, Z.grid)
  grid.visible = false
  scene.add(grid)

  // Sprites share one material per texture; transparency is cut out (alphaTest)
  // so depth orders overlapping sprites by their feet.
  const spriteMaterial = (buffer: PixelBuffer) =>
    track(
      stampStencil(
        new MeshBasicMaterial({ map: track(textureFrom(buffer)), alphaTest: 0.5 }),
        BEHIND_DECOR
      )
    )
  const shadowLayers = Object.fromEntries(
    (Object.keys(shadowSizes) as ShadowSize[]).map((size) => {
      const buffer = paintShadow(size)
      const material = track(
        new MeshBasicMaterial({
          map: track(textureFrom(buffer)),
          transparent: true,
          depthWrite: false
        })
      )
      return [
        size,
        new SpriteLayer(
          scene,
          track(new PlaneGeometry(buffer.width, buffer.height)),
          material,
          buffer.width,
          buffer.height
        )
      ]
    })
  ) as Record<ShadowSize, SpriteLayer>

  const decorLayers = new Map<string, { layer: SpriteLayer; shadow: ShadowSize }>()
  for (const [kind, frames] of Object.entries(decorVariants)) {
    frames.forEach((frame, variant) => {
      const layer = new SpriteLayer(
        scene,
        track(new PlaneGeometry(frame.buffer.width, frame.buffer.height)),
        spriteMaterial(frame.buffer),
        frame.buffer.width,
        frame.buffer.height
      )
      decorLayers.set(`${kind}:${variant}`, { layer, shadow: frame.shadow })
    })
  }
  const placedDecor = new Map<number, string>()
  function syncDecor(index: number) {
    const x = index % world.columns
    const y = Math.floor(index / world.columns)
    const kind = decorKindOf(world.decor[index])
    const key = kind ? `${kind}:${decorVariantIndex(kind, x, y)}` : null
    const previous = placedDecor.get(index)
    if (previous === key) return
    if (previous) {
      const entry = decorLayers.get(previous)
      entry?.layer.remove(index)
      if (entry) shadowLayers[entry.shadow].remove(index)
      placedDecor.delete(index)
    }
    if (!key) return
    const entry = decorLayers.get(key)
    if (!entry) return
    const footX = x * TILE_SIZE + TILE_SIZE / 2
    const footY = y * TILE_SIZE + TILE_SIZE - 2
    // Sorted by the tile's middle: residents beside the trunk stand in front of
    // it, residents on the tiles behind it pass under the canopy.
    entry.layer.set(index, footX, footY + 1, spriteZ(y * TILE_SIZE + TILE_SIZE / 2))
    shadowLayers[entry.shadow].set(index, footX, footY + 2, Z.shadow)
    placedDecor.set(index, key)
  }
  for (let index = 0; index < world.decor.length; index++) syncDecor(index)

  // Residents: one sheet texture each, cut into frames by UV offset.
  const residentWidth = RESIDENT_FRAME.width * RESIDENT_SCALE
  const residentHeight = RESIDENT_FRAME.height * RESIDENT_SCALE
  const residentGeometry = track(new PlaneGeometry(residentWidth, residentHeight))
  const residentMeshes = residents.map((resident) => {
    const design = designs.get(resident.slug)
    const buffer = design
      ? paintResidentSheet(design)
      : createBuffer(RESIDENT_FRAME.width * RESIDENT_FRAMES, RESIDENT_FRAME.height * 3)
    const texture = track(textureFrom(buffer))
    texture.repeat.set(1 / RESIDENT_FRAMES, 1 / facings.length)
    const mesh = new Mesh(
      residentGeometry,
      track(stampStencil(new MeshBasicMaterial({ map: texture, alphaTest: 0.5 }), 0))
    )
    // Drawn after everything else, only where the resident is behind decoration.
    const silhouette = new Mesh(
      residentGeometry,
      track(
        new ShaderMaterial({
          vertexShader: silhouetteVertex,
          fragmentShader: silhouetteFragment,
          uniforms: { map: { value: texture }, uvTransform: { value: texture.matrix } },
          transparent: true,
          depthWrite: false,
          depthFunc: GreaterDepth,
          stencilWrite: true,
          stencilRef: BEHIND_DECOR,
          stencilFunc: EqualStencilFunc
        })
      )
    )
    silhouette.renderOrder = 5
    mesh.add(silhouette)
    scene.add(mesh)
    return { mesh, texture }
  })
  const residentShadows = new SpriteLayer(
    scene,
    track(new PlaneGeometry(...shadowSizes.small)),
    shadowLayers.small.mesh.material as Material,
    shadowSizes.small[0],
    shadowSizes.small[1],
    Math.max(4, residents.length)
  )
  const ringTexture = track(textureFrom(ringBuffer()))
  const makeRing = (color: string) => {
    const mesh = new Mesh(
      track(new PlaneGeometry(18, 8)),
      track(
        new MeshBasicMaterial({
          map: ringTexture,
          transparent: true,
          depthWrite: false,
          color: new Color(color)
        })
      )
    )
    mesh.visible = false
    scene.add(mesh)
    return mesh
  }
  const selectedRing = makeRing('#ffe66b')
  const focusRing = makeRing('#ffffff')

  // Cursor.
  const cursorLayers = [false, true].map((blocked) => {
    const buffer = cursorBuffer(blocked)
    const material = track(
      new MeshBasicMaterial({
        map: track(textureFrom(buffer)),
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    )
    const layer = new SpriteLayer(
      scene,
      track(new PlaneGeometry(TILE_SIZE, TILE_SIZE)),
      material,
      TILE_SIZE,
      TILE_SIZE,
      9
    )
    layer.mesh.renderOrder = 10
    return { layer, material }
  })

  let view: IslandView = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 2 }
  let size: SceneSize = { width: 0, height: 0 }
  let origin = { left: 0, top: 0 }
  let selected: string | null = null
  let focused: string | null = null
  let editing = false
  let frame = 0
  let last = 0
  let time = 0
  let disposed = false
  let failed = false
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function placeCamera() {
    if (!size.width || !size.height) return
    const unit = view.zoom * pixelRatio
    // Snap so art pixels land on whole device pixels.
    const left = Math.round((view.x - size.width / 2 / view.zoom) * unit) / unit
    const top = Math.round((view.y - size.height / 2 / view.zoom) * unit) / unit
    origin = { left, top }
    camera.left = left
    camera.right = left + size.width / view.zoom
    camera.top = -top
    camera.bottom = -(top + size.height / view.zoom)
    camera.updateProjectionMatrix()
  }

  function project(): ResidentScreen[] {
    return residents.map((resident) => {
      const x = Math.round(resident.x)
      const y = Math.round(resident.y)
      return {
        slug: resident.slug,
        x: (x - origin.left) * view.zoom,
        y: (y - origin.top) * view.zoom,
        width: residentWidth * view.zoom,
        height: residentHeight * view.zoom
      }
    })
  }

  function placeResidents() {
    residents.forEach((resident, i) => {
      const { mesh, texture } = residentMeshes[i]
      const row = facings.indexOf(resident.facing)
      texture.offset.set(resident.frame / RESIDENT_FRAMES, 1 - (row + 1) / facings.length)
      texture.updateMatrix()
      const footX = Math.round(resident.x)
      const footY = Math.round(resident.y)
      // Keep the shoes where the full-size art put them and shrink upward.
      const sole = footY + 1 - RESIDENT_FOOT_PAD
      mesh.position.set(
        footX,
        -(sole - residentHeight / 2 + RESIDENT_FOOT_PAD * RESIDENT_SCALE),
        spriteZ(footY)
      )
      mesh.scale.x = resident.flip ? -1 : 1
      residentShadows.set(i, footX, footY + 2, Z.shadow)
      for (const [ring, slug] of [
        [selectedRing, selected],
        [focusRing, focused !== selected ? focused : null]
      ] as const) {
        if (slug !== resident.slug) continue
        ring.visible = true
        ring.position.set(footX, -(footY - 1), Z.ring)
      }
    })
    if (!selected || !residents.some((r) => r.slug === selected)) selectedRing.visible = false
    if (!focused || focused === selected || !residents.some((r) => r.slug === focused))
      focusRing.visible = false
  }

  function fail(error?: unknown) {
    if (disposed || failed) return
    failed = true
    if (error !== undefined) console.error('Island renderer unavailable', error)
    cancelAnimationFrame(frame)
    onFailure()
  }

  function draw(now: number) {
    frame = 0
    if (disposed || failed || document.hidden || !size.width) return
    try {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      if (dt && dt < 1 / 32) {
        frame = requestAnimationFrame(draw)
        return
      }
      last = now
      const still = reducedMotion.matches
      if (!still) {
        time += dt
        stepResidents(world, residents, dt, (slug) => slug === selected)
      }
      waterMaterial.uniforms.uTime.value = time
      placeResidents()
      renderer.render(scene, camera)
      onFrame(project())
      if (!still) frame = requestAnimationFrame(draw)
    } catch (error) {
      fail(error)
    }
  }
  function wake() {
    if (!frame && !disposed && !failed) frame = requestAnimationFrame(draw)
  }
  function visibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
    } else wake()
  }
  function contextLost(event: Event) {
    event.preventDefault()
    fail()
  }
  document.addEventListener('visibilitychange', visibility)
  reducedMotion.addEventListener('change', wake)
  canvas.addEventListener('webglcontextlost', contextLost)

  return {
    setView(next: IslandView, nextSize: SceneSize) {
      if (failed || disposed || !nextSize.width || !nextSize.height) return
      view = next
      if (nextSize.width !== size.width || nextSize.height !== size.height) {
        size = nextSize
        renderer.setSize(size.width, size.height, false)
      }
      placeCamera()
      wake()
    },
    // Repaints only the tiles touched by an edit (and the pixels they blend into).
    updateTiles(indices: number[]) {
      if (!indices.length || failed || disposed) return
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const index of indices) {
        const x = index % world.columns
        const y = Math.floor(index / world.columns)
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
        syncDecor(index)
      }
      try {
        paintRegion(
          (minX - 1) * TILE_SIZE,
          (minY - 1) * TILE_SIZE,
          (maxX + 2) * TILE_SIZE,
          (maxY + 2) * TILE_SIZE + 4
        )
        const cells = TILE_SIZE / SHORE_CELL
        updateShoreField(
          world,
          field,
          (minX - 1) * cells,
          (minY - 1) * cells,
          (maxX + 2) * cells,
          (maxY + 2) * cells
        )
        shoreTexture.needsUpdate = true
        settleResidents(world, residents)
      } catch (error) {
        fail(error)
      }
      wake()
    },
    setCursor(cursor: IslandCursor | null) {
      for (const { layer } of cursorLayers) layer.clear()
      if (cursor) {
        cursor.tiles.forEach((tile, i) => {
          const blocked = !tile.allowed && !cursor.soft
          cursorLayers[blocked ? 1 : 0].layer.set(
            i,
            tile.x * TILE_SIZE + TILE_SIZE / 2,
            (tile.y + 1) * TILE_SIZE,
            Z.cursor
          )
        })
        cursorLayers[0].material.color.set(cursor.soft ? '#c9d6e3' : '#fff6bf')
        cursorLayers[1].material.color.set('#ff5b5b')
        gridMaterial.uniforms.uCursor.value = [
          cursor.center.x * TILE_SIZE + TILE_SIZE / 2,
          cursor.center.y * TILE_SIZE + TILE_SIZE / 2
        ]
        gridMaterial.uniforms.uShowCursor.value = 1
      } else gridMaterial.uniforms.uShowCursor.value = 0
      wake()
    },
    setEditing(value: boolean) {
      editing = value
      grid.visible = editing
      if (!editing) this.setCursor(null)
      wake()
    },
    select(slug: string | null) {
      selected = slug
      wake()
    },
    focus(slug: string | null) {
      focused = slug
      wake()
    },
    occupied(x: number, y: number) {
      return residents.some((resident) => residentOccupies(resident, x, y))
    },
    resident(slug: string) {
      return residents.find((resident) => resident.slug === slug) ?? null
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', visibility)
      reducedMotion.removeEventListener('change', wake)
      canvas.removeEventListener('webglcontextlost', contextLost)
      for (const layer of Object.values(shadowLayers)) layer.dispose()
      for (const { layer } of decorLayers.values()) layer.dispose()
      for (const { layer } of cursorLayers) layer.dispose()
      residentShadows.dispose()
      for (const item of disposables) item.dispose()
      renderer.dispose()
    }
  }
}
export type IslandRenderer = ReturnType<typeof createIslandRenderer>
