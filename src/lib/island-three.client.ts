import {
  AdditiveBlending,
  AlwaysStencilFunc,
  CanvasTexture,
  Color,
  CustomBlending,
  DataTexture,
  DstColorFactor,
  EqualStencilFunc,
  GreaterDepth,
  InstancedMesh,
  LinearFilter,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  ReplaceStencilOp,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  UnsignedByteType,
  WebGLRenderer,
  ZeroFactor
} from 'three'
import {
  createBuffer,
  createShoreField,
  hex,
  islandPalette,
  outline,
  type PixelBuffer,
  paintTerrain,
  SHORE_CELL,
  SHORE_RANGE,
  setPixel,
  updateShoreField
} from './island-art'
import { type IslandView, WORLD_HEIGHT, WORLD_WIDTH } from './island-camera'
import { daylightNow } from './island-daylight'
import {
  dropResident,
  facings,
  paintResidentSheet,
  RESIDENT_FOOT_PAD,
  RESIDENT_FRAME,
  RESIDENT_FRAMES,
  RESIDENT_SCALE,
  type Resident,
  type ResidentDesign,
  residentIsSwimming,
  residentOccupies,
  settleResidents,
  stepResidents
} from './island-residents'
import {
  decorVariantIndex,
  decorVariants,
  GULL_FRAME,
  paintFishSchool,
  paintGull,
  paintShadow,
  paintTurtle,
  type ShadowSize,
  type SpriteFrame,
  shadowSizes
} from './island-sprites'
import { decorKindOf, EDIT_MARGIN, hash2, type IslandWorld, TILE_SIZE } from './island-world'
import type { SceneSize } from './scene-math'

export type ResidentScreen = {
  slug: string
  // Foot position and sprite box in CSS pixels.
  x: number
  y: number
  width: number
  height: number
  swimming: boolean
  dragging: boolean
}
export type CursorTile = { x: number; y: number; allowed: boolean }
export type IslandCursor = { tiles: CursorTile[]; soft: boolean; center: { x: number; y: number } }

const CHUNK = 256
const Z = {
  water: -10,
  swimmer: -5,
  terrain: 0,
  grid: 0.3,
  shadow: 0.5,
  flat: 0.55,
  ring: 0.6,
  sprite: 1,
  cursor: 5,
  sky: 20
}
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
    capacity = 32,
    private renderOrder = 0
  ) {
    this.mesh = this.create(capacity)
  }
  private create(capacity: number) {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity)
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.renderOrder = this.renderOrder
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

const noiseGlsl = /* glsl */ `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
// Ordered dither threshold in [0, 1) on a 4×4 pixel grid.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}
`

// The sea: depth bands dithered into each other from pale lagoon to deep blue,
// reef patches and moving light on the shallows, surf rolling onto the shore.
const waterFragment = /* glsl */ `
uniform sampler2D uShore;
uniform vec2 uWorld;
uniform float uRange;
uniform float uTime;
varying vec2 vWorld;
${noiseGlsl}
void main() {
  vec2 p = floor(vWorld);
  vec2 uv = (p + 0.5) / uWorld;
  float d = 1.0;
  if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) d = texture2D(uShore, uv).r;
  float dist = d * uRange;
  float dither = bayer4(p) - 0.5;
  float drift = (vnoise(p / 26.0 + 3.7) - 0.5) * 22.0 * smoothstep(6.0, 50.0, dist);
  float dd = dist + drift + dither * 5.0;

  vec3 col = ${vec3Of(islandPalette.deep)};
  col = mix(col, ${vec3Of(islandPalette.ocean)}, 1.0 - smoothstep(60.0, 110.0, dd));
  col = mix(col, ${vec3Of(islandPalette.mid)}, 1.0 - smoothstep(38.0, 76.0, dd));
  col = mix(col, ${vec3Of(islandPalette.shallow)}, 1.0 - smoothstep(20.0, 52.0, dd));
  col = mix(col, ${vec3Of(islandPalette.lagoon)}, 1.0 - smoothstep(8.0, 30.0, dd));
  col = mix(col, ${vec3Of(islandPalette.pale)}, 1.0 - smoothstep(0.0, 12.0, dd));
  vec3 foam = ${vec3Of(islandPalette.foam)};

  // Long swells far out, slowly drifting.
  if (dd >= 86.0) {
    float swell = vnoise(vec2(p.x / 90.0 + uTime * 0.015, p.y / 34.0 - uTime * 0.01));
    if (swell + dither * 0.25 > 0.6) col = ${vec3Of(islandPalette.swell)};
  }

  // Reef and seagrass showing through the shallows.
  float reef = vnoise(p / 21.0 + 11.3) * 0.72 + vnoise(p / 7.0) * 0.28 + dither * 0.05;
  if (dd > 12.0 && dd < 74.0 && reef > 0.63) col = mix(col, ${vec3Of(islandPalette.reef)}, reef > 0.7 ? 0.5 : 0.28);

  // Light rippling over the sandy bottom.
  float tick = floor(uTime * 6.0) / 6.0;
  vec2 q = p / 10.0;
  float net = abs(
    vnoise(q + vec2(tick * 0.32, tick * 0.21)) - vnoise(q * 1.6 - vec2(tick * 0.27, -tick * 0.24) + 4.0)
  );
  if (dd < 44.0 && dist > 4.0 && net < 0.028) col = mix(col, foam, 0.36 * (1.0 - dd / 56.0));

  // Short wave dashes drifting in open water.
  vec2 size = vec2(22.0, 11.0);
  vec2 cell = floor(p / size);
  float h = hash(cell);
  vec2 local = p - cell * size;
  float sway = floor(sin(uTime * 0.9 + h * 6.283) * 1.5 + 0.5);
  float start = 3.0 + floor(h * 9.0) + sway;
  float len = 3.0 + floor(hash(cell + 7.0) * 3.0);
  bool visible = fract(uTime * 0.18 + h) < 0.72;
  if (h > 0.68 && visible && dd > 30.0) {
    if (local.y == 5.0 && local.x >= start && local.x < start + len) col = mix(col, foam, 0.5);
    if (local.y == 6.0 && (local.x == start - 1.0 || local.x == start + len)) col = mix(col, foam, 0.28);
  }

  // Surf: a line of foam rolls in, breaks on the shore and slides back.
  float along = vnoise(p / 44.0 + 1.9);
  float phase = fract(uTime * 0.14 + along * 1.3);
  float front = mix(26.0, 1.0, phase * phase * (3.0 - 2.0 * phase));
  float grain = hash(p + floor(uTime * 5.0));
  if (abs(dist - front) < 0.9 && grain < 0.25 + phase * 0.9) col = mix(col, foam, 0.9);
  if (abs(dist - front - 5.0) < 0.6 && grain < phase * 0.55) col = mix(col, foam, 0.55);
  float wash = 1.6 + 2.6 * smoothstep(0.8, 1.0, phase) + 2.2 * (1.0 - smoothstep(0.0, 0.25, phase));
  wash += sin(uTime * 1.3 + along * 12.0) * 0.6;
  if (dist < wash + dither * 1.2) col = mix(col, foam, 0.48 + grain * 0.3);

  // Glints of sun.
  vec2 g = floor(p / 26.0);
  float gh = hash(g + 3.1);
  vec2 gp = g * 26.0 + floor(vec2(hash(g + 1.7), hash(g + 9.2)) * 20.0) + 3.0;
  float blink = fract(uTime * 0.35 + gh * 5.0);
  if (dist > 12.0 && gh > 0.5 && blink < 0.14) {
    vec2 k = abs(p - gp);
    if ((k.x == 0.0 && k.y <= 1.0) || (k.y == 0.0 && k.x <= 1.0)) col = vec3(1.0);
  }
  gl_FragColor = vec4(col, 1.0);
}
`

// Cloud shadows sliding over land and sea alike.
const cloudFragment = /* glsl */ `
uniform float uTime;
varying vec2 vWorld;
${noiseGlsl}
void main() {
  vec2 p = floor(vWorld / 2.0) * 2.0;
  vec2 q = p / 210.0 + vec2(uTime * 0.011, uTime * 0.004);
  float n = vnoise(q) * 0.62 + vnoise(q * 2.4 + 3.1) * 0.28 + vnoise(q * 5.5 + 8.0) * 0.1;
  float edge = n + (bayer4(p / 2.0) - 0.5) * 0.035;
  if (edge < 0.6) discard;
  gl_FragColor = vec4(0.1, 0.22, 0.55, edge < 0.63 ? 0.06 : 0.11);
}
`

// Decoration sprites: cut-out pixels that can lean with the wind row by row
// (so the art stays on the pixel grid) or bob on the water.
const spriteVertex = /* glsl */ `
varying vec2 vUv;
varying float vPhase;
void main() {
  vUv = uv;
  #ifdef USE_INSTANCING
  mat4 placed = modelMatrix * instanceMatrix;
  #else
  mat4 placed = modelMatrix;
  #endif
  vPhase = placed[3].x * 0.021 + placed[3].y * 0.013;
  gl_Position = projectionMatrix * viewMatrix * placed * vec4(position, 1.0);
}
`

const spriteFragment = /* glsl */ `
uniform sampler2D map;
uniform vec2 uSize;
uniform float uTime;
uniform float uSway;
uniform float uBob;
varying vec2 vUv;
varying float vPhase;
void main() {
  float gust = sin(uTime * 1.1 + vPhase) + 0.45 * sin(uTime * 2.7 + vPhase * 1.9);
  float lean = floor(gust * uSway * vUv.y * vUv.y * 0.7 + 0.5);
  float bob = floor(sin(uTime * 1.7 + vPhase * 37.0) * uBob + 0.5);
  vec2 uv = vUv + vec2(lean / uSize.x, bob / uSize.y);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  vec4 texel = texture2D(map, uv);
  if (texel.a < 0.5) discard;
  gl_FragColor = vec4(texel.rgb, 1.0);
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

// Warm light around a torch, added over the darkened scene at night. Dithered
// rings keep it on the pixel grid.
const GLOW = { width: 96, height: 72 } as const
function glowBuffer() {
  const buffer = createBuffer(GLOW.width, GLOW.height)
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
  for (let y = 0; y < GLOW.height; y++) {
    for (let x = 0; x < GLOW.width; x++) {
      const d = Math.hypot(
        (x + 0.5 - GLOW.width / 2) / (GLOW.width / 2),
        (y + 0.5 - GLOW.height / 2) / (GLOW.height / 2)
      )
      if (d >= 1) continue
      const threshold = (bayer[((y >> 1) & 3) * 4 + ((x >> 1) & 3)] + 0.5) / 16
      const level = Math.floor((1 - d) ** 1.5 * 6 + threshold)
      if (level > 0) setPixel(buffer, x, y, hex('#ff9d3c', Math.min(150, level * 26)))
    }
  }
  return buffer
}

// Stencil marks: decorations stamp 1 where they are drawn, residents stamp 0,
// so a resident's silhouette shows only where a tree or rock hides them.
const BEHIND_DECOR = 1
const stampStencil = <T extends Material>(material: T, ref: number): T => {
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
  const clock = { value: 0 }
  const clouds = new Mesh(
    water.geometry,
    track(
      new ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: cloudFragment,
        uniforms: { uTime: clock },
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    )
  )
  clouds.position.set(WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, Z.sky)
  clouds.renderOrder = 20
  scene.add(clouds)

  // Time of day: everything drawn so far is multiplied by the hour's color.
  const tintMaterial = track(
    new MeshBasicMaterial({
      blending: CustomBlending,
      blendSrc: DstColorFactor,
      blendDst: ZeroFactor,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
  )
  const tint = new Mesh(water.geometry, tintMaterial)
  tint.position.set(WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, Z.sky)
  tint.renderOrder = 24
  scene.add(tint)
  const glowMaterial = track(
    new MeshBasicMaterial({
      map: track(textureFrom(glowBuffer())),
      blending: AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
  )
  const glows = new SpriteLayer(
    scene,
    track(new PlaneGeometry(GLOW.width, GLOW.height)),
    glowMaterial,
    GLOW.width,
    GLOW.height,
    16,
    26
  )
  let glow = 0
  let lightChecked = -Infinity
  function updateDaylight(now: number) {
    if (now - lightChecked < 15_000) return
    lightChecked = now
    const light = daylightNow()
    tintMaterial.color.setRGB(...light.tint, SRGBColorSpace)
    tint.visible = light.tint.some((channel) => channel < 0.999)
    glow = light.glow
  }

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

  // Sprites share one material per texture; transparency is cut out so depth
  // orders overlapping sprites by their feet.
  const rawTexture = (buffer: PixelBuffer) => {
    const texture = track(textureFrom(buffer))
    texture.colorSpace = NoColorSpace
    return texture
  }
  const animated: Array<{ material: ShaderMaterial; textures: Texture[] }> = []
  const spriteMaterial = (frame: SpriteFrame) => {
    const textures = [frame.buffer, ...(frame.frames ?? [])].map(rawTexture)
    const material = track(
      new ShaderMaterial({
        vertexShader: spriteVertex,
        fragmentShader: spriteFragment,
        uniforms: {
          map: { value: textures[0] },
          uSize: { value: [frame.buffer.width, frame.buffer.height] },
          uTime: clock,
          uSway: { value: frame.sway ?? 0 },
          uBob: { value: frame.bob ?? 0 }
        }
      })
    )
    if (textures.length > 1) animated.push({ material, textures })
    // Flat things never hide a resident, so they leave no stencil mark.
    return frame.flat ? material : stampStencil(material, BEHIND_DECOR)
  }
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

  const decorLayers = new Map<
    string,
    { layer: SpriteLayer; shadow: ShadowSize | null; flat: boolean }
  >()
  for (const [kind, frames] of Object.entries(decorVariants)) {
    frames.forEach((frame: SpriteFrame, variant) => {
      const layer = new SpriteLayer(
        scene,
        track(new PlaneGeometry(frame.buffer.width, frame.buffer.height)),
        spriteMaterial(frame),
        frame.buffer.width,
        frame.buffer.height
      )
      decorLayers.set(`${kind}:${variant}`, {
        layer,
        shadow: frame.shadow,
        flat: frame.flat === true
      })
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
      if (entry?.shadow) shadowLayers[entry.shadow].remove(index)
      glows.remove(index)
      placedDecor.delete(index)
    }
    if (!key) return
    const entry = decorLayers.get(key)
    if (!entry) return
    const footX = x * TILE_SIZE + TILE_SIZE / 2
    const footY = y * TILE_SIZE + TILE_SIZE - 2
    // Sorted by the tile's middle: residents beside the trunk stand in front of
    // it, residents on the tiles behind it pass under the canopy.
    entry.layer.set(
      index,
      footX,
      footY + 1,
      entry.flat ? Z.flat : spriteZ(y * TILE_SIZE + TILE_SIZE / 2)
    )
    if (entry.shadow) shadowLayers[entry.shadow].set(index, footX, footY + 2, Z.shadow)
    // Centered on the flame.
    if (kind === 'torch') glows.set(index, footX, footY - 26 + GLOW.height / 2, Z.sky)
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
    const swimTexture = track(textureFrom(design ? paintResidentSheet(design, true) : buffer))
    for (const map of [texture, swimTexture])
      map.repeat.set(1 / RESIDENT_FRAMES, 1 / facings.length)
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
    return { mesh, texture, swimTexture, silhouette }
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

  // Wildlife: gulls crossing overhead with their shadows, fish and turtles
  // circling in the shallows. None of it is saved or editable.
  const fieldDistance = (x: number, y: number) => {
    const cx = Math.floor(x / SHORE_CELL)
    const cy = Math.floor(y / SHORE_CELL)
    if (cx < 0 || cy < 0 || cx >= field.width || cy >= field.height) return SHORE_RANGE * SHORE_CELL
    return (field.distance[cy * field.width + cx] / 255) * SHORE_RANGE * SHORE_CELL
  }
  const gullTexture = track(textureFrom(paintGull()))
  gullTexture.repeat.set(0.5, 1)
  const gullGeometry = track(new PlaneGeometry(GULL_FRAME.width, GULL_FRAME.height))
  const gullMaterial = track(
    new MeshBasicMaterial({ map: gullTexture, alphaTest: 0.5, depthTest: false, depthWrite: false })
  )
  const gullShadowMaterial = track(
    new MeshBasicMaterial({
      map: track(textureFrom(paintShadow('small'))),
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
  )
  const gullShadowGeometry = track(new PlaneGeometry(...shadowSizes.small))
  const gulls = [0, 1, 2].map((i) => {
    const mesh = new Mesh(gullGeometry, gullMaterial)
    mesh.renderOrder = 22
    const shadow = new Mesh(gullShadowGeometry, gullShadowMaterial)
    shadow.renderOrder = 19
    scene.add(mesh, shadow)
    const direction = i % 2 ? -1 : 1
    return {
      mesh,
      shadow,
      direction,
      x: WORLD_WIDTH * (0.2 + i * 0.3),
      y: WORLD_HEIGHT * (0.25 + hash2(i, 5, 801) * 0.5),
      speed: 20 + i * 5,
      lap: 0
    }
  })
  const swimmers: Array<{
    mesh: Mesh
    x: number
    y: number
    radius: number
    speed: number
    phase: number
  }> = []
  const addSwimmers = (
    buffer: PixelBuffer,
    count: number,
    color: string,
    opacity: number,
    seed: number
  ) => {
    const geometry = track(new PlaneGeometry(buffer.width, buffer.height))
    const material = track(
      new MeshBasicMaterial({
        map: track(textureFrom(buffer)),
        transparent: true,
        depthWrite: false,
        opacity,
        color: new Color(color)
      })
    )
    for (let i = 0, found = 0; i < 400 && found < count; i++) {
      const x = hash2(i, seed, 811) * WORLD_WIDTH
      const y = hash2(i, seed, 812) * WORLD_HEIGHT
      const depth = fieldDistance(x, y)
      if (depth < 26 || depth > 70) continue
      if (swimmers.some((other) => Math.hypot(other.x - x, other.y - y) < 150)) continue
      const mesh = new Mesh(geometry, material)
      scene.add(mesh)
      swimmers.push({
        mesh,
        x,
        y,
        radius: 12 + hash2(i, seed, 813) * 12,
        speed: (0.18 + hash2(i, seed, 814) * 0.2) * (i % 2 ? 1 : -1),
        phase: hash2(i, seed, 815) * 6.283
      })
      found++
    }
  }
  addSwimmers(paintFishSchool(), 7, '#0d4f7a', 0.5, 1)
  addSwimmers(paintTurtle(), 2, '#d8ffe0', 0.85, 2)
  function placeWildlife(dt: number) {
    for (const gull of gulls) {
      gull.x += gull.direction * gull.speed * dt
      if (gull.x < -160 || gull.x > WORLD_WIDTH + 160) {
        gull.lap++
        gull.x = gull.direction > 0 ? -150 : WORLD_WIDTH + 150
        gull.y = WORLD_HEIGHT * (0.15 + hash2(gull.lap, gull.speed, 802) * 0.7)
      }
      const x = Math.round(gull.x)
      const y = Math.round(
        gull.y + Math.sin(time * 0.5 + gull.speed) * 14 - gull.x * 0.12 * gull.direction
      )
      gull.mesh.position.set(x, -y, Z.sky)
      gull.mesh.scale.x = gull.direction
      gull.shadow.position.set(x + 8, -(y + 34), Z.sky)
    }
    gullTexture.offset.x = Math.floor(time * 3.2) % 4 === 0 ? 0.5 : 0
    for (const swimmer of swimmers) {
      const angle = swimmer.phase + time * swimmer.speed
      const x = Math.round(swimmer.x + Math.cos(angle) * swimmer.radius * 1.6)
      const y = Math.round(swimmer.y + Math.sin(angle) * swimmer.radius)
      swimmer.mesh.visible = fieldDistance(x, y) > 9
      swimmer.mesh.position.set(x, -y, Z.swimmer)
      swimmer.mesh.scale.x = Math.sin(angle) * swimmer.speed > 0 ? -1 : 1
    }
  }

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
      9,
      30
    )
    return { layer, material }
  })

  let view: IslandView = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 2 }
  let size: SceneSize = { width: 0, height: 0 }
  let origin = { left: 0, top: 0 }
  let dragged: { resident: Resident; original: Resident; offset: { x: number; y: number } } | null =
    null
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
      const x = Math.round(resident.x + resident.offsetX)
      const y = Math.round(resident.y + resident.offsetY)
      return {
        slug: resident.slug,
        x: (x - origin.left) * view.zoom,
        y: (y - origin.top) * view.zoom,
        width: residentWidth * view.zoom,
        height: residentHeight * view.zoom,
        swimming: residentIsSwimming(world, resident) && dragged?.resident !== resident,
        dragging: dragged?.resident === resident
      }
    })
  }

  function placeResidents() {
    residents.forEach((resident, i) => {
      const { mesh, texture: walkTexture, swimTexture, silhouette } = residentMeshes[i]
      const swimming = residentIsSwimming(world, resident) && dragged?.resident !== resident
      const texture = swimming ? swimTexture : walkTexture
      mesh.material.map = texture
      silhouette.material.uniforms.map.value = texture
      silhouette.material.uniforms.uvTransform.value = texture.matrix
      const row = facings.indexOf(resident.facing)
      texture.offset.set(resident.frame / RESIDENT_FRAMES, 1 - (row + 1) / facings.length)
      texture.updateMatrix()
      const footX = Math.round(resident.x)
      const footY = Math.round(resident.y)
      // Keep the shoes where the full-size art put them and shrink upward.
      const sole = footY + 1 - RESIDENT_FOOT_PAD
      mesh.position.set(
        footX + Math.round(resident.offsetX),
        -(
          sole +
          Math.round(resident.offsetY) -
          residentHeight / 2 +
          RESIDENT_FOOT_PAD * RESIDENT_SCALE
        ),
        spriteZ(footY)
      )
      mesh.scale.x = resident.flip ? -1 : 1
      mesh.rotation.z = resident.tilt
      if (swimming) residentShadows.remove(i)
      else residentShadows.set(i, footX, footY + 2, Z.shadow)
      if (dragged?.resident === resident) {
        mesh.position.y += 5
        mesh.position.z = Z.cursor + 1
      }
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
        stepResidents(
          world,
          residents,
          dt,
          (slug) => slug === selected || slug === dragged?.resident.slug
        )
      }
      waterMaterial.uniforms.uTime.value = time
      clock.value = time
      const tick = Math.floor(time * 7)
      for (const { material, textures } of animated)
        material.uniforms.map.value = textures[tick % textures.length]
      updateDaylight(now)
      glows.mesh.visible = glow > 0.01
      // The firelight wavers in steps, like the flames.
      glowMaterial.opacity = glow * (0.86 + 0.14 * Math.sin(tick * 2.4))
      placeWildlife(still ? 0 : dt)
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
  // Under reduced motion nothing else redraws as the hours pass.
  const lightTimer = setInterval(wake, 60_000)
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
          (maxY + 2) * TILE_SIZE + 8
        )
        const cells = TILE_SIZE / SHORE_CELL
        // A whole-island change (reset, undoing one) only needs one pass.
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
    beginResidentDrag(slug: string, point: { x: number; y: number }) {
      const resident = residents.find((r) => r.slug === slug)
      if (!resident) return
      dragged = {
        resident,
        original: { ...resident },
        offset: { x: resident.x - point.x, y: resident.y - point.y }
      }
      wake()
    },
    moveResidentDrag(point: { x: number; y: number }) {
      if (!dragged) return
      dragged.resident.x = point.x + dragged.offset.x
      dragged.resident.y = point.y + dragged.offset.y
      wake()
    },
    endResidentDrag(cancel: boolean) {
      if (!dragged) return
      const { resident, original } = dragged
      const point = { x: resident.x, y: resident.y }
      Object.assign(resident, original)
      if (!cancel) dropResident(world, residents, resident, point)
      dragged = null
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
      clearInterval(lightTimer)
      document.removeEventListener('visibilitychange', visibility)
      reducedMotion.removeEventListener('change', wake)
      canvas.removeEventListener('webglcontextlost', contextLost)
      for (const layer of Object.values(shadowLayers)) layer.dispose()
      for (const { layer } of decorLayers.values()) layer.dispose()
      for (const { layer } of cursorLayers) layer.dispose()
      glows.dispose()
      residentShadows.dispose()
      for (const item of disposables) item.dispose()
      renderer.dispose()
    }
  }
}
export type IslandRenderer = ReturnType<typeof createIslandRenderer>
