import {
  AdditiveBlending,
  AlwaysStencilFunc,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CustomBlending,
  DataTexture,
  DoubleSide,
  DstColorFactor,
  EqualStencilFunc,
  GreaterDepth,
  Group,
  InstancedMesh,
  LessEqualDepth,
  LinearFilter,
  LinearSRGBColorSpace,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  RedFormat,
  ReplaceStencilOp,
  Scene,
  ShaderMaterial,
  type Texture,
  UnsignedByteType,
  WebGLRenderer,
  WebGLRenderTarget,
  ZeroFactor
} from 'three'
import {
  createBuffer,
  createShoreField,
  hex,
  islandPalette,
  outline,
  type PixelBuffer,
  SHORE_CELL,
  SHORE_RANGE,
  setPixel,
  updateShoreField
} from './island-art'
import { type BakedChunk, DEPTH_UNIT, REFERENCE_HEIGHT } from './island-bake'
import type { BakeRequest, BakeResponse } from './island-bake.worker'
import { clampView, type IslandView, WORLD_HEIGHT, WORLD_WIDTH } from './island-camera'
import { daylightNow } from './island-daylight'
import {
  dropResident,
  facings,
  paintResidentSheet,
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
  GULL_FRAME,
  paintFishSchool,
  paintGull,
  paintShadow,
  paintTurtle,
  shadowSizes
} from './island-sprites'
import { EDIT_MARGIN, hash2, type IslandWorld, TILE_SIZE } from './island-world'
import type { SceneSize } from './scene-math'

export type ResidentScreen = {
  slug: string
  // Foot position and sprite box in CSS pixels.
  x: number
  y: number
  // Unsnapped foot position for smooth DOM overlays while the camera follows.
  bubbleX: number
  bubbleY: number
  width: number
  height: number
  swimming: boolean
  dragging: boolean
}
export type CursorTile = { x: number; y: number; allowed: boolean }
export type IslandCursor = { tiles: CursorTile[]; soft: boolean; center: { x: number; y: number } }

// The whole scene is drawn one art pixel to one pixel into a small image,
// which is then scaled up to the screen without smoothing.
//
// Things on the island live in world coordinates (x east, y south, z up) under
// a group that projects them: x stays, y - z becomes the screen row, and y + z
// orders them front to back. Points carry their screen position already.
// Overlays (clouds, cursor, gulls, the time of day) are drawn flat in screen
// coordinates, above everything.
const DEPTH_SCALE = 0.01
const DEPTH_BASE = -30
const Z = { grid: 0.3, cursor: 5, sky: 20 }

const OBLIQUE = new Matrix4().set(
  1,
  0,
  0,
  0,
  0,
  -1,
  1,
  -REFERENCE_HEIGHT,
  0,
  DEPTH_SCALE,
  DEPTH_SCALE,
  DEPTH_BASE,
  0,
  0,
  0,
  1
)

// Colors go into the small image exactly as they are written; nothing is
// converted between color spaces on the way.
const rawColor = (value: string) =>
  new Color().setHex(Number.parseInt(value.slice(1), 16), LinearSRGBColorSpace)

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
  texture.colorSpace = NoColorSpace
  return texture
}

// Instanced flat sprites keyed by an id, in screen coordinates. Adding and
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
  set(key: number, x: number, y: number, z: number) {
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
    this.matrix.makeTranslation(left + this.width / 2, -(top + this.height / 2), z)
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

// A flat plane in screen coordinates, at the reference height.
const screenVertex = /* glsl */ `
varying vec2 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = vec2(world.x, -world.y);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

// A flat plane lying in the world: its own coordinates are the world's.
const groundVertex = /* glsl */ `
varying vec2 vWorld;
void main() {
  vWorld = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
// Lakes, shallows and hot springs show between their banks too, as clear fresh
// water under the same ripples.
const waterFragment = /* glsl */ `
uniform sampler2D uShore;
uniform sampler2D uLake;
uniform vec2 uWorld;
uniform float uPad;
uniform float uRange;
uniform float uTime;
varying vec2 vWorld;
${noiseGlsl}
void main() {
  vec2 p = floor(vWorld);
  vec2 uv = (p + 0.5) / uWorld;
  float d = 1.0;
  // The shore field reaches past the map's edge; beyond it lies open sea.
  vec2 suv = (p + 0.5 + uPad) / (uWorld + 2.0 * uPad);
  if (suv.x > 0.0 && suv.y > 0.0 && suv.x < 1.0 && suv.y < 1.0) d = texture2D(uShore, suv).r;
  bool inside = uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0;
  float dist = d * uRange;
  float dither = bayer4(p) - 0.5;
  vec3 foam = ${vec3Of(islandPalette.foam)};

  float pool = inside ? texture2D(uLake, uv).r : 0.0;
  if (d < 0.5 && pool > 0.2) {
    // Clear blue water, its darker depths and pale shallows slowly shifting.
    // The pool's value tells a lake from sandy shallows and from a hot spring.
    vec3 base = ${vec3Of(islandPalette.lake)};
    vec3 deep = ${vec3Of(islandPalette.lakeDeep)};
    vec3 shallow = ${vec3Of(islandPalette.lakeShallow)};
    vec3 shine = ${vec3Of(islandPalette.lakeShine)};
    bool spring = pool < 0.5;
    if (spring) {
      base = ${vec3Of(islandPalette.spring)};
      deep = ${vec3Of(islandPalette.springDeep)};
      shallow = ${vec3Of(islandPalette.springShallow)};
      shine = ${vec3Of(islandPalette.springShine)};
    } else if (pool < 0.8) {
      base = ${vec3Of(islandPalette.shoal)};
      deep = ${vec3Of(islandPalette.shoalDeep)};
      shallow = ${vec3Of(islandPalette.shoalShallow)};
      shine = ${vec3Of(islandPalette.shoalShine)};
    }
    float tick = floor(uTime * 6.0) / 6.0;
    float depth = vnoise(vec2(p.x / 26.0 + tick * 0.03, p.y / 17.0 + 5.3)) * 0.8
      + vnoise(vec2(p.x / 8.0, p.y / 5.0 - tick * 0.05)) * 0.2 + dither * 0.07;
    vec3 col = base;
    if (depth > 0.63) col = shallow;
    else if (depth < 0.36) col = deep;

    // Light rippling across the surface.
    vec2 q = p / 8.0;
    float net = abs(
      vnoise(q + vec2(tick * 0.26, tick * 0.17)) - vnoise(q * 1.6 - vec2(tick * 0.22, -tick * 0.19) + 4.0)
    );
    if (net < 0.03) col = mix(col, shine, 0.42);

    // Wavelets: bright dashes over a line of shadow, swaying and fading.
    vec2 size = vec2(14.0, 6.0);
    vec2 at = vec2(p.x + floor(p.y / size.y) * 5.0, p.y);
    vec2 cell = floor(at / size);
    float h = hash(cell + 2.3);
    vec2 local = at - cell * size;
    float sway = floor(sin(uTime * 1.1 + h * 6.283) * 1.5 + 0.5);
    float start = 2.0 + floor(hash(cell + 5.1) * 5.0) + sway;
    float len = 3.0 + floor(hash(cell + 7.0) * 4.0);
    if (h > 0.5 && fract(uTime * 0.2 + h * 3.0) < 0.7) {
      if (local.y == 2.0 && local.x >= start && local.x < start + len) col = mix(col, shine, 0.8);
      if (local.y == 3.0 && local.x > start && local.x <= start + len) col = mix(col, deep, 0.6);
    }

    // Glints of sun.
    vec2 g = floor(p / 18.0);
    float gh = hash(g + 4.4);
    vec2 gp = g * 18.0 + floor(vec2(hash(g + 2.9), hash(g + 6.6)) * 13.0) + 2.0;
    if (gh > 0.45 && fract(uTime * 0.4 + gh * 5.0) < 0.16) {
      vec2 k = abs(p - gp);
      if ((k.x == 0.0 && k.y <= 1.0) || (k.y == 0.0 && k.x <= 1.0)) col = vec3(1.0);
    }

    // Steam curling up off a hot spring.
    if (spring) {
      float steam = vnoise(vec2(p.x / 9.0 + sin(tick * 0.5) * 0.4, p.y / 6.0 + tick * 0.55))
        * vnoise(p / 23.0 + vec2(tick * 0.04, 8.1));
      if (steam + dither * 0.08 > 0.42) col = mix(col, vec3(1.0), 0.55);
    }
    gl_FragColor = vec4(col, 1.0);
    return;
  }
  float drift = (vnoise(p / 26.0 + 3.7) - 0.5) * 22.0 * smoothstep(6.0, 50.0, dist);
  float dd = dist + drift + dither * 5.0;

  vec3 col = ${vec3Of(islandPalette.deep)};
  col = mix(col, ${vec3Of(islandPalette.ocean)}, 1.0 - smoothstep(60.0, 110.0, dd));
  col = mix(col, ${vec3Of(islandPalette.mid)}, 1.0 - smoothstep(38.0, 76.0, dd));
  col = mix(col, ${vec3Of(islandPalette.shallow)}, 1.0 - smoothstep(20.0, 52.0, dd));
  col = mix(col, ${vec3Of(islandPalette.lagoon)}, 1.0 - smoothstep(8.0, 30.0, dd));
  col = mix(col, ${vec3Of(islandPalette.pale)}, 1.0 - smoothstep(0.0, 12.0, dd));

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

// Baked points: one pixel each, already lit and colored. Positions are the
// screen column, screen row and depth.
const pointHead = /* glsl */ `
attribute vec3 aColor;
varying vec3 vColor;
vec4 place(vec2 screen, float depth) {
  return projectionMatrix * viewMatrix * vec4(
    screen.x + 0.5,
    -(screen.y + 0.5),
    depth / ${DEPTH_UNIT.toFixed(1)} * ${DEPTH_SCALE.toFixed(4)} + ${DEPTH_BASE.toFixed(1)},
    1.0
  );
}
`
const terrainVertex = /* glsl */ `
${pointHead}
void main() {
  vColor = aColor;
  gl_Position = place(position.xy, position.z);
  gl_PointSize = 1.0;
}
`
const pointFragment = /* glsl */ `
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
}
`

// Decoration points also lean with the wind row by row (so they stay on the
// pixel grid), bob on the water, flicker as flames or drift as fireflies.
const decorVertex = /* glsl */ `
${pointHead}
uniform float uTime;
attribute vec4 aAnim;
varying float vGlow;
varying float vSeed;
float seedOf(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  vColor = aColor;
  vGlow = aAnim.z;
  vSeed = seedOf(position.xy);
  float phase = aAnim.w;
  float gust = sin(uTime * 1.1 + phase) + 0.45 * sin(uTime * 2.7 + phase * 1.9);
  float lean = floor(gust * aAnim.x * 0.7 + 0.5);
  float bob = floor(sin(uTime * 1.7 + phase * 37.0) * aAnim.y + 0.5);
  if (vGlow > 2.5) {
    // A drawn flame: its tip leans one way, then the other, in whole pixels.
    lean = floor(sin(uTime * 5.0 + phase * 13.0) * aAnim.x + 0.5);
  }
  vec2 screen = position.xy + vec2(lean, bob);
  if (vGlow > 1.5 && vGlow < 2.5) {
    float s = seedOf(position.xy + 3.1) * 6.283;
    screen += floor(vec2(sin(uTime * 0.6 + s) * 2.6, cos(uTime * 0.8 + s * 1.3) * 1.8) + 0.5);
  }
  gl_Position = place(screen, position.z);
  gl_PointSize = 1.0;
}
`
const decorFragment = /* glsl */ `
uniform float uTime;
uniform float uGlowOnly;
varying vec3 vColor;
varying float vGlow;
varying float vSeed;
float flicker(float seed, float tick) {
  return fract(sin(seed * 91.7 + tick * 47.3) * 43758.5453);
}
void main() {
  if (uGlowOnly > 0.5 && vGlow < 0.5) discard;
  vec3 col = vColor;
  if (vGlow > 2.5) {
    // A drawn flame keeps its colors and only breathes a little brighter.
    if (sin(uTime * 3.1 + vSeed * 0.5) > 0.6) col = mix(col, ${vec3Of('#fff4bd')}, 0.18);
  } else if (vGlow > 1.5) {
    // A firefly glows and fades on its own beat.
    if (sin(uTime * 2.3 + vSeed * 40.0) < -0.35) discard;
  } else if (vGlow > 0.5) {
    // Flames lick up and die back in steps, like the drawn frames they replace.
    float h = flicker(vSeed, floor(uTime * 7.0));
    if (h < 0.14) discard;
    if (h > 0.78) col = mix(col, ${vec3Of('#fff3b0')}, 0.6);
    else if (h < 0.3) col = mix(col, ${vec3Of('#c2410c')}, 0.5);
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

// Scales the small image up to the screen, each art pixel a block of whole
// device pixels; the offset keeps panning smooth below one art pixel.
const blitVertex = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
const blitFragment = /* glsl */ `
uniform sampler2D uImage;
uniform vec2 uSize;
uniform vec2 uOffset;
uniform float uScale;
uniform float uCanvasHeight;
void main() {
  vec2 device = vec2(gl_FragCoord.x, uCanvasHeight - gl_FragCoord.y);
  vec2 art = floor(uOffset + device * uScale + 0.0001) + 0.5;
  gl_FragColor = texture2D(uImage, vec2(art.x / uSize.x, 1.0 - art.y / uSize.y));
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

// Warm light around a fire, added over the darkened scene at night, and the
// smaller, greener light of fireflies. Dithered rings keep both on the pixel grid.
const GLOW = { width: 96, height: 72, color: '#ff9d3c' } as const
const SOFT_GLOW = { width: 56, height: 42, color: '#b9e85a' } as const
function glowBuffer(look: { width: number; height: number; color: string }) {
  const buffer = createBuffer(look.width, look.height)
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
  for (let y = 0; y < look.height; y++) {
    for (let x = 0; x < look.width; x++) {
      const d = Math.hypot(
        (x + 0.5 - look.width / 2) / (look.width / 2),
        (y + 0.5 - look.height / 2) / (look.height / 2)
      )
      if (d >= 1) continue
      const threshold = (bayer[((y >> 1) & 3) * 4 + ((x >> 1) & 3)] + 0.5) / 16
      const level = Math.floor((1 - d) ** 1.5 * 6 + threshold)
      if (level > 0) setPixel(buffer, x, y, hex(look.color, Math.min(150, level * 26)))
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
  onFrame: (positions: ResidentScreen[], view: IslandView) => void
  onFailure: () => void
}

export function createIslandRenderer(canvas: HTMLCanvasElement, options: IslandRendererOptions) {
  const { world, residents, designs, onFrame, onFailure } = options
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: true })
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(rawColor(islandPalette.deep))
  const scene = new Scene()
  const camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 100)
  camera.position.z = 50
  const ground = new Group()
  ground.matrixAutoUpdate = false
  ground.matrix.copy(OBLIQUE)
  scene.add(ground)
  const disposables: Array<{ dispose: () => void }> = []
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item)
    return item
  }

  // The small image and the pass that scales it up.
  const target = track(
    new WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: true,
      magFilter: NearestFilter,
      minFilter: NearestFilter,
      generateMipmaps: false
    })
  )
  target.texture.colorSpace = NoColorSpace
  const blitMaterial = track(
    new ShaderMaterial({
      vertexShader: blitVertex,
      fragmentShader: blitFragment,
      uniforms: {
        uImage: { value: target.texture },
        uSize: { value: [1, 1] },
        uOffset: { value: [0, 0] },
        uScale: { value: 1 },
        uCanvasHeight: { value: 1 }
      },
      depthTest: false,
      depthWrite: false
    })
  )
  const blitScene = new Scene()
  const blit = new Mesh(track(new PlaneGeometry(2, 2)), blitMaterial)
  blit.frustumCulled = false
  blitScene.add(blit)
  const blitCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  // Sea, lying at height 0 in the world.
  const field = createShoreField(world)
  updateShoreField(world, field)
  const shoreTexture = track(
    new DataTexture(
      field.sea,
      field.width + 2 * SHORE_RANGE,
      field.height + 2 * SHORE_RANGE,
      RedFormat,
      UnsignedByteType
    )
  )
  shoreTexture.magFilter = LinearFilter
  shoreTexture.minFilter = LinearFilter
  shoreTexture.needsUpdate = true
  const lakeTexture = track(
    new DataTexture(field.lake, field.width, field.height, RedFormat, UnsignedByteType)
  )
  lakeTexture.needsUpdate = true
  const waterMaterial = track(
    new ShaderMaterial({
      vertexShader: groundVertex,
      fragmentShader: waterFragment,
      side: DoubleSide,
      uniforms: {
        uShore: { value: shoreTexture },
        uLake: { value: lakeTexture },
        uWorld: { value: [WORLD_WIDTH, WORLD_HEIGHT] },
        uPad: { value: SHORE_RANGE * SHORE_CELL },
        uRange: { value: SHORE_RANGE * SHORE_CELL },
        uTime: { value: 0 }
      }
    })
  )
  const seaSize = 6000
  const seaGeometry = track(new PlaneGeometry(WORLD_WIDTH + seaSize, WORLD_HEIGHT + seaSize))
  seaGeometry.translate(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0)
  const water = new Mesh(seaGeometry, waterMaterial)
  water.frustumCulled = false
  ground.add(water)
  const clock = { value: 0 }
  const skyGeometry = track(new PlaneGeometry(WORLD_WIDTH + seaSize, WORLD_HEIGHT + seaSize))
  const clouds = new Mesh(
    skyGeometry,
    track(
      new ShaderMaterial({
        vertexShader: screenVertex,
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
  clouds.frustumCulled = false
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
  const tint = new Mesh(skyGeometry, tintMaterial)
  tint.position.set(WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, Z.sky)
  tint.renderOrder = 24
  tint.frustumCulled = false
  scene.add(tint)
  const glowLayer = (look: typeof GLOW | typeof SOFT_GLOW) => {
    const material = track(
      new MeshBasicMaterial({
        map: track(textureFrom(glowBuffer(look))),
        blending: AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    )
    const layer = new SpriteLayer(
      scene,
      track(new PlaneGeometry(look.width, look.height)),
      material,
      look.width,
      look.height,
      16,
      26
    )
    return { material, layer }
  }
  const { material: glowMaterial, layer: glows } = glowLayer(GLOW)
  const { material: softGlowMaterial, layer: softGlows } = glowLayer(SOFT_GLOW)
  let glow = 0
  let lightChecked = -Infinity
  function updateDaylight(now: number) {
    if (now - lightChecked < 15_000) return
    lightChecked = now
    const light = daylightNow()
    tintMaterial.color.setRGB(...light.tint, LinearSRGBColorSpace)
    tint.visible = light.tint.some((channel) => channel < 0.999)
    glow = light.glow
  }

  // The island's points, baked off the main thread chunk by chunk. Heights come
  // back with them, so residents and their shadows can stand on the ground.
  const heights = new Float32Array(WORLD_WIDTH * WORLD_HEIGHT)
  const heightAt = (x: number, y: number) => {
    const px = Math.max(0, Math.min(WORLD_WIDTH - 1, Math.floor(x)))
    const py = Math.max(0, Math.min(WORLD_HEIGHT - 1, Math.floor(y)))
    return heights[py * WORLD_WIDTH + px]
  }
  const uniformsTime = { value: 0 }
  const terrainMaterial = track(
    new ShaderMaterial({ vertexShader: terrainVertex, fragmentShader: pointFragment })
  )
  const decorMaterial = track(
    stampStencil(
      new ShaderMaterial({
        vertexShader: decorVertex,
        fragmentShader: decorFragment,
        uniforms: { uTime: uniformsTime, uGlowOnly: { value: 0 } }
      }),
      BEHIND_DECOR
    )
  )
  // Flames and fireflies again after the time of day darkens the rest.
  const flameMaterial = track(
    new ShaderMaterial({
      vertexShader: decorVertex,
      fragmentShader: decorFragment,
      uniforms: { uTime: uniformsTime, uGlowOnly: { value: 1 } },
      transparent: true,
      depthWrite: false,
      depthFunc: LessEqualDepth
    })
  )
  const chunks = new Map<
    number,
    { objects: Points[]; geometries: BufferGeometry[]; glowTiles: number[] }
  >()
  function dropChunk(index: number) {
    const chunk = chunks.get(index)
    if (!chunk) return
    for (const object of chunk.objects) scene.remove(object)
    for (const geometry of chunk.geometries) geometry.dispose()
    for (const tile of chunk.glowTiles) {
      glows.remove(tile)
      softGlows.remove(tile)
    }
    chunks.delete(index)
  }
  function placeChunk(baked: BakedChunk) {
    dropChunk(baked.index)
    const objects: Points[] = []
    const geometries: BufferGeometry[] = []
    const add = (geometry: BufferGeometry, material: Material, renderOrder = 0) => {
      const points = new Points(geometry, material)
      points.frustumCulled = false
      points.renderOrder = renderOrder
      scene.add(points)
      objects.push(points)
    }
    if (baked.terrain.color.length) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(baked.terrain.position, 3))
      geometry.setAttribute('aColor', new BufferAttribute(baked.terrain.color, 3, true))
      geometries.push(geometry)
      add(geometry, terrainMaterial)
    }
    if (baked.decor.color.length) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(baked.decor.position, 3))
      geometry.setAttribute('aColor', new BufferAttribute(baked.decor.color, 3, true))
      geometry.setAttribute('aAnim', new BufferAttribute(baked.decor.anim, 4))
      geometries.push(geometry)
      add(geometry, decorMaterial)
      if (baked.decor.anim.some((value, i) => i % 4 === 2 && value > 0))
        add(geometry, flameMaterial, 25)
    }
    for (const light of baked.glows) {
      const look = light.soft ? SOFT_GLOW : GLOW
      ;(light.soft ? softGlows : glows).set(light.tile, light.x, light.y + look.height / 2, Z.sky)
    }
    chunks.set(baked.index, { objects, geometries, glowTiles: baked.glows.map((g) => g.tile) })
  }

  let bakeSerial = 0
  let baking = false
  let stale = false
  let resolveReady: () => void = () => {}
  let rejectReady: (error: unknown) => void = () => {}
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // Kept from rejecting unhandled when nobody waits for it.
  ready.catch(() => {})
  const baker = new Worker(new URL('./island-bake.worker.ts', import.meta.url), {
    type: 'module'
  })
  function requestBake() {
    if (baking) {
      stale = true
      return
    }
    baking = true
    stale = false
    const request: BakeRequest = {
      serial: ++bakeSerial,
      columns: world.columns,
      rows: world.rows,
      ground: world.ground.slice(),
      decor: world.decor.slice()
    }
    baker.postMessage(request, [request.ground.buffer, request.decor.buffer])
  }
  baker.onmessage = (event: MessageEvent<BakeResponse>) => {
    if (disposed) return
    const message = event.data
    if (message.type === 'error') {
      rejectReady(new Error(message.message))
      fail(new Error(message.message))
      return
    }
    if (message.type === 'heights') {
      const { rect } = message
      for (let y = 0; y < rect.height; y++)
        heights.set(
          message.heights.subarray(y * rect.width, (y + 1) * rect.width),
          (rect.y + y) * WORLD_WIDTH + rect.x
        )
    } else if (message.type === 'chunk') placeChunk(message.chunk)
    else {
      baking = false
      resolveReady()
      if (stale) requestBake()
    }
    wake()
  }
  baker.onerror = (event) => {
    event.preventDefault()
    rejectReady(new Error('Island baker failed'))
    fail(new Error('Island baker failed'))
  }
  requestBake()

  // Editing aids: corner dots near the cursor and the edge of the editable area.
  const gridMaterial = track(
    new ShaderMaterial({
      vertexShader: screenVertex,
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

  // Residents: one sheet texture each, cut into frames by UV offset, standing
  // upright in the world so trees and ledges hide them as they should.
  const residentWidth = RESIDENT_FRAME.width * RESIDENT_SCALE
  const residentHeight = RESIDENT_FRAME.height * RESIDENT_SCALE
  const residentGeometry = track(new PlaneGeometry(residentWidth, residentHeight))
  residentGeometry.rotateX(Math.PI / 2)
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
      track(
        stampStencil(new MeshBasicMaterial({ map: texture, alphaTest: 0.5, side: DoubleSide }), 0)
      )
    )
    // Drawn after everything else, only where the resident is behind decoration.
    const silhouette = new Mesh(
      residentGeometry,
      track(
        new ShaderMaterial({
          vertexShader: silhouetteVertex,
          fragmentShader: silhouetteFragment,
          uniforms: { map: { value: texture }, uvTransform: { value: texture.matrix } },
          side: DoubleSide,
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
    ground.add(mesh)
    return { mesh, texture, swimTexture, silhouette }
  })
  // Flat things lying on the ground: shadows and selection rings.
  // The world's y runs south, so a flat picture is flipped to keep its top north.
  const flatGeometry = (buffer: PixelBuffer) =>
    track(new PlaneGeometry(buffer.width, buffer.height)).scale(1, -1, 1)
  const flatMesh = (buffer: PixelBuffer, color?: string, opacity = 1) => {
    const mesh = new Mesh(
      flatGeometry(buffer),
      track(
        new MeshBasicMaterial({
          map: track(textureFrom(buffer)),
          transparent: true,
          depthWrite: false,
          opacity,
          side: DoubleSide,
          ...(color ? { color: rawColor(color) } : {})
        })
      )
    )
    mesh.frustumCulled = false
    ground.add(mesh)
    return mesh
  }
  const shadowBuffer = paintShadow('small')
  const residentShadows = residents.map(() => flatMesh(shadowBuffer))
  const ring = ringBuffer()
  const selectedRing = flatMesh(ring, '#ffe66b')
  const focusRing = flatMesh(ring, '#ffffff')
  selectedRing.visible = false
  focusRing.visible = false

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
      map: track(textureFrom(shadowBuffer)),
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
    const geometry = flatGeometry(buffer)
    const material = track(
      new MeshBasicMaterial({
        map: track(textureFrom(buffer)),
        transparent: true,
        depthWrite: false,
        opacity,
        side: DoubleSide,
        color: rawColor(color)
      })
    )
    for (let i = 0, found = 0; i < 400 && found < count; i++) {
      const x = hash2(i, seed, 811) * WORLD_WIDTH
      const y = hash2(i, seed, 812) * WORLD_HEIGHT
      const depth = fieldDistance(x, y)
      if (depth < 26 || depth > 70) continue
      if (swimmers.some((other) => Math.hypot(other.x - x, other.y - y) < 150)) continue
      const mesh = new Mesh(geometry, material)
      mesh.frustumCulled = false
      ground.add(mesh)
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
      swimmer.mesh.position.set(x, y + 0.05, 0.05)
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
    // The small image starts on a whole art pixel; the scale-up shifts it by
    // the rest.
    const imageLeft = Math.floor(left)
    const imageTop = Math.floor(top)
    const imageWidth = Math.ceil(size.width / view.zoom) + 2
    const imageHeight = Math.ceil(size.height / view.zoom) + 2
    if (target.width !== imageWidth || target.height !== imageHeight)
      target.setSize(imageWidth, imageHeight)
    camera.left = imageLeft
    camera.right = imageLeft + imageWidth
    camera.top = -imageTop
    camera.bottom = -(imageTop + imageHeight)
    camera.updateProjectionMatrix()
    blitMaterial.uniforms.uSize.value = [imageWidth, imageHeight]
    blitMaterial.uniforms.uOffset.value = [left - imageLeft, top - imageTop]
    blitMaterial.uniforms.uScale.value = 1 / unit
    blitMaterial.uniforms.uCanvasHeight.value = renderer.domElement.height
  }

  // How far a resident stands above the reference height on screen.
  const lift = (resident: Resident) =>
    residentIsSwimming(world, resident) && dragged?.resident !== resident
      ? -REFERENCE_HEIGHT
      : Math.round(heightAt(resident.x, resident.y - 1)) - REFERENCE_HEIGHT

  function project(): ResidentScreen[] {
    return residents.map((resident) => {
      const up = lift(resident)
      const x = Math.round(resident.x + resident.offsetX)
      const y = Math.round(resident.y + resident.offsetY) - up
      return {
        slug: resident.slug,
        x: (x - origin.left) * view.zoom,
        y: (y - origin.top) * view.zoom,
        bubbleX: (resident.x + resident.offsetX - view.x) * view.zoom + size.width / 2,
        bubbleY: (resident.y + resident.offsetY - up - view.y) * view.zoom + size.height / 2,
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
      const base = lift(resident) + REFERENCE_HEIGHT
      const isDragged = dragged?.resident === resident
      // Upright just in front of the foot; the art's shoes rest on the ground.
      mesh.position.set(
        footX + Math.round(resident.offsetX),
        footY + 1,
        base + residentHeight / 2 - Math.round(resident.offsetY) + (isDragged ? 5 : 0)
      )
      mesh.scale.x = resident.flip ? -1 : 1
      mesh.rotation.y = -resident.tilt
      mesh.material.depthTest = !isDragged
      mesh.renderOrder = isDragged ? 31 : 0
      // Raised a little toward the viewer (y and z together) so they lie over
      // the ground without moving on screen.
      const shadow = residentShadows[i]
      shadow.visible = !swimming
      shadow.position.set(footX, footY + 2 - shadowBuffer.height / 2 + 0.3, base + 0.3)
      for (const [ring, slug] of [
        [selectedRing, selected],
        [focusRing, focused !== selected ? focused : null]
      ] as const) {
        if (slug !== resident.slug) continue
        ring.visible = true
        ring.position.set(footX, footY - 1 + 0.4, base + 0.4)
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
        const followed = residents.find((resident) => resident.slug === selected)
        const previous = followed && { x: followed.x, y: followed.y }
        stepResidents(world, residents, dt, (slug) => slug === dragged?.resident.slug)
        if (followed && previous && (followed.x !== previous.x || followed.y !== previous.y)) {
          // Follow walking without undoing the user's pan or zoom, or chasing each hop.
          view = clampView(
            { ...view, x: view.x + followed.x - previous.x, y: view.y + followed.y - previous.y },
            size
          )
          placeCamera()
        }
      }
      waterMaterial.uniforms.uTime.value = time
      clock.value = time
      uniformsTime.value = time
      updateDaylight(now)
      glows.mesh.visible = glow > 0.01
      // The firelight wavers in steps, like the flames.
      glowMaterial.opacity = glow * (0.86 + 0.14 * Math.sin(Math.floor(time * 7) * 2.4))
      softGlows.mesh.visible = glows.mesh.visible
      // Fireflies pulse slowly instead.
      softGlowMaterial.opacity = glow * (0.6 + 0.3 * Math.sin(time * 1.6))
      placeWildlife(still ? 0 : dt)
      placeResidents()
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      renderer.render(blitScene, blitCamera)
      onFrame(project(), view)
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
    // Settles once the whole island has been baked the first time.
    ready,
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
    // Bakes again the chunks an edit touches, and updates the sea around them.
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
      }
      try {
        const cells = TILE_SIZE / SHORE_CELL
        // A whole-island change (reset) only needs one pass.
        updateShoreField(
          world,
          field,
          (minX - 1) * cells,
          (minY - 1) * cells,
          (maxX + 2) * cells,
          (maxY + 2) * cells
        )
        shoreTexture.needsUpdate = true
        lakeTexture.needsUpdate = true
        settleResidents(world, residents)
        requestBake()
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
        cursorLayers[0].material.color.copy(rawColor(cursor.soft ? '#c9d6e3' : '#fff6bf'))
        cursorLayers[1].material.color.copy(rawColor('#ff5b5b'))
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
      baker.terminate()
      document.removeEventListener('visibilitychange', visibility)
      reducedMotion.removeEventListener('change', wake)
      canvas.removeEventListener('webglcontextlost', contextLost)
      for (const index of [...chunks.keys()]) dropChunk(index)
      for (const { layer } of cursorLayers) layer.dispose()
      glows.dispose()
      softGlows.dispose()
      for (const item of disposables) item.dispose()
      renderer.dispose()
    }
  }
}
export type IslandRenderer = ReturnType<typeof createIslandRenderer>
