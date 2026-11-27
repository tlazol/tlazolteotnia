import {
  AlwaysStencilFunc,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DepthStencilFormat,
  DepthTexture,
  DirectionalLight,
  DoubleSide,
  EqualStencilFunc,
  GreaterDepth,
  Group,
  InstancedMesh,
  Line,
  LinearFilter,
  LinearSRGBColorSpace,
  LineBasicMaterial,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RedFormat,
  ReplaceStencilOp,
  Scene,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  type Texture,
  UnsignedByteType,
  UnsignedInt248Type,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget
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
import {
  cameraAxis,
  clampView,
  type IslandView,
  type Point,
  pitchCos,
  pitchSin,
  projectGround,
  tileAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  worldToScreen
} from './island-camera'
import { daylightNow } from './island-daylight'
import { createDecor } from './island-decor.client'
import { firelightMaterial, lightMaterial } from './island-lights.client'
import { tileHeight } from './island-relief'
import {
  dropResident,
  facings,
  paintResidentHand,
  paintResidentSheet,
  RESIDENT_FRAME,
  RESIDENT_FRAMES,
  RESIDENT_SCALE,
  type Resident,
  type ResidentDesign,
  residentFootHeight,
  residentIsSwimming,
  residentOccupies,
  residentPose,
  settleResidents,
  stepManualResident,
  stepResidents,
  takeOverResident
} from './island-residents'
import {
  GULL_FRAME,
  paintFishSchool,
  paintGull,
  paintShadow,
  paintTurtle,
  shadowSizes
} from './island-sprites'
import { createTerrain } from './island-terrain.client'
import {
  EDIT_MARGIN,
  HOTSPRING,
  hash2,
  type IslandWorld,
  SEA_LEVEL_CODE,
  TILE_SIZE
} from './island-world'
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
// World geometry uses east/south/up map coordinates. The ground group mirrors
// south to Three's -Y. Overlays use projected art pixels.
const Z = { sky: 20 }

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

// The sea and its edit grid span the whole map. Cut both at tile boundaries
// wherever dry land has been dug to sea level or below.
const seaCutout = /* glsl */ `
uniform sampler2D uElevation;
void clipDugLand(vec2 uv) {
  if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0))) &&
      texture2D(uElevation, uv).r * 255.0 > ${(SEA_LEVEL_CODE - 0.5).toFixed(1)}) discard;
}
`

// Map coordinates run east/south; the sky ray uses Three's north-positive Y.
const twilightGlsl = /* glsl */ `
uniform float uSunrise, uAfterglow, uNight;
vec2 twilightBearing() {
  return uSunrise > 0.0 ? normalize(vec2(1.0, -0.25)) : normalize(vec2(-1.0, -0.38));
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
${seaCutout}
uniform float uTime;
${twilightGlsl}
varying vec2 vWorld;
${noiseGlsl}
vec3 reflectedSky(vec3 water, vec2 p) {
  float twilight = max(uSunrise, uAfterglow);
  if (uNight + twilight == 0.0) return water;
  // Keep the pale sand bars, reef shadows and foam visible through reflected light.
  float value = dot(water, vec3(0.22, 0.61, 0.17));
  vec3 nightWater = mix(vec3(0.11, 0.16, 0.31), vec3(0.54, 0.78, 0.87), value);
  water = mix(water, nightWater, uNight);
  if (twilight == 0.0) return water;
  vec2 bearing = twilightBearing();
  float centerX = uSunrise > 0.0 ? 0.67 : 0.43;
  vec2 offset = (p - uWorld * vec2(centerX, 0.50)) / uWorld.y;
  float across = dot(offset, vec2(-bearing.y, bearing.x));
  float ripple = vnoise(vec2(p.x * 0.019, p.y * 0.093 - uTime * 0.18));
  float shaft = exp(-9.0 * abs(across + 0.068 * (ripple - 0.5)));
  if (!isOrthographic) {
    vec2 sight = p - cameraPosition.xy * vec2(1.0, -1.0);
    shaft = pow(max(0.0, dot(sight / max(length(sight), 1.0), bearing)), 6.0);
  }
  vec3 shade = mix(vec3(0.19, 0.17, 0.44), vec3(0.81, 0.73, 0.92), value);
  vec3 shine = mix(vec3(0.76, 0.40, 0.55), vec3(1.0, 0.86, 0.74), value);
  if (uSunrise > 0.0) {
    shade = mix(vec3(0.31, 0.39, 0.58), vec3(0.80, 0.88, 0.91), value);
    shine = mix(vec3(0.92, 0.58, 0.62), vec3(1.0, 0.94, 0.73), value);
  }
  float crest = smoothstep(0.57, 0.84, ripple);
  vec3 reflection = mix(shade, shine, shaft * (0.34 + 0.66 * crest));
  return mix(water, reflection, twilight);
}
void main() {
  vec2 p = floor(vWorld);
  vec2 uv = (p + 0.5) / uWorld;
  clipDugLand(uv);
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

    gl_FragColor = vec4(reflectedSky(col, p), 1.0);
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
  gl_FragColor = vec4(reflectedSky(col, p), 1.0);
}
`

// Eye-level sky. Project clouds onto a layer above the island so that they
// narrow towards the horizon and stay in place as a resident looks around.
const skyFragment = /* glsl */ `
uniform float uTime;
${twilightGlsl}
varying vec3 vRay;
${noiseGlsl}
void main() {
  vec3 ray = normalize(vRay);
  float height = max(ray.z, 0.0);
  vec2 bearing = twilightBearing() * vec2(1.0, -1.0);
  float sunward = 0.5 + 0.5 * dot(ray.xy, bearing);
  float band = exp(-3.6 * height);
  vec3 horizon = mix(vec3(0.78, 0.89, 0.94), vec3(0.36, 0.40, 0.57), uNight);
  vec3 zenith = mix(vec3(0.46, 0.74, 0.91), vec3(0.10, 0.13, 0.26), uNight);
  horizon = mix(horizon, mix(vec3(0.73, 0.63, 0.91), vec3(1.0, 0.88, 0.73), sunward), uAfterglow);
  zenith = mix(zenith, vec3(0.37, 0.32, 0.70), uAfterglow);
  horizon = mix(horizon, mix(vec3(0.70, 0.76, 0.91), vec3(1.0, 0.84, 0.67), sunward), uSunrise);
  zenith = mix(zenith, vec3(0.48, 0.61, 0.85), uSunrise);
  vec3 sky = mix(zenith, horizon, band);
  float rose = exp(-9.0 * abs(height - 0.17)) * sunward * sunward * max(uSunrise, uAfterglow);
  sky = mix(sky, vec3(1.0, 0.74, 0.92), 0.72 * rose);
  if (uSunrise > 0.0) {
    vec3 sun = normalize(vec3(bearing, mix(0.18, -0.14, uNight)));
    float radius = length(ray - sun);
    float disc = 1.0 - smoothstep(0.023, 0.028, radius);
    sky = mix(sky, vec3(1.0, 0.95, 0.78), uSunrise * (disc + (1.0 - disc) * 0.46 * exp(-9.0 * radius)));
  }
  vec2 q = ray.xy / (0.14 + height) * vec2(2.3, 4.0) + vec2(uTime * 0.003, 0.0);
  float cloud = 0.7 * vnoise(q) + 0.3 * vnoise(q * 2.6);
  float veil = smoothstep(0.52, 0.72, cloud) * smoothstep(0.0, 0.06, height);
  vec3 cloudColor = mix(vec3(0.94, 0.95, 0.98), zenith, uNight);
  cloudColor = mix(cloudColor, mix(zenith, horizon, 0.32 * band), uAfterglow);
  cloudColor = mix(cloudColor, mix(zenith, vec3(1.0, 0.77, 0.75), sunward * band), uSunrise);
  gl_FragColor = vec4(mix(sky, cloudColor, veil * 0.72), 1.0);
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

const gridFragment = /* glsl */ `
#ifdef SEA_GRID
${seaCutout}
#endif
uniform vec2 uCursor;
uniform float uRadius;
uniform vec2 uWorld;
uniform float uMargin;
uniform float uShowCursor;
varying vec2 vWorld;

void main() {
  vec2 p = floor(vWorld);
  #ifdef SEA_GRID
  clipDugLand((p + 0.5) / uWorld);
  #endif
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
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
const blitFragment = /* glsl */ `
uniform sampler2D uImage;
uniform vec4 uArtRect;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(uImage, uArtRect.xy + vUv * uArtRect.zw);
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
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.autoUpdate = false
  renderer.autoClear = false
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(rawColor(islandPalette.deep))
  const scene = new Scene()
  const overlay = new Scene()
  const overlayCamera = new OrthographicCamera(0, 1, 0, -1, 0.1, 100)
  overlayCamera.position.z = 50
  const camera = new OrthographicCamera(0, 1, 0, -1, 1, 6000)
  camera.up.set(0, 0, 1)
  const eyeCamera = new PerspectiveCamera(90, 1, 0.35, 6000)
  eyeCamera.up.set(0, 0, 1)
  const ground = new Group()
  ground.scale.y = -1
  scene.add(ground)
  scene.add(new AmbientLight(0xffffff, 1.85))
  const sun = new DirectionalLight(0xffffff, 1.65)
  sun.target.position.set(WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, 0)
  sun.position.copy(sun.target.position).add(new Vector3(-390, -280, 740))
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, {
    left: -840,
    right: 840,
    top: 820,
    bottom: -820,
    near: 1,
    far: 1900
  })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.normalBias = 0.6
  scene.add(sun, sun.target)
  const disposables: Array<{ dispose: () => void }> = []
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item)
    return item
  }

  // Draw the hands in camera space after the world, so looking around or
  // approaching scenery cannot move them away from the screen or clip them.
  const handsScene = new Scene()
  const handsCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  handsCamera.position.z = 2
  const handGeometry = track(new PlaneGeometry(0.42, 0.56))
  const handMaterial = track(
    new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false })
  )
  const hands = [-1, 1].map((side) => {
    const mesh = new Mesh(handGeometry, handMaterial)
    mesh.scale.x = side
    handsScene.add(mesh)
    return { mesh, side }
  })
  let handTexture: Texture | null = null
  let handLift = 0

  // The small image and the pass that scales it up.
  const depth = new DepthTexture(1, 1, UnsignedInt248Type)
  depth.format = DepthStencilFormat
  const target = track(
    new WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: true,
      depthTexture: depth,
      magFilter: NearestFilter,
      minFilter: NearestFilter,
      generateMipmaps: false
    })
  )
  target.texture.colorSpace = NoColorSpace
  // Sample the world's color and depth while composing light into a separate image.
  const litTarget = track(
    new WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false
    })
  )
  // UV bounds of the visible crop within the slightly oversized world image.
  const artRect = { value: new Vector4(0, 0, 1, 1) }
  const blitMaterial = track(
    new ShaderMaterial({
      vertexShader: blitVertex,
      fragmentShader: blitFragment,
      uniforms: {
        uImage: { value: litTarget.texture },
        uArtRect: artRect
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
  const clock = { value: 0 }
  const night = { value: 0 }
  const afterglow = { value: 0 }
  const sunrise = { value: 0 }
  const sky = new Mesh(
    blit.geometry,
    track(
      new ShaderMaterial({
        uniforms: {
          uInverseProjection: { value: eyeCamera.projectionMatrixInverse },
          uCameraWorld: { value: eyeCamera.matrixWorld },
          uAfterglow: afterglow,
          uSunrise: sunrise,
          uNight: night,
          uTime: clock
        },
        vertexShader: /* glsl */ `
          uniform mat4 uInverseProjection, uCameraWorld;
          varying vec3 vRay;
          void main() {
            vec4 eye = uInverseProjection * vec4(position.xy, 1.0, 1.0);
            vRay = mat3(uCameraWorld) * eye.xyz;
            gl_Position = vec4(position.xy, 1.0, 1.0);
          }
        `,
        fragmentShader: skyFragment,
        depthWrite: false
      })
    )
  )
  sky.frustumCulled = false
  sky.visible = false
  scene.add(sky)

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
  const elevationTexture = track(
    new DataTexture(world.elevation, world.columns, world.rows, RedFormat, UnsignedByteType)
  )
  elevationTexture.needsUpdate = true
  const waterMaterial = track(
    new ShaderMaterial({
      vertexShader: groundVertex,
      fragmentShader: waterFragment,
      side: DoubleSide,
      uniforms: {
        uElevation: { value: elevationTexture },
        uShore: { value: shoreTexture },
        uLake: { value: lakeTexture },
        uWorld: { value: [WORLD_WIDTH, WORLD_HEIGHT] },
        uPad: { value: SHORE_RANGE * SHORE_CELL },
        uRange: { value: SHORE_RANGE * SHORE_CELL },
        uTime: clock,
        uNight: night,
        uSunrise: sunrise,
        uAfterglow: afterglow
      }
    })
  )
  const seaSize = 6000
  const seaGeometry = track(new PlaneGeometry(WORLD_WIDTH + seaSize, WORLD_HEIGHT + seaSize))
  seaGeometry.translate(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0)
  const water = new Mesh(seaGeometry, waterMaterial)
  water.frustumCulled = false
  ground.add(water)
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
  overlay.add(clouds)

  // Opaque scenery has alpha 1 in the world image. Inlays store the fraction
  // that still needs the hour's tint, so their cores stay lit after sundown.
  const daylightTint = new Color()
  const tintMaterial = track(
    new ShaderMaterial({
      vertexShader: blitVertex,
      fragmentShader: /* glsl */ `
        uniform sampler2D uImage;
        uniform vec3 uTint;
        varying vec2 vUv;
        void main() {
          vec4 world = texture2D(uImage, vUv);
          vec3 lit = world.rgb * mix(vec3(1.0), uTint, world.a);
          // Spread a little of a visible seam's light to its four neighbors.
          float halo = 4.0 - textureOffset(uImage, vUv, ivec2(-1, 0)).a
                           - textureOffset(uImage, vUv, ivec2(1, 0)).a
                           - textureOffset(uImage, vUv, ivec2(0, -1)).a
                           - textureOffset(uImage, vUv, ivec2(0, 1)).a;
          gl_FragColor = vec4(lit + halo * world.a * vec3(0.012, 0.059, 0.052), 1.0);
        }
      `,
      uniforms: { uImage: { value: target.texture }, uTint: { value: daylightTint } },
      depthTest: false,
      depthWrite: false
    })
  )
  const tintScene = new Scene()
  const tint = new Mesh(blit.geometry, tintMaterial)
  tint.position.z = -0.5
  tintScene.add(tint)
  let lightChecked = -Infinity
  function updateDaylight(now: number) {
    if (now - lightChecked < 15_000) return
    lightChecked = now
    const light = daylightNow()
    daylightTint.setRGB(...light.tint, LinearSRGBColorSpace)
    night.value = light.glow
    afterglow.value = light.afterglow
    sunrise.value = light.sunrise
    handMaterial.color.copy(daylightTint)
  }

  const scenery = new Group()
  ground.add(scenery)
  const decorMaterial = track(
    stampStencil(new MeshLambertMaterial({ vertexColors: true }), BEHIND_DECOR)
  )
  const inverseProjection = { value: camera.projectionMatrixInverse }
  const firelight = track(
    firelightMaterial(clock, night, depth, target.texture, elevationTexture, inverseProjection)
  )
  const decor = createDecor(
    world,
    scenery,
    decorMaterial,
    clock,
    {
      particles: track(lightMaterial(clock, night, depth, artRect)),
      firelight,
      projector: track(
        firelightMaterial(
          clock,
          night,
          depth,
          target.texture,
          elevationTexture,
          inverseProjection,
          true
        )
      )
    },
    () => {
      renderer.shadowMap.needsUpdate = true
      wake()
    },
    fail
  )
  const terrain = createTerrain(world, scenery, night, decor.firelightScene, firelight)
  renderer.shadowMap.needsUpdate = true
  // Editing aids: corner dots near the cursor and the edge of the editable area.
  const gridMaterial = track(
    new ShaderMaterial({
      vertexShader: groundVertex,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
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
  const grid = new Group()
  const seaGridMaterial = track(gridMaterial.clone())
  seaGridMaterial.defines = { SEA_GRID: 1 }
  seaGridMaterial.uniforms = { ...gridMaterial.uniforms, uElevation: { value: elevationTexture } }
  const seaGrid = new Mesh(seaGeometry, seaGridMaterial)
  grid.add(seaGrid)
  ground.add(grid)
  grid.visible = false
  // Overlay the same terrain triangles as the brush is picking.
  function syncGrid() {
    grid.clear()
    grid.add(seaGrid)
    for (const patch of terrain.patches.values()) grid.add(new Mesh(patch.geometry, gridMaterial))
  }

  // Residents: one sheet texture each, cut into frames by UV offset, standing
  // upright in the world so trees and ledges hide them as they should.
  const residentWidth = RESIDENT_FRAME.width * RESIDENT_SCALE
  const residentHeight = RESIDENT_FRAME.height * RESIDENT_SCALE
  const residentGeometry = track(new PlaneGeometry(residentWidth, residentHeight))
  residentGeometry.translate(0, residentHeight / 2, 0)
  const residentMeshes = residents.map((resident) => {
    const design = designs.get(resident.slug)
    const buffer = design
      ? paintResidentSheet(design)
      : createBuffer(RESIDENT_FRAME.width * RESIDENT_FRAMES, RESIDENT_FRAME.height * facings.length)
    const texture = track(textureFrom(buffer))
    const swimBuffer = design ? paintResidentSheet(design, true) : buffer
    const swimTexture = track(textureFrom(swimBuffer))
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
    scene.add(mesh)
    return { mesh, texture, swimTexture, silhouette, buffer, swimBuffer }
  })
  const pickMeshes = residentMeshes.map(({ mesh }) => mesh)

  // In local coordinates the rod points along +X. Its tip stays with the
  // resident while the far end of the line follows the float at sea level.
  const rodTipHeight = 19
  const rodGeometry = track(new BoxGeometry(Math.hypot(11, 12), 1.3, 1.3))
  rodGeometry.rotateY(-Math.atan2(12, 11)).translate(7.5, 0, rodTipHeight - 6)
  const rodMaterial = track(new MeshBasicMaterial({ color: rawColor('#b97b43') }))
  const lineGeometry = track(
    new BufferGeometry().setFromPoints([new Vector3(0, 0, 1), new Vector3(1, 0, 0)])
  )
  const lineMaterial = track(new LineBasicMaterial({ color: rawColor('#f2e5cc') }))
  const floatGeometry = track(new BoxGeometry(2.6, 2.6, 1.7))
  const floatMaterial = track(new MeshBasicMaterial({ color: rawColor('#ec514b') }))
  const capMaterial = track(new MeshBasicMaterial({ color: rawColor('#fff4db') }))
  function createFishingTackle() {
    const group = new Group()
    const rod = new Mesh(rodGeometry, rodMaterial)
    const line = new Line(lineGeometry, lineMaterial)
    const float = new Mesh(floatGeometry, floatMaterial)
    const cap = new Mesh(floatGeometry, capMaterial)
    cap.position.z = 1.25
    cap.scale.set(0.72, 0.72, 0.55)
    float.add(cap)
    group.add(rod, line, float)
    scene.add(group)
    return { group, rod, line, float }
  }
  const fishingTackle: ReturnType<typeof createFishingTackle>[] = []
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

  const wisp = createBuffer(7, 9)
  const mist = hex('#fffaf1')
  const curl = [
    '   ##  ',
    '  ##   ',
    '  #    ',
    '  ##   ',
    '   ##  ',
    '    #  ',
    '   ##  ',
    '  ##   ',
    '  #    '
  ]
  for (const [y, row] of curl.entries()) {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') setPixel(wisp, x, y, mist)
    }
  }
  const steamMap = track(textureFrom(wisp))
  const wisps = Array.from({ length: 3 }, () => {
    const sprite = new Sprite(track(new SpriteMaterial({ map: steamMap, depthWrite: false })))
    scene.add(sprite)
    return sprite
  })
  function findSprings() {
    const tiles: number[] = []
    world.ground.forEach((kind, index) => {
      if (kind === HOTSPRING) tiles.push(index)
    })
    return tiles
  }
  let springs = findSprings()
  function placeSteam(still: boolean) {
    const burst = Math.floor(time / 7)
    const tile = springs[Math.floor(hash2(burst, 0, 851) * springs.length)]
    for (const [i, sprite] of wisps.entries()) {
      const age = ((time % 7) - 0.5 - i * 0.42) / 2.4
      sprite.visible = !still && tile !== undefined && age > 0 && age < 1
      if (!sprite.visible) continue
      const originX = ((tile % world.columns) + 0.5) * TILE_SIZE
      const originY = (Math.floor(tile / world.columns) + 0.5) * TILE_SIZE
      sprite.position.set(
        originX + (i - 1) * 3 + Math.sin(age * 5 + i) * 1.6,
        -originY,
        3 + age * 18
      )
      sprite.scale.set(4 + age * 5, 5 + age * 6, 1)
      sprite.material.opacity = 0.68 * Math.sin(Math.PI * age)
    }
  }

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
    overlay.add(mesh, shadow)
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
      const bird = projectGround(view, x, y, 38)
      const shade = projectGround(view, x + 9, y + 12)
      gull.mesh.position.set(bird.x, -bird.y, Z.sky)
      gull.mesh.scale.x = gull.direction
      gull.shadow.position.set(shade.x, -shade.y, Z.sky)
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
    const geometry = track(new PlaneGeometry(TILE_SIZE, TILE_SIZE))
    geometry.scale(1, -1, 1)
    material.side = DoubleSide
    const mesh = new InstancedMesh(geometry, material, 9)
    mesh.frustumCulled = false
    mesh.renderOrder = 30
    mesh.count = 0
    ground.add(mesh)
    return { mesh, material }
  })
  const cursorMatrix = new Matrix4()

  let view: IslandView = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 2 }
  let size: SceneSize = { width: 0, height: 0 }
  let lastTurn: number | undefined
  let dragged: {
    resident: Resident
    original: Resident
    height: number
    offset: { x: number; y: number }
  } | null = null
  let selected: string | null = null
  let viewer: Resident | null = null
  let walkInput: Point | null = null
  let queuedInput: Point | null = null
  let eyeYaw = 0
  const initialEyePitch = -Math.atan(0.12)
  let eyePitch = initialEyePitch
  let followHeading = true
  let focused: string | null = null
  let editing = false
  let frame = 0
  let last = 0
  let time = 0
  let disposed = false
  let failed = false
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function sizeImage(width: number, height: number, x: number, y: number, scale: number) {
    if (target.width !== width || target.height !== height) {
      target.setSize(width, height)
      litTarget.setSize(width, height)
    }
    const spanX = (renderer.domElement.width * scale) / width
    const spanY = (renderer.domElement.height * scale) / height
    // Match the art-pixel tie break on the top and left edges when zoomed.
    artRect.value.set((x + 0.0001) / width, 1 - (y + 0.0001) / height - spanY, spanX, spanY)
  }

  function placeCamera() {
    if (!size.width || !size.height) return
    if (viewer) {
      eyeCamera.aspect = size.width / size.height
      eyeCamera.updateProjectionMatrix()
      sizeImage(Math.ceil(size.width / 2), Math.ceil(size.height / 2), 0, 0, 0.5 / pixelRatio)
      return
    }
    const unit = view.zoom * pixelRatio
    // Snap so art pixels land on whole device pixels.
    const center = projectGround(view, view.x, view.y)
    const left = Math.round((center.x - size.width / 2 / view.zoom) * unit) / unit
    const top = Math.round((center.y - size.height / 2 / view.zoom) * unit) / unit
    if (lastTurn !== (view.turn ?? 0)) {
      lastTurn = view.turn ?? 0
      const axis = cameraAxis(view)
      camera.position.set(axis.x * pitchCos * 3000, -axis.y * pitchCos * 3000, pitchSin * 3000)
      camera.lookAt(0, 0, 0)
    }
    // The small image starts on a whole art pixel; the scale-up shifts it by
    // the rest.
    const density = Math.min(1, view.zoom)
    const imageLeft = Math.floor(left * density)
    const imageTop = Math.floor(top * density)
    const imageWidth = Math.ceil((size.width * density) / view.zoom) + 2
    const imageHeight = Math.ceil((size.height * density) / view.zoom) + 2
    camera.left = imageLeft / density
    camera.right = (imageLeft + imageWidth) / density
    camera.top = -imageTop / density
    camera.bottom = -(imageTop + imageHeight) / density
    camera.updateProjectionMatrix()
    overlayCamera.left = camera.left
    overlayCamera.right = camera.right
    overlayCamera.top = camera.top
    overlayCamera.bottom = camera.bottom
    overlayCamera.updateProjectionMatrix()
    sizeImage(
      imageWidth,
      imageHeight,
      left * density - imageLeft,
      top * density - imageTop,
      density / unit
    )
  }

  const heightAt = (x: number, y: number) =>
    tileHeight(world, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE))
  const footHeight = (resident: Resident) =>
    dragged?.resident === resident ? dragged.height : residentFootHeight(world, resident)
  function project(): ResidentScreen[] {
    return residents.map((resident) => {
      const dragging = dragged?.resident === resident
      const base = footHeight(resident)
      const p = worldToScreen(view, size, resident, base)
      const x = p.x + resident.offsetX * view.zoom
      const y = p.y + (resident.offsetY - (dragging ? 5 : 0)) * view.zoom
      return {
        slug: resident.slug,
        x,
        y,
        bubbleX: x,
        bubbleY: y,
        width: residentWidth * view.zoom,
        height: residentHeight * view.zoom,
        swimming: base === 0 && !dragging,
        dragging
      }
    })
  }

  const right = new Vector3()
  const up = new Vector3()
  function followEyes(resident: Resident, dt: number) {
    if (followHeading && !walkInput) {
      const delta = Math.atan2(resident.heading.y, resident.heading.x) - eyeYaw
      eyeYaw += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-8 * dt))
    }
    const eyeHeight = residentIsSwimming(world, resident) ? 7 : 10
    const z = footHeight(resident) + eyeHeight - resident.offsetY
    eyeCamera.position.set(resident.x, -resident.y, z)
    eyeCamera.lookAt(
      resident.x + Math.cos(eyeYaw),
      -resident.y - Math.sin(eyeYaw),
      z + Math.tan(eyePitch)
    )
  }

  function placeHands(dt: number, walking: boolean) {
    const visible = viewer && walking && !residentIsSwimming(world, viewer)
    handLift += ((visible ? 1 : 0) - handLift) * (1 - Math.exp(-12 * dt))
    handsScene.visible = !!viewer && !!handTexture && handLift > 0.001
    const aspect = size.width / size.height
    handsCamera.left = -aspect
    handsCamera.right = aspect
    handsCamera.updateProjectionMatrix()
    const phase = ((viewer?.walkClock ?? 0) / 0.36) * Math.PI * 2
    for (const { mesh, side } of hands) {
      const swing = Math.sin(phase + (side < 0 ? Math.PI : 0)) * handLift
      mesh.position.set(
        side * (Math.min(aspect * 0.65, 0.95) + swing * 0.015),
        -1.3 + handLift * 0.38 + swing * 0.045,
        0
      )
      mesh.rotation.z = side * (0.24 + swing * 0.04)
    }
  }

  function placeResidents() {
    let anglers = 0
    const rotation = (viewer ? eyeCamera : camera).quaternion
    right.set(1, 0, 0).applyQuaternion(rotation)
    up.set(0, 1, 0).applyQuaternion(rotation)
    residents.forEach((resident, i) => {
      const { mesh, texture: walkTexture, swimTexture, silhouette } = residentMeshes[i]
      mesh.visible = viewer !== resident
      silhouette.visible = !viewer
      const isDragged = dragged?.resident === resident
      const base = footHeight(resident)
      if (resident.action === 'fish' && !isDragged) {
        if (anglers === fishingTackle.length) fishingTackle.push(createFishingTackle())
        const { group, rod, line, float } = fishingTackle[anglers++]
        group.visible = true
        group.rotation.z = Math.atan2(-resident.heading.y, resident.heading.x)
        group.position.set(resident.x, -resident.y, 0)
        rod.position.set(0, -2, base)
        float.position.set(TILE_SIZE + 2, -2, 1 + 0.6 * Math.sin(resident.actionClock * 3))
        line.position.set(13, -2, float.position.z)
        line.scale.set(float.position.x - 13, 1, base + rodTipHeight - float.position.z)
      }
      const swimming = base === 0 && !isDragged
      const texture = swimming ? swimTexture : walkTexture
      mesh.material.map = texture
      silhouette.material.uniforms.map.value = texture
      silhouette.material.uniforms.uvTransform.value = texture.matrix
      const { facing, flip } = residentPose(
        viewer
          ? {
              x: right.x * resident.heading.x - right.y * resident.heading.y,
              y: -Math.cos(eyeYaw) * resident.heading.x - Math.sin(eyeYaw) * resident.heading.y
            }
          : projectGround(view, resident.heading.x, resident.heading.y)
      )
      const row = facings.indexOf(facing)
      texture.offset.set(resident.frame / RESIDENT_FRAMES, 1 - (row + 1) / facings.length)
      texture.updateMatrix()
      const footX = resident.x
      const footY = resident.y
      mesh.position
        .set(footX, -footY, base + 0.15)
        .addScaledVector(right, resident.offsetX)
        .addScaledVector(up, -resident.offsetY + (isDragged ? 5 : 0))
      mesh.quaternion.copy(rotation)
      mesh.rotateZ(resident.tilt)
      mesh.scale.x = flip ? -1 : 1
      mesh.material.depthTest = !isDragged
      mesh.renderOrder = isDragged ? 31 : 0
      // Keep contact shadows and selection rings just above the tile surface.
      const shadow = residentShadows[i]
      shadow.visible = !swimming && mesh.visible
      const surfaceHeight = heightAt(footX, footY)
      shadow.position.set(footX, footY, surfaceHeight + 0.3)
      for (const [ring, slug] of [
        [selectedRing, selected],
        [focusRing, focused !== selected ? focused : null]
      ] as const) {
        if (slug !== resident.slug) continue
        ring.visible = !viewer
        ring.position.set(footX, footY - 1 + 0.4, surfaceHeight + 0.4)
      }
    })
    for (let i = anglers; i < fishingTackle.length; i++) fishingTackle[i].group.visible = false
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
      const previousWalkClock = viewer?.walkClock
      if (!still) time += dt
      if (!still || (viewer && walkInput)) {
        const followed = residents.find((resident) => resident.slug === selected)
        const previous = followed && { x: followed.x, y: followed.y }
        if (!still)
          stepResidents(
            world,
            residents,
            dt,
            (slug) => slug === dragged?.resident.slug || (!!walkInput && slug === viewer?.slug)
          )
        if (viewer && walkInput) {
          const direction = queuedInput ?? walkInput
          if (!viewer.target) queuedInput = null
          stepManualResident(world, residents, viewer, dt, eyeYaw, direction)
        }
        if (followed && previous && (followed.x !== previous.x || followed.y !== previous.y)) {
          // Follow walking without undoing the user's pan or zoom, or chasing each hop.
          view = clampView(
            { ...view, x: view.x + followed.x - previous.x, y: view.y + followed.y - previous.y },
            size
          )
          if (!viewer) placeCamera()
        }
      }
      clock.value = time
      updateDaylight(now)
      placeSteam(still)
      placeWildlife(still ? 0 : dt)
      if (viewer) followEyes(viewer, dt)
      if (still) handLift = 0
      placeHands(dt, !still && viewer !== null && viewer.walkClock !== previousWalkClock)
      placeResidents()
      renderer.setRenderTarget(target)
      renderer.clear()
      const activeCamera = viewer ? eyeCamera : camera
      renderer.render(scene, activeCamera)
      if (!viewer) renderer.render(overlay, overlayCamera)
      renderer.setRenderTarget(litTarget)
      renderer.render(tintScene, blitCamera)
      inverseProjection.value = activeCamera.projectionMatrixInverse
      renderer.render(decor.firelightScene, activeCamera)
      renderer.setRenderTarget(null)
      renderer.render(blitScene, blitCamera)
      renderer.render(decor.particleScene, activeCamera)
      if (viewer && handsScene.visible) renderer.render(handsScene, handsCamera)
      onFrame(viewer ? [] : project(), view)
      if (!still || (walkInput && (walkInput.x || walkInput.y || queuedInput || viewer?.target)))
        wake()
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
    ready: decor.ready,
    pickResident(point: Point) {
      if (!viewer || !size.width || !size.height) return null
      const ray = new Raycaster()
      // Aim through the center of the art pixel displayed under the pointer.
      ray.setFromCamera(
        new Vector2(
          ((Math.floor(point.x / 2) + 0.5) / target.width) * 2 - 1,
          1 - ((Math.floor(point.y / 2) + 0.5) / target.height) * 2
        ),
        eyeCamera
      )
      for (const hit of ray.intersectObjects(pickMeshes, false)) {
        if (!hit.object.visible || !hit.uv) continue
        const depth = hit.point.project(eyeCamera).z
        if (depth < -1 || depth > 1) continue
        const index = residentMeshes.findIndex(({ mesh }) => mesh === hit.object)
        const sprite = residentMeshes[index]
        const map = sprite.mesh.material.map
        if (!map) continue
        const sheet = map === sprite.swimTexture ? sprite.swimBuffer : sprite.buffer
        const uv = map.transformUv(hit.uv)
        const x = Math.min(sheet.width - 1, Math.floor(uv.x * sheet.width))
        const y = Math.min(sheet.height - 1, Math.floor(uv.y * sheet.height))
        if (sheet.data[(y * sheet.width + x) * 4 + 3] < 128) continue
        ray.far = hit.distance
        if (ray.intersectObject(scenery).length) return null
        return residents[index].slug
      }
      return null
    },
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
    // Rebuild the affected terrain patches, decoration batches and shoreline.
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
        elevationTexture.needsUpdate = true
        shoreTexture.needsUpdate = true
        lakeTexture.needsUpdate = true
        springs = findSprings()
        settleResidents(world, residents)
        terrain.update(indices)
        decor.update(indices)
        if (editing) syncGrid()
        renderer.shadowMap.needsUpdate = true
      } catch (error) {
        fail(error)
      }
      wake()
    },
    setCursor(cursor: IslandCursor | null) {
      for (const { mesh } of cursorLayers) mesh.count = 0
      if (cursor) {
        for (const tile of cursor.tiles) {
          const { mesh } = cursorLayers[!tile.allowed && !cursor.soft ? 1 : 0]
          cursorMatrix.makeTranslation(
            (tile.x + 0.5) * TILE_SIZE,
            (tile.y + 0.5) * TILE_SIZE,
            tileHeight(world, tile.x, tile.y) + 0.2
          )
          mesh.setMatrixAt(mesh.count++, cursorMatrix)
          mesh.instanceMatrix.needsUpdate = true
        }
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
      if (editing) syncGrid()
      grid.visible = editing
      if (!editing) this.setCursor(null)
      wake()
    },
    select(slug: string | null) {
      selected = slug
      wake()
    },
    setFirstPerson(slug: string | null) {
      const resident = residents.find((item) => item.slug === slug) ?? null
      if (viewer === resident) return
      walkInput = null
      queuedInput = null
      viewer = resident
      handLift = 0
      handTexture?.dispose()
      handTexture = null
      const design = viewer && designs.get(viewer.slug)
      if (design) handTexture = textureFrom(paintResidentHand(design))
      handMaterial.map = handTexture
      handMaterial.needsUpdate = true
      if (viewer) eyeYaw = Math.atan2(viewer.heading.y, viewer.heading.x)
      eyePitch = initialEyePitch
      eyeCamera.zoom = 1
      followHeading = true
      sky.visible = viewer !== null
      placeCamera()
      wake()
    },
    setWalkInput(input: Point | null) {
      if (!viewer) return
      if (input && !walkInput) takeOverResident(viewer)
      if (walkInput && !input) followHeading = true
      walkInput = input
      // Remember a quick tap until the current tile reservation finishes.
      if (!input || input.x || input.y) queuedInput = input
      wake()
    },
    get eyeZoom() {
      return eyeCamera.zoom
    },
    setEyeZoom(zoom: number) {
      if (!viewer) return
      eyeCamera.zoom = Math.max(0.75, Math.min(3, zoom))
      eyeCamera.updateProjectionMatrix()
      wake()
    },
    lookAround(dx: number, dy: number) {
      if (!viewer || !size.width || !size.height || (!dx && !dy)) return
      const radiansPerPixel =
        (Math.PI * 2) / (3 * Math.min(size.width, size.height) * eyeCamera.zoom)
      const pitchLimit = (Math.PI * 85) / 180
      followHeading = false
      eyeYaw -= dx * radiansPerPixel
      eyePitch = Math.max(-pitchLimit, Math.min(pitchLimit, eyePitch + dy * radiansPerPixel))
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
        height: footHeight(resident),
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
      const tile = tileAt(view, size, worldToScreen(view, size, resident, dragged.height), world)
      Object.assign(resident, original)
      if (!cancel)
        dropResident(world, residents, resident, {
          x: (tile.x + 0.5) * TILE_SIZE,
          y: (tile.y + 0.5) * TILE_SIZE
        })
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
      handTexture?.dispose()
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frame)
      clearInterval(lightTimer)
      decor.dispose()
      terrain.dispose()
      sun.shadow.dispose()
      document.removeEventListener('visibilitychange', visibility)
      reducedMotion.removeEventListener('change', wake)
      canvas.removeEventListener('webglcontextlost', contextLost)
      for (const { mesh } of cursorLayers) mesh.dispose()
      for (const item of disposables) item.dispose()
      renderer.dispose()
    }
  }
}
export type IslandRenderer = ReturnType<typeof createIslandRenderer>
