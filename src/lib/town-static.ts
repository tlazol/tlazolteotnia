import { BufferGeometry, Float32BufferAttribute, Group, Mesh, PlaneGeometry } from 'three'
import type { TownLabel } from './town-atlas'
import { type BuildingSpec, buildBuilding, palette, signBoard } from './town-buildings'
import { townHalloween } from './town-halloween'
import type { TownMaterials } from './town-materials'
import { createTownBuilder, face, surface } from './town-mesh-builder'
import type { TownObstacle, TownRoof } from './town-navigation'
import {
  barrel,
  bench,
  bicycleRack,
  busStop,
  crate,
  fence,
  flowerBed,
  gravestone,
  hedge,
  hydrant,
  jackOLantern,
  mailbox,
  rockCluster,
  streetLamp,
  type TreeKind,
  trashBin,
  tree,
  umbrella,
  vending
} from './town-props'
import { carParts } from './town-vehicles'
import {
  boardwalk,
  breakwater,
  carriageway,
  crossings,
  fbm,
  hash2,
  inSand,
  islandDistance,
  lighthouse,
  mulberry32,
  park,
  parkPond,
  pavementHeight,
  pierDeck,
  piers,
  platform,
  quayEdge,
  quayEnd,
  type Rect,
  railEnds,
  railway,
  sidewalk,
  smoothstep,
  station,
  streets,
  summit,
  type TownBlock,
  terrainGrid,
  terrainHeight,
  terrainVertexHeight,
  townBlocks,
  townPavements,
  townRoads,
  waterDistance,
  waterLevel
} from './town-world'

export type TownOccluder = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}
export type TownLampPost = { x: number; y: number; z: number }

const colors = {
  asphalt: 0x707684,
  paving: 0xe8e1d1,
  curb: 0xcbc3b2,
  plaza: 0xf0e4c9,
  lawn: 0x86c766,
  grass: 0x8ccc68,
  forest: 0x6fb05b,
  highland: 0xa8c77a,
  rock: 0xa89c8b,
  slope: 0x77b35d,
  sand: 0xf2e0ae,
  wetSand: 0xdcc593,
  seabed: 0xcbb486,
  dirt: 0xc9a77a,
  line: 0xfbfaf2,
  yellow: 0xf2c94c,
  ballast: 0x9a8f86,
  stone: 0xc9c0ae,
  water: 0x58b8c9,
  track: 0xcc6a52
}

const crops = [0xe9c95b, 0x95d36a, 0xa48bdc, 0xa66f4c, 0x6fb86a, 0xf0c94a, 0xf28aa8, 0xb9db6e]
const fieldGrid = { x: 3520, z: -1760, width: 480, depth: 400, gap: 80, columns: 4, rows: 8 }
const farmyard = { left: 3520, right: 4000, top: -320, bottom: 560 }
const pasture = { column: 1, row: 5 }
const millField = { column: 1, row: 2 }
const orchard = { column: 2, row: 1 }

// A whole plot is left fallow when any corner reaches the beach, so sand never cuts into it.
const beachMargin = -200
const farmedPlots = new Map<number, boolean>()
function farmedPlot(column: number, row: number) {
  if (column < 0 || row < 0 || column >= fieldGrid.columns || row >= fieldGrid.rows) return false
  const key = row * fieldGrid.columns + column
  let farmed = farmedPlots.get(key)
  if (farmed === undefined) {
    const left = fieldGrid.x + column * (fieldGrid.width + fieldGrid.gap)
    const top = fieldGrid.z + row * (fieldGrid.depth + fieldGrid.gap)
    farmed = [left, left + fieldGrid.width].every((x) =>
      [top, top + fieldGrid.depth].every((z) => waterDistance(x, z) <= beachMargin)
    )
    farmedPlots.set(key, farmed)
  }
  return farmed
}

// Fields are coloured into the terrain so that they follow its gentle relief.
export function fieldAt(x: number, z: number) {
  const column = Math.floor((x - fieldGrid.x) / (fieldGrid.width + fieldGrid.gap))
  const row = Math.floor((z - fieldGrid.z) / (fieldGrid.depth + fieldGrid.gap))
  if (column < 0 || row < 0 || column >= fieldGrid.columns || row >= fieldGrid.rows) return null
  const localX = x - fieldGrid.x - column * (fieldGrid.width + fieldGrid.gap)
  const localZ = z - fieldGrid.z - row * (fieldGrid.depth + fieldGrid.gap)
  if (localX > fieldGrid.width || localZ > fieldGrid.depth)
    // Tracks only run alongside farmed plots instead of trailing across the sand.
    return farmedPlot(column, row) || farmedPlot(column + 1, row) || farmedPlot(column, row + 1)
      ? { track: true, column, row }
      : null
  if (x >= farmyard.left && x <= farmyard.right && z >= farmyard.top && z <= farmyard.bottom)
    return null
  if (!farmedPlot(column, row)) return null
  return {
    track: false,
    column,
    row,
    crop: crops[Math.floor(hash2(column * 7 + 3, row * 5 + 1) * crops.length)]
  }
}

function forestDensity(x: number, z: number) {
  return smoothstep(0.38, 0.62, fbm(x / 1500 + 11, z / 1500 - 4, 3))
}

function terrainColor(x: number, z: number, height: number, normalY: number) {
  if (height < waterLevel - 2) return { color: colors.seabed, id: surface.sand }
  const field = fieldAt(x, z)
  if (field && height < 30) {
    if (field.track) return { color: colors.dirt, id: surface.sand }
    if (
      (field.column === pasture.column && field.row === pasture.row) ||
      (field.column === millField.column && field.row === millField.row)
    )
      return { color: colors.lawn, id: surface.grass }
    if (field.column === orchard.column && field.row === orchard.row)
      return { color: 0x9bd16c, id: surface.grass }
    return { color: field.crop ?? colors.grass, id: surface.crops }
  }
  if (!field && inSand(x, z))
    return { color: waterDistance(x, z) > -70 ? colors.wetSand : colors.sand, id: surface.sand }
  if (normalY < 0.5) return { color: colors.rock, id: surface.plain }
  if (normalY < 0.8) return { color: colors.slope, id: surface.grass }
  const forest = forestDensity(x, z) * smoothstep(-200, 200, height - 10 + Math.abs(x) * 0.02)
  const lowland = mixColor(colors.grass, colors.forest, smoothstep(0.25, 0.75, forest))
  return {
    color: mixColor(lowland, colors.highland, smoothstep(450, 750, height)),
    id: surface.grass
  }
}

function mixColor(from: number, to: number, amount: number) {
  const channel = (shift: number) =>
    Math.round(((from >> shift) & 255) * (1 - amount) + ((to >> shift) & 255) * amount)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

export function buildTownStatic(materials: TownMaterials) {
  const b = createTownBuilder(2400, materials.atlas.white)
  const obstacles: TownObstacle[] = []
  const occluders: TownOccluder[] = []
  const roofs: TownRoof[] = []
  const lamps: TownLampPost[] = []

  const solid = (x: number, z: number, halfX: number, halfZ = halfX) =>
    obstacles.push({ left: x - halfX, right: x + halfX, top: z - halfZ, bottom: z + halfZ })
  const plantTree = (
    x: number,
    z: number,
    kind: TreeKind,
    rng: () => number,
    scale = 1,
    lift = 0
  ) => {
    tree(b, x, z, kind, rng, scale, 0, 1, lift)
    solid(x, z, 12 * scale)
  }
  const lamp = (x: number, z: number, yaw: number) => {
    lamps.push(streetLamp(b, x, z, yaw))
    solid(x, z, 8)
  }

  function ground(r: Rect, color: number, id: number, height = 3.2) {
    b.box(
      (r.left + r.right) / 2,
      height / 2,
      (r.top + r.bottom) / 2,
      r.right - r.left,
      height,
      r.bottom - r.top,
      color,
      { surface: id, flat: true }
    )
  }

  function placeBuilding(spec: BuildingSpec, x: number, z: number, yaw: number) {
    let result: ReturnType<typeof buildBuilding> = { height: 0, door: 0, roof: undefined }
    b.frame(x, z, yaw, () => {
      result = buildBuilding(b, spec)
      // Carved pumpkins keep watch on the doorstep: a pair at homes, one elsewhere.
      if (townHalloween && spec.kind !== 'station') {
        const home = spec.kind === 'house' || spec.kind === 'cottage' || spec.kind === 'townhouse'
        for (const side of home ? [-1, 1] : [spec.seed % 2 ? 1 : -1])
          jackOLantern(b, result.door + side * 36, 18, side * -0.3, home ? 0.9 : 1.1)
      }
    })
    const cos = Math.round(Math.cos(yaw))
    const sin = Math.round(Math.sin(yaw))
    const corners = [
      [-spec.width / 2, 0],
      [spec.width / 2, 0],
      [-spec.width / 2, -spec.depth],
      [spec.width / 2, -spec.depth]
    ]
    const toWorld = (lx: number, lz: number) => ({
      x: x + lx * cos + lz * sin,
      z: z - lx * sin + lz * cos
    })
    const bounds = (points: { x: number; z: number }[]) => ({
      left: Math.min(...points.map((point) => point.x)),
      right: Math.max(...points.map((point) => point.x)),
      top: Math.min(...points.map((point) => point.z)),
      bottom: Math.max(...points.map((point) => point.z))
    })
    const { left, right, top, bottom } = bounds(corners.map(([lx, lz]) => toWorld(lx, lz)))
    obstacles.push({ left: left - 14, right: right + 14, top: top - 14, bottom: bottom + 14 })
    const { roof } = result
    occluders.push({
      minX: left,
      maxX: right,
      minY: 0,
      // A flat roof must not hide the residents standing on it.
      maxY: roof?.height ?? result.height,
      minZ: top,
      maxZ: bottom
    })
    if (roof) {
      const box = (lx: number, lz: number, halfX: number, halfZ: number) =>
        bounds([toWorld(lx - halfX, lz - halfZ), toWorld(lx + halfX, lz + halfZ)])
      roofs.push({
        left,
        right,
        top,
        bottom,
        height: roof.height,
        clutter: roof.clutter.map((item) => box(item.x, item.z, item.halfX + 20, item.halfZ + 20))
      })
    }
    return { ...result, doorX: x + result.door * cos, doorZ: z - result.door * sin }
  }

  function parkedCar(x: number, z: number, yaw: number, variant: number) {
    b.frame(
      x,
      z,
      yaw,
      () => {
        for (const item of carParts(variant)) {
          if (item.shape === 'wheel')
            b.cylinder(item.x, item.y, item.z, item.height / 2, item.width, item.color, {
              rz: Math.PI / 2,
              segments: 10
            })
          else
            b.box(item.x, item.y, item.z, item.width, item.height, item.depth, item.color, {
              rx: item.pitch,
              rz: item.angle,
              glow: item.shape === 'light' ? -0.6 : 0
            })
        }
      },
      pavementHeight
    )
    solid(x, z, 42)
  }

  // ── Terrain ────────────────────────────────────────────────────────────────
  function terrain() {
    const { step, x: x0, z: z0, columns, rows } = terrainGrid
    const at = (column: number, row: number) =>
      [x0 + column * step, terrainVertexHeight(column, row), z0 + row * step] as const
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const a = at(column, row)
        const b1 = at(column + 1, row)
        const c = at(column, row + 1)
        const d = at(column + 1, row + 1)
        const deepest = Math.max(a[1], b1[1], c[1], d[1])
        if (deepest < -47 && waterDistance(a[0] + step / 2, a[2] + step / 2) > 500) continue
        const triangles =
          (column + row) % 2
            ? [
                [a, c, b1],
                [b1, c, d]
              ]
            : [
                [a, c, d],
                [a, d, b1]
              ]
        for (const [p, q, r] of triangles) {
          const cx = (p[0] + q[0] + r[0]) / 3
          const cy = (p[1] + q[1] + r[1]) / 3
          const cz = (p[2] + q[2] + r[2]) / 3
          const ux = q[0] - p[0]
          const uy = q[1] - p[1]
          const uz = q[2] - p[2]
          const vx = r[0] - p[0]
          const vy = r[1] - p[1]
          const vz = r[2] - p[2]
          const nx = uy * vz - uz * vy
          const ny = uz * vx - ux * vz
          const nz = ux * vy - uy * vx
          const normalY = Math.abs(ny) / Math.hypot(nx, ny, nz)
          const { color, id } = terrainColor(cx, cz, cy, normalY)
          b.triangle(p, q, r, color, {
            surface: id,
            flat: Math.max(p[1], q[1], r[1]) < 30,
            shade: 0.97 + hash2(cx / 7, cz / 7) * 0.06
          })
        }
      }
    }
  }

  // ── Streets ────────────────────────────────────────────────────────────────
  function streetsAndMarkings() {
    for (const road of townRoads) {
      const horizontal = road.start.z === road.end.z
      const length = Math.hypot(road.end.x - road.start.x, road.end.z - road.start.z)
      const cx = (road.start.x + road.end.x) / 2
      const cz = (road.start.z + road.end.z) / 2
      const along = length + carriageway * 2
      b.box(
        cx,
        0.6,
        cz,
        horizontal ? along : carriageway * 2,
        1.2,
        horizontal ? carriageway * 2 : along,
        colors.asphalt,
        {
          surface: surface.asphalt,
          flat: true
        }
      )
      const ux = (road.end.x - road.start.x) / length
      const uz = (road.end.z - road.start.z) / length
      for (let distance = 230; distance < length - 230; distance += 64) {
        const x = road.start.x + ux * distance
        const z = road.start.z + uz * distance
        b.plate(x, 1.3, z, horizontal ? 32 : 4, horizontal ? 4 : 32, colors.line, { flat: true })
      }
      for (const distance of [126, length - 126]) {
        const x = road.start.x + ux * distance
        const z = road.start.z + uz * distance
        const side = distance < length / 2 ? -1 : 1
        // Stop line across the approaching lane only.
        b.plate(
          x + (horizontal ? 0 : (side * carriageway) / 2),
          1.3,
          z + (horizontal ? (-side * carriageway) / 2 : 0),
          horizontal ? 6 : carriageway,
          horizontal ? carriageway : 6,
          colors.line,
          { flat: true }
        )
      }
      const rng = mulberry32(Math.round(cx * 3 + cz * 7))
      if (length > 600)
        b.cylinder(
          road.start.x + ux * length * (0.3 + rng() * 0.4) + (horizontal ? 0 : 26),
          1.4,
          road.start.z + uz * length * (0.3 + rng() * 0.4) + (horizontal ? 26 : 0),
          13,
          0.6,
          0x5a5f6a,
          { segments: 10, flat: true }
        )
    }
    for (const crossing of crossings) {
      const horizontal = Math.abs(crossing.ux) > 0.5
      for (let offset = -carriageway + 10; offset <= carriageway - 10; offset += 22) {
        b.plate(
          crossing.x + (horizontal ? 0 : offset),
          1.35,
          crossing.z + (horizontal ? offset : 0),
          horizontal ? 54 : 12,
          horizontal ? 12 : 54,
          colors.line,
          { flat: true }
        )
      }
    }
  }

  function curbedPavement(r: Rect) {
    ground(r, colors.paving, surface.paving, pavementHeight)
  }

  function sidewalkRing(block: Rect) {
    const s = sidewalk
    curbedPavement({ ...block, bottom: block.top + s })
    curbedPavement({ ...block, top: block.bottom - s })
    curbedPavement({
      ...block,
      top: block.top + s,
      bottom: block.bottom - s,
      right: block.left + s
    })
    curbedPavement({
      ...block,
      top: block.top + s,
      bottom: block.bottom - s,
      left: block.right - s
    })
    const cx = (block.left + block.right) / 2
    const cz = (block.top + block.bottom) / 2
    const w = block.right - block.left
    const d = block.bottom - block.top
    b.box(cx, 1.9, block.top + 3, w, 3.8, 6, colors.curb, { flat: true })
    b.box(cx, 1.9, block.bottom - 3, w, 3.8, 6, colors.curb, { flat: true })
    b.box(block.left + 3, 1.9, cz, 6, 3.8, d, colors.curb, { flat: true })
    b.box(block.right - 3, 1.9, cz, 6, 3.8, d, colors.curb, { flat: true })
  }

  // Street trees and lamps alternate along the curb, clear of the zebra crossings.
  function streetside(block: Rect, seed: number, options: { trees?: boolean } = {}) {
    const rng = mulberry32(seed * 977 + 13)
    const edges = [
      {
        x: block.left,
        z: block.bottom - 8,
        dx: 1,
        dz: 0,
        length: block.right - block.left,
        yaw: 0
      },
      {
        x: block.right,
        z: block.top + 8,
        dx: -1,
        dz: 0,
        length: block.right - block.left,
        yaw: Math.PI
      },
      {
        x: block.right - 8,
        z: block.bottom,
        dx: 0,
        dz: -1,
        length: block.bottom - block.top,
        yaw: Math.PI / 2
      },
      {
        x: block.left + 8,
        z: block.top,
        dx: 0,
        dz: 1,
        length: block.bottom - block.top,
        yaw: -Math.PI / 2
      }
    ]
    for (const [edgeIndex, edge] of edges.entries()) {
      const count = Math.max(1, Math.floor((edge.length - 340) / 200))
      for (let index = 0; index <= count; index++) {
        const distance = 170 + (index * (edge.length - 340)) / count
        const x = edge.x + edge.dx * distance
        const z = edge.z + edge.dz * distance
        if ((index + edgeIndex) % 2 === 0) lamp(x, z, edge.yaw)
        else if (options.trees !== false)
          plantTree(x, z, rng() < 0.2 ? 'blossom' : 'round', rng, 0.85, 34)
        else if (rng() < 0.5) trashBin(b, x, z)
      }
      if (rng() < 0.5) hydrant(b, edge.x + edge.dx * 120, edge.z + edge.dz * 120)
    }
  }

  // ── Blocks ─────────────────────────────────────────────────────────────────
  type Lot = {
    width: number
    building?: Omit<BuildingSpec, 'seed'>
    setback?: number
    garden?: boolean
    extra?: (lot: {
      cx: number
      edge: number
      dir: number
      yaw: number
      width: number
      front: number
    }) => void
  }

  function lotRow(inner: Rect, side: 'south' | 'north', lots: Lot[], seed: number) {
    const dir = side === 'south' ? 1 : -1
    const yaw = side === 'south' ? 0 : Math.PI
    const edge = side === 'south' ? inner.bottom : inner.top
    const middle = (inner.top + inner.bottom) / 2
    const total = lots.reduce((sum, lot) => sum + lot.width, 0)
    let x = (inner.left + inner.right) / 2 - total / 2
    const rng = mulberry32(seed)
    for (const [index, lot] of lots.entries()) {
      const cx = x + lot.width / 2
      const setback = lot.setback ?? 12
      const front = edge - dir * setback
      if (lot.building) {
        const spec = { ...lot.building, seed: seed * 31 + index * 7 + 1 }
        const placed = placeBuilding(spec, cx, front, yaw)
        if (lot.garden)
          garden(rng, cx, lot.width, edge, front, dir, yaw, placed.doorX, spec.depth, middle)
      }
      lot.extra?.({ cx, edge, dir, yaw, width: lot.width, front })
      x += lot.width
    }
  }

  function garden(
    rng: () => number,
    cx: number,
    width: number,
    edge: number,
    front: number,
    dir: number,
    yaw: number,
    doorX: number,
    depth: number,
    middle: number
  ) {
    const pathZ = (edge + front) / 2
    b.plate(doorX, 3.6, pathZ, 34, Math.abs(edge - front), colors.paving, {
      surface: surface.paving,
      flat: true
    })
    const fenceZ = edge - dir * 5
    const left = cx - width / 2 + 6
    const right = cx + width / 2 - 6
    const fenceColor = rng() < 0.6 ? palette.trim : 0x9b7656
    if (rng() < 0.55) {
      if (doorX - 26 > left) fence(b, left, fenceZ, doorX - 26, fenceZ, fenceColor)
      if (doorX + 26 < right) fence(b, doorX + 26, fenceZ, right, fenceZ, fenceColor)
    } else {
      if (doorX - 26 > left + 10) hedge(b, (left + doorX - 26) / 2, fenceZ, doorX - 26 - left, 16)
      if (doorX + 26 < right - 10)
        hedge(b, (doorX + 26 + right) / 2, fenceZ, right - doorX - 26, 16)
    }
    mailbox(b, doorX + 34, fenceZ - dir * 10, yaw, palette.roofs[Math.floor(rng() * 8)])
    const bedX = doorX > cx ? doorX - 90 : doorX + 90
    if (Math.abs(front - edge) > 60) {
      if (rng() < 0.35 && width > 260) {
        parkedCar(bedX, (front + edge) / 2 - dir * 4, yaw, Math.floor(rng() * 12))
      } else {
        flowerBed(b, bedX, front + dir * 22, 70, 20, rng)
        if (rng() < 0.6)
          tree(b, cx + (doorX > cx ? -1 : 1) * (width / 2 - 30), edge - dir * 34, 'bush', rng, 1)
      }
    }
    const back = front - dir * depth
    const room = Math.abs(middle - back)
    if (room > 70) {
      const kind: TreeKind = rng() < 0.15 ? 'blossom' : rng() < 0.2 ? 'birch' : 'round'
      plantTree(
        cx + (rng() - 0.5) * width * 0.5,
        back - (dir * room) / 2,
        kind,
        rng,
        0.9 + rng() * 0.3
      )
    }
    fence(b, cx - width / 2 + 2, edge - dir * 5, cx - width / 2 + 2, middle, 0xc9b28f)
  }

  function houseLots(span: number, rng: () => number): Lot[] {
    const count = Math.max(2, Math.round(span / 300))
    const widths = Array.from({ length: count }, () => 0.85 + rng() * 0.3)
    const total = widths.reduce((sum, width) => sum + width, 0)
    return widths.map((share) => {
      const width = (share / total) * span
      const roll = rng()
      const kind = roll < 0.55 ? 'house' : roll < 0.8 ? 'cottage' : 'townhouse'
      return {
        width,
        setback: kind === 'townhouse' ? 50 : 80 + rng() * 26,
        garden: true,
        building: {
          kind,
          width: Math.min(width - 56, kind === 'townhouse' ? 220 : 280),
          depth: kind === 'townhouse' ? 200 : 180 + rng() * 40,
          floors: kind === 'townhouse' ? 3 : 2
        }
      }
    })
  }

  function shopLots(span: number, labels: (TownLabel | 'office' | 'apartment' | 'shop')[]): Lot[] {
    const width = span / labels.length
    return labels.map((label, index) => {
      const outdoor =
        label === 'CAFE' ||
        label === 'PIZZA' ||
        label === 'DINER' ||
        label === 'FLOWERS' ||
        label === 'BAKERY'
      const building: Omit<BuildingSpec, 'seed'> =
        label === 'office'
          ? { kind: 'office', width: width - 12, depth: 240, floors: 4 }
          : label === 'apartment'
            ? { kind: 'apartment', width: width - 12, depth: 230, floors: 5 }
            : {
                kind: 'shop',
                width: width - 8,
                depth: 210 + (index % 2) * 30,
                floors: 2 + (index % 3 === 1 ? 1 : 0),
                label: label === 'shop' ? undefined : label
              }
      return { width, setback: outdoor ? 74 : 14, building }
    })
  }

  function inset(block: Rect, amount = sidewalk): Rect {
    return {
      left: block.left + amount,
      right: block.right - amount,
      top: block.top + amount,
      bottom: block.bottom - amount
    }
  }

  function residentialBlock(block: TownBlock, inner: Rect) {
    const rng = mulberry32(block.seed * 101)
    ground(inner, colors.lawn, surface.grass)
    const span = inner.right - inner.left
    lotRow(inner, 'south', houseLots(span, rng), block.seed * 3)
    lotRow(inner, 'north', houseLots(span, rng), block.seed * 3 + 1)
    fence(
      b,
      inner.left + 8,
      (inner.top + inner.bottom) / 2,
      inner.right - 8,
      (inner.top + inner.bottom) / 2,
      0xc9b28f
    )
  }

  function downtownBlock(
    block: TownBlock,
    inner: Rect,
    south: Parameters<typeof shopLots>[1],
    north: Parameters<typeof shopLots>[1]
  ) {
    ground(inner, colors.plaza, surface.paving)
    const span = inner.right - inner.left
    lotRow(inner, 'south', shopLots(span, south), block.seed * 3)
    lotRow(inner, 'north', shopLots(span, north), block.seed * 3 + 1)
    // Service yards behind the shops.
    const rng = mulberry32(block.seed * 17)
    const middle = (inner.top + inner.bottom) / 2
    for (let index = 0; index < 4; index++) {
      const x = inner.left + 80 + rng() * (span - 160)
      if (rng() < 0.5) crate(b, x, middle + (rng() - 0.5) * 60, 26, rng)
      else barrel(b, x, middle + (rng() - 0.5) * 60)
    }
  }

  function libraryBlock(block: TownBlock, inner: Rect) {
    const rng = mulberry32(block.seed * 101)
    ground(inner, colors.lawn, surface.grass)
    const span = inner.right - inner.left
    lotRow(inner, 'north', houseLots(span, rng), block.seed * 3 + 1)
    lotRow(
      inner,
      'south',
      [
        {
          width: span,
          setback: 120,
          building: { kind: 'civic', width: 470, depth: 250, label: 'LIBRARY' },
          extra: ({ cx, edge }) => {
            ground(
              { left: cx - 120, right: cx + 120, top: edge - 120, bottom: edge },
              colors.plaza,
              surface.paving,
              3.5
            )
            for (const side of [-1, 1]) {
              plantTree(cx + side * 330, edge - 70, 'round', rng, 1.1)
              bench(b, cx + side * 180, edge - 50, 0)
              flowerBed(b, cx + side * 200, edge - 100, 100, 26, rng)
            }
          }
        }
      ],
      block.seed * 3
    )
  }

  function schoolBlock(block: TownBlock, inner: Rect) {
    const rng = mulberry32(block.seed * 101)
    ground(inner, colors.lawn, surface.grass)
    const cx = (inner.left + inner.right) / 2
    const schoolFront = inner.top + 330
    placeBuilding({ kind: 'school', width: 620, depth: 220, seed: 7 }, cx, schoolFront, 0)
    ground(
      { left: cx - 120, right: cx + 120, top: schoolFront, bottom: schoolFront + 90 },
      colors.plaza,
      surface.paving,
      3.5
    )
    // A running track around a football pitch.
    const fieldZ = (schoolFront + 90 + inner.bottom) / 2
    const width = inner.right - inner.left - 120
    const depth = inner.bottom - schoolFront - 150
    b.cylinder(cx - width / 2 + depth / 2, 2, fieldZ, depth / 2, 4, colors.track, {
      segments: 20,
      flat: true
    })
    b.cylinder(cx + width / 2 - depth / 2, 2, fieldZ, depth / 2, 4, colors.track, {
      segments: 20,
      flat: true
    })
    b.box(cx, 2, fieldZ, width - depth, 4, depth, colors.track, { flat: true })
    b.cylinder(cx - width / 2 + depth / 2, 2.5, fieldZ, depth / 2 - 40, 4, 0x6dbb5a, {
      segments: 20,
      flat: true
    })
    b.cylinder(cx + width / 2 - depth / 2, 2.5, fieldZ, depth / 2 - 40, 4, 0x6dbb5a, {
      segments: 20,
      flat: true
    })
    b.box(cx, 2.5, fieldZ, width - depth, 4, depth - 80, 0x6dbb5a, {
      flat: true,
      surface: surface.grass
    })
    b.plate(cx, 4.6, fieldZ, 4, depth - 80, colors.line, { flat: true })
    b.cylinder(cx, 4.4, fieldZ, 40, 0.5, colors.line, { segments: 16, flat: true })
    b.cylinder(cx, 4.5, fieldZ, 36, 0.5, 0x6dbb5a, { segments: 16, flat: true })
    for (const side of [-1, 1]) {
      const x = cx + side * (width / 2 - depth / 2 - 20)
      b.box(x, 22, fieldZ - 40, 4, 44, 4, palette.trim)
      b.box(x, 22, fieldZ + 40, 4, 44, 4, palette.trim)
      b.box(x, 44, fieldZ, 4, 4, 84, palette.trim)
    }
    for (let index = 0; index < 5; index++) {
      const x = inner.left + 70 + (index * (inner.right - inner.left - 140)) / 4
      plantTree(x, inner.top + 60, index % 2 ? 'blossom' : 'round', rng, 1)
    }
    fence(b, inner.left + 10, inner.bottom - 12, inner.right - 10, inner.bottom - 12, 0x7da0b8)
  }

  function hospitalBlock(block: TownBlock, inner: Rect) {
    const rng = mulberry32(block.seed * 101)
    ground(inner, colors.lawn, surface.grass)
    const span = inner.right - inner.left
    lotRow(inner, 'north', houseLots(span, rng), block.seed * 3 + 1)
    lotRow(
      inner,
      'south',
      [
        {
          width: span,
          setback: 190,
          building: { kind: 'hospital', width: 560, depth: 220 },
          extra: ({ cx, edge }) => {
            ground(
              { left: cx - 300, right: cx + 300, top: edge - 190, bottom: edge },
              colors.plaza,
              surface.paving,
              3.5
            )
            for (const side of [-1, 1]) {
              plantTree(cx + side * 380, edge - 110, 'round', rng, 1.1)
              flowerBed(b, cx + side * 200, edge - 40, 120, 26, rng)
            }
          }
        }
      ],
      block.seed * 3
    )
  }

  function parkBlock(inner: Rect) {
    const rng = mulberry32(4242)
    ground(inner, colors.lawn, surface.grass)
    // Pond with a stone rim, lily pads and a small island.
    // Keep the rim's top below the water surface so the two discs don't z-fight.
    b.cylinder(parkPond.x, 2.5, parkPond.z, parkPond.radiusX + 16, 5, colors.stone, {
      radiusZ: parkPond.radiusZ + 16,
      segments: 24,
      surface: surface.stone,
      flat: true
    })
    b.cylinder(parkPond.x, 4, parkPond.z, parkPond.radiusX, 4, colors.water, {
      radiusZ: parkPond.radiusZ,
      segments: 24,
      surface: surface.pond,
      flat: true
    })
    solid(parkPond.x, parkPond.z, parkPond.radiusX + 16, parkPond.radiusZ + 16)
    for (let index = 0; index < 7; index++) {
      const angle = rng() * Math.PI * 2
      const radius = 0.4 + rng() * 0.45
      b.cylinder(
        parkPond.x + Math.cos(angle) * parkPond.radiusX * radius,
        6.4,
        parkPond.z + Math.sin(angle) * parkPond.radiusZ * radius,
        12,
        1,
        0x5aa65a,
        { segments: 7 }
      )
    }
    const { island } = parkPond
    const ix = parkPond.x + island.dx
    const iz = parkPond.z + island.dz
    b.blob(ix, 4, iz, island.radiusX * 2, 24, island.radiusZ * 2, colors.lawn, { detail: 1 })
    tree(b, ix, iz, 'round', rng, 0.6, 10)
    // Paths.
    const pathZ = park.bottom - 170
    b.plate(
      (inner.left + inner.right) / 2,
      3.8,
      pathZ,
      inner.right - inner.left,
      90,
      colors.plaza,
      { surface: surface.paving, flat: true }
    )
    const pathX = inner.right - 300
    b.plate(pathX, 3.8, (inner.top + pathZ) / 2, 80, pathZ - inner.top, colors.plaza, {
      surface: surface.paving,
      flat: true
    })
    // Gazebo.
    const gx = pathX + 150
    const gz = inner.top + 170
    b.cylinder(gx, 6, gz, 80, 12, palette.stone, { segments: 8, surface: surface.stone })
    for (let index = 0; index < 8; index++) {
      const angle = (index / 8) * Math.PI * 2
      b.box(gx + Math.cos(angle) * 68, 60, gz + Math.sin(angle) * 68, 7, 100, 7, palette.trim)
    }
    b.cylinder(gx, 116, gz, 88, 10, palette.trim, { segments: 8 })
    b.cone(gx, 150, gz, 90, 60, 0x3f8f87, { segments: 8 })
    solid(gx, gz, 84)
    // Playground.
    const px = inner.left + 190
    const pz = inner.top + 140
    b.box(px, 3.6, pz, 220, 1, 150, colors.sand, { surface: surface.sand, flat: true })
    b.box(px - 60, 40, pz, 40, 80, 40, 0xf2c94c)
    b.box(px - 60, 84, pz, 48, 8, 48, 0xe8574f)
    b.box(px - 10, 44, pz, 16, 4, 110, 0x4d7be0, { ry: Math.PI / 2, rx: 0.62 })
    for (const side of [-1, 1]) b.box(px + 70, 50, pz + side * 50, 6, 100, 6, palette.frame)
    b.box(px + 70, 100, pz, 6, 6, 106, palette.frame)
    for (const side of [-1, 1]) {
      b.box(px + 70, 70, pz + side * 22, 2, 60, 2, palette.frame)
      b.box(px + 70, 38, pz + side * 22, 16, 3, 12, 0xe8574f)
    }
    solid(px, pz, 120, 85)
    // Trees, benches and flowers around the paths.
    for (let index = 0; index < 9; index++) {
      const x = inner.left + 60 + (index * (inner.right - inner.left - 120)) / 8
      plantTree(x, inner.bottom - 40, index % 3 === 0 ? 'blossom' : 'round', rng, 1 + rng() * 0.25)
      if (index % 2) bench(b, x, pathZ + 62, Math.PI)
    }
    for (let index = 0; index < 4; index++)
      plantTree(inner.right - 40, inner.top + 80 + index * 150, 'round', rng, 1.1)
    for (const x of [inner.left + 300, inner.right - 420]) lamp(x, pathZ - 56, Math.PI)
    flowerBed(b, pathX, pathZ - 90, 80, 50, rng)
  }

  function plazaBlock(inner: Rect) {
    const rng = mulberry32(777)
    ground(inner, colors.plaza, surface.paving)
    const cx = (inner.left + inner.right) / 2
    const hallFront = inner.top + 320
    placeBuilding({ kind: 'townhall', width: 540, depth: 260, seed: 3 }, cx, hallFront, 0)
    // Fountain.
    const fz = plazaFountain.z
    b.cylinder(cx, 9, fz, 120, 18, colors.stone, { segments: 20, surface: surface.stone })
    b.cylinder(cx, 17, fz, 108, 4, colors.water, { segments: 20, surface: surface.pond })
    b.cylinder(cx, 40, fz, 16, 50, colors.stone, { segments: 10 })
    b.cylinder(cx, 64, fz, 46, 8, colors.stone, { segments: 14, top: 1.2 })
    b.cylinder(cx, 68, fz, 40, 2, colors.water, { segments: 14, surface: surface.pond })
    b.cylinder(cx, 84, fz, 7, 30, colors.stone, { segments: 8 })
    solid(cx, fz, 124)
    for (let index = 0; index < 8; index++) {
      const angle = (index / 8) * Math.PI * 2 + Math.PI / 8
      const x = cx + Math.cos(angle) * 230
      const z = fz + Math.sin(angle) * 150
      if (index % 2) bench(b, x, z, Math.atan2(cx - x, fz - z))
      else flowerBed(b, x, z, 60, 60, rng)
    }
    for (const [x, z] of [
      [inner.left + 70, inner.bottom - 70],
      [inner.right - 70, inner.bottom - 70],
      [inner.left + 70, hallFront + 60],
      [inner.right - 70, hallFront + 60]
    ])
      plantTree(x, z, 'blossom', rng, 1.15)
    for (const side of [-1, 1]) {
      const x = cx + side * 110
      b.cylinder(x, 120, hallFront + 120, 3, 240, palette.metal)
      b.box(x + 22, 220, hallFront + 120, 44, 28, 1, side < 0 ? 0x4d6fb3 : 0xe8574f, {
        faces: face.pz | face.nz
      })
      lamp(cx + side * 300, fz, side < 0 ? -Math.PI / 2 : Math.PI / 2)
    }
  }

  function avenueBlock(block: TownBlock, inner: Rect) {
    ground(inner, colors.plaza, surface.paving)
    const span = inner.right - inner.left
    lotRow(
      inner,
      'south',
      [
        {
          width: span * 0.42,
          setback: 30,
          building: { kind: 'cinema', width: span * 0.42 - 20, depth: 260 }
        },
        ...shopLots(span * 0.58, ['ICE CREAM', 'ARCADE'])
      ],
      block.seed * 3
    )
    lotRow(
      inner,
      'north',
      [
        {
          width: span * 0.5,
          setback: 60,
          building: { kind: 'hotel', width: span * 0.5 - 30, depth: 230 }
        },
        ...shopLots(span * 0.5, ['PIZZA', 'apartment'])
      ],
      block.seed * 3 + 1
    )
  }

  function churchBlock(block: TownBlock, inner: Rect) {
    const rng = mulberry32(block.seed * 101)
    ground(inner, colors.lawn, surface.grass)
    const span = inner.right - inner.left
    lotRow(inner, 'north', houseLots(span, rng), block.seed * 3 + 1)
    lotRow(
      inner,
      'south',
      [
        {
          width: span * 0.45,
          setback: 70,
          building: { kind: 'church', width: 250, depth: 320 },
          extra: ({ cx, edge }) => {
            ground(
              { left: cx - 40, right: cx + 40, top: edge - 70, bottom: edge },
              colors.plaza,
              surface.paving,
              3.5
            )
            plantTree(cx - 190, edge - 120, 'cone', rng, 1.2)
            plantTree(cx + 200, edge - 300, 'cone', rng, 1.3)
            // The churchyard lawn fills with old graves on Halloween, kept in front of the
            // church and clear of the path and the pine.
            if (townHalloween)
              for (const [depth, offsets] of [
                [28, [-200, -160, -115, -75, 75, 115, 160, 200]],
                [84, [160, 200]],
                [140, [160, 200]]
              ] as const)
                for (const offset of offsets) {
                  const index = depth / 28 + Math.abs(offset) / 5
                  gravestone(
                    b,
                    cx + offset,
                    edge - depth - 20,
                    (index % 3) * 0.08 - 0.08,
                    index % 4 === 0
                  )
                  solid(cx + offset, edge - depth - 10, 16, 22)
                }
          }
        },
        ...houseLots(span * 0.55, rng)
      ],
      block.seed * 3
    )
  }

  function marketBlock(block: TownBlock, inner: Rect) {
    const rng = mulberry32(block.seed * 101)
    ground(inner, colors.plaza, surface.paving)
    const span = inner.right - inner.left
    lotRow(inner, 'north', shopLots(span, ['BURGER', 'DINER', 'shop', 'TOYS']), block.seed * 3 + 1)
    // An open-air market: rows of striped stalls.
    const middle = (inner.top + inner.bottom) / 2
    const cx = (inner.left + inner.right) / 2
    // The entrance arch carries the MARKET sign.
    b.frame(cx, inner.bottom - 26, 0, () => {
      for (const side of [-1, 1]) b.box(side * 150, 90, 0, 14, 180, 14, palette.frame)
      b.box(0, 178, 0, 320, 14, 14, palette.frame)
      signBoard(b, 'MARKET', 0, 206, 2, 36, 0x2d7d5a)
    })
    for (const side of [-1, 1]) solid(cx + side * 150, inner.bottom - 26, 12)
    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < 2; row++) {
        const x = inner.left + 140 + column * ((span - 280) / 3)
        const z = middle + 60 + row * 150
        const colorsPair = palette.awnings[(column + row * 2) % palette.awnings.length]
        b.frame(x, z, 0, () => {
          b.box(0, 26, 0, 110, 52, 60, palette.wood, { surface: surface.planks })
          for (let item = 0; item < 6; item++)
            b.blob(
              -40 + item * 16,
              56,
              (item % 2) * 16 - 8,
              14,
              12,
              14,
              [0xe8574f, 0xf2c94c, 0x7cc46a, 0xf29a4a][(item + column) % 4]
            )
          for (const side of [-1, 1])
            for (const depth of [-1, 1]) b.box(side * 52, 60, depth * 28, 4, 120, 4, palette.frame)
          for (let stripe = 0; stripe < 6; stripe++)
            b.box(-50 + stripe * 20, 122, 0, 20, 4, 76, colorsPair[stripe % 2], { rz: 0 })
        })
        solid(x, z, 62, 42)
      }
    }
    for (const side of [-1, 1]) plantTree(cx + side * (span / 2 - 50), middle + 30, 'round', rng, 1)
  }

  function civicBlock(block: TownBlock, inner: Rect) {
    ground(inner, colors.plaza, surface.paving)
    const span = inner.right - inner.left
    const rng = mulberry32(block.seed * 101)
    lotRow(
      inner,
      'south',
      [
        {
          width: span * 0.55,
          setback: 110,
          building: { kind: 'civic', width: span * 0.55 - 70, depth: 230, label: 'POLICE' }
        },
        {
          width: span * 0.45,
          setback: 110,
          building: { kind: 'fire', width: span * 0.45 - 40, depth: 220 }
        }
      ],
      block.seed * 3
    )
    lotRow(
      inner,
      'north',
      [
        {
          width: span * 0.5,
          setback: 90,
          building: { kind: 'civic', width: span * 0.5 - 70, depth: 220, label: 'POST' }
        },
        {
          width: span * 0.5,
          setback: 40,
          building: { kind: 'apartment', width: span * 0.5 - 40, depth: 230, floors: 6 }
        }
      ],
      block.seed * 3 + 1
    )
    for (const x of [inner.left + 60, inner.right - 60])
      plantTree(x, (inner.top + inner.bottom) / 2, 'round', rng, 1)
    parkedCar(inner.left + 200, inner.bottom - 40, Math.PI / 2, 4)
  }

  function harborBlock(block: TownBlock, inner: Rect, index: number) {
    ground(inner, colors.plaza, surface.paving)
    const span = inner.right - inner.left
    const rng = mulberry32(block.seed * 101)
    const lots: Lot[][] = [
      [
        {
          width: span * 0.5,
          setback: 40,
          building: { kind: 'fishmarket', width: span * 0.5 - 40, depth: 220 }
        },
        ...shopLots(span * 0.5, ['BOATS', 'CAFE'])
      ],
      [
        {
          width: span * 0.55,
          setback: 30,
          building: { kind: 'warehouse', width: span * 0.55 - 30, depth: 260 }
        },
        {
          width: span * 0.45,
          setback: 30,
          building: { kind: 'office', width: span * 0.45 - 30, depth: 220, floors: 3 }
        }
      ],
      [{ width: span, setback: 30, building: { kind: 'warehouse', width: span - 60, depth: 260 } }]
    ]
    lotRow(inner, 'south', lots[index] ?? lots[2], block.seed * 3)
    for (let item = 0; item < 5; item++)
      crate(b, inner.left + 40 + rng() * (span - 80), inner.top + 30 + rng() * 40, 26, rng)
  }

  function blocks() {
    for (const block of townBlocks) {
      sidewalkRing(block)
      const inner = inset(block)
      switch (block.kind) {
        case 'residential':
          residentialBlock(block, inner)
          break
        case 'library':
          libraryBlock(block, inner)
          break
        case 'school':
          schoolBlock(block, inner)
          break
        case 'hospital':
          hospitalBlock(block, inner)
          break
        case 'park':
          parkBlock(inner)
          break
        case 'downtown':
          downtownBlock(
            block,
            inner,
            ['BAKERY', 'BOOKS', 'CAFE', 'FLOWERS'],
            ['DRUGS', 'office', 'shop', 'apartment']
          )
          break
        case 'plaza':
          plazaBlock(inner)
          break
        case 'avenue':
          avenueBlock(block, inner)
          break
        case 'church':
          churchBlock(block, inner)
          break
        case 'market':
          marketBlock(block, inner)
          break
        case 'civic':
          civicBlock(block, inner)
          break
        case 'harbor':
          harborBlock(
            block,
            inner,
            townBlocks.filter((other) => other.kind === 'harbor').indexOf(block)
          )
          break
      }
      streetside(block, block.seed, { trees: block.kind !== 'harbor' })
    }
    for (const pavement of townPavements) curbedPavement(pavement)
    // Lamps along the outer edge of the town.
    for (let x = -2300; x <= 2300; x += 400) lamp(x, streets[0] - carriageway - 8, Math.PI)
  }

  // ── Railway and station ───────────────────────────────────────────────────
  function railwayLine() {
    const [west, east] = railEnds
    const length = east - west + 400
    const center = (west + east) / 2
    b.box(center, 3, railway, length, 6, 140, colors.ballast, {
      surface: surface.ballast,
      flat: true
    })
    for (let x = west - 200; x < east + 200; x += 32) b.box(x, 7.5, railway, 10, 3, 76, 0x7d5f4a)
    for (const side of [-1, 1])
      b.box(center, 10.5, railway + side * 20, length, 4, 4, 0xa9b1ba, { surface: surface.metal })
    for (const [x, yaw] of [
      [west, Math.PI / 2],
      [east, -Math.PI / 2]
    ]) {
      b.frame(x, railway, yaw, () => {
        b.box(0, 110, -40, 300, 240, 80, colors.stone, { surface: surface.stone })
        b.box(0, 62, 0.6, 110, 124, 1, 0x1b1820, { faces: face.pz })
        b.cylinder(0, 124, 1, 55, 1, 0x1b1820, { rx: Math.PI / 2, segments: 14 })
        b.box(0, 232, -40, 320, 12, 90, 0xb5ab98)
        b.box(0, 184, 2, 30, 26, 4, 0xb5ab98)
      })
    }
    fence(b, west + 60, railway - 80, east - 60, railway - 80, 0x8d949c)
    fence(b, west + 60, railway + 80, platform.left - 40, railway + 80, 0x8d949c)
    fence(b, platform.right + 40, railway + 80, east - 60, railway + 80, 0x8d949c)
    // Platform with a canopy.
    const pz = (platform.top + platform.bottom) / 2
    const pw = platform.right - platform.left
    const px = (platform.left + platform.right) / 2
    b.box(px, 12, pz, pw, 24, platform.bottom - platform.top, colors.paving, {
      surface: surface.paving
    })
    b.plate(px, 24.2, platform.top + 6, pw, 6, colors.yellow, { flat: true })
    for (const [index, x] of Array.from(
      { length: 8 },
      (_, i) => platform.left + 60 + i * 117
    ).entries()) {
      b.box(x, 90, pz + 10, 6, 132, 6, 0x3f6a8a)
      if (index % 2) bench(b, x + 50, pz + 24, Math.PI)
    }
    b.box(px, 158, pz + 10, pw - 60, 6, 110, 0x3f6a8a, { rx: 0.06 })
    // Station and forecourt.
    const forecourt = {
      left: 160,
      right: 1040,
      top: station.front,
      bottom: streets[0] - carriageway - sidewalk
    }
    ground(forecourt, colors.plaza, surface.paving)
    placeBuilding(
      { kind: 'station', width: station.width, depth: station.depth, seed: 11 },
      station.x,
      station.front,
      0
    )
    busStop(b, 300, forecourt.bottom - 30, 0)
    bicycleRack(b, 940, station.front + 40, 0, mulberry32(5))
    parkedCar(820, station.front + 52, Math.PI / 2, 3)
    parkedCar(720, station.front + 52, Math.PI / 2, 7)
    vending(b, 200, station.front + 20, 0, 0xe8574f)
    vending(b, 236, station.front + 20, 0, 0x4d7be0)
  }

  // ── Harbor ─────────────────────────────────────────────────────────────────
  function harbor() {
    const rng = mulberry32(31337)
    const left = -carriageway - sidewalk
    const right = quayEnd + carriageway + 60
    b.box((left + right) / 2, -18, quayEdge - 14, right - left, 44, 28, colors.stone, {
      surface: surface.stone
    })
    for (let x = left + 60; x < right - 20; x += 130) {
      b.cylinder(x, 12, quayEdge - 16, 7, 18, 0x3d3a4a, { segments: 8 })
      b.cylinder(x, 22, quayEdge - 16, 9, 4, 0x3d3a4a, { segments: 8 })
    }
    for (let x = left + 160; x < right - 60; x += 420) lamp(x, quayEdge - 44, 0)
    for (let x = left + 360; x < right - 60; x += 840) bench(b, x, quayEdge - 60, 0)
    // Two piers on timber posts.
    for (const { x: px, width, end } of piers) {
      const length = end - quayEdge
      b.box(px, pierDeck - 3, quayEdge + length / 2, width, 6, length, palette.wood, {
        surface: surface.planks
      })
      for (let z = quayEdge + 40; z < end; z += 90)
        for (const side of [-1, 1])
          b.cylinder(px + side * 44, -16, z, 6, 56, 0x6b4a36, { segments: 6 })
      lamps.push(streetLamp(b, px + 40, end - 20, Math.PI / 2))
      crate(b, px - 26, quayEdge + 120, 24, rng, pierDeck)
      solid(px - 26, quayEdge + 120, 18)
      barrel(b, px + 30, quayEdge + 200)
      solid(px + 30, quayEdge + 200, 13)
    }
    // A harbor crane at the end of the quay.
    b.frame(3210, quayEdge - 50, 0, () => {
      for (const sx of [-40, 40])
        for (const sz of [-30, 30]) b.box(sx, 110, sz, 10, 220, 10, 0xf2b84b)
      b.box(0, 226, 0, 100, 16, 80, 0xf2b84b)
      b.box(0, 260, 0, 60, 50, 50, 0xe8574f)
      b.box(0, 286, 120, 16, 14, 340, 0xf2b84b)
      b.box(0, 286, -70, 30, 30, 40, 0x6a717a)
      b.box(0, 200, 260, 2, 160, 2, 0x3d3a4a)
      b.box(0, 116, 260, 18, 10, 18, 0x3d3a4a)
    })
    solid(3210, quayEdge - 50, 60, 46)
    // Breakwater and lighthouse.
    const length = breakwater.end - breakwater.start
    b.box(breakwater.x, 6, breakwater.start + length / 2, 90, 14, length, colors.stone, {
      surface: surface.stone
    })
    for (let z = breakwater.start + 60; z < breakwater.end; z += 70)
      for (const side of [-1, 1])
        rockCluster(b, breakwater.x + side * 62, z + rng() * 30, 54, rng, -12)
    b.frame(lighthouse.x, lighthouse.z, 0, () => {
      b.cylinder(0, -6, 0, 150, 40, colors.stone, { segments: 14, surface: surface.stone })
      for (let index = 0; index < 10; index++) {
        const angle = (index / 10) * Math.PI * 2
        rockCluster(b, Math.cos(angle) * 160, Math.sin(angle) * 160, 70, rng, -14)
      }
      b.cylinder(0, 26, 0, 74, 22, 0xe9e3d4, { segments: 12 })
      // Pumpkin and black bands replace the red and white on Halloween.
      const bands = townHalloween ? [0x2a2236, 0xf07a1e] : [0xd9473f, 0xfbf8ef]
      for (let index = 0; index < 6; index++) {
        const radius = 48 - index * 2.6
        b.cylinder(0, 62 + index * 50, 0, radius, 50, bands[(index + 1) % 2], {
          top: (radius - 2.6) / radius,
          segments: 14
        })
      }
      b.box(0, 72, 47, 26, 46, 6, 0x5a4a7a)
      b.cylinder(0, 342, 0, 52, 8, 0x3d3a4a, { segments: 14 })
      for (let index = 0; index < 12; index++) {
        const angle = (index / 12) * Math.PI * 2
        b.box(Math.cos(angle) * 48, 356, Math.sin(angle) * 48, 3, 20, 3, 0x3d3a4a)
      }
      b.cylinder(0, 366, 0, 50, 3, 0x3d3a4a, { segments: 14 })
      b.cylinder(0, 374, 0, 26, 48, 0xfff2c4, { segments: 10, glow: -1.4 })
      b.cylinder(0, 402, 0, 32, 8, 0xd9473f, { segments: 10 })
      b.cone(0, 426, 0, 32, 40, 0xd9473f, { segments: 10 })
      b.blob(0, 452, 0, 12, 12, 12, 0x3d3a4a)
    })
    occluders.push({
      minX: lighthouse.x - 50,
      maxX: lighthouse.x + 50,
      minY: 0,
      maxY: 450,
      minZ: lighthouse.z - 50,
      maxZ: lighthouse.z + 50
    })
  }

  // ── Beach ──────────────────────────────────────────────────────────────────
  function beach() {
    const rng = mulberry32(2718)
    const length = boardwalk.right - boardwalk.left
    const center = (boardwalk.left + boardwalk.right) / 2
    b.box(center, 2.5, boardwalk.z, length, 5, 100, 0xc8996a, { surface: surface.planks })
    for (let x = boardwalk.left + 100; x < boardwalk.right; x += 300) lamp(x, boardwalk.z - 58, 0)
    // A path from the town down to the sea.
    const pathLength = boardwalk.z - 50 - (streets[3] + carriageway + sidewalk)
    b.plate(
      -1200,
      3.6,
      streets[3] + carriageway + sidewalk + pathLength / 2,
      70,
      pathLength,
      colors.plaza,
      {
        surface: surface.paving,
        flat: true
      }
    )
    for (let z = 1900; z < boardwalk.z - 100; z += 240) {
      plantTree(-1270, z, 'palm', rng, 1.1)
      plantTree(-1130, z + 120, 'palm', rng, 1)
    }
    // Beach huts facing the boardwalk.
    const hutColors = [0xf28aa8, 0x6fc3d6, 0xf2c94c, 0x9ad48b, 0xb59be6, 0xf29a4a]
    for (let index = 0; index < 9; index++) {
      const x = boardwalk.left + 170 + index * 300
      if (index === 4) continue
      b.frame(x, boardwalk.z - 70, 0, () => {
        const color = hutColors[index % hutColors.length]
        b.box(0, 8, -40, 110, 16, 100, palette.wood, { surface: surface.planks })
        b.box(0, 66, -50, 86, 100, 70, color, { surface: surface.siding })
        b.prism(0, 116, -50, 96, 34, 82, palette.trim, { surface: surface.tiles })
        b.box(0, 52, -14.5, 34, 70, 1, palette.trim, { faces: face.pz })
        b.box(0, 52, -13.6, 4, 60, 1, color, { faces: face.pz })
      })
      solid(x, boardwalk.z - 120, 60, 55)
    }
    // Sunbathers' umbrellas and towels across the sand.
    for (let index = 0; index < 60; index++) {
      const x = -4300 + rng() * 3800
      const z = boardwalk.z + 130 + rng() * 700
      const distance = waterDistance(x, z)
      if (distance > -100 || distance < -480 || terrainHeight(x, z) < -2) continue
      if (rng() < 0.55) {
        const pair = palette.awnings[Math.floor(rng() * palette.awnings.length)]
        umbrella(b, x, z, pair, rng)
        b.box(x + 30, 1, z + 10, 36, 2, 70, pair[0], { ry: rng(), flat: true })
      } else if (rng() < 0.4) {
        b.box(x, 1, z, 30, 2, 64, palette.flowers[Math.floor(rng() * 5)], { ry: rng(), flat: true })
      } else {
        tree(b, x, z, 'palm', rng, 1.1 + rng() * 0.3)
        solid(x, z, 17)
      }
    }
    // Lifeguard tower.
    b.frame(-2000, boardwalk.z + 340, 0, () => {
      for (const sx of [-26, 26])
        for (const sz of [-26, 26]) b.box(sx, 50, sz, 6, 100, 6, palette.trim)
      b.box(0, 104, 0, 70, 8, 70, palette.wood)
      b.box(0, 130, 0, 60, 44, 60, 0xe8574f)
      b.prism(0, 152, 0, 72, 24, 72, palette.trim)
      b.box(0, 130, 30.5, 40, 20, 1, palette.glass, { faces: face.pz })
      b.box(-30, 70, 50, 20, 6, 70, palette.wood, { rx: 0.7 })
      b.cylinder(32, 180, -32, 2, 70, palette.frame)
      b.box(44, 205, -32, 22, 14, 1, 0xf2c94c, { faces: face.pz | face.nz })
    })
    solid(-2000, boardwalk.z + 340, 45)
    // Volleyball net.
    b.frame(-3100, boardwalk.z + 320, 0.2, () => {
      for (const side of [-1, 1]) b.box(side * 90, 40, 0, 5, 80, 5, palette.trim)
      b.box(0, 66, 0, 180, 24, 1, 0xf6f4ee, { faces: face.pz | face.nz })
    })
    b.blob(-3060, 9, boardwalk.z + 380, 18, 18, 18, 0xf2c94c, { detail: 1 })
    // Picnic lawn between the town and the beach.
    for (let index = 0; index < 18; index++) {
      const x = -2700 + rng() * 2300
      const z = 1900 + rng() * 650
      if (Math.abs(x + 1200) < 140) continue
      plantTree(
        x,
        z,
        rng() < 0.4 ? 'palm' : rng() < 0.5 ? 'blossom' : 'round',
        rng,
        1 + rng() * 0.3
      )
    }
    for (const [x, z] of [
      [-2200, 2350],
      [-1700, 2200],
      [-800, 2420]
    ]) {
      b.frame(x, z, 0.3, () => {
        b.box(0, 22, 0, 90, 4, 40, palette.wood, { surface: surface.planks })
        for (const side of [-1, 1]) b.box(0, 12, side * 34, 90, 4, 14, palette.wood)
        for (const side of [-1, 1]) b.box(side * 34, 10, 0, 4, 20, 50, palette.wood)
      })
    }
  }

  // ── Farmland ───────────────────────────────────────────────────────────────
  function farm() {
    const rng = mulberry32(8080)
    // A country lane links the town to the farmyard.
    const laneStart = 2400 + carriageway + sidewalk
    const laneEnd = farmyard.left + 60
    b.box((laneStart + laneEnd) / 2, 0.8, 550, laneEnd - laneStart, 1.6, 84, colors.asphalt, {
      surface: surface.asphalt,
      flat: true
    })
    for (let x = laneStart + 60; x < laneEnd - 40; x += 70)
      b.plate(x, 1.7, 550, 30, 3, colors.line, { flat: true })
    for (let x = laneStart + 200; x < laneEnd; x += 300) {
      lamp(x, 500, Math.PI)
      plantTree(x + 150, 470, 'round', rng, 1)
      plantTree(x + 80, 640, rng() < 0.5 ? 'birch' : 'round', rng, 1)
    }
    fence(b, laneStart + 40, 600, laneEnd - 40, 600, 0x9b7656)
    const yardX = (farmyard.left + farmyard.right) / 2
    placeBuilding({ kind: 'house', width: 240, depth: 180, seed: 404 }, yardX, -40, 0)
    // Red barn with a white trim and a hayloft.
    b.frame(yardX - 40, 440, 0, () => {
      b.box(0, 80, -110, 220, 160, 220, 0xc8453c, { surface: surface.siding })
      b.prism(0, 160, -110, 240, 50, 240, 0x5a4a4a, { ry: Math.PI / 2, surface: surface.tiles })
      b.prism(0, 158, -110, 220, 46, 220, 0xc8453c, { ry: Math.PI / 2 })
      b.box(0, 60, 1, 110, 120, 3, palette.trim)
      b.box(0, 58, 2.6, 96, 110, 1, 0x9c3a33, { faces: face.pz })
      for (const angle of [0.86, -0.86])
        b.box(0, 58, 3.4, 8, 140, 1, palette.trim, { rz: angle, faces: face.pz })
      b.box(0, 150, 1, 50, 40, 3, palette.trim)
    })
    solid(yardX - 40, 330, 124)
    occluders.push({
      minX: yardX - 150,
      maxX: yardX + 70,
      minY: 0,
      maxY: 200,
      minZ: 220,
      maxZ: 440
    })
    b.cylinder(yardX + 150, 130, 300, 42, 260, 0xd8dfe4, { segments: 14, surface: surface.metal })
    b.blob(yardX + 150, 262, 300, 86, 50, 86, 0x8fa4b4, { detail: 1 })
    solid(yardX + 150, 300, 46)
    for (let index = 0; index < 8; index++) {
      const x = farmyard.left + 640 + rng() * 900
      const z = -1600 + rng() * 300
      b.cylinder(x, 22, z, 22, 40, 0xe9c95b, { rz: Math.PI / 2, ry: rng() * 3, segments: 10 })
    }
    // Tractor.
    b.frame(yardX + 140, 120, 0.6, () => {
      b.box(0, 34, 0, 40, 30, 70, 0x4f9a55)
      b.box(0, 60, -14, 36, 34, 36, palette.glass)
      b.box(0, 78, -14, 42, 4, 42, 0x4f9a55)
      for (const side of [-1, 1]) {
        b.cylinder(side * 24, 24, -22, 24, 12, 0x2e2a35, { rz: Math.PI / 2, segments: 12 })
        b.cylinder(side * 22, 14, 26, 14, 10, 0x2e2a35, { rz: Math.PI / 2, segments: 10 })
      }
      b.box(8, 60, 30, 6, 30, 6, 0x3d3a4a)
    })
    // Windmill (the sails turn separately).
    const mill = windmillPosition
    b.frame(
      mill.x,
      mill.z,
      0,
      () => {
        b.cylinder(0, 140, 0, 64, 280, 0xf3ead8, {
          top: 0.62,
          segments: 10,
          surface: surface.stone
        })
        b.cone(0, 316, 0, 50, 70, 0x5a4a4a, { segments: 10 })
        b.box(0, 40, 62, 30, 60, 6, palette.doors[0])
        for (const y of [140, 220])
          b.box(0, y, 55 - (y - 140) * 0.08, 20, 26, 6, palette.glass, { glow: 0.8 })
      },
      mill.y
    )
    solid(mill.x, mill.z, 70)
    // Orchard trees and a cow pasture.
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 5; column++) {
        const x = fieldGrid.x + orchard.column * 560 + 60 + column * 90
        const z = fieldGrid.z + orchard.row * 480 + 60 + row * 90
        tree(b, x, z, 'round', rng, 0.7, terrainHeight(x, z))
        solid(x, z, 10)
        for (let apple = 0; apple < 3; apple++)
          b.blob(
            x + (rng() - 0.5) * 40,
            terrainHeight(x, z) + 50 + rng() * 20,
            z + 20 + rng() * 10,
            7,
            7,
            7,
            0xe04452
          )
      }
    const pastureX = fieldGrid.x + pasture.column * 560
    const pastureZ = fieldGrid.z + pasture.row * 480
    const corners = [
      [pastureX + 10, pastureZ + 10],
      [pastureX + 470, pastureZ + 10],
      [pastureX + 470, pastureZ + 390],
      [pastureX + 10, pastureZ + 390]
    ]
    for (let index = 0; index < 4; index++) {
      const [x1, z1] = corners[index]
      const [x2, z2] = corners[(index + 1) % 4]
      fence(b, x1, z1, x2, z2, 0x9b7656)
    }
    for (let index = 0; index < 4; index++) {
      const x = pastureX + 80 + rng() * 300
      const z = pastureZ + 80 + rng() * 240
      b.frame(
        x,
        z,
        rng() * Math.PI * 2,
        () => {
          b.box(0, 34, 0, 34, 30, 64, 0xf8f6ef)
          b.box(0, 36, 6, 35, 18, 18, 0x2f2b33)
          b.box(0, 42, 38, 24, 24, 24, 0xf8f6ef)
          b.box(0, 36, 51, 22, 10, 4, 0xf3b1b6)
          for (const sx of [-12, 12])
            for (const sz of [-22, 22]) b.box(sx, 10, sz, 8, 20, 8, 0x2f2b33)
        },
        terrainHeight(x, z)
      )
    }
    // Scarecrow.
    b.frame(fieldGrid.x + 2 * 560 + 240, fieldGrid.z + 3 * 480 + 200, 0, () => {
      b.box(0, 50, 0, 5, 100, 5, palette.wood)
      b.box(0, 78, 0, 70, 5, 5, palette.wood)
      b.box(0, 72, 0, 30, 34, 16, 0x6a8fc9)
      if (townHalloween) {
        jackOLantern(b, 0, 0, 0, 1.4, 88)
        b.cone(0, 132, 0, 26, 30, 0x2a2236)
        b.cylinder(0, 116, 0, 26, 2, 0x2a2236, { segments: 12 })
      } else {
        b.blob(0, 104, 0, 22, 22, 22, 0xe9c95b)
        b.cone(0, 120, 0, 22, 16, 0x9b7656)
      }
    })
  }

  // ── Wilderness ─────────────────────────────────────────────────────────────
  function wilderness() {
    const rng = mulberry32(5150)
    const cell = 150
    let planted = 0
    for (let z = -5000; z < 4200; z += cell) {
      for (let x = -6400; x < 6400; x += cell) {
        const px = x + rng() * cell
        const pz = z + rng() * cell
        const distance = waterDistance(px, pz)
        if (distance > -140) continue
        if (px > -2600 && px < 2600 && pz > -1840 && pz < 1840) continue
        if (px > -3450 && px < 3450 && pz > 1680 && pz < 3050) continue
        if (px > 60 && px < 1200 && pz > -2240 && pz < -1700) continue
        if (px > 2500 && px < 3560 && Math.abs(pz - 550) < 90) continue
        if (Math.abs(pz - railway) < 260 && px > railEnds[0] - 200 && px < railEnds[1] + 200)
          continue
        if (fieldAt(px, pz) || (px > 3300 && px < 5600 && pz > -1900 && pz < 2000)) continue
        const height = terrainHeight(px, pz)
        if (height < -2) continue
        const sandy = inSand(px, pz)
        const density = sandy
          ? 0.08
          : 0.22 + forestDensity(px, pz) * 0.75 + smoothstep(100, 500, height) * 0.25
        if (rng() > density) continue
        const kind: TreeKind = sandy
          ? 'palm'
          : height > 380
            ? rng() < 0.75
              ? 'cone'
              : 'birch'
            : height > 120
              ? rng() < 0.5
                ? 'cone'
                : rng() < 0.5
                  ? 'autumn'
                  : 'round'
              : rng() < 0.12
                ? 'blossom'
                : rng() < 0.3
                  ? 'cone'
                  : 'round'
        tree(b, px, pz, kind, rng, 0.9 + rng() * 0.7, height - 2, 0)
        solid(px, pz, 20)
        planted++
        if (rng() < 0.08) {
          const size = 40 + rng() * 40
          rockCluster(b, px + 60, pz + 40, size, rng, height)
          solid(px + 60, pz + 40, size)
        }
      }
    }
    // Lakeside cabin and jetty.
    const cabin = { x: -3700, z: 1180 }
    if (islandDistance(cabin.x, cabin.z) < 0) {
      const y = terrainHeight(cabin.x, cabin.z)
      solid(cabin.x - 80 * Math.sin(Math.PI * 0.85), cabin.z - 80 * Math.cos(Math.PI * 0.85), 110)
      b.frame(
        cabin.x,
        cabin.z,
        Math.PI * 0.85,
        () => {
          b.box(0, 50, -80, 160, 100, 120, 0x9b6a4a, { surface: surface.planks })
          b.prism(0, 100, -80, 180, 60, 140, 0x4f6f5a, { surface: surface.tiles })
          b.box(0, 40, -19, 36, 70, 2, palette.doors[0])
          b.box(50, 60, -19, 34, 30, 2, palette.glass, { glow: 0.9 })
          chimneyStone(-50, -100)
        },
        y
      )
    }
    // Campsite.
    const camp = { x: -3500, z: 1650 }
    const campY = terrainHeight(camp.x, camp.z)
    for (const [index, [dx, dz, color]] of [
      [-80, 0, 0xf29a4a],
      [60, -40, 0x6fc3d6],
      [10, 90, 0xf2c94c]
    ].entries()) {
      solid(camp.x + dx, camp.z + dz, 55)
      b.frame(
        camp.x + dx,
        camp.z + dz,
        index * 0.9,
        () => b.prism(0, 0, 0, 80, 54, 70, color),
        campY
      )
    }
    b.cylinder(camp.x, campY + 4, camp.z + 20, 18, 8, 0x6a6058, { segments: 8 })
    b.cone(camp.x, campY + 18, camp.z + 20, 12, 22, 0xff9a3c, { segments: 6, glow: -1.2 })
    // Observatory on the summit.
    const peakY = terrainHeight(summit.x, summit.z)
    b.frame(
      summit.x,
      summit.z,
      0.6,
      () => {
        b.cylinder(0, -20, 0, 130, 60, colors.stone, { segments: 12, surface: surface.stone })
        b.cylinder(0, 60, 0, 80, 110, 0xf7f3ea, { segments: 16 })
        b.blob(0, 118, 0, 170, 150, 170, 0xdfe6ef, { detail: 2 })
        b.box(0, 150, 50, 30, 70, 50, 0x3d3a4a, { rx: -0.6 })
        b.box(0, 40, 81, 30, 56, 2, palette.doors[1])
      },
      peakY
    )
    occluders.push({
      minX: summit.x - 90,
      maxX: summit.x + 90,
      minY: peakY,
      maxY: peakY + 200,
      minZ: summit.z - 90,
      maxZ: summit.z + 90
    })
    // A radio mast on the eastern hill.
    const mast = { x: 1600, z: -3600 }
    const mastY = terrainHeight(mast.x, mast.z)
    solid(mast.x, mast.z, 40)
    b.frame(
      mast.x,
      mast.z,
      0,
      () => {
        for (let level = 0; level < 6; level++) {
          const size = 70 - level * 10
          const y = level * 60
          for (const sx of [-1, 1])
            for (const sz of [-1, 1])
              b.box(
                (sx * size) / 2,
                y + 30,
                (sz * size) / 2,
                5,
                62,
                5,
                level % 2 ? 0xe8574f : 0xfbf8ef
              )
          b.box(0, y + 60, 0, size, 4, size, 0x8d949c, {
            faces: face.py | face.px | face.nx | face.pz | face.nz
          })
        }
        b.box(0, 380, 0, 6, 60, 6, 0xe8574f)
        b.blob(0, 414, 0, 12, 12, 12, 0xff5a5a, { glow: -1.5 })
      },
      mastY
    )
    return planted
  }

  // ── Halloween ──────────────────────────────────────────────────────────────
  function halloweenDecor() {
    const rng = mulberry32(1031)
    // Pumpkin patches take over a few of the crop fields.
    for (let row = 0; row < fieldGrid.rows; row++)
      for (let column = 0; column < fieldGrid.columns; column++) {
        if ((column * 3 + row) % 4 !== 1 || !farmedPlot(column, row)) continue
        if (
          (column === pasture.column && row === pasture.row) ||
          (column === millField.column && row === millField.row) ||
          (column === orchard.column && row === orchard.row)
        )
          continue
        const left = fieldGrid.x + column * (fieldGrid.width + fieldGrid.gap)
        const top = fieldGrid.z + row * (fieldGrid.depth + fieldGrid.gap)
        for (let z = top + 40; z < top + fieldGrid.depth - 20; z += 64)
          for (let x = left + 40; x < left + fieldGrid.width - 20; x += 70) {
            const px = x + (rng() - 0.5) * 30
            const pz = z + (rng() - 0.5) * 24
            if (!fieldAt(px, pz) || fieldAt(px, pz)?.track) continue
            const size = 0.9 + rng() * 0.7
            jackOLantern(b, px, pz, rng() * 6, size, terrainHeight(px, pz), rng() < 0.2)
            solid(px, pz, 13 * size)
          }
      }
    // A ring of lanterns around the plaza fountain.
    for (let index = 0; index < 10; index++) {
      const angle = (index / 10) * Math.PI * 2
      const x = plazaFountain.x + Math.cos(angle) * 142
      const z = plazaFountain.z + Math.sin(angle) * 142
      jackOLantern(b, x, z, Math.PI / 2 - angle, 1.2, pavementHeight)
      solid(x, z, 16)
    }
  }

  function chimneyStone(x: number, z: number) {
    b.box(x, 120, z, 26, 60, 26, colors.stone, { surface: surface.stone })
  }

  terrain()
  streetsAndMarkings()
  blocks()
  railwayLine()
  harbor()
  beach()
  farm()
  if (townHalloween) halloweenDecor()
  const forestTrees = wilderness()
  for (const box of occluders)
    obstacles.push({ left: box.minX, right: box.maxX, top: box.minZ, bottom: box.maxZ })

  const group = new Group()
  group.name = 'town-static'
  for (const chunk of b.build()) {
    const mesh = new Mesh(chunk.geometry, materials.town)
    mesh.castShadow = !chunk.flat
    mesh.receiveShadow = true
    mesh.matrixAutoUpdate = false
    mesh.updateMatrix()
    group.add(mesh)
  }

  const water = new Mesh(new PlaneGeometry(44000, 44000).rotateX(-Math.PI / 2), materials.water)
  water.position.set(0, waterLevel, -350)
  water.renderOrder = 1
  water.receiveShadow = true
  group.add(water)

  // Warm pools of lamplight, only visible after dusk.
  const poolPositions: number[] = []
  const poolUvs: number[] = []
  for (const post of lamps) {
    const size = 150
    const y = Math.max(4.5, terrainHeight(post.x, post.z) + 4.5)
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
      [1, 1],
      [0, 1]
    ]) {
      poolPositions.push(post.x + (u - 0.5) * size, y, post.z - (v - 0.5) * size)
      poolUvs.push(u, v)
    }
  }
  const poolGeometry = new BufferGeometry()
  poolGeometry.setAttribute('position', new Float32BufferAttribute(poolPositions, 3))
  poolGeometry.setAttribute('uv', new Float32BufferAttribute(poolUvs, 2))
  poolGeometry.computeBoundingSphere()
  const pools = new Mesh(poolGeometry, materials.pools)
  pools.renderOrder = 2
  pools.visible = false
  group.add(pools)

  return {
    group,
    pools,
    obstacles,
    occluders,
    roofs,
    lamps,
    stats: { vertices: b.vertices, forestTrees },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose()
      })
    }
  }
}

export const plazaFountain = (() => {
  const block = townBlocks.find((item) => item.kind === 'plaza') ?? townBlocks[0]
  const top = block.top + sidewalk
  const bottom = block.bottom - sidewalk
  return { x: (block.left + block.right) / 2, z: (top + 320 + 100 + bottom) / 2 }
})()

export const windmillPosition = (() => {
  const x = fieldGrid.x + millField.column * 560 + 240
  const z = fieldGrid.z + millField.row * 480 + 200
  return { x, z, y: terrainHeight(x, z), hub: { y: 270, z: 66 } }
})()
