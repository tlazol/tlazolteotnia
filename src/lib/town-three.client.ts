import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DepthTexture,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Float32BufferAttribute,
  FloatType,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Shape,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget
} from 'three'
import { type BoardSize, type BoardView, hashSlug } from './sticker-board'
import {
  nearestTownRoad,
  onettBuildings,
  onettGroves,
  onettHills,
  onettRoads,
  onettToTown
} from './town-layout'
import { createTownNavigation, type TownObstacle, type TownPoint } from './town-navigation'
import { clampTownView, nearestResidentRoute, type TownArticle, townToBoard } from './town-posts'
import { avoidTraffic, type TrafficBody, type TrafficRoute, trafficPose } from './town-traffic'
import { boardToTown, createTownCamera, updateTownCamera } from './town-view'

type Part = {
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  angle: number
  pitch: number
  yaw: number
  color: number
  motion?: 'leg' | 'arm' | 'pedal' | 'wheel'
}
type TownShape = 'box' | 'person' | 'ground' | 'land' | 'roof' | 'gable' | 'tree' | 'disc' | 'wheel'
type Resident = TrafficBody & {
  slug?: string
  time?: number
  returning?: { path: TownPoint[]; route: TrafficRoute }
  route: TrafficRoute
  phase: number
  placed?: boolean
}
type MovingPart = { part: Part; resident: Resident }

// Two child silhouettes and four young-adult silhouettes.
function personScale(variant: number) {
  const appearance = variant % 6
  return appearance < 2 ? 0.72 : 1
}

// Sampled from the daytime Onett map; keep these hues independent of scene lighting.
// https://cdn.wikimg.net/strategywiki/images/1/1e/EarthBound_Onett.png
const colors = {
  grass: 0x12f76c,
  hedge: 0x2aba64,
  tree: 0x2aba64,
  treeOutline: 0x527264,
  treeHighlight: 0x12f76c,
  trunk: 0x9a5a6c,
  pavement: 0xeff0d3,
  curb: 0xa2a26c,
  road: 0xc3d39e,
  stripe: 0xeff0d3,
  shadow: 0x2aba64,
  cream: 0xf2f2bd,
  ink: 0x333333,
  window: 0x527a74,
  door: 0x8a623c,
  brick: 0xd27a74,
  wood: 0xb27a4c,
  flower: 0xfa0a5c,
  water: 0x52bafc,
  waterHighlight: 0xa2eafa,
  ocean: 0x388cba,
  shallows: 0x52bacb,
  sand: 0xeaca8c,
  court: 0xd28a74,
  asphalt: 0x82928c,
  glass: 0x8acacc
}
const roofs = [0x8a72fc, 0x8a72fc, 0xd25afc, 0xfa0a5c]
const walls = [0xf2f2bd, 0xeff0d3, 0xf2f2bd, 0xfafa74]

function shadeFaces(geometry: BufferGeometry) {
  const normals = geometry.getAttribute('normal')
  const shades = new Float32Array(normals.count * 3)
  for (let i = 0; i < normals.count; i++) {
    // The main faces retain the sampled color; only side faces have a fixed shade.
    const shade =
      normals.getX(i) > 0.9 ? 0.72 : normals.getX(i) > 0.25 && normals.getY(i) > 0.1 ? 0.84 : 1
    shades.set([shade, shade, shade], i * 3)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(shades, 3))
}

// Small repeating tiles keep surface detail on a deliberate pixel grid.
function tileTexture(kind: 'grass' | 'roof') {
  const pixels = new Uint8Array(16 * 16 * 4)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const seam = y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0
      const tuft =
        (y === 3 && (x === 2 || x === 4)) ||
        (y === 4 && x === 3) ||
        (y === 10 && (x === 10 || x === 12)) ||
        (y === 11 && x === 11)
      const course = Math.floor(y / 4)
      const tile = Math.floor((x + (course % 2) * 4) / 8)
      const tileTone = 242 - ((tile * 7 + course * 13) % 3) * 9
      const value = kind === 'roof' ? (seam ? 165 : y % 4 === 0 ? 255 : tileTone) : tuft ? 206 : 255
      const index = (y * 16 + x) * 4
      pixels.set([value, value, value, 255], index)
    }
  }
  const texture = new DataTexture(pixels, 16, 16, RGBAFormat)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  // Small grass patches repeat the tile below pixel size; mipmaps prevent shimmer.
  texture.minFilter = kind === 'grass' ? LinearMipmapLinearFilter : NearestFilter
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(kind === 'roof' ? 3 : 375, kind === 'roof' ? 3 : 375)
  texture.generateMipmaps = kind === 'grass'
  texture.needsUpdate = true
  return texture
}

function treeGeometry() {
  // A stepped leaf silhouette with depth, facing the fixed diagonal camera.
  const shape = new Shape()
  const outline = [
    [-0.5, -0.8],
    [0.5, -0.8],
    [0.5, -0.6],
    [0.8, -0.6],
    [0.8, -0.3],
    [1, -0.3],
    [1, 0.4],
    [0.8, 0.4],
    [0.8, 0.7],
    [0.5, 0.7],
    [0.5, 0.9],
    [-0.5, 0.9],
    [-0.5, 0.7],
    [-0.8, 0.7],
    [-0.8, 0.4],
    [-1, 0.4],
    [-1, -0.3],
    [-0.8, -0.3],
    [-0.8, -0.6],
    [-0.5, -0.6]
  ]
  shape.moveTo(outline[0][0], outline[0][1])
  for (const [x, y] of outline.slice(1)) shape.lineTo(x, y)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, steps: 1 })
  geometry.translate(0, 0, -0.25)
  geometry.rotateY(Math.PI / 4)
  return geometry
}

function personGeometry() {
  // One bevel per edge: carved toy-like facets, shared by every resident.
  const shape = new Shape()
  shape.moveTo(-0.36, -0.36)
  shape.lineTo(0.36, -0.36)
  shape.lineTo(0.36, 0.36)
  shape.lineTo(-0.36, 0.36)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.72,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.14,
    bevelSegments: 1,
    steps: 1
  })
  geometry.translate(0, 0, -0.36)
  return geometry
}

function roofGeometry() {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5],
      3
    )
  )
  geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3])
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute([0, 0, 1, 0, 0.5, 0, 0, 1, 1, 1, 0.5, 1], 2)
  )
  const flat = geometry.toNonIndexed()
  geometry.dispose()
  flat.computeVertexNormals()
  return flat
}

// A headland with stepped coves. Share its outline between the ground,
// cliff terraces and planting so no trees or grass extend over the water.
const coastStep = 96
const coastColumns = Array.from({ length: 100 }, (_, index) => {
  const x = -2352 + index * coastStep
  const reach = Math.sqrt(Math.max(0, 1 - ((x - 2400) / 4850) ** 2))
  const inlet = Math.sin(x / 490) * 160 + Math.sin(x / 173) * 65
  const bay = Math.exp(-(((x - 4400) / 1150) ** 2)) * 380
  return {
    x,
    north: Math.round((-1000 - reach * 4200 + inlet) / 32) * 32,
    south: Math.round((-1000 + reach * 3400 + inlet - bay) / 32) * 32,
    beach: 100 + Math.round(Math.exp(-(((x - 3500) / 1700) ** 2)) * 320)
  }
})

function landGeometry() {
  const positions: number[] = []
  const uvs: number[] = []
  for (const { x, north, south } of coastColumns) {
    const left = x - coastStep / 2
    const right = x + coastStep / 2
    for (const [px, pz] of [
      [left, north],
      [left, south],
      [right, north],
      [right, north],
      [left, south],
      [right, south]
    ]) {
      positions.push(px, -1, pz)
      // Match the original grass tile's world scale across every coastal strip.
      uvs.push(px / 30000, pz / 30000)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

export function createTownScene(articles?: TownArticle[]) {
  const scene = new Scene()
  scene.background = new Color(colors.ocean)
  const camera = createTownCamera()
  const geometries = {
    box: new BoxGeometry(1, 1, 1),
    person: personGeometry(),
    disc: new CylinderGeometry(0.5, 0.5, 1, 20),
    wheel: new TorusGeometry(0.5, 0.09, 4, 12).rotateY(Math.PI / 2),
    ground: new BoxGeometry(1, 1, 1),
    land: landGeometry(),
    roof: roofGeometry(),
    gable: roofGeometry(),
    tree: treeGeometry()
  }
  for (const geometry of Object.values(geometries)) shadeFaces(geometry)
  const material = new MeshBasicMaterial({ vertexColors: true })
  const grassTexture = tileTexture('grass')
  const roofTexture = tileTexture('roof')
  const grassMaterial = new MeshBasicMaterial({ map: grassTexture, vertexColors: true })
  const roofMaterial = new MeshBasicMaterial({ map: roofTexture, vertexColors: true })
  const meshes: InstancedMesh[] = []
  const occluders: InstancedMesh[] = []
  const traffic = new Scene()
  const residents: Resident[] = []
  const ambientResidents = new Map<string, Resident>()
  const trafficMeshes: { mesh: InstancedMesh; items: MovingPart[] }[] = []
  const obstacles: TownObstacle[] = []
  function containsGround(point: TownPoint) {
    const coast = coastColumns[Math.round((point.x - coastColumns[0].x) / coastStep)]
    return !!coast && point.z > coast.north + 12 && point.z < coast.south - 12
  }
  let navigation = createTownNavigation(obstacles, containsGround)
  const transform = new Object3D()
  const color = new Color()
  let blockKey = ''
  let viewKey = ''
  let dirty = true
  let trafficDirty = false
  let elapsed = 0
  let lastTime: number | undefined
  let lastMotion = false
  let selectedSlug: string | null = null
  let followedSlug: string | null = articles?.[0]?.slug ?? null
  let currentView: BoardView = { x: 0, y: 0, zoom: 1 }
  let focusedSlug: string | null = null
  let dragged: { resident: Resident; pose: Resident['pose'] } | null = null
  let zoom = 1
  const liftHeight = 28
  let visibleSlugs = articles ? new Set(articles.map((article) => article.slug)) : null
  const articleResidents = new Map<string, Resident>()
  const raycaster = new Raycaster()
  const projected = new Vector3()
  const world = new Vector3()
  const screen = new Vector2()
  let viewport: BoardSize = { width: 0, height: 0 }
  const visibility = new Map<string, boolean>()
  let visibilityTime = -Infinity

  // Cache the static town so sticker glints don't redraw thousands of town objects.
  const target = new WebGLRenderTarget(1, 1, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    samples: 4,
    generateMipmaps: false
  })
  target.texture.colorSpace = SRGBColorSpace
  // Preserve thin surface layers across the camera's wide depth range in both passes.
  target.depthTexture = new DepthTexture(1, 1, FloatType)
  const trafficTarget = new WebGLRenderTarget(1, 1, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    samples: 4,
    generateMipmaps: false
  })
  trafficTarget.texture.colorSpace = SRGBColorSpace
  trafficTarget.depthTexture = new DepthTexture(1, 1, FloatType)
  const backdrop = new Scene()
  const backdropCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const backdropGeometry = new PlaneGeometry(2, 2)
  // Compare the cached town depth with the moving residents so trees and buildings
  // still occlude them, without rendering the whole town on every animation frame.
  const backdropMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      townMap: { value: target.texture },
      townDepth: { value: target.depthTexture },
      trafficMap: { value: trafficTarget.texture },
      trafficDepth: { value: trafficTarget.depthTexture },
      texelSize: { value: new Vector2(1, 1) },
      outlineDepth: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D townMap;
      uniform sampler2D townDepth;
      uniform sampler2D trafficMap;
      uniform sampler2D trafficDepth;
      uniform vec2 texelSize;
      uniform float outlineDepth;
      varying vec2 vUv;

      float visibleDepth(vec2 uv) {
        return min(texture2D(townDepth, uv).r, texture2D(trafficDepth, uv).r);
      }

      void main() {
        vec2 uv = vUv;
        float townZ = texture2D(townDepth, uv).r;
        float trafficZ = texture2D(trafficDepth, uv).r;
        gl_FragColor = trafficZ < townZ
          ? texture2D(trafficMap, uv)
          : texture2D(townMap, uv);
        float depth = min(townZ, trafficZ);
        float neighborDepth = max(
          max(visibleDepth(uv + vec2(texelSize.x, 0.0)),
              visibleDepth(uv - vec2(texelSize.x, 0.0))),
          max(visibleDepth(uv + vec2(0.0, texelSize.y)),
              visibleDepth(uv - vec2(0.0, texelSize.y)))
        );
        // Ink only the nearer side: a single pixel, without a halo through occluders.
        float outline = step(outlineDepth, neighborDepth - depth);
        // Darken the surface color so each contour keeps its material's hue.
        gl_FragColor.rgb *= mix(1.0, 0.45, outline);
        #include <colorspace_fragment>
      }
    `
  })
  backdrop.add(new Mesh(backdropGeometry, backdropMaterial))

  function rebuild(detailed: boolean) {
    for (const mesh of meshes) {
      scene.remove(mesh)
      mesh.dispose()
    }
    meshes.length = 0
    occluders.length = 0
    for (const { mesh } of trafficMeshes) {
      traffic.remove(mesh)
      mesh.dispose()
    }
    trafficMeshes.length = 0
    residents.length = 0
    obstacles.length = 0
    const movingParts: Partial<Record<TownShape, MovingPart[]>> = {}
    const forestParts: Partial<Record<TownShape, Part[]>> = {}
    let distantForest = false
    let resident: Resident | undefined
    const parts: Record<TownShape, Part[]> = {
      box: [],
      person: [],
      ground: [],
      land: [],
      roof: [],
      gable: [],
      tree: [],
      disc: [],
      wheel: []
    }
    let offsetX = 0
    let offsetZ = 0
    let yaw = 0
    let scale = 1
    function part(
      shape: TownShape,
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      tint: number,
      angle = 0,
      pitch = 0
    ) {
      const item: Part = {
        x: (x * Math.cos(yaw) + z * Math.sin(yaw)) * scale + offsetX,
        y: y * scale,
        z: (-x * Math.sin(yaw) + z * Math.cos(yaw)) * scale + offsetZ,
        width: width * scale,
        height: height * scale,
        depth: depth * scale,
        angle,
        pitch,
        yaw: shape === 'tree' ? 0 : yaw,
        color: tint
      }
      // Solid geometry at body height blocks walking; flat roads and grass do not.
      if (
        !resident &&
        item.y + item.height / 2 > 5 &&
        item.y - item.height * (shape === 'tree' ? 0.8 : 0.5) < 60
      ) {
        // Tree geometry spans +/-1 in x and +/-0.25 in z before its 45-degree turn.
        const extent = shape === 'tree' ? 1.25 / Math.SQRT2 : 0.5
        const radiusX =
          (Math.abs(Math.cos(item.yaw)) * item.width + Math.abs(Math.sin(item.yaw)) * item.depth) *
            extent +
          12
        const radiusZ =
          (Math.abs(Math.sin(item.yaw)) * item.width + Math.abs(Math.cos(item.yaw)) * item.depth) *
            extent +
          12
        obstacles.push({
          left: item.x - radiusX,
          right: item.x + radiusX,
          top: item.z - radiusZ,
          bottom: item.z + radiusZ
        })
      }
      if (resident) {
        movingParts[shape] ??= []
        movingParts[shape].push({ part: item, resident })
      } else if (distantForest) {
        forestParts[shape] ??= []
        forestParts[shape].push(item)
      } else parts[shape].push(item)
      return item
    }
    const box = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      c: number,
      angle = 0,
      pitch = 0
    ) => part('box', x, y, z, w, h, d, c, angle, pitch)

    // Small-town silhouettes: caps, striped tees, denim, cardigans and satchels.
    // Local +z is the face / direction of travel.
    const clothingColors = [
      0x343449, 0xeff0d3, 0x687286, 0xa87b61, 0xfa0a5c, 0xff729f, 0xffb3d4, 0xc44b91, 0xf56c52,
      0xf99b50, 0xfacb58, 0xfafa74, 0x527afc, 0x3556a4, 0x52bafc, 0xa2eafa, 0x8a72fc, 0xb8a0f2,
      0xd25afc, 0x713f94, 0x28a68a, 0x68d6ac, 0xb0edca, 0x387961, 0x93ca54, 0xd5ed87, 0x658b44,
      0xe3b987, 0x9d4563, 0xe6a0a4, 0x437c99, 0xb2ced7
    ]
    const shoeColors = [
      0x393846, 0xf4efd9, 0x655b70, 0x975e43, 0xf34f71, 0xfa91c3, 0xc84992, 0xff8854, 0xf9ce58,
      0xe9ee91, 0x4569d5, 0x70c9ef, 0xb4eafa, 0x53449b, 0x9d79e4, 0xd7b2ef, 0x36ad96, 0x8dddb6,
      0xb8df74, 0x487c62, 0xba5871, 0xdc9670, 0x738aab, 0xc1c6d5
    ]
    const skinTones = [
      0xffe1c4, 0xf5cfb0, 0xefbe98, 0xe8b48a, 0xdca078, 0xd39470, 0xc18762, 0xb57753, 0xa66b4b,
      0x905a42, 0x774a38, 0x603c30,
      // Pastel aliens share the town's aqua, green and violet accents.
      0x91d8f0, 0x60bcd4, 0x9aebcc, 0x69c39b, 0xb5d98a, 0xc3aff0, 0xe7b1e0, 0x79a7df
    ]
    const hairColors = [
      0x302b3b, 0x51382f, 0x765044, 0x9a603e, 0xbe783f, 0xd7a85a, 0xf0cc78, 0xa44346, 0xfa5cab,
      0xff9ed2, 0x52d5f3, 0xa2eafa, 0x28cbb8, 0x8a72fc, 0xc6a0ff, 0x9cea74, 0x527afc, 0xd25afc,
      0xfa786f, 0x58d692
    ]
    function person(variant: number, riding = false) {
      const appearance = variant % 6
      const child = appearance < 2
      const skirt = !riding && (appearance === 1 || appearance === 3 || appearance === 5)
      // Independent, stable seeds let every silhouette use every palette colour.
      const identity = resident?.slug ?? String(variant)
      const skin = skinTones[(hashSlug(`skin:${identity}`) >>> 8) % skinTones.length]
      const outfitColor = (palette: readonly number[], slot: string) =>
        palette[(hashSlug(`${slot}:${identity}`) >>> 8) % palette.length]
      const shirt = outfitColor(clothingColors, 'top')
      const bottom = outfitColor(clothingColors, 'bottom')
      const shoe = outfitColor(shoeColors, 'shoe')
      const sock = outfitColor(clothingColors, 'sock')
      const hat = outfitColor(clothingColors, 'hat')
      const bag = outfitColor(clothingColors, 'bag')
      // Keep tiny stripes, collars and laces legible against both pastel and dark tops.
      const shirtLuma =
        (((shirt >> 16) & 255) * 299 + ((shirt >> 8) & 255) * 587 + (shirt & 255) * 114) / 1000
      const accent = outfitColor(
        shirtLuma > 155
          ? [0x343449, 0x3556a4, 0x713f94, 0x387961, 0x9d4563, 0x437c99]
          : [0xeff0d3, 0xffb3d4, 0xfafa74, 0xa2eafa, 0xb0edca, 0xd5ed87],
        'trim'
      )
      const sole = outfitColor([0xeff0d3, 0x393846, 0xf9ce58, 0xfa91c3, 0x8dddb6, 0xb4eafa], 'sole')
      const sleeve = hashSlug(`sleeve:${identity}`) % 3 === 0 ? accent : shirt
      const hair = hairColors[(hashSlug(`hair:${identity}`) >>> 16) % hairColors.length]
      const lift = riding ? 10 : 0
      const lean = riding ? -7 : 0
      const sculpt = (
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        c: number
      ) => part('person', x, y, z, w, h, d, c)

      // Broad shoulders, a tucked waist and a short neck separate the main volumes.
      sculpt(0, 30 + lift, lean, 18, 18, 12, shirt)
      // The seated hips rest on the saddle's top (y=33), centered at z=-7.
      sculpt(0, riding ? 36.5 : 23, lean, 14, 7, 11, bottom)
      sculpt(0, 40 + lift, lean, 6, 6, 7, skin)
      sculpt(0, 47 + lift, lean + 1, 20, 18, 17, skin)
      // Center the crown over the head and cover its front and corner bevels.
      sculpt(0, 54 + lift, lean + 1, 21, 8, 20, hair)
      // Hair must extend past the head's side/front planes, not share their depth.
      sculpt(0, 48 + lift, lean - 6, 21, 13, 7, hair)
      for (const side of [-1, 1]) {
        sculpt(side * 10, 46 + lift, lean + 1, 4, 6, 5, skin)
        // Small inset eyes stay legible without a large protruding face.
        box(side * 4, 47 + lift, lean + 9.4, 2.2, 3, 1, colors.ink)
      }
      sculpt(0, 44 + lift, lean + 10, 3, 3, 3, skin)

      if (appearance === 0) {
        sculpt(0, 56 + lift, lean - 1, 22, 7, 19, hat)
        sculpt(0, 54 + lift, lean + 10, 23, 3, 12, hat)
        box(0, 57 + lift, lean + 8.6, 5, 3, 1, accent)
        for (const y of [27, 33]) box(0, y + lift, lean + 6.1, 16, 3, 1, accent)
        // A little canvas backpack also makes the child recognisable from behind.
        sculpt(0, 31 + lift, lean - 8, 12, 13, 6, bag)
      } else if (appearance === 1 || appearance === 3) {
        for (const side of [-1, 1]) {
          sculpt(side * 8, 46 + lift, lean - 1, 6, child ? 14 : 17, 13, hair)
        }
        sculpt(-4, 52 + lift, lean + 7.5, 13, 6, 5, hair)
        sculpt(6, 52 + lift, lean + 7, 5, 5, 4, hair)
        sculpt(10, 51 + lift, lean + 1, 3, 4, 7, hat)
        box(0, 36 + lift, lean + 6, 7, 4, 1, accent)
        if (child) {
          for (const side of [-1, 1]) box(side * 5, 31 + lift, lean + 6.3, 3, 12, 1, bottom)
          box(0, 27 + lift, lean + 6.5, 11, 6, 1, bottom)
        }
      } else if (appearance === 2) {
        sculpt(-4, 55 + lift, lean + 3.5, 13, 7, 13, hair)
        box(0, 32 + lift, lean + 6.1, 7, 12, 1, accent)
        for (const side of [-1, 1]) box(side * 5, 35 + lift, lean + 6.5, 3, 6, 1, bottom)
        box(5, 29 + lift, lean + 6.5, 4, 1.5, 1, accent)
      } else if (appearance === 4) {
        // A swept crop and a hoodie with contrasting drawstrings.
        sculpt(-5, 56 + lift, lean + 3, 12, 7, 12, hair)
        sculpt(3, 54 + lift, lean + 7, 10, 6, 6, hair)
        sculpt(0, 37 + lift, lean - 6, 15, 7, 8, shirt)
        for (const side of [-1, 1]) box(side * 3, 34 + lift, lean + 6.2, 1, 7, 1, accent)
        box(0, 27 + lift, lean + 6.2, 10, 4, 1, accent)
      } else if (appearance === 5) {
        // A high ponytail, side fringe and a light cardigan.
        sculpt(0, 53 + lift, lean - 10, 9, 8, 9, hair)
        sculpt(0, 45 + lift, lean - 12, 8, 14, 8, hair)
        sculpt(0, 53 + lift, lean - 8, 10, 3, 4, hat)
        sculpt(-5, 52 + lift, lean + 7.5, 11, 6, 5, hair)
        sculpt(-9, 48 + lift, lean + 2, 4, 9, 8, hair)
        box(0, 31 + lift, lean + 6.2, 7, 13, 1, accent)
        for (const y of [27, 32]) box(5, y + lift, lean + 6.5, 1.5, 1.5, 1, accent)
      }
      if (skirt) {
        sculpt(0, 22, 0, 19, 10, 13, bottom)
        sculpt(0, 18, 0, 22, 6, 15, bottom)
      }
      for (const side of [-1, 1]) {
        if (riding) {
          // Keep the thighs attached to the seated hips while the lower legs pedal.
          sculpt(side * 6, 33.5, 1, 7, 7, 22, bottom)
          sculpt(side * 6, 23, 11, 6, 20, 6, child ? skin : bottom).motion = 'pedal'
          sculpt(side * 7, 14, 13, 8, 5, 11, shoe).motion = 'pedal'
          box(side * 7, 12.5, 13, 8, 2, 10, sole).motion = 'pedal'
          sculpt(side * 11, 38, 4, 7, 7, 24, sleeve)
          sculpt(side * 10, 36, 19, 5, 5, 9, skin)
        } else {
          sculpt(side * 4.5, 16, 0, 7, 13, 8, skirt ? skin : bottom).motion = 'leg'
          sculpt(side * 4.5, 8, 0, 6, 8, 6, child || skirt ? skin : bottom).motion = 'leg'
          if (child) box(side * 4.5, 5, 0, 6, 4, 6, sock).motion = 'leg'
          sculpt(side * 4.5, 3, 2, 8, 5, 12, shoe).motion = 'leg'
          box(side * 4.5, 1.5, 2, 8, 2, 11, sole).motion = 'leg'
          sculpt(side * 11, 33, 0, 7, 10, 9, sleeve).motion = 'arm'
          sculpt(side * 11, 26, 0.5, 5, 8, 6, skin).motion = 'arm'
          sculpt(side * 11, 22, 1, 6, 5, 6, skin).motion = 'arm'
        }
      }
      if (!riding && appearance === 2) {
        // The satchel is worn at the hip, so it moves with the torso, not the hand.
        box(-8, 31, 6.6, 2, 17, 1.5, bag)
        sculpt(-11, 22, 1, 7, 11, 11, bag)
        sculpt(-11, 25, 2, 8, 4, 11, accent)
      }
    }

    function car(variant: number) {
      const paint = [colors.flower, colors.water, colors.cream, roofs[0]][variant % 4]
      box(2, 2.7, 2, 35, 0.8, 70, colors.curb)
      box(0, 12, 0, 30, 12, 64, paint)
      box(0, 19, 23, 28, 5, 17, paint)
      box(0, 25, -4, 25, 16, 32, colors.window)
      box(0, 34, -5, 28, 4, 32, paint)
      box(0, 26, 13, 22, 10, 2, colors.glass)
      box(0, 26, -21, 22, 9, 2, colors.glass)
      for (const side of [-1, 1]) {
        for (const z of [-21, 21]) {
          part('disc', side * 15, 9, z, 14, 5, 14, colors.ink, Math.PI / 2)
          part('disc', side * 18, 9, z, 6, 1, 6, colors.pavement, Math.PI / 2)
        }
        box(side * 13, 26, -4, 2, 12, 3, paint)
        box(side * 17, 22, 10, 5, 4, 6, paint)
        box(side * 10, 15, 33, 7, 5, 2, colors.cream)
        box(side * 10, 15, -33, 7, 4, 2, colors.flower)
        if (detailed) box(side * 16, 17, -8, 1, 2, 6, colors.cream)
      }
      box(0, 8, 33, 28, 4, 3, colors.pavement)
      box(0, 8, -33, 28, 4, 3, colors.pavement)
      box(0, 14, 34, 9, 4, 1, colors.ink)
    }

    function cyclist(variant: number) {
      const frame = [0xfa0a5c, 0x527afc, 0xfafa74, 0x8a72fc, 0xeff0d3][(variant + 2) % 5]
      // Slim frame tubes keep daylight visible through both wheels and triangles.
      function tube(y1: number, z1: number, y2: number, z2: number, tint = frame) {
        box(
          0,
          (y1 + y2) / 2,
          (z1 + z2) / 2,
          3,
          Math.hypot(y2 - y1, z2 - z1),
          3,
          tint,
          0,
          Math.atan2(z2 - z1, y2 - y1)
        )
      }
      for (const z of [-20, 20]) {
        part('wheel', 0, 12, z, 18, 18, 18, colors.ink).motion = 'wheel'
        box(0, 12, z, 7, 3, 3, colors.pavement)
        if (detailed) {
          box(0, 12, z, 1, 15, 1, colors.curb).motion = 'wheel'
          box(0, 12, z, 1, 1, 15, colors.curb).motion = 'wheel'
        }
      }
      tube(12, -20, 13, 0)
      tube(12, -20, 29, -7)
      tube(13, 0, 29, -7)
      tube(29, -7, 29, 14)
      tube(13, 0, 29, 14)
      tube(12, 20, 34, 13, colors.pavement)
      box(0, 31, -7, 11, 4, 10, colors.ink)
      box(0, 35, 18, 23, 3, 3, colors.ink)
      box(0, 13, 0, 20, 3, 3, colors.window)
      person(variant, true)
    }

    // Work in facade coordinates so front and side details share the same construction.
    function facade(x: number, z: number, side = false) {
      return (u: number, y: number, out: number, w: number, h: number, d: number, c: number) => {
        if (side) box(x + out, y, z + u, d, h, w, c)
        else box(x + u, y, z + out, w, h, d, c)
      }
    }

    function windowDetail(
      x: number,
      y: number,
      z: number,
      side = false,
      shutters = false,
      interior = 0
    ) {
      const face = facade(x, z, side)
      face(0, y, 2, 38, 36, 4, colors.cream)
      face(0, y, 5, 30, 28, 3, colors.window)
      if (!detailed) return
      // Curtains and partly lowered blinds vary by room, with glass in front of them.
      if (interior % 3 === 0) {
        for (const dx of [-11, 11]) {
          face(dx, y + 1, 7, 6, 25, 1, colors.sand)
          face(dx, y - 5, 8, 7, 2, 1, colors.wood)
        }
      } else if (interior % 3 === 1) {
        face(0, y + 9, 7, 28, 9, 1, colors.pavement)
        for (const dy of [6, 10]) face(0, y + dy, 8, 28, 1, 1, colors.curb)
      }
      face(-8, y + 5, 7.5, 5, 15, 1, colors.glass)
      face(7, y - 6, 7, 8, 8, 1, colors.glass)
      face(0, y, 8, 3, 28, 2, colors.cream)
      face(0, y - 2, 8, 30, 3, 2, colors.cream)
      face(0, y - 19, 5, 44, 4, 12, colors.curb)
      face(0, y + 19, 3, 42, 3, 7, colors.pavement)
      face(4, y - 7, 10, 3, 2, 2, colors.door)
      for (const dx of [-17, 17]) face(dx, y - 16, 5, 2, 2, 2, colors.window)
      if (shutters) {
        for (const sign of [-1, 1]) {
          face(sign * 25, y, 3, 10, 32, 4, colors.window)
          for (let dy = -10; dy <= 10; dy += 5) {
            face(sign * 25, y + dy, 6, 8, 2, 2, colors.glass)
          }
        }
      }
    }

    function roofEquipment(x: number, y: number, z: number) {
      box(x, y + 2, z, 48, 4, 38, colors.window)
      box(x, y + 13, z, 40, 20, 30, colors.pavement)
      box(x, y + 24, z, 44, 3, 34, colors.cream)
      if (!detailed) return
      for (const dx of [-11, 11]) {
        box(x + dx, y + 13, z + 16, 15, 14, 2, colors.window)
        for (const dy of [-4, 0, 4]) {
          box(x + dx, y + 13 + dy, z + 18, 13, 1.5, 2, colors.curb)
        }
      }
      for (const dx of [-12, -4, 4, 12]) {
        box(x + dx, y + 26, z, 3, 1, 23, colors.curb)
      }
    }

    function parapet(x: number, y: number, z: number, width: number, depth: number) {
      for (const sign of [-1, 1]) {
        box(x, y, z + sign * (depth / 2 - 3), width, 9, 6, colors.cream)
        box(x + sign * (width / 2 - 3), y, z, 6, 9, depth, colors.cream)
      }
    }

    function brickwork(x: number, z: number, width: number, height: number, side = false) {
      const face = facade(x, z, side)
      for (let y = 16, row = 0; y < height; y += 10, row++) {
        face(0, y, 0.7, width, 1.5, 1, colors.sand)
        for (let u = -width / 2 + 8 + (row % 2) * 12; u < width / 2 - 2; u += 24) {
          face(u, y + 5, 0.7, 1.5, 9, 1, colors.sand)
        }
      }
    }

    function planter(x: number, z: number, tint: number) {
      box(x, 5, z, 16, 10, 16, colors.brick)
      box(x, 11, z, 20, 4, 20, colors.sand)
      box(x, 14, z, 15, 3, 15, colors.door)
      box(x, 22, z, 4, 18, 4, colors.hedge)
      for (const dx of [-6, 6]) box(x + dx, 21, z, 9, 5, 8, colors.hedge)
      box(x, 31, z, 9, 6, 9, tint)
      box(x, 35, z, 4, 3, 4, colors.sand)
    }

    function wallUtilities(x: number, z: number) {
      const face = facade(x, z, true)
      // An outdoor condenser, its mounting feet, drain hose, and electricity meter.
      face(0, 23, 11, 29, 23, 18, colors.pavement)
      face(0, 24, 21, 20, 18, 2, colors.window)
      for (const u of [-6, 0, 6]) face(u, 24, 23, 2, 16, 2, colors.curb)
      for (const dy of [-5, 0, 5]) face(0, 24 + dy, 24, 18, 1.5, 2, colors.cream)
      for (const u of [-10, 10]) face(u, 9, 10, 4, 6, 22, colors.window)
      face(19, 28, 5, 3, 32, 3, colors.curb)
      face(14, 43, 5, 13, 3, 3, colors.curb)
      face(-26, 36, 4, 13, 12, 6, colors.curb)
      face(-26, 38, 8, 8, 6, 2, colors.window)
      face(-26, 38, 10, 4, 3, 1, colors.glass)
      face(-26, 19, 2, 2, 24, 2, colors.window)
    }

    function roofSurface(x: number, y: number, z: number, width: number, depth: number) {
      // Membrane seams, flashing, drain grate, and an access path to the equipment.
      for (let u = -width / 2 + 30; u < width / 2 - 10; u += 38) {
        box(x + u, y, z, 1.5, 0.6, depth - 12, colors.window)
      }
      for (let v = -depth / 2 + 27; v < depth / 2 - 8; v += 36) {
        box(x, y, z + v, width - 12, 0.6, 1.5, colors.curb)
      }
      for (let u = -35; u <= 35; u += 14) box(x + u, y + 1, z + 13, 12, 1, 17, colors.pavement)
      box(x + width / 2 - 16, y + 1, z + depth / 2 - 16, 12, 1, 12, colors.window)
      for (const u of [-3, 1, 5]) {
        box(x + width / 2 - 16 + u, y + 2, z + depth / 2 - 16, 1.5, 1, 10, colors.curb)
      }
    }

    function shopGoods(x: number, z: number, variant: number) {
      // Stacked produce crates with separate rims, slats, fruit, and price cards.
      for (let i = 0; i < 2; i++) {
        const px = x + i * 30
        box(px, 12, z, 26, 24, 25, colors.wood)
        box(px, 25, z, 22, 2, 21, colors.door)
        for (const dz of [-13, 13]) box(px, 27, z + dz, 28, 6, 3, colors.sand)
        for (const dx of [-13, 13]) box(px + dx, 27, z, 3, 6, 26, colors.sand)
        for (const y of [7, 16]) box(px, y, z + 13, 23, 2, 1, colors.door)
        for (const dx of [-6, 5]) {
          for (const dz of [-6, 5]) {
            box(px + dx, 30, z + dz, 8, 7, 8, (variant + i) % 2 ? colors.flower : colors.sand)
            box(px + dx, 34, z + dz, 2, 3, 2, colors.hedge)
          }
        }
        box(px, 21, z + 15, 10, 6, 2, colors.cream)
        box(px, 21, z + 17, 5, 2, 1, colors.window)
      }
    }

    function tree(x: number, z: number, scale = 1, elevation = 0) {
      box(x + 16, elevation + 1, z + 12, 74 * scale, 1, 58 * scale, colors.shadow)
      box(x, elevation + 24 * scale, z, 13 * scale, 48 * scale, 13 * scale, colors.trunk)
      part(
        'tree',
        x,
        elevation + 86 * scale,
        z,
        57 * scale,
        64 * scale,
        48 * scale,
        colors.treeOutline
      )
      part(
        'tree',
        x + 10 * scale,
        elevation + 90 * scale,
        z + 10 * scale,
        49 * scale,
        55 * scale,
        32 * scale,
        colors.tree
      )
      part(
        'tree',
        x + 5 * scale,
        elevation + 106 * scale,
        z + 22 * scale,
        31 * scale,
        30 * scale,
        16 * scale,
        colors.treeHighlight
      )
    }

    function house(x: number, z: number, variant: number) {
      const width = 180 + (variant % 3) * 18
      const depth = variant % 3 === 2 ? 126 : 152
      const height = 88 + (variant % 2) * 24
      box(x + 18, 1, z + 18, width + 38, 1, depth + 35, colors.shadow)
      box(x, 6, z, width + 12, 12, depth + 12, colors.curb)
      box(x, height / 2 + 12, z, width, height, depth, walls[variant % walls.length])
      box(x, height + 14, z, width + 28, 8, depth + 28, colors.ink)
      if (variant % 3 === 2) {
        box(x, height + 23, z, width + 30, 16, depth + 30, roofs[variant % roofs.length])
        box(x - 40, height + 39, z, 60, 16, 58, colors.cream)
      } else {
        part('roof', x, height + 18, z, width + 30, 62, depth + 30, roofs[variant % roofs.length])
      }
      const chimneyY = height + (variant % 3 === 2 ? 53 : 63)
      box(x + width / 4, chimneyY, z - 35, 23, 47, 25, colors.brick)
      box(x + width / 4, chimneyY + 26, z - 35, 28, 7, 30, colors.cream)
      const front = facade(x, z + depth / 2)
      front(0, 37, 2, 34, 54, 5, colors.cream)
      front(0, 36, 5, 25, 46, 3, colors.door)
      front(7, 34, 8, 3, 3, 2, colors.stripe)
      for (const side of [-1, 1]) {
        windowDetail(x + side * 59, 63, z + depth / 2, false, variant % 2 === 0, variant + side)
        windowDetail(x + width / 2, 63, z + side * 38, true, false, variant + side + 2)
      }
      if (detailed) {
        // Recessed door panels, porch brackets, and a warm porch light.
        front(0, 47, 7, 15, 15, 2, colors.window)
        front(-4, 49, 9, 4, 9, 1, colors.glass)
        front(0, 23, 7, 16, 10, 2, colors.wood)
        front(0, 70, 10, 48, 5, 26, roofs[variant % roofs.length])
        for (const dx of [-19, 19]) front(dx, 61, 5, 4, 14, 12, colors.wood)
        front(26, 48, 5, 10, 16, 7, colors.ink)
        front(26, 49, 9, 6, 9, 3, colors.sand)
        front(-25, 36, 3, 10, 6, 2, colors.cream)
        // Corner boards, foundation joints, gutters, and a downspout with a shoe.
        for (const sign of [-1, 1]) {
          front(sign * (width / 2 - 4), height / 2 + 12, 2, 7, height, 4, colors.cream)
          box(x + sign * (width / 2 + 12), height + 18, z, 5, 5, depth + 30, colors.window)
        }
        box(x + width / 2 + 5, height / 2 + 12, z + depth / 2 - 11, 6, height, 6, colors.curb)
        box(x + width / 2 + 9, 13, z + depth / 2 - 11, 14, 6, 6, colors.window)
        for (let dx = -width / 2 + 12; dx < width / 2; dx += 23) {
          front(dx, 6, 7, 2, 9, 1, colors.window)
        }
        const sideFace = facade(x + width / 2, z, true)
        for (let y = 24; y < height; y += 12) {
          sideFace(0, y, 0.5, depth, 2, 1, colors.curb)
        }
        for (let y = chimneyY - 16; y < chimneyY + 22; y += 9) {
          box(x + width / 4, y, z - 22, 23, 2, 1, colors.sand)
          box(x + width / 4 + 12, y, z - 35, 1, 2, 25, colors.sand)
        }
        box(x + width / 4, chimneyY + 30, z - 35, 17, 2, 19, colors.ink)
        if (variant % 3 === 2) {
          parapet(x, height + 34, z, width + 24, depth + 24)
          roofEquipment(x + 30, height + 32, z + 12)
        } else {
          box(x, height + 80, z, 9, 5, depth + 36, roofs[variant % roofs.length])
          for (const dz of [-depth / 2 - 16, depth / 2 + 16]) {
            box(x, height + 77, z + dz, 12, 7, 5, colors.cream)
          }
        }
        if (variant % 3 !== 2) {
          const roofWidth = width + 30
          const slope = Math.atan2(62, roofWidth / 2)
          const slopeLength = Math.hypot(roofWidth / 2, 62)
          const gableZ = z + depth / 2 + 16
          part('gable', x, height + 19, gableZ, roofWidth - 10, 57, 2, colors.cream)
          for (let rise = 8; rise < 54; rise += 8) {
            box(
              x,
              height + 19 + rise,
              gableZ + 2,
              (roofWidth - 10) * (1 - rise / 57),
              2,
              2,
              colors.curb
            )
          }
          for (const sign of [-1, 1]) {
            box(
              x + (sign * roofWidth) / 4,
              height + 49,
              gableZ + 3,
              slopeLength + 4,
              5,
              6,
              colors.pavement,
              -sign * slope
            )
          }
          const gable = facade(x, gableZ + 3)
          gable(0, height + 40, 1, 25, 22, 3, colors.wood)
          gable(0, height + 40, 3, 19, 16, 2, colors.window)
          for (const dy of [-5, 0, 5]) gable(0, height + 40 + dy, 5, 18, 2, 2, colors.cream)
          // A framed skylight follows the pitch rather than floating over the roof.
          const skylightX = roofWidth * 0.29
          const skylightY = height + 80 - skylightX * Math.tan(slope)
          box(x + skylightX, skylightY + 2, z + 31, 34, 4, 40, colors.cream, -slope)
          box(x + skylightX + 1, skylightY + 5, z + 31, 27, 2, 32, colors.window, -slope)
          box(x + skylightX + 1, skylightY + 6, z + 23, 25, 1, 6, colors.glass, -slope)
          box(x + skylightX + 1, skylightY + 7, z + 31, 3, 2, 32, colors.cream, -slope)
          for (let dz = -depth / 2; dz <= depth / 2; dz += 14) {
            box(x, height + 83, z + dz, 10, 2, 2, colors.cream)
          }
        } else {
          roofSurface(x, height + 31.5, z, width, depth)
          box(x - 40, height + 48, z, 51, 2, 48, colors.window)
          for (const dx of [-17, 0, 17]) box(x - 40 + dx, height + 50, z, 2, 2, 48, colors.cream)
        }
        wallUtilities(x + width / 2, z)
        planter(x + 33, z + depth / 2 + 31, variant % 2 ? colors.flower : colors.cream)
        front(20, 33, 5, 4, 9, 3, colors.window)
        front(20, 35, 7, 2, 2, 1, colors.sand)
        front(-25, 36, 5, 5, 2, 1, colors.window)
        box(x, 7, z + depth / 2 + 25, 25, 2, 14, colors.wood)
        for (const dx of [-8, -4, 0, 4, 8])
          box(x + dx, 8.5, z + depth / 2 + 25, 1, 1, 12, colors.sand)
        for (let step = 0; step < 3; step++) {
          box(x, 6.5, z + 107 + step * 16, 38, 1, 1.5, colors.curb)
        }
        // The mailbox has a slot, a little flag, and a raised lid.
        box(x + 61, 47, z + 146, 16, 3, 2, colors.ink)
        box(x + 61, 52, z + 137, 25, 3, 19, colors.cream)
        box(x + 74, 48, z + 137, 2, 15, 2, colors.wood)
        box(x + 76, 55, z + 137, 7, 5, 2, colors.flower)
        // A planted window box makes the repeated houses feel inhabited.
        front(-59, 39, 12, 40, 9, 14, colors.wood)
        for (const dx of [-72, -60, -48]) {
          front(dx, 47, 12, 9, 10, 9, colors.hedge)
          front(dx, 53, 13, 6, 5, 6, variant % 2 ? colors.flower : colors.sand)
        }
      }
      box(x, 4, z + 111, 43, 4, 68, colors.pavement)
      box(x, 9, z + 85, 48, 10, 17, colors.cream)
      // A little mailbox and a low garden hedge.
      box(x + 61, 20, z + 137, 6, 40, 6, colors.trunk)
      box(x + 61, 43, z + 137, 23, 16, 17, roofs[variant % roofs.length])
      box(x - 75, 17, z + 140, 74, 32, 22, colors.hedge)
      // Horizontal siding and a short picket fence echo the town's sprite details.
      for (let y = 24; y < height; y += detailed ? 12 : 18) {
        box(x, y, z + depth / 2 + 0.5, width, 2, 1, colors.curb)
      }
      box(x + width / 2 + 35, 23, z, 5, 5, 172, colors.cream)
      for (let p = -76; p <= 76; p += 25) {
        box(x + width / 2 + 35, 20, z + p, 8, 40, 10, colors.cream)
      }
    }

    function bench(x: number, z: number) {
      box(x, 15, z, 58, 8, 22, colors.trunk)
      box(x, 30, z - 12, 58, 24, 5, colors.wood)
      for (const dx of [-19, 19]) box(x + dx, 7, z, 5, 14, 19, colors.window)
    }

    function flowerbed(x: number, z: number) {
      box(x, 7, z, 90, 14, 40, colors.hedge)
      for (let i = 0; i < 6; i++) {
        box(x - 34 + i * 13, 18, z + (i % 2) * 9 - 5, 9, 9, 9, i % 2 ? colors.cream : colors.flower)
      }
    }

    function building(
      x: number,
      z: number,
      kind: 'office' | 'apartment' | 'shop' | 'clinic',
      variant: number
    ) {
      const floors =
        kind === 'office' ? 4 + (variant % 2) : kind === 'apartment' ? 3 + (variant % 2) : 1
      const width = kind === 'shop' ? 252 : 230
      const depth = 164
      const height = floors * 48 + 20
      const tint =
        kind === 'office' ? colors.glass : kind === 'apartment' ? colors.brick : colors.cream
      box(x + 20, 1, z + 20, width + 40, 1, depth + 40, colors.shadow)
      box(x, 5, z, width + 18, 10, depth + 18, colors.curb)
      box(x, height / 2 + 10, z, width, height, depth, tint)
      box(x, height + 15, z, width + 20, 10, depth + 20, colors.cream)
      box(x, height + 21, z, width - 12, 3, depth - 12, colors.asphalt)
      roofEquipment(x - 58, height + 23, z - 35)
      if (detailed) {
        roofSurface(x, height + 23, z, width - 12, depth - 12)
        if (kind === 'apartment') {
          brickwork(x, z + depth / 2, width, height)
          brickwork(x + width / 2, z, depth, height, true)
        }
        parapet(x, height + 26, z, width + 14, depth + 14)
        roofEquipment(x + 20, height + 23, z - 35)
        // Roof access hatch, ductwork, vent stack, and a small aerial.
        box(x + 72, height + 24, z + 36, 36, 3, 32, colors.window)
        box(x + 72, height + 27, z + 36, 29, 3, 25, colors.curb)
        box(x - 17, height + 29, z - 35, 38, 10, 12, colors.curb)
        box(x - 77, height + 42, z + 39, 10, 38, 10, colors.brick)
        box(x - 77, height + 62, z + 39, 17, 4, 17, colors.cream)
        if (floors > 1) {
          box(x + 78, height + 52, z - 53, 3, 60, 3, colors.window)
          for (const dy of [0, 10]) box(x + 78, height + 68 + dy, z - 53, 31, 2, 3, colors.window)
        }
        for (const sign of [-1, 1]) {
          box(x + sign * (width / 2 - 5), height / 2 + 10, z + 84, 8, height, 5, colors.cream)
        }
        box(x + width / 2 + 5, height / 2 + 10, z - 67, 5, height, 5, colors.curb)
      }
      if (detailed && floors > 1) {
        const side = facade(x + width / 2, z, true)
        // Fixed service ladder along the clear rear strip of the side wall.
        for (const u of [-79, -69]) side(u, height / 2 + 16, 9, 3, height + 12, 3, colors.window)
        for (let y = 18; y < height + 24; y += 10) side(-74, y, 10, 13, 2, 3, colors.cream)
        for (const y of [36, height - 12]) side(-74, y, 5, 16, 3, 12, colors.window)
        if (kind === 'apartment') {
          for (const dx of [-46, 24]) box(x + dx, height + 44, z + 49, 3, 42, 3, colors.window)
          box(x - 11, height + 64, z + 49, 73, 2, 2, colors.cream)
          for (let i = 0; i < 3; i++) {
            box(
              x - 32 + i * 20,
              height + 52,
              z + 49,
              14,
              22 - i * 3,
              2,
              i % 2 ? colors.pavement : roofs[variant % roofs.length]
            )
            for (const dx of [-4, 4])
              box(x - 32 + i * 20 + dx, height + 64, z + 49, 2, 4, 3, colors.wood)
          }
        } else {
          // Glazed stairwell headhouse, with a ribbed cap and visible door.
          box(x - 33, height + 40, z + 44, 45, 34, 38, colors.cream)
          box(x - 33, height + 58, z + 44, 51, 4, 44, colors.window)
          box(x - 33, height + 39, z + 64, 19, 27, 3, colors.window)
          box(x - 35, height + 44, z + 66, 11, 10, 2, colors.glass)
        }
      }
      for (let floor = 0; floor < floors; floor++) {
        const y = 42 + floor * 48
        if (floors > 1 || !detailed) {
          for (const dx of [-78, -26, 26, 78]) {
            windowDetail(x + dx, y, z + 82, false, false, variant + floor + (dx + 78) / 52)
          }
        }
        for (const dz of [-48, 4, 56]) {
          windowDetail(x + width / 2, y, z + dz, true, false, variant + floor)
        }
        if (kind === 'apartment') {
          box(x, y - 18, z + 96, width + 12, 7, 30, colors.cream)
          box(x, y - 2, z + 111, width + 12, 3, 4, colors.window)
          box(x, y - 14, z + 111, width + 12, 3, 4, colors.cream)
          if (detailed) {
            for (let dx = -112; dx <= 112; dx += 14) {
              box(x + dx, y - 8, z + 111, 3, 14, 3, colors.cream)
            }
            for (const dx of [-52, 0, 52]) box(x + dx, y - 6, z + 97, 3, 23, 26, colors.pavement)
            box(x + 94, y - 9, z + 98, 22, 12, 12, colors.curb)
            for (const dy of [-3, 1, 5]) box(x + 94, y - 9 + dy, z + 105, 17, 1.5, 2, colors.window)
            box(x - 78, y - 10, z + 103, 23, 9, 10, colors.wood)
            for (const dx of [-85, -75]) box(x + dx, y - 3, z + 103, 8, 9, 8, colors.hedge)
          } else {
            box(x, y - 8, z + 111, width + 12, 12, 3, colors.pavement)
          }
        } else if (kind === 'office') {
          box(x, y + 21, z + 85, width, 5, 5, colors.cream)
          box(x + width / 2 + 2, y + 21, z, 5, 5, depth, colors.cream)
        }
      }
      box(x, 27, z + 87, 28, 40, 7, colors.door)
      box(x, 3, z + 140, 48, 4, 98, colors.pavement)
      if (detailed) {
        const front = facade(x, z + 82)
        front(0, 30, 10, 19, 29, 2, colors.window)
        front(-4, 34, 12, 5, 16, 1, colors.glass)
        front(6, 26, 13, 2, 9, 2, colors.cream)
        front(0, 7, 16, 40, 5, 25, colors.cream)
        if (kind === 'shop' || kind === 'clinic') {
          for (const sign of [-1, 1]) {
            front(sign * 69, 33, 3, 76, 43, 6, colors.wood)
            front(sign * 69, 34, 7, 68, 34, 3, colors.window)
            front(sign * 69 - 21, 39, 9, 5, 20, 1, colors.glass)
            front(sign * 69, 22, 10, 68, 3, 5, colors.cream)
            for (let i = 0; i < 3; i++) {
              front(
                sign * 69 - 23 + i * 22,
                29,
                11,
                11,
                10 + i * 3,
                3,
                kind === 'shop' ? roofs[(variant + i) % roofs.length] : colors.pavement
              )
            }
            front(sign * 69, 34, 13, 3, 34, 3, colors.cream)
          }
        } else {
          front(0, 56, 18, 58, 5, 34, colors.window)
          for (const dx of [-22, 22]) front(dx, 33, 27, 4, 43, 4, colors.cream)
        }
      }
      if (kind === 'shop') {
        for (let i = 0; i < 8; i++) {
          box(
            x - 112 + i * 32,
            62,
            z + 95,
            32,
            7,
            32,
            i % 2 ? colors.cream : roofs[variant % roofs.length]
          )
        }
        if (detailed) {
          for (let i = 0; i < 8; i++) {
            box(
              x - 112 + i * 32,
              57,
              z + 110,
              32,
              9,
              3,
              i % 2 ? colors.cream : roofs[variant % roofs.length]
            )
          }
          shopGoods(x + 53, z + 113, variant)
          for (const dx of [-113, 113]) {
            box(x + dx, 53, z + 97, 3, 14, 3, colors.window)
            box(x + dx, 47, z + 90, 3, 3, 17, colors.window)
          }
          // A side vending machine: display, selection buttons, coin slot, collection tray.
          const machine = facade(x + width / 2 + 4, z + 54, true)
          machine(0, 29, 13, 32, 56, 24, roofs[variant % roofs.length])
          machine(0, 59, 13, 34, 4, 26, colors.cream)
          machine(-3, 39, 26, 21, 29, 2, colors.window)
          for (const y of [31, 43]) {
            for (const u of [-10, -3, 4]) {
              machine(u, y, 28, 4, 8, 2, u === -3 ? colors.sand : colors.glass)
              machine(u, y - 6, 28, 4, 2, 2, colors.cream)
            }
          }
          machine(11, 31, 27, 3, 9, 2, colors.ink)
          machine(0, 12, 26, 21, 8, 2, colors.ink)
          machine(0, 8, 29, 23, 2, 5, colors.curb)
          for (const dx of [-54, 54]) box(x + dx, height + 30, z, 5, 25, 5, colors.window)
          box(x - 81, 18, z + 151, 28, 34, 6, colors.wood)
          box(x - 81, 20, z + 155, 22, 24, 2, colors.window)
          for (const dy of [14, 21, 28]) box(x - 81, dy, z + 157, 14, 2, 1, colors.cream)
        }
        box(x, height + 43, z, 150, 38, 12, roofs[variant % roofs.length])
        for (const dx of [-42, 0, 42]) box(x + dx, height + 43, z + 7, 22, 8, 2, colors.cream)
        flowerbed(x + 78, z + 148)
      } else if (kind === 'clinic') {
        box(x, height + 46, z, 66, 50, 12, colors.cream)
        box(x, height + 46, z + 7, 34, 10, 3, colors.flower)
        box(x, height + 46, z + 7, 10, 34, 3, colors.flower)
        box(x, 60, z + 101, 94, 7, 36, colors.water)
        if (detailed) {
          const front = facade(x, z + 82)
          front(-113, 52, 17, 5, 4, 32, colors.window)
          front(-113, 35, 32, 24, 34, 5, colors.pavement)
          front(-113, 35, 36, 15, 5, 2, colors.flower)
          front(-113, 35, 36, 5, 15, 2, colors.flower)
          front(24, 42, 4, 13, 18, 3, colors.window)
          for (const y of [37, 42, 47]) front(24, y, 6, 8, 2, 1, colors.cream)
          for (const dx of [-37, 37]) planter(x + dx, z + 133, colors.cream)
          for (const dx of [-29, 29]) {
            box(x + dx, 19, z + 146, 3, 32, 3, colors.window)
            box(x + dx, 35, z + 141, 3, 3, 38, colors.cream)
          }
        }
      }
    }

    function townhouse(variant: number) {
      // Narrow adjoining homes have separate doors, stepped cornices and twin gables.
      for (const side of [-1, 1]) {
        const x = side * 57
        const height = side === -1 ? 144 : 168
        const tint = side === -1 ? colors.brick : colors.sand
        const roof = roofs[(variant + (side === -1 ? 0 : 1)) % roofs.length]
        box(x, 6, 0, 114, 12, 162, colors.curb)
        box(x, height / 2 + 12, 0, 110, height, 150, tint)
        box(x, height + 15, 0, 116, 6, 160, colors.cream)
        part('roof', x, height + 18, 0, 116, 48, 164, roof)
        part('gable', x, height + 18, 83, 106, 43, 3, tint)
        box(x, height + 33, 86, 18, 16, 3, colors.window)
        for (const dx of [-49, 49]) box(x + dx, height / 2 + 12, 77, 6, height, 4, colors.cream)
        windowDetail(x, 109, 76, false, true, variant)
        windowDetail(x - 23, 49, 76, false, false, variant + 1)
        box(x + 28, 35, 78, 28, 50, 5, colors.cream)
        box(x + 28, 35, 82, 21, 44, 3, colors.door)
        box(x + 28, 47, 84, 13, 13, 2, colors.glass)
        box(x + 28, 65, 89, 38, 5, 26, roof)
        box(x + 28, 5, 101, 35, 10, 36, colors.pavement)
        box(x + 28, 2, 131, 31, 4, 28, colors.pavement)
        if (detailed) {
          brickwork(x, 75, 110, height)
          planter(x - 28, 111, colors.flower)
          box(x + 33, 31, 85, 3, 3, 2, colors.sand)
        }
      }
      for (const z of [-42, 22]) windowDetail(112, 109, z, true)
      box(85, 202, -38, 20, 56, 23, colors.brick)
      box(85, 232, -38, 26, 6, 29, colors.cream)
    }

    function specialtyShop(kind: 'cafe' | 'florist' | 'workshop', label: string) {
      const cafe = kind === 'cafe'
      const florist = kind === 'florist'
      const width = 224
      const height = cafe ? 98 : florist ? 82 : 118
      const tint = cafe ? colors.brick : florist ? colors.cream : colors.wood
      const accent = cafe ? colors.flower : florist ? colors.hedge : colors.window
      box(14, 1, 16, width + 36, 1, 188, colors.shadow)
      box(0, 6, 0, width + 12, 12, 162, colors.curb)
      box(0, height / 2 + 12, 0, width, height, 150, tint)
      box(0, height + 16, 0, width + 20, 8, 168, colors.cream)
      if (cafe) {
        part('roof', 0, height + 20, 0, width + 24, 64, 174, roofs[3])
        part('gable', 0, height + 20, 88, width + 12, 58, 3, colors.cream)
        box(-72, height + 66, -30, 24, 58, 26, colors.brick)
        box(-72, height + 97, -30, 30, 6, 32, colors.cream)
      } else if (florist) {
        // The raised glasshouse roof reads clearly even when fine detail is hidden.
        box(0, height + 23, 0, width + 10, 6, 158, accent)
        part('gable', 0, height + 26, 0, 154, 40, 126, colors.glass)
        box(0, height + 67, 0, 5, 4, 130, colors.cream)
        const slope = Math.atan2(40, 77)
        for (const z of [-64, -32, 0, 32, 64]) {
          for (const side of [-1, 1]) {
            box(side * 38.5, height + 47, z, Math.hypot(77, 40), 4, 4, colors.cream, -side * slope)
          }
        }
      } else {
        box(0, height + 24, 0, width + 24, 10, 174, colors.window)
        parapet(0, height + 33, 0, width + 20, 170)
        roofEquipment(-64, height + 30, -26)
        box(77, height + 53, -40, 16, 52, 16, colors.brick)
        box(77, height + 81, -40, 24, 6, 24, colors.ink)
      }
      const front = facade(0, 75)
      const doorX = cafe || florist ? 63 : -76
      front(doorX, 39, 3, 35, 58, 5, colors.cream)
      front(doorX, 39, 7, 27, 50, 3, colors.door)
      front(doorX, 48, 10, 19, 23, 2, colors.glass)
      front(doorX + 8, 32, 11, 3, 3, 2, colors.sand)
      box(doorX, 5, 100, 43, 10, 40, colors.pavement)
      if (cafe || florist) {
        front(-35, 45, 3, 112, 57, 6, colors.cream)
        front(-35, 45, 7, 103, 48, 3, colors.window)
        for (const dx of [-69, -35, -1]) {
          front(dx, 49, 10, 23, 31, 2, colors.glass)
          front(dx + 15, 45, 12, 4, 50, 3, colors.cream)
        }
        for (let i = 0; i < 7; i++) {
          const awning = i % 2 ? colors.cream : accent
          front(-96 + i * 32, 81, 19, 32, 7, 42, awning)
          front(-96 + i * 32, 75, 39, 32, 10, 4, awning)
        }
        windowDetail(112, 52, -30, true)
        windowDetail(112, 52, 28, true)
      } else {
        // A wide roller door, clerestory windows and a workbench distinguish the workshop.
        front(25, 45, 3, 120, 70, 6, colors.cream)
        front(25, 45, 7, 110, 62, 3, colors.curb)
        for (let y = 20; y < 76; y += 9) front(25, y, 10, 108, 2, 2, colors.window)
        for (const dx of [-76, -26, 24, 74]) {
          front(dx, 106, 3, 36, 17, 4, colors.cream)
          front(dx, 106, 6, 29, 11, 2, colors.glass)
        }
        box(29, 30, 117, 96, 6, 29, colors.wood)
        for (const dx of [-10, 68]) box(dx, 14, 117, 5, 28, 24, colors.window)
        for (const dx of [0, 19, 38]) box(dx, 37, 117, 14, 8, 19, colors.sand)
        if (detailed) wallUtilities(112, 0)
      }
      sign(label, cafe ? 143 : florist ? 111 : 154, cafe ? 92 : 84, accent, 2)
      if (florist) {
        for (const x of [-83, -42, -1, 100]) {
          planter(x, 121, x === -42 ? colors.sand : colors.flower)
        }
        flowerbed(-46, 154)
      } else if (cafe) {
        for (const x of [-66, 99]) {
          part('disc', x, 32, 132, 35, 5, 35, colors.cream)
          box(x, 16, 132, 5, 32, 5, colors.window)
          for (const dz of [-23, 23]) {
            box(x, 16, 132 + dz, 19, 5, 18, colors.wood)
            for (const dx of [-6, 6]) box(x + dx, 7, 132 + dz, 3, 14, 14, colors.window)
          }
          if (detailed) {
            box(x, 38, 132, 7, 7, 7, colors.pavement)
            box(x, 42, 132, 5, 1, 5, colors.door)
          }
        }
        if (detailed) brickwork(0, 75, width, height)
      }
    }

    function cottage(variant: number) {
      const accent = roofs[variant % roofs.length]
      // A low, broad porch and a steep roof give the cottages a distinct silhouette.
      box(12, 1, 15, 218, 1, 194, colors.shadow)
      box(0, 6, 0, 176, 12, 146, colors.curb)
      box(0, 48, 0, 164, 78, 134, variant % 2 ? colors.sand : colors.brick)
      part('roof', 0, 89, 0, 192, 92, 160, accent)
      part('gable', 0, 90, 81, 178, 83, 3, colors.cream)
      windowDetail(0, 124, 84, false, false, variant)
      for (const x of [-52, 52]) windowDetail(x, 49, 68, false, true, variant)
      windowDetail(83, 48, 0, true)
      box(0, 34, 71, 27, 51, 6, colors.door)
      box(0, 45, 75, 17, 20, 2, colors.glass)
      box(8, 30, 76, 3, 3, 2, colors.sand)
      box(0, 8, 108, 188, 12, 72, colors.wood)
      box(0, 4, 154, 45, 8, 22, colors.pavement)
      box(0, 81, 105, 196, 8, 84, accent, 0, 0.12)
      for (const x of [-84, 84]) {
        box(x, 45, 135, 7, 74, 7, colors.cream)
        box(x, 30, 107, 5, 5, 55, colors.cream)
        for (const z of [87, 105, 123]) box(x, 21, z, 4, 22, 4, colors.cream)
      }
      box(-47, 143, -34, 22, 66, 24, colors.brick)
      box(-47, 178, -34, 29, 6, 31, colors.cream)
      if (detailed) {
        for (let x = -84; x <= 84; x += 14) box(x, 15, 108, 1, 1, 66, colors.sand)
        planter(-55, 137, colors.flower)
        planter(55, 137, colors.sand)
        wallUtilities(83, -31)
      }
    }

    function civicShop(
      kind: 'post-office' | 'cinema' | 'fire-station' | 'market',
      variant: number
    ) {
      const cinema = kind === 'cinema'
      const fireStation = kind === 'fire-station'
      const market = kind === 'market'
      const height = cinema ? 158 : fireStation ? 128 : market ? 82 : 108
      const accent = cinema ? roofs[variant % roofs.length] : market ? colors.hedge : colors.flower
      box(14, 1, 18, 270, 1, 210, colors.shadow)
      box(0, 6, 0, 248, 12, 166, colors.curb)
      box(0, height / 2 + 12, 0, 236, height, 154, fireStation ? colors.brick : colors.cream)
      box(0, height + 17, 0, 252, 10, 170, accent)
      const front = facade(0, 78)
      if (market) {
        // Three individual pitched bays and open produce stalls under a striped canopy.
        for (const x of [-78, 0, 78]) {
          part('roof', x, height + 22, 0, 80, 44, 176, roofs[(variant + 1) % roofs.length])
          part('gable', x, height + 22, 89, 74, 38, 3, colors.sand)
          front(x, 46, 3, 64, 57, 5, colors.window)
          box(x, 27, 115, 65, 12, 32, colors.wood)
          shopGoods(x - 16, 113, variant + (x === 0 ? 1 : 0))
        }
        for (let i = 0; i < 10; i++) {
          const tint = i % 2 ? colors.cream : accent
          front(-108 + i * 24, 78, 29, 24, 7, 65, tint)
          front(-108 + i * 24, 70, 60, 24, 13, 4, tint)
        }
        for (const x of [-115, 115]) box(x, 39, 135, 5, 78, 5, colors.wood)
        sign('MARKET', 142, 88, accent, 2)
      } else if (fireStation) {
        // Twin engine bays and a square hose tower distinguish the fire station.
        for (const x of [-66, 27]) {
          front(x, 46, 3, 83, 81, 5, colors.cream)
          front(x, 44, 7, 73, 71, 3, colors.flower)
          for (let y = 18; y <= 72; y += 11) front(x, y, 10, 70, 2, 2, colors.brick)
          front(x, 64, 11, 56, 17, 2, colors.window)
          for (const dx of [-18, 0, 18]) front(x + dx, 65, 13, 12, 11, 2, colors.glass)
          box(x, 2, 126, 83, 4, 90, colors.pavement)
        }
        box(81, 115, -40, 68, 230, 68, colors.brick)
        box(81, 234, -40, 80, 9, 80, colors.cream)
        windowDetail(81, 194, -5)
        windowDetail(116, 194, -40, true)
        front(92, 39, 4, 24, 56, 6, colors.door)
        sign('FIRE', 115, 86, accent, 2)
      } else if (cinema) {
        box(0, height + 30, 0, 152, 20, 165, accent)
        box(0, height + 47, 0, 76, 14, 159, colors.cream)
        for (const x of [-96, 96]) {
          front(x, 92, 3, 13, 160, 8, accent)
          front(x / 1.6, 48, 6, 44, 59, 4, colors.window)
          front(x / 1.6, 48, 9, 36, 51, 2, colors.sand)
          front(x / 1.6, 55, 11, 24, 21, 2, accent)
          front(x / 1.6, 33, 11, 25, 4, 2, colors.cream)
        }
        front(0, 37, 4, 56, 60, 5, colors.window)
        for (const x of [-14, 14]) front(x, 42, 8, 22, 38, 2, colors.glass)
        front(0, 37, 10, 4, 60, 3, colors.cream)
        box(0, 86, 108, 220, 13, 65, accent)
        sign('CINEMA', 105, 141, accent, 2)
        for (let x = -100; x <= 100; x += 20) box(x, 80, 142, 5, 5, 4, colors.sand)
        box(0, 3, 122, 98, 6, 80, colors.brick)
      } else {
        part('roof', 0, height + 22, 0, 256, 48, 174, roofs[3])
        for (const x of [-75, 75]) windowDetail(x, 58, 78, false, false, variant)
        front(0, 39, 4, 40, 58, 6, colors.window)
        front(0, 42, 8, 30, 43, 3, colors.glass)
        front(0, 39, 11, 3, 58, 3, colors.cream)
        box(0, 76, 100, 66, 6, 43, accent)
        box(0, 5, 114, 60, 10, 64, colors.pavement)
        // A freestanding red posting box and a rooftop envelope emblem.
        box(90, 26, 125, 27, 52, 25, accent)
        box(90, 54, 125, 33, 7, 29, colors.cream)
        box(90, 42, 139, 18, 4, 2, colors.ink)
        box(0, 174, 0, 65, 39, 8, colors.cream)
        for (const side of [-1, 1]) box(side * 14, 174, 6, 35, 4, 3, accent, side * 0.5)
        sign('POST', 101, 87, accent, 2)
      }
      windowDetail(119, 55, -35, true)
      if (detailed) {
        if (fireStation) brickwork(119, 0, 154, height, true)
        if (cinema || fireStation) {
          parapet(0, height + 26, 0, 244, 162)
          roofEquipment(-60, height + 23, -32)
        }
        wallUtilities(119, 28)
      }
    }

    function park(x: number, z: number, variant: number) {
      part('ground', x, 2, z, 310, 2, 310, variant % 2 ? 0x8ada74 : colors.grass)
      box(x, 3, z, 30, 2, 310, colors.sand)
      box(x, 3, z + 55, 310, 2, 26, colors.sand)
      if (variant % 3 === 0) {
        // Stepped banks keep the pond on the same pixel grid as the trees.
        box(x - 58, 3, z - 48, 148, 3, 122, colors.sand)
        box(x - 58, 5, z - 48, 126, 2, 96, colors.water)
        box(x - 58, 5, z - 48, 152, 2, 50, colors.water)
        for (const dx of [-32, 18])
          box(x - 58 + dx, 7, z - 43 + dx, 35, 1, 5, colors.waterHighlight)
      } else if (variant % 3 === 1) {
        box(x - 65, 4, z - 52, 110, 5, 110, colors.sand)
        for (const dx of [-102, -28]) box(x + dx, 43, z - 45, 7, 80, 7, colors.wood)
        box(x - 65, 85, z - 45, 90, 7, 9, colors.flower)
        for (const dx of [-79, -51]) box(x + dx, 56, z - 45, 3, 54, 3, colors.ink)
        box(x - 65, 29, z - 45, 38, 6, 22, colors.water)
      } else {
        flowerbed(x - 70, z - 70)
        flowerbed(x - 70, z - 18)
      }
      tree(x + 88, z - 78, 0.85)
      tree(x - 92, z + 110, 0.7)
      bench(x + 88, z + 100)
    }

    function school(x: number, z: number) {
      box(x, 65, z, 422, 130, 146, colors.cream)
      box(x, 135, z, 442, 10, 166, roofs[0])
      for (const y of [40, 94]) {
        for (let dx = -174; dx <= 174; dx += 58) {
          windowDetail(x + dx, y, z + 73)
        }
        for (const dz of [-45, 0, 45]) windowDetail(x + 211, y, z + dz, true)
      }
      if (detailed) {
        roofSurface(x, 140.5, z, 420, 146)
        parapet(x, 145, z, 434, 158)
        roofEquipment(x - 126, 141, z - 20)
        roofEquipment(x + 126, 141, z - 20)
        for (const y of [16, 67, 121]) {
          box(x, y, z + 74, 422, 4, 4, colors.curb)
          box(x + 212, y, z, 4, 4, 146, colors.curb)
        }
        for (const dx of [-203, -116, 116, 203]) box(x + dx, 65, z + 75, 6, 128, 5, colors.pavement)
      }
      box(x, 84, z + 95, 78, 168, 50, colors.brick)
      box(x, 172, z + 95, 92, 10, 64, colors.cream)
      box(x, 132, z + 122, 34, 34, 4, colors.cream)
      box(x, 139, z + 125, 4, 17, 2, colors.ink)
      box(x + 6, 131, z + 125, 15, 4, 2, colors.ink)
      box(x, 28, z + 122, 36, 56, 5, colors.door)
      box(x, 2, z + 157, 68, 4, 65, colors.pavement)
      if (detailed) {
        brickwork(x, z + 120, 78, 162)
        brickwork(x + 39, z + 95, 50, 162, true)
        for (const sign of [-1, 1]) {
          for (let y = 9; y < 165; y += 13) {
            box(x + sign * 35, y, z + 122, y % 2 ? 10 : 7, 9, 5, colors.cream)
          }
          planter(x + sign * 52, z + 130, colors.flower)
          box(x + sign * 47, 22, z + 157, 3, 40, 3, colors.window)
          box(x + sign * 47, 43, z + 148, 3, 3, 38, colors.cream)
        }
        const notice = facade(x + 96, z + 106)
        for (const dx of [-16, 16]) notice(dx, 14, 3, 3, 28, 4, colors.wood)
        notice(0, 35, 3, 43, 31, 5, colors.wood)
        notice(0, 35, 6, 36, 24, 2, colors.window)
        for (const dx of [-10, 2, 12]) {
          notice(dx, 35, 8, 8, 16, 1, colors.cream)
          notice(dx, 39, 9, 5, 2, 1, colors.flower)
        }
        for (const dy of [-12, 12]) box(x, 132 + dy, z + 125, 3, 3, 2, colors.ink)
        for (const dx of [-12, 12]) box(x + dx, 132, z + 125, 3, 3, 2, colors.ink)
        for (const dx of [-9, 9]) box(x + dx, 35, z + 126, 12, 23, 2, colors.window)
        box(x, 28, z + 128, 3, 56, 3, colors.cream)
        box(x, 67, z + 123, 56, 9, 3, colors.cream)
        for (const dx of [-18, -9, 0, 9, 18]) box(x + dx, 67, z + 125, 4, 4, 1, colors.window)
        box(x, 8, z + 132, 57, 8, 21, colors.curb)
        box(x, 4, z + 144, 65, 4, 12, colors.cream)
      }
    }

    const glyphs: Record<string, string> = {
      A: '01110/10001/10001/11111/10001/10001/10001',
      B: '11110/10001/10001/11110/10001/10001/11110',
      C: '01111/10000/10000/10000/10000/10000/01111',
      D: '11110/10001/10001/10001/10001/10001/11110',
      E: '11111/10000/10000/11110/10000/10000/11111',
      F: '11111/10000/10000/11110/10000/10000/10000',
      G: '01111/10000/10000/10111/10001/10001/01111',
      H: '10001/10001/10001/11111/10001/10001/10001',
      I: '11111/00100/00100/00100/00100/00100/11111',
      K: '10001/10010/10100/11000/10100/10010/10001',
      L: '10000/10000/10000/10000/10000/10000/11111',
      M: '10001/11011/10101/10101/10001/10001/10001',
      N: '10001/11001/11001/10101/10011/10011/10001',
      O: '01110/10001/10001/10001/10001/10001/01110',
      P: '11110/10001/10001/11110/10000/10000/10000',
      R: '11110/10001/10001/11110/10100/10010/10001',
      S: '01111/10000/10000/01110/00001/00001/11110',
      T: '11111/00100/00100/00100/00100/00100/00100',
      U: '10001/10001/10001/10001/10001/10001/01110',
      W: '10001/10001/10001/10101/10101/11011/10001',
      Y: '10001/10001/01010/00100/00100/00100/00100',
      "'": '00100/00100/01000/00000/00000/00000/00000'
    }
    function sign(text: string, y: number, z: number, tint = colors.flower, pixel = 3) {
      const width = (text.length * 6 + 2) * pixel
      box(0, y, z, width + 8, pixel * 11, 7, colors.curb)
      box(0, y + 1, z + 4, width, pixel * 9, 3, colors.cream)
      for (let i = 0; i < text.length; i++) {
        const rows = glyphs[text[i]]?.split('/') ?? []
        rows.forEach((row, dy) => {
          for (let dx = 0; dx < row.length; dx++) {
            if (row[dx] === '1')
              box(
                (i * 6 + dx - text.length * 3 + 1) * pixel,
                y + (3 - dy) * pixel,
                z + 7,
                pixel,
                pixel,
                2,
                tint
              )
          }
        })
      }
    }
    function fence(width: number, depth: number) {
      for (const side of [-1, 1]) {
        box((side * width) / 2, 23, 0, 5, 7, depth, colors.cream)
        for (let z = -depth / 2; z <= depth / 2; z += 20)
          box((side * width) / 2, 20, z, 6, 40, 6, colors.cream)
        box(side * (width / 4 + 15), 23, depth / 2, width / 2 - 30, 7, 5, colors.cream)
      }
      for (let x = -width / 2; x <= width / 2; x += 20) {
        if (Math.abs(x) > 30) box(x, 20, depth / 2, 6, 40, 6, colors.cream)
      }
    }

    box(2000, -246, -1000, 60000, 8, 60000, colors.ocean)
    part('land', 0, 0, 0, 1, 1, 1, colors.grass)
    for (const [index, { x, north, south, beach }] of coastColumns.entries()) {
      const center = (north + south) / 2
      const depth = south - north
      // The submerged shelf, narrow beach, rock strata and grassy rim all follow
      // the same irregular coast, including the sides of the coves.
      box(x, -238, center, coastStep + 260, 6, depth + 290, colors.shallows)
      box(x, -227, center, coastStep + 120, 16, depth + 150, colors.sand)
      box(x, -172, center, coastStep, 102, depth, colors.wood)
      box(x, -84, center, coastStep, 74, depth, colors.brick)
      box(x, -25, center, coastStep, 44, depth, colors.sand)
      // Keep the rim below the grass at y = -1 so their top faces never coincide.
      box(x, -6, center, coastStep, 8, depth, colors.hedge)
      // A broad southern beach and low sandy terraces bring the shore near town.
      box(x, -238, south + beach / 2, coastStep + 100, 6, beach + 220, colors.shallows)
      box(x, -227, south + beach / 2, coastStep, 16, beach, colors.sand)
      box(x, -218, south + beach - 18, coastStep, 2, 32, 0xdab878)
      box(x - 8, -235, south + beach + 30, 68, 2, 7, colors.waterHighlight)
      if (beach > 290) {
        for (let step = 0; step < 5; step++)
          box(x, -35 - step * 45, south + step * 34, coastStep, 45, 78, colors.sand)
        box(x + 19, -218, south + beach * 0.72, 24, 2, 4, colors.cream)
      }
      for (const edge of [north, south]) {
        const direction = edge === north ? -1 : 1
        box(x + 12, -91, edge + direction * 2, 38, 7, 5, colors.wood)
        box(x - 20, -154, edge + direction * 2, 52, 5, 5, colors.sand)
        box(x - 9, -218, edge + direction * 85, 63, 2, 6, colors.waterHighlight)
        if (index % 5 === 0 && (edge === north || beach < 180)) {
          box(x + 26, -221, edge + direction * 190, 34, 38, 28, colors.treeOutline)
          box(x + 22, -201, edge + direction * 190, 29, 4, 24, colors.curb)
        }
      }
    }
    // Sparse broken wave crests give the open sea texture at the widest zoom.
    for (let i = 0; i < 1800; i++) {
      const seed = hashSlug(`sea:${i}`)
      const x = -14000 + (seed % 30000)
      const z = -13000 + ((seed >>> 12) % 28000)
      box(x, -240, z, 24 + (seed % 54), 1, 4, colors.shallows)
    }
    for (const hill of onettHills) {
      const point = onettToTown(hill.x, hill.y)
      offsetX = point.x
      offsetZ = point.z
      box(0, hill.height / 2, 0, hill.width, hill.height, hill.depth, colors.brick)
      for (let x = -hill.width / 2; x < hill.width / 2; x += 24) {
        box(x, hill.height / 2, hill.depth / 2 + 2, 12, hill.height - 12, 6, colors.sand)
        for (let y = 12; y < hill.height; y += 20)
          box(x + 6, y, hill.depth / 2 + 6, 12, 3, 3, colors.wood)
      }
      box(0, hill.height, 0, hill.width + 12, 12, hill.depth + 12, colors.hedge)
      part('ground', 0, hill.height + 8, 0, hill.width, 4, hill.depth, colors.grass)
    }
    offsetX = offsetZ = 0
    for (const road of onettRoads) {
      for (const [extra, y, tint] of road.trail
        ? [[0, 0.5, colors.sand]]
        : [
            [36, 0.5, colors.pavement],
            [0, 1.5, colors.road]
          ]) {
        const width = road.width + extra
        for (let i = 1; i < road.points.length; i++) {
          const previous = road.points[i - 1]
          const point = road.points[i]
          const dx = point.x - previous.x
          const dz = point.z - previous.z
          offsetX = (point.x + previous.x) / 2
          offsetZ = (point.z + previous.z) / 2
          yaw = Math.atan2(dx, dz)
          box(0, y, 0, width, 1, Math.hypot(dx, dz) + width, tint)
        }
      }
      if (!road.trail) {
        for (let i = 1; i < road.points.length; i++) {
          const a = road.points[i - 1]
          const b = road.points[i]
          const length = Math.hypot(b.x - a.x, b.z - a.z)
          yaw = Math.atan2(b.x - a.x, b.z - a.z)
          for (let distance = 40; distance < length; distance += 95) {
            offsetX = a.x + ((b.x - a.x) * distance) / length
            offsetZ = a.z + ((b.z - a.z) * distance) / length
            box(0, 2.2, 0, 3, 0.4, 38, colors.stripe)
          }
        }
      }
      offsetX = offsetZ = yaw = 0
    }

    for (const lot of onettBuildings) {
      offsetX = lot.x
      offsetZ = lot.z
      scale = lot.scale
      const kind = lot.kind
      if (kind === 'house') {
        house(0, 0, lot.variant)
        if (lot.label) sign(lot.label, 10, 200, colors.window, 2)
      } else if (kind === 'townhouse') {
        townhouse(lot.variant)
      } else if (kind === 'cottage') {
        cottage(lot.variant)
      } else if (
        kind === 'post-office' ||
        kind === 'cinema' ||
        kind === 'fire-station' ||
        kind === 'market'
      ) {
        civicShop(kind, lot.variant)
      } else if (kind === 'cafe' || kind === 'florist' || kind === 'workshop') {
        specialtyShop(kind, lot.label ?? kind.toUpperCase())
      } else if (kind === 'city-hall') {
        box(0, 81, 0, 360, 162, 174, colors.cream)
        box(0, 169, 0, 380, 14, 190, colors.curb)
        box(0, 181, 0, 366, 10, 177, colors.pavement)
        for (const x of [-139, -94, 94, 139]) {
          windowDetail(x, 55, 88)
          windowDetail(x, 115, 88)
        }
        box(0, 54, 99, 61, 105, 10, colors.window)
        for (const x of [-65, -31, 31, 65]) {
          box(x, 83, 121, 14, 137, 18, colors.cream)
          box(x, 16, 121, 23, 10, 27, colors.curb)
          box(x, 153, 121, 25, 9, 27, colors.pavement)
        }
        part('gable', 0, 158, 125, 178, 57, 30, colors.cream)
        for (let i = 0; i < 4; i++)
          box(0, 4 + i * 4, 158 - i * 10, 190 - i * 10, 8, 25, colors.pavement)
        sign('TOWN HALL', 184, 144, colors.flower, 2)
        flowerbed(-115, 140)
        flowerbed(115, 140)
      } else if (kind === 'library' || kind === 'police') {
        school(0, 0)
        if (lot.label) sign(lot.label, 146, 126, colors.window, 2)
        fence(480, 370)
      } else {
        building(
          0,
          0,
          kind === 'hotel' || kind === 'apartment'
            ? 'apartment'
            : kind === 'hospital' || kind === 'office'
              ? 'office'
              : 'shop',
          lot.variant
        )
        if (lot.label) {
          const height = kind === 'hotel' ? 244 : kind === 'hospital' ? 265 : 117
          sign(lot.label, height, 20, kind === 'arcade' ? roofs[0] : colors.flower)
        }
        if (kind === 'burger') {
          box(72, 121, 0, 5, 92, 5, colors.cream)
          part('disc', 72, 166, 0, 74, 12, 62, colors.sand)
          part('disc', 72, 158, 0, 78, 6, 64, colors.hedge)
          part('disc', 72, 152, 0, 74, 7, 62, colors.brick)
          part('disc', 72, 146, 0, 74, 8, 62, colors.sand)
        }
        if (kind === 'arcade') {
          box(0, 28, -140, 265, 56, 6, colors.flower)
          for (let x = -130; x <= 130; x += 16) box(x, 30, -140, 4, 66, 8, roofs[0])
        }
      }
    }
    offsetX = offsetZ = yaw = 0
    scale = 1

    // Closely spaced, staggered rows make the characteristic scalloped forest edges.
    const planted = new Set<string>()
    function plant(bx: number, by: number, size: number) {
      const key = `${Math.round(bx / 40)}:${Math.round(by / 40)}`
      if (planted.has(key)) return
      const point = onettToTown(bx, by)
      const coast = coastColumns[Math.round((point.x - coastColumns[0].x) / coastStep)]
      if (!coast || point.z < coast.north + 60 || point.z > coast.south - 60) return
      if (nearestTownRoad(point, onettRoads).distance < 54 * size) return
      if (
        onettBuildings.some(
          (lot) =>
            Math.abs(point.x - lot.x) < 220 * lot.scale &&
            Math.abs(point.z - lot.z) < 220 * lot.scale
        )
      )
        return
      let elevation = 0
      for (const hill of onettHills) {
        const center = onettToTown(hill.x, hill.y)
        const dx = Math.abs(point.x - center.x) - hill.width / 2
        const dz = Math.abs(point.z - center.z) - hill.depth / 2
        if (dx > 60 || dz > 60) continue
        if (dx > -60 || dz > -60) return
        elevation = Math.max(elevation, hill.height + 10)
      }
      planted.add(key)
      tree(point.x, point.z, size, elevation)
    }
    for (const grove of onettGroves) {
      const townEdge = grove.x < 0 || grove.x > 3000 || grove.y > 2300
      let row = 0
      for (let y = -grove.ry; y <= grove.ry; y += 54, row++) {
        for (let x = -grove.rx; x <= grove.rx; x += 67) {
          if ((x / grove.rx) ** 2 + (y / grove.ry) ** 2 > 1) continue
          if (townEdge && hashSlug(`grove:${grove.x}:${x}:${y}`) % 100 < 48) continue
          plant(grove.x + x + (row % 2) * 28, grove.y + y, 0.88)
        }
      }
    }
    for (let i = 0; i < 520; i++) {
      const seed = hashSlug(`onett-tree:${i}`)
      const bx = -200 + (seed % 3500)
      const by = -350 + ((seed >>> 12) % 2750)
      plant(bx, by, 0.6 + (seed % 4) * 0.08)
    }
    // Alternate woodland pockets with open meadows and wildflower patches.
    // These details are outside the streets; keep them out of resident raycasts.
    distantForest = true
    for (const [column, { x, north, south }] of coastColumns.entries()) {
      for (let z = north + 85, row = 0; z < south - 85; z += 88, row++) {
        const seed = hashSlug(`forest:${column}:${row}`)
        const px = x + (seed % 35) - 17
        const pz = z + ((seed >>> 8) % 29) - 14
        const by = (pz + 1595) / Math.SQRT2
        const bx = px - by + 445
        const fringe = Math.sin(by / 210) * 80 + Math.sin(bx / 290) * 65
        if (bx > -400 + fringe && bx < 3390 + fringe && by > -380 + fringe && by < 2570 + fringe)
          continue
        const woodland = Math.sin(px / 720) + Math.cos(pz / 590) + Math.sin((px + pz) / 310) * 0.45
        if (woodland > 0.65 && seed % 100 < 72 && pz < south - 220) {
          plant(bx, by, 0.65 + ((seed >>> 16) % 6) * 0.07)
          continue
        }
        // Keep the hilltops and northern trails clear of ground-level flowers.
        if (by < -350 || nearestTownRoad({ x: px, z: pz }, onettRoads).distance < 100) continue
        const flowers = Math.sin(px / 410) * Math.cos(pz / 530)
        if (woodland > 0.65 || flowers < 0.25 || seed % 5 === 0) continue
        const tint = [0xffdc74, 0xf08bb1, 0xa99ce5][Math.floor((px + 2500) / 1100) % 3]
        for (let flower = 0; flower < 7; flower++) {
          const scatter = hashSlug(`flowers:${column}:${row}:${flower}`)
          const fx = px + (scatter % 65) - 32
          const fz = pz + ((scatter >>> 8) % 65) - 32
          box(fx, 7, fz, 3, 14, 3, colors.hedge)
          box(fx, 15, fz, 15, 4, 7, tint)
          box(fx, 15, fz, 7, 4, 15, tint)
          box(fx, 18, fz, 5, 2, 5, colors.cream)
        }
      }
    }
    distantForest = false
    // Small civic gardens, bus stops, lamps and signs carry the town's street rhythm.
    for (const [bx, by] of [
      [1260, 1270],
      [2400, 760],
      [1930, 1740]
    ]) {
      const point = onettToTown(bx, by)
      offsetX = point.x
      offsetZ = point.z
      scale = 0.55
      park(0, 0, 2)
    }
    scale = 1
    for (const by of [850, 1450, 2000]) {
      for (let bx = 330; bx < 2800 - (by === 2000 ? 700 : 0); bx += 380) {
        const point = onettToTown(bx, by + 66)
        offsetX = point.x
        offsetZ = point.z
        box(0, 30, 0, 4, 60, 4, colors.window)
        box(0, 63, 0, 22, 22, 5, colors.flower)
        box(0, 63, 4, 12, 4, 2, colors.cream)
        box(100, 47, 0, 5, 94, 5, colors.wood)
        box(110, 94, 0, 24, 5, 5, colors.wood)
        box(120, 90, 0, 15, 8, 14, colors.cream)
      }
    }
    // Keep routes and phases stable across detail rebuilds while models stay local.
    offsetX = offsetZ = yaw = 0
    for (const [roadIndex, road] of onettRoads.entries()) {
      if (road.trail) continue
      for (let segment = 1; segment < road.points.length; segment++) {
        const a = road.points[segment - 1]
        const b = road.points[segment]
        const heading = Math.atan2(b.x - a.x, b.z - a.z)
        const placements = [
          { t: 0.24, lane: -19, kind: 'car' },
          { t: 0.68, lane: 29, kind: 'bicycle' },
          { t: 0.16, lane: 48, kind: 'walker' },
          { t: 0.47, lane: -48, kind: 'walker' },
          { t: 0.79, lane: 48, kind: 'walker' }
        ] as const
        for (const [index, placement] of placements.entries()) {
          if (articles && placement.kind !== 'car') continue
          // The short hospital approach only has room for a pedestrian.
          if (road.width < 78 && index !== 2) continue
          const lane = road.width < 78 ? road.width / 2 + 9 : placement.lane
          const point = {
            x: a.x + (b.x - a.x) * placement.t + Math.cos(heading) * lane,
            z: a.z + (b.z - a.z) * placement.t - Math.sin(heading) * lane
          }
          // Leave intersections clear, including sidewalks crossing another street.
          if (
            nearestTownRoad(
              point,
              onettRoads.filter((other) => other !== road && !other.trail)
            ).distance < 45
          )
            continue
          const variant = roadIndex + segment + index
          const route: TrafficRoute = {
            start: a,
            end: b,
            lane,
            progress: placement.t,
            speed: placement.kind === 'car' ? 54 : placement.kind === 'bicycle' ? 30 : 12
          }
          const key = `${roadIndex}:${segment}:${index}`
          resident = ambientResidents.get(key) ?? {
            route,
            kind: placement.kind,
            scale: placement.kind === 'car' ? 1 : personScale(variant),
            phase: variant * 1.7,
            pose: trafficPose(route, elapsed)
          }
          ambientResidents.set(key, resident)
          residents.push(resident)
          scale = resident.scale
          if (resident.kind === 'car') car(variant)
          else if (resident.kind === 'bicycle') cyclist(variant)
          else person(variant)
        }
      }
    }
    for (const article of articles ?? []) {
      resident = articleResidents.get(article.slug)
      if (!resident) {
        resident = {
          slug: article.slug,
          time: 0,
          route: article.route,
          kind: article.kind,
          scale: personScale(article.variant),
          phase: article.variant * 1.7,
          pose: trafficPose(article.route, 0)
        }
        articleResidents.set(article.slug, resident)
      }
      residents.push(resident)
      scale = resident.scale
      if (resident.kind === 'bicycle') cyclist(article.variant)
      else person(article.variant)
    }
    resident = undefined
    offsetX = offsetZ = yaw = 0
    for (const collection of [parts, forestParts]) {
      for (const shape of [
        'box',
        'ground',
        'land',
        'roof',
        'gable',
        'tree',
        'disc',
        'wheel'
      ] as const) {
        const items = collection[shape] ?? []
        if (!items.length) continue
        const mesh = new InstancedMesh(
          geometries[shape],
          shape === 'ground' || shape === 'land'
            ? grassMaterial
            : shape === 'roof'
              ? roofMaterial
              : material,
          items.length
        )
        items.forEach((item, index) => {
          transform.position.set(item.x, item.y, item.z)
          transform.rotation.set(item.pitch, item.yaw, item.angle, 'YXZ')
          transform.scale.set(item.width, item.height, item.depth)
          transform.updateMatrix()
          mesh.setMatrixAt(index, transform.matrix)
          mesh.setColorAt(index, color.setHex(item.color))
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        mesh.computeBoundingSphere()
        meshes.push(mesh)
        if (collection === parts) occluders.push(mesh)
        scene.add(mesh)
      }
    }
    for (const shape of ['box', 'person', 'disc', 'wheel'] as const) {
      const items = movingParts[shape] ?? []
      if (!items.length) continue
      const mesh = new InstancedMesh(geometries[shape], material, items.length)
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      // Residents travel outside their initial bounds; let the GPU clip these batches.
      mesh.frustumCulled = false
      items.forEach(({ part }, index) => {
        mesh.setColorAt(index, color.setHex(part.color))
      })
      trafficMeshes.push({ mesh, items })
      traffic.add(mesh)
    }
    navigation = createTownNavigation(obstacles, containsGround)
  }

  function animateTraffic(delta: number) {
    const active = residents.filter(
      (resident) =>
        resident !== dragged?.resident && (!resident.slug || visibleSlugs?.has(resident.slug))
    )
    const moving = new Set(
      active.filter(
        (resident) =>
          !resident.placed ||
          (delta > 0 &&
            (!resident.slug || resident.slug === selectedSlug || resident.slug !== focusedSlug))
      )
    )
    for (const resident of moving) {
      if (!resident.returning) resident.pose = trafficPose(resident.route, resident.time ?? elapsed)
    }
    avoidTraffic(
      active,
      delta,
      (body) => moving.has(body),
      (point) => navigation.canStand(point)
    )
    for (const resident of active) resident.placed = true
    for (const { mesh, items } of trafficMeshes) {
      items.forEach(({ part, resident }, index) => {
        const { x, z, yaw } = resident.pose
        const cycle =
          (resident.time ?? elapsed) * (resident.kind === 'walker' ? 5 : 7) + resident.phase
        const swing = Math.sin(cycle) * Math.sign(part.x)
        let y = part.y
        let localZ = part.z
        let pitch = part.pitch
        if (part.motion === 'leg' || part.motion === 'arm') {
          const direction = part.motion === 'leg' ? 1 : -1
          const rotation = swing * 0.32 * direction
          const pivotY = (part.motion === 'leg' ? 22 : 36) * resident.scale
          const offsetY = part.y - pivotY
          y = pivotY + offsetY * Math.cos(rotation) - part.z * Math.sin(rotation)
          localZ = offsetY * Math.sin(rotation) + part.z * Math.cos(rotation)
          pitch += rotation
        } else if (part.motion === 'pedal') {
          y += swing * 3 * resident.scale
          localZ += Math.cos(cycle) * Math.sign(part.x) * 3 * resident.scale
        } else if (part.motion === 'wheel') {
          pitch += ((resident.time ?? elapsed) * resident.route.speed) / 9
        }
        transform.position.set(
          x + part.x * Math.cos(yaw) + localZ * Math.sin(yaw),
          y + (resident === dragged?.resident ? liftHeight : 0),
          z - part.x * Math.sin(yaw) + localZ * Math.cos(yaw)
        )
        transform.rotation.set(pitch, yaw, part.angle, 'YXZ')
        const visible = !resident.slug || visibleSlugs?.has(resident.slug)
        transform.scale.set(
          visible ? part.width : 0,
          visible ? part.height : 0,
          visible ? part.depth : 0
        )
        transform.updateMatrix()
        mesh.setMatrixAt(index, transform.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  return {
    beginResidentDrag(slug: string) {
      const resident = articleResidents.get(slug)
      if (!resident) return
      followedSlug = null
      dragged = { resident, pose: { ...resident.pose } }
      trafficDirty = true
    },
    moveResidentDrag(dx: number, dy: number) {
      if (!dragged) return
      const delta = boardToTown(dx / zoom, dy / zoom)
      dragged.resident.pose = {
        ...dragged.resident.pose,
        x: dragged.resident.pose.x + delta.x,
        z: dragged.resident.pose.z + delta.z
      }
      trafficDirty = true
      visibilityTime = -Infinity
    },
    endResidentDrag(cancel = false) {
      if (!dragged) return
      const { resident, pose } = dragged
      if (cancel) {
        resident.pose = pose
      } else {
        const route = nearestResidentRoute(resident.pose, resident.route, navigation.canStand)
        const path = navigation.findPath(resident.pose, trafficPose(route, 0))
        if (path) {
          resident.returning = { path, route }
          resident.avoidance = undefined
          resident.previousPose = undefined
        } else resident.pose = pose
      }
      dragged = null
      trafficDirty = true
      visibilityTime = -Infinity
    },
    select(slug: string | null) {
      selectedSlug = slug
    },
    follow(slug: string | null) {
      followedSlug = slug && visibleSlugs?.has(slug) ? slug : null
    },
    focus(slug: string | null) {
      focusedSlug = slug
    },
    filter(slugs: string[]) {
      visibleSlugs = new Set(slugs)
      if (followedSlug && !visibleSlugs.has(followedSlug)) followedSlug = null
      dirty = true
      visibilityTime = -Infinity
    },
    residentPosition(slug: string) {
      return articleResidents.get(slug)?.pose
    },
    projectResidents(now: number) {
      // Pan and zoom preserve the orthographic viewing direction. Keep occlusion
      // checks on their own cadence, including while the camera follows a resident.
      const checkVisibility = now - visibilityTime >= 180
      if (checkVisibility) {
        visibilityTime = now
        scene.updateMatrixWorld()
      }
      return [...articleResidents.entries()].map(([slug, resident]) => {
        const { x, z } = resident.pose
        const riding = resident.kind === 'bicycle'
        const headHeight = (riding ? 56 : 46) * resident.scale
        const lifted = resident === dragged?.resident
        world.set(x, headHeight + (lifted ? liftHeight : 0), z)
        projected.copy(world).project(camera)
        const px = ((projected.x + 1) * viewport.width) / 2
        const py = ((1 - projected.y) * viewport.height) / 2
        const inView = px >= 0 && px <= viewport.width && py >= 70 && py < viewport.height - 70
        if ((checkVisibility || !visibility.has(slug)) && inView && visibleSlugs?.has(slug)) {
          screen.set(projected.x, projected.y)
          raycaster.setFromCamera(screen, camera)
          raycaster.far = raycaster.ray.origin.distanceTo(world) - 8
          visibility.set(slug, raycaster.intersectObjects(occluders, false).length === 0)
        }
        return {
          slug,
          x: px,
          y: py,
          width: (riding ? 64 : 28) * resident.scale,
          bodyHeight: (headHeight + (riding ? 20 * resident.scale : 0)) / Math.SQRT2,
          footY: (headHeight + (lifted ? liftHeight : 0)) / Math.SQRT2,
          dropAllowed: !lifted || navigation.canStand(resident.pose),
          visible: inView && !!visibleSlugs?.has(slug) && (lifted || visibility.get(slug) === true)
        }
      })
    },
    update(view: BoardView, size: BoardSize) {
      currentView = view
      viewport = size
      zoom = view.zoom
      const nextKey = [view.x, view.y, view.zoom, size.width, size.height].join(':')
      if (nextKey === viewKey) return
      viewKey = nextKey
      dirty = true
      updateTownCamera(camera, view, size)
      const detailed = view.zoom >= 0.45
      const nextBlockKey = `${detailed}`
      if (nextBlockKey !== blockKey) {
        rebuild(detailed)
        blockKey = nextBlockKey
        visibilityTime = -Infinity
      }
      // Use CSS-pixel resolution with MSAA to smooth edges while bounding GPU cost.
      target.setSize(Math.max(1, Math.ceil(size.width)), Math.max(1, Math.ceil(size.height)))
      trafficTarget.setSize(target.width, target.height)
      backdropMaterial.uniforms.texelSize.value.set(1 / target.width, 1 / target.height)
      // Ignore the ordinary depth slope of flat ground at every zoom level.
      const worldPixelSize = size.height / target.height / view.zoom
      backdropMaterial.uniforms.outlineDepth.value =
        Math.max(3, worldPixelSize * 1.5) / (camera.far - camera.near)
    },
    pause() {
      lastTime = undefined
    },
    render(renderer: WebGLRenderer, now: number, motion: boolean) {
      const previousElapsed = elapsed
      if (motion && lastMotion && lastTime !== undefined) {
        elapsed += Math.max(0, Math.min((now - lastTime) / 1000, 0.1))
      }
      const delta = elapsed - previousElapsed
      for (const [slug, resident] of articleResidents) {
        if (
          resident !== dragged?.resident &&
          (resident.slug === selectedSlug || resident.slug !== focusedSlug) &&
          visibleSlugs?.has(slug)
        ) {
          resident.time = (resident.time ?? 0) + delta
          if (resident.returning) {
            if (delta <= 0) continue
            resident.pose = {
              ...resident.pose,
              x: resident.pose.x - (resident.avoidance?.x ?? 0),
              z: resident.pose.z - (resident.avoidance?.z ?? 0)
            }
            let remaining = delta * resident.route.speed
            while (resident.returning.path.length) {
              const next = resident.returning.path[0]
              const dx = next.x - resident.pose.x
              const dz = next.z - resident.pose.z
              const distance = Math.hypot(dx, dz)
              if (distance > remaining) {
                if (remaining > 0)
                  resident.pose = {
                    x: resident.pose.x + (dx * remaining) / distance,
                    z: resident.pose.z + (dz * remaining) / distance,
                    yaw: Math.atan2(dx, dz)
                  }
                break
              }
              resident.pose = { ...next, yaw: Math.atan2(dx, dz) }
              remaining -= distance
              resident.returning.path.shift()
            }
            if (!resident.returning.path.length) {
              resident.route = resident.returning.route
              resident.time = remaining / resident.route.speed
              resident.returning = undefined
            }
          }
        }
      }
      lastTime = now
      lastMotion = motion
      const previousTarget = renderer.getRenderTarget()
      let updateTraffic = dirty || trafficDirty || elapsed !== previousElapsed
      if (updateTraffic) animateTraffic(delta)
      const followed = followedSlug ? articleResidents.get(followedSlug) : undefined
      if (followed) {
        const point = townToBoard(followed.pose.x, followed.pose.z, 28)
        const next = clampTownView(
          {
            x: viewport.width / 2 - point.x * zoom,
            y: viewport.height * 0.56 - point.y * zoom,
            zoom
          },
          viewport
        )
        if (next.x !== currentView.x || next.y !== currentView.y) {
          currentView = next
          viewKey = ''
          dirty = true
          updateTraffic = true
          updateTownCamera(camera, currentView, viewport)
        }
      }
      if (dirty) {
        renderer.setRenderTarget(target)
        renderer.clear()
        renderer.render(scene, camera)
        dirty = false
      }
      if (updateTraffic) {
        trafficDirty = false
        renderer.setRenderTarget(trafficTarget)
        renderer.clear()
        renderer.render(traffic, camera)
      }
      renderer.setRenderTarget(previousTarget)
      renderer.render(backdrop, backdropCamera)
      return currentView
    },
    dispose() {
      for (const mesh of meshes) mesh.dispose()
      for (const { mesh } of trafficMeshes) mesh.dispose()
      for (const geometry of Object.values(geometries)) geometry.dispose()
      material.dispose()
      grassMaterial.dispose()
      roofMaterial.dispose()
      grassTexture.dispose()
      roofTexture.dispose()
      target.dispose()
      trafficTarget.dispose()
      backdropGeometry.dispose()
      backdropMaterial.dispose()
    }
  }
}
