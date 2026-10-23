import { type TownLabel, townAtlasRects, townLabelAspect } from './town-atlas'
import { face, surface, type TownBuilder } from './town-mesh-builder'
import { mulberry32 } from './town-world'

// Buildings are modelled facing +z: the front wall lies on z = 0 and the body
// extends to z = -depth. Residents are about 70 units tall; storeys are ~100.

export type BuildingKind =
  | 'house'
  | 'cottage'
  | 'townhouse'
  | 'apartment'
  | 'shop'
  | 'civic'
  | 'townhall'
  | 'hospital'
  | 'school'
  | 'fire'
  | 'hotel'
  | 'cinema'
  | 'church'
  | 'warehouse'
  | 'fishmarket'
  | 'station'
  | 'office'

export type BuildingSpec = {
  kind: BuildingKind
  width: number
  depth: number
  seed: number
  label?: TownLabel
  floors?: number
}

export const palette = {
  walls: [0xf6e7c9, 0xf3c9ac, 0xc5e4d1, 0xc3dbee, 0xf5dd96, 0xf0bfbd, 0xd7c9ec, 0xf8f4ea, 0xe8d3b3],
  bricks: [0xc46a52, 0xb65d4e, 0xd28b67, 0xa95a50],
  roofs: [0x56689a, 0xc65a4c, 0x3f8f87, 0x8b5b47, 0x4f5468, 0x5f9160, 0xd57c45, 0x7b62a0],
  doors: [0x7b4e37, 0x3f6080, 0xb84b40, 0x2f6c57, 0x5a4a7a],
  awnings: [
    [0xe8574f, 0xfff4e4],
    [0x3e8f84, 0xfff4e4],
    [0xf2b84b, 0xfff4e4],
    [0x4d6fb3, 0xfff4e4],
    [0xd96a9a, 0xfff4e4],
    [0x6a9a57, 0xf8e8b8]
  ],
  trim: 0xfdf8ee,
  cream: 0xf2e4c8,
  stone: 0xdcd3c1,
  darkStone: 0xa79f90,
  glass: 0x6f9ab8,
  frame: 0x5d566b,
  metal: 0xbcc5cc,
  roofDeck: 0x9c9fa6,
  wood: 0x9b6a4a,
  leaf: 0x5aa65a,
  flowers: [0xf2667a, 0xffd25c, 0xf59ad0, 0xffffff, 0xb08cf0]
} as const

// A walkable flat roof in building space: the deck height, its size and the
// footprints of rooftop clutter that residents cannot stand in.
export type BuildingRoof = {
  height: number
  width: number
  depth: number
  clutter: { x: number; z: number; halfX: number; halfZ: number }[]
}

type Context = { b: TownBuilder; rng: () => number; door?: number; roof?: BuildingRoof }
const pick = <T>(rng: () => number, items: readonly T[]) => items[Math.floor(rng() * items.length)]
const lit = (rng: () => number) => (rng() < 0.55 ? 0.65 + rng() * 0.5 : 0)
function darken(hex: number, factor: number) {
  const r = Math.round(((hex >> 16) & 255) * factor)
  const g = Math.round(((hex >> 8) & 255) * factor)
  const b = Math.round((hex & 255) * factor)
  return (r << 16) | (g << 8) | b
}

function wallFaces(width: number, depth: number) {
  return [
    { x: 0, z: 0, yaw: 0, span: width, front: true },
    { x: width / 2, z: -depth / 2, yaw: Math.PI / 2, span: depth, front: false },
    { x: 0, z: -depth, yaw: Math.PI, span: width, front: false },
    { x: -width / 2, z: -depth / 2, yaw: -Math.PI / 2, span: depth, front: false }
  ]
}

type WindowOptions = {
  frame?: number
  shutter?: number
  flowers?: boolean
  mullion?: boolean
  glass?: number
}

function windowAt(
  { b, rng }: Context,
  x: number,
  y: number,
  width: number,
  height: number,
  options: WindowOptions = {}
) {
  const frame = options.frame ?? palette.trim
  b.box(x, y, 1.5, width + 8, height + 8, 3, frame, {
    faces: face.px | face.nx | face.py | face.pz
  })
  b.box(x, y, 3.2, width, height, 0.4, options.glass ?? palette.glass, {
    glow: lit(rng),
    faces: face.pz
  })
  if (options.mullion) {
    b.box(x, y, 3.8, 2.4, height, 1.2, frame, { faces: face.pz | face.px | face.nx })
    b.box(x, y + height * 0.12, 3.8, width, 2.4, 1.2, frame, { faces: face.pz | face.py })
  }
  b.box(x, y - height / 2 - 5, 4, width + 14, 4, 9, frame)
  if (options.shutter !== undefined) {
    for (const side of [-1, 1])
      b.box(x + side * (width / 2 + 10), y, 2.5, 11, height + 4, 2, options.shutter, {
        surface: surface.siding
      })
  }
  if (options.flowers) {
    b.box(x, y - height / 2 - 12, 7, width + 4, 9, 10, palette.wood)
    for (let index = 0; index < 4; index++)
      b.blob(
        x - width / 2 + 4 + (index * (width - 8)) / 3,
        y - height / 2 - 5,
        9,
        12,
        10,
        10,
        index % 2 ? pick(rng, palette.flowers) : palette.leaf
      )
  }
}

// Repeat windows along every wall; `skip` returns true for openings handled elsewhere.
function windowRows(
  context: Context,
  width: number,
  depth: number,
  floors: { y: number; height: number }[],
  options: WindowOptions & {
    spacing?: number
    windowWidth?: number
    sides?: boolean
    skip?: (front: boolean, floor: number, x: number) => boolean
  } = {}
) {
  const spacing = options.spacing ?? 78
  const windowWidth = options.windowWidth ?? 40
  for (const wall of wallFaces(width, depth)) {
    if (!wall.front && options.sides === false) continue
    const count = Math.max(1, Math.floor((wall.span - 30) / spacing))
    context.b.frame(wall.x, wall.z, wall.yaw, () => {
      for (const [floor, level] of floors.entries()) {
        for (let index = 0; index < count; index++) {
          const x = -wall.span / 2 + ((index + 0.5) * wall.span) / count
          if (options.skip?.(wall.front, floor, x)) continue
          windowAt(context, x, level.y, windowWidth, level.height, {
            ...options,
            shutter: wall.front ? options.shutter : undefined,
            flowers: wall.front && options.flowers,
            mullion: wall.front && options.mullion
          })
        }
      }
    })
  }
}

function plinth({ b }: Context, width: number, depth: number, color: number = palette.darkStone) {
  b.box(0, 4, -depth / 2, width + 8, 8, depth + 8, color, { surface: surface.stone })
}

function body(
  { b }: Context,
  width: number,
  depth: number,
  height: number,
  color: number,
  wallSurface: number,
  base = 0
) {
  b.box(0, base + height / 2, -depth / 2, width, height, depth, color, { surface: wallSurface })
}

function band({ b }: Context, width: number, depth: number, y: number, color: number, size = 6) {
  b.box(0, y, -depth / 2, width + 6, size, depth + 6, color)
}

function door(
  context: Context,
  x: number,
  color: number,
  options: { width?: number; canopy?: number; double?: boolean; lamp?: boolean } = {}
) {
  const { b } = context
  context.door ??= x
  const width = options.width ?? 40
  b.box(x, 47, 1.5, width + 12, 94, 3, palette.trim, {
    faces: face.px | face.nx | face.py | face.pz
  })
  if (options.double) {
    b.box(x, 42, 3.4, width, 84, 0.6, palette.glass, { faces: face.pz, glow: 0.9 })
    b.box(x, 42, 4, 2.5, 84, 1, palette.frame, { faces: face.pz })
  } else {
    b.box(x, 42, 3.4, width, 84, 0.8, color, { faces: face.pz })
    b.box(x, 62, 4, width * 0.55, 22, 0.6, palette.glass, { faces: face.pz, glow: 0.6 })
    b.box(x + width * 0.32, 40, 5, 4, 4, 3, 0xe9c46a)
  }
  b.box(x, 3, 14, width + 34, 6, 26, palette.stone, { surface: surface.stone })
  if (options.canopy !== undefined) {
    b.box(x, 104, 18, width + 40, 5, 36, options.canopy, { rx: 0.18 })
    for (const side of [-1, 1]) b.box(x + side * (width / 2 + 14), 98, 6, 4, 10, 12, palette.trim)
  }
  if (options.lamp) {
    b.box(x + width / 2 + 16, 72, 6, 9, 14, 9, 0x403a48)
    b.box(x + width / 2 + 16, 72, 9, 6, 9, 4, 0xffd98a, { glow: -0.9 })
  }
}

function gableRoof(
  { b }: Context,
  width: number,
  depth: number,
  y: number,
  rise: number,
  roof: number,
  wall: number,
  wallSurface: number,
  overhang = 16
) {
  b.prism(0, y, -depth / 2, width, rise, depth, wall, { surface: wallSurface })
  const run = depth / 2 + overhang
  const angle = Math.atan2(rise, depth / 2)
  const length = run / Math.cos(angle)
  for (const side of [-1, 1]) {
    b.box(
      0,
      y + rise - (run / 2) * Math.tan(angle) + 5,
      -depth / 2 + (side * run) / 2,
      width + overhang * 2,
      8,
      length,
      roof,
      { rx: side * angle, surface: surface.tiles }
    )
  }
  b.box(0, y + rise + 6, -depth / 2, width + overhang * 2 + 2, 7, 12, darken(roof, 0.8))
}

function hipRoof(
  { b }: Context,
  width: number,
  depth: number,
  y: number,
  rise: number,
  roof: number,
  overhang = 16
) {
  b.box(0, y + 2, -depth / 2, width + overhang * 2, 6, depth + overhang * 2, palette.trim)
  b.hip(0, y + 5, -depth / 2, width + overhang * 2, rise, depth + overhang * 2, roof, {
    surface: surface.tiles
  })
}

function flatRoof(
  context: Context,
  width: number,
  depth: number,
  y: number,
  parapet: number,
  clutter = true
) {
  const { b, rng } = context
  b.box(0, y + 1, -depth / 2, width - 6, 2, depth - 6, palette.roofDeck, {
    surface: surface.paving
  })
  context.roof = { height: y + 2, width, depth, clutter: [] }
  for (const [x, z, w, d] of [
    [0, -3, width, 6],
    [0, -depth + 3, width, 6],
    [-width / 2 + 3, -depth / 2, 6, depth],
    [width / 2 - 3, -depth / 2, 6, depth]
  ])
    b.box(x, y + 8, z, w, 16, d, parapet)
  if (!clutter) return
  const units = 1 + Math.floor(rng() * 3)
  for (let index = 0; index < units; index++) {
    const x = (rng() - 0.5) * (width - 70)
    const z = -depth * (0.3 + rng() * 0.5)
    b.box(x, y + 14, z, 30, 24, 24, palette.metal, { surface: surface.metal })
    b.cylinder(x, y + 26.5, z, 9, 1, 0x6a717a, { segments: 10 })
    roofClutter(context, x, z, 15, 12)
  }
  if (rng() < 0.6) {
    b.cylinder(width * 0.3, y + 12, -depth * 0.25, 6, 22, 0x8d949c)
    roofClutter(context, width * 0.3, -depth * 0.25, 6)
  }
}

function roofClutter(context: Context, x: number, z: number, halfX: number, halfZ = halfX) {
  context.roof?.clutter.push({ x, z, halfX, halfZ })
}

function chimney({ b }: Context, x: number, z: number, top: number, color: number) {
  b.box(x, top - 30, z, 22, 70, 22, color, { surface: surface.brick })
  b.box(x, top + 6, z, 28, 6, 28, palette.darkStone)
}

export function signBoard(
  b: TownBuilder,
  label: TownLabel,
  x: number,
  y: number,
  z: number,
  height: number,
  frame: number = palette.frame,
  doubleSided = false
) {
  const width = height * townLabelAspect()
  b.box(x, y, z, width + 8, height + 8, 5, frame, { faces: 63 })
  const options = { uv: townAtlasRects.labels[label], glow: -0.35 }
  b.quad(x, y, z + 2.6, width, height, 0xffffff, options)
  if (doubleSided) b.frame(x, z, Math.PI, () => b.quad(0, y, 2.6, width, height, 0xffffff, options))
  return width
}

// Back doors, wall units and downpipes for the side most people see from the street behind.
function rear(context: Context, width: number, depth: number, height: number, color: number) {
  const { b, rng } = context
  b.frame(0, -depth, Math.PI, () => {
    const x = (rng() - 0.5) * (width - 120)
    b.box(x, 42, 2, 40, 84, 2, color, { faces: face.pz })
    b.box(x, 3, 14, 60, 6, 26, palette.stone, { surface: surface.stone })
    b.box(x, 96, 14, 56, 4, 28, palette.frame)
    b.box(x + 34, 74, 5, 8, 10, 8, 0xffd98a, { glow: -0.8 })
    const unit = x + (x > 0 ? -90 : 90)
    if (Math.abs(unit) < width / 2 - 30) {
      b.box(unit, 26, 12, 40, 34, 22, palette.metal, { surface: surface.metal })
      b.cylinder(unit, 26, 23.5, 12, 1, 0x6a717a, { rx: Math.PI / 2, segments: 10 })
    }
    b.box(width / 2 - 10, height / 2, 4, 6, height, 6, 0x8d949c)
  })
}

function awning({ b }: Context, x: number, y: number, width: number, colors: readonly number[]) {
  const stripes = Math.max(3, Math.round(width / 22))
  const stripe = width / stripes
  for (let index = 0; index < stripes; index++) {
    const color = colors[index % 2]
    const sx = x - width / 2 + stripe * (index + 0.5)
    b.box(sx, y, 22, stripe, 4, 46, color, { rx: 0.36 })
    b.box(sx, y - 16, 44, stripe, 12, 2, color, { faces: face.pz | face.py | face.px | face.nx })
  }
}

function storefront(
  context: Context,
  width: number,
  doorX: number,
  doorColor: number,
  options: { posters?: boolean } = {}
) {
  const { b, rng } = context
  b.box(0, 12, 2.5, width, 24, 5, palette.frame)
  const panels = Math.max(2, Math.round(width / 70))
  const glassWidth = width - 8
  b.box(0, 64, 1.5, glassWidth, 80, 1, palette.glass, { faces: face.pz, glow: 0.95 + rng() * 0.3 })
  for (let index = 0; index <= panels; index++) {
    const x = -glassWidth / 2 + (index * glassWidth) / panels
    b.box(x, 64, 3, 5, 82, 4, palette.frame, { faces: face.pz | face.px | face.nx })
  }
  b.box(0, 106, 3, width, 6, 5, palette.frame)
  if (options.posters) {
    const poster = pick(rng, townAtlasRects.posters)
    b.quad(doorX > 0 ? -width / 4 : width / 4, 58, 2.4, 22, 30, 0xffffff, {
      uv: poster,
      glow: -0.2
    })
  }
  door(context, doorX, doorColor, { width: 38, double: true })
}

function shopProps(
  context: Context,
  label: TownLabel | undefined,
  width: number,
  top: number,
  depth: number
) {
  const { b, rng } = context
  if (label === 'BURGER') {
    // A giant burger sits on the roof, readable from the overview.
    const z = -depth * 0.45
    b.cylinder(0, top + 24, z, 46, 22, 0xd99a4a, { segments: 16, top: 0.85 })
    b.cylinder(0, top + 38, z, 50, 8, 0x6b3a2a, { segments: 16 })
    b.cylinder(0, top + 44, z, 52, 4, 0x6dbf55, { segments: 16 })
    b.cylinder(0, top + 47, z, 50, 4, 0xf2c94c, { segments: 16 })
    b.blob(0, top + 60, z, 96, 40, 96, 0xe0a456, { detail: 1 })
    b.box(0, top + 10, z, 10, 20, 10, palette.frame)
    roofClutter(context, 0, z, 52)
  } else if (label === 'ICE CREAM') {
    const z = -depth * 0.45
    b.cone(0, top + 45, z, 22, 70, 0xe4b56a, { segments: 10, rx: Math.PI })
    b.blob(0, top + 88, z, 52, 46, 52, 0xffc6dc, { detail: 1 })
    b.blob(0, top + 116, z, 38, 34, 38, 0xfff3dc, { detail: 1 })
    b.blob(0, top + 138, z, 10, 10, 10, 0xe04452)
    roofClutter(context, 0, z, 26)
  } else if (label === 'BAKERY') {
    for (const [x, z] of [
      [-30, 30],
      [30, 30]
    ]) {
      b.box(x, 12, z, 34, 24, 26, palette.wood)
      b.blob(x - 6, 28, z, 18, 10, 14, 0xd9963f)
      b.blob(x + 7, 28, z, 18, 10, 14, 0xe0a85a)
    }
  } else if (label === 'FLOWERS') {
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - 34)
      b.box(x, 14, 30, 44, 28, 36, palette.wood, { surface: surface.planks })
      for (let index = 0; index < 6; index++)
        b.blob(
          x - 14 + (index % 3) * 14,
          33 + Math.floor(index / 3) * 4,
          22 + Math.floor(index / 3) * 14,
          16,
          14,
          14,
          pick(rng, palette.flowers)
        )
    }
  } else if (label === 'CAFE' || label === 'PIZZA' || label === 'DINER') {
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - 40)
      b.cylinder(x, 2, 48, 18, 4, palette.frame, { segments: 10 })
      b.cylinder(x, 22, 48, 2, 40, palette.frame)
      b.cylinder(x, 42, 48, 22, 3, palette.trim, { segments: 12 })
      b.cylinder(x, 104, 48, 2, 90, palette.frame)
      b.cone(x, 140, 48, 52, 28, pick(rng, palette.awnings)[0], { segments: 8 })
      for (const seat of [-1, 1]) b.box(x + seat * 30, 16, 48, 16, 30, 16, palette.wood)
    }
  } else if (label === 'TOYS') {
    b.blob(-width * 0.25, top + 36, -depth * 0.4, 60, 60, 60, 0xe85d5d, { detail: 1 })
    b.box(width * 0.2, top + 30, -depth * 0.5, 50, 50, 50, 0x5b8fe0)
    b.box(width * 0.2, top + 64, -depth * 0.5, 30, 18, 30, 0xf3c94c)
    roofClutter(context, -width * 0.25, -depth * 0.4, 30)
    roofClutter(context, width * 0.2, -depth * 0.5, 25)
  } else if (label === 'ARCADE') {
    for (let index = 0; index < 4; index++)
      b.box(0, 132 + index * 12, 4, width - 20, 4, 3, index % 2 ? 0xff5fa2 : 0x55e6ff, {
        glow: -1.2
      })
  } else if (label === 'BOOKS') {
    for (const [index, color] of [0x3f62c7, 0xe0567b, 0xf2b84b, 0x3e8f84].entries())
      b.box(0, top + 9 + index * 14, -depth * 0.4, 70 - index * 8, 13, 46, color)
    roofClutter(context, 0, -depth * 0.4, 35, 23)
  }
}

function house(context: Context, width: number, depth: number, floors: number) {
  const { b, rng } = context
  const brick = rng() < 0.3
  const wall = brick ? pick(rng, palette.bricks) : pick(rng, palette.walls)
  const wallSurface = brick ? surface.brick : surface.siding
  const roof = pick(rng, palette.roofs)
  const trim = rng() < 0.75 ? palette.trim : palette.cream
  const floorHeight = 100
  const height = floors * floorHeight + 8
  plinth(context, width, depth)
  body(context, width, depth, height, wall, wallSurface)
  if (floors > 1) band(context, width, depth, floorHeight + 4, trim, 5)
  for (const side of [-1, 1]) b.box(side * (width / 2 - 2), height / 2, -2, 8, height, 8, trim)
  const doorX = (rng() < 0.5 ? -1 : 1) * Math.min(width * 0.24, width / 2 - 50)
  const shutter = rng() < 0.6 ? pick(rng, palette.roofs) : undefined
  const porch = rng() < 0.4
  door(context, doorX, pick(rng, palette.doors), { canopy: porch ? undefined : roof, lamp: true })
  if (porch) {
    b.box(doorX, 104, 30, 96, 6, 64, roof, { rx: 0.12 })
    for (const side of [-1, 1]) b.box(doorX + side * 42, 52, 56, 7, 104, 7, trim)
    b.box(doorX, 4, 34, 104, 8, 66, palette.wood, { surface: surface.planks })
  }
  const levels = Array.from({ length: floors }, (_, floor) => ({
    y: floor * floorHeight + 58,
    height: 46
  }))
  windowRows(context, width, depth, levels, {
    frame: trim,
    shutter,
    flowers: rng() < 0.5,
    mullion: true,
    spacing: 96,
    skip: (front, floor, x) => front && floor === 0 && Math.abs(x - doorX) < 60
  })
  const rise = (depth / 2) * (0.7 + rng() * 0.25)
  if (rng() < 0.62) {
    gableRoof(context, width, depth, height, rise, roof, wall, wallSurface)
    if (width > 230 && rng() < 0.6) {
      const x = -doorX * 0.8
      b.box(x, height + rise * 0.35, -depth * 0.18, 56, rise * 0.7, 50, wall, {
        surface: wallSurface
      })
      b.box(x, height + rise * 0.35, -depth * 0.18 + 25.5, 30, 30, 1, palette.glass, {
        faces: face.pz,
        glow: lit(rng)
      })
      b.prism(x, height + rise * 0.7, -depth * 0.18, 66, 26, 60, roof, {
        ry: Math.PI / 2,
        surface: surface.tiles
      })
    }
  } else {
    hipRoof(context, width, depth, height, rise, roof)
  }
  chimney(
    context,
    width * 0.3 * (doorX > 0 ? -1 : 1),
    -depth * 0.62,
    height + rise * 0.85,
    pick(rng, palette.bricks)
  )
  return height + rise + 10
}

function townhouse(context: Context, width: number, depth: number, floors: number) {
  const { b, rng } = context
  const wall = rng() < 0.6 ? pick(rng, palette.bricks) : pick(rng, palette.walls)
  const wallSurface = wall === palette.walls[0] ? surface.siding : surface.brick
  const floorHeight = 96
  const height = floors * floorHeight + 26
  plinth(context, width, depth)
  body(context, width, depth, height, wall, wallSurface)
  band(context, width, depth, height - 6, palette.trim, 12)
  const doorX = -width * 0.22
  door(context, doorX, pick(rng, palette.doors), { canopy: palette.frame, lamp: true })
  // A bay window projects from the upper floors.
  const bayX = width * 0.18
  b.box(bayX, floorHeight * 1.5 + 20, 14, 86, floorHeight * (floors - 1) - 10, 28, palette.trim)
  for (let floor = 1; floor < floors; floor++) {
    b.box(bayX, floor * floorHeight + 58, 28.4, 60, 50, 0.6, palette.glass, {
      faces: face.pz,
      glow: lit(rng)
    })
  }
  windowRows(
    context,
    width,
    depth,
    Array.from({ length: floors }, (_, floor) => ({ y: floor * floorHeight + 58, height: 50 })),
    {
      spacing: 72,
      windowWidth: 34,
      mullion: true,
      skip: (front, floor, x) =>
        front &&
        ((floor === 0 && Math.abs(x - doorX) < 50) || (floor > 0 && Math.abs(x - bayX) < 60))
    }
  )
  flatRoof(context, width, depth, height, palette.trim, rng() < 0.5)
  rear(context, width, depth, height, pick(rng, palette.doors))
  return height + 20
}

function apartment(context: Context, width: number, depth: number, floors: number) {
  const { b, rng } = context
  const wall = pick(rng, [0xf6efe2, 0xe9dccb, 0xcfe0ea, 0xf3d6c2, 0xd9e4cf])
  const accent = pick(rng, palette.roofs)
  const floorHeight = 92
  const height = floors * floorHeight + 14
  plinth(context, width, depth)
  body(context, width, depth, height, wall, surface.plain)
  b.box(0, 50, -depth / 2, width + 4, 100, depth + 4, darken(wall, 0.86), {
    surface: surface.stone
  })
  for (let floor = 1; floor < floors; floor++)
    band(context, width, depth, floor * floorHeight + 4, palette.trim, 4)
  door(context, 0, palette.glass, { width: 56, double: true })
  b.box(0, 108, 34, 120, 8, 68, accent)
  const units = Math.max(2, Math.round(width / 130))
  const unit = width / units
  for (let floor = 1; floor < floors; floor++) {
    for (let index = 0; index < units; index++) {
      const x = -width / 2 + unit * (index + 0.5)
      const y = floor * floorHeight
      b.box(x, y + 50, 1.5, unit * 0.62, 72, 1, palette.glass, { faces: face.pz, glow: lit(rng) })
      b.box(x, y + 4, 16, unit - 12, 7, 32, palette.trim)
      b.box(x, y + 24, 31, unit - 12, 34, 3, 0xdfe9ef, {
        faces: face.pz | face.py | face.px | face.nx
      })
      b.box(x, y + 42, 31.5, unit - 10, 3, 4, accent)
      if (rng() < 0.4) b.blob(x + unit * 0.3, y + 22, 20, 18, 22, 16, palette.leaf)
      if (rng() < 0.25)
        b.box(x - unit * 0.2, y + 34, 16, unit * 0.3, 18, 1, pick(rng, palette.flowers), {
          faces: face.pz
        })
    }
  }
  windowRows(
    context,
    width,
    depth,
    Array.from({ length: floors }, (_, floor) => ({ y: floor * floorHeight + 54, height: 44 })),
    {
      spacing: 80,
      windowWidth: 38,
      skip: (front, floor) => front && floor > 0,
      frame: palette.trim
    }
  )
  windowAt(context, -width * 0.3, 58, 50, 40)
  windowAt(context, width * 0.3, 58, 50, 40)
  flatRoof(context, width, depth, height, darken(wall, 0.9))
  const tankX = -width * 0.25
  for (const [dx, dz] of [
    [-16, -16],
    [16, -16],
    [-16, 16],
    [16, 16]
  ])
    b.box(tankX + dx, height + 16, -depth / 2 + dz, 4, 32, 4, palette.frame)
  b.cylinder(tankX, height + 54, -depth / 2, 30, 44, 0xb3d2df, {
    segments: 12,
    surface: surface.metal
  })
  b.cone(tankX, height + 84, -depth / 2, 32, 16, 0x7d9fb0, { segments: 12 })
  roofClutter(context, tankX, -depth / 2, 32)
  rear(context, width, depth, height, palette.glass)
  return height + 90
}

function shop(context: Context, width: number, depth: number, floors: number, label?: TownLabel) {
  const { b, rng } = context
  const brick = rng() < 0.4
  const wall = brick ? pick(rng, palette.bricks) : pick(rng, palette.walls)
  const wallSurface = brick ? surface.brick : surface.siding
  const ground = 118
  const upper = 96
  const height = ground + (floors - 1) * upper + 10
  plinth(context, width, depth)
  body(context, width, depth, height, wall, wallSurface)
  const doorX = (rng() < 0.5 ? -1 : 1) * (width / 2 - 46)
  storefront(context, width - 24, doorX, pick(rng, palette.doors), { posters: rng() < 0.6 })
  const colors = pick(rng, palette.awnings)
  awning(context, 0, 112, width - 16, colors)
  if (label) signBoard(context.b, label, 0, ground + 26, 6, 32)
  band(context, width, depth, ground + 4, palette.trim, 6)
  if (floors > 1) {
    windowRows(
      context,
      width,
      depth,
      Array.from({ length: floors - 1 }, (_, floor) => ({
        y: ground + floor * upper + 52,
        height: 44
      })),
      {
        spacing: 84,
        mullion: true,
        flowers: rng() < 0.4,
        shutter: rng() < 0.4 ? colors[0] : undefined
      }
    )
  }
  windowRows(context, width, depth, [{ y: 60, height: 44 }], {
    skip: (front) => front,
    spacing: 110
  })
  const falseFront = rng() < 0.5
  if (falseFront) {
    b.box(0, height + 26, -3, width, 52, 6, wall, { surface: wallSurface })
    b.box(0, height + 54, -3, width + 8, 6, 10, palette.trim)
    flatRoof(context, width, depth, height, wall)
  } else if (rng() < 0.5) {
    gableRoof(
      context,
      width,
      depth,
      height,
      depth * 0.32,
      pick(rng, palette.roofs),
      wall,
      wallSurface,
      10
    )
  } else {
    band(context, width, depth, height, palette.trim, 10)
    flatRoof(context, width, depth, height, palette.trim)
  }
  shopProps(context, label, width, height, depth)
  rear(context, width, depth, height, pick(rng, palette.doors))
  return height + (label === 'ICE CREAM' ? 140 : label === 'BURGER' ? 80 : 60)
}

function columns(
  { b }: Context,
  width: number,
  count: number,
  height: number,
  z: number,
  color: number = palette.trim
) {
  for (let index = 0; index < count; index++) {
    const x = -width / 2 + (index * width) / (count - 1)
    b.box(x, 6, z, 26, 12, 26, color)
    b.cylinder(x, height / 2 + 12, z, 10, height - 12, color, { segments: 10 })
    b.box(x, height + 4, z, 26, 8, 26, color)
  }
}

function portico(context: Context, width: number, height: number, label?: TownLabel) {
  const { b } = context
  const depth = 70
  for (let step = 0; step < 3; step++)
    b.box(
      0,
      4 + step * 8,
      depth + 30 - step * 14,
      width + 60 - step * 16,
      8,
      40 + step * 4,
      palette.stone,
      {
        surface: surface.stone
      }
    )
  b.box(0, 26, depth / 2, width + 20, 4, depth, palette.stone, { surface: surface.stone })
  columns(context, width, Math.max(4, Math.round(width / 60)), height - 26, depth - 8)
  b.box(0, height + 12, depth / 2 - 4, width + 28, 20, depth + 8, palette.trim)
  b.prism(0, height + 22, depth / 2 - 4, depth + 8, 46, width + 36, palette.trim, {
    ry: Math.PI / 2
  })
  if (label) signBoard(context.b, label, 0, height + 12, depth + 2, 18)
}

function civic(context: Context, width: number, depth: number, label?: TownLabel) {
  const { b, rng } = context
  const police = label === 'POLICE'
  const post = label === 'POST'
  const wall = police ? 0xdfe6ef : post ? 0xf3e2c4 : pick(rng, [0xe8dcc6, 0xd9c6a5, 0xe6d3c0])
  const floorHeight = 118
  const height = floorHeight * 2 + 20
  plinth(context, width, depth, palette.darkStone)
  body(context, width, depth, height, wall, surface.stone)
  band(context, width, depth, floorHeight + 6, palette.trim, 8)
  band(context, width, depth, height, palette.trim, 14)
  const porticoWidth = Math.min(width * 0.5, 230)
  portico(context, porticoWidth, height - 30, label)
  door(context, 0, palette.doors[0], { width: 54, double: true })
  windowRows(
    context,
    width,
    depth,
    [
      { y: 66, height: 64 },
      { y: floorHeight + 66, height: 64 }
    ],
    {
      spacing: 76,
      windowWidth: 38,
      mullion: true,
      frame: palette.trim,
      skip: (front, _floor, x) => front && Math.abs(x) < porticoWidth / 2 + 30
    }
  )
  const roof = police ? 0x40507a : post ? 0xc65a4c : 0x5e7c78
  hipRoof(context, width, depth, height + 6, depth * 0.3, roof, 10)
  if (police) {
    b.box(width * 0.36, height + 40, -depth * 0.5, 12, 70, 12, palette.frame)
    b.box(width * 0.36, height + 80, -depth * 0.5, 26, 12, 26, 0x4d7be0, { glow: -1 })
    b.box(-width * 0.36, height + 30, -depth * 0.4, 6, 60, 6, palette.frame)
  }
  if (post) {
    b.box(width * 0.36, 30, 60, 26, 60, 22, 0xd9452f)
    b.cylinder(width * 0.36, 60, 60, 13, 22, 0xd9452f, {
      segments: 12,
      arc: Math.PI,
      rz: Math.PI / 2
    })
  }
  if (label === 'LIBRARY') {
    b.hip(0, height + 50, -depth / 2, 110, 70, 110, 0x7aa6a0, { surface: surface.metal })
    b.box(0, height + 30, -depth / 2, 110, 40, 110, wall, { surface: surface.stone })
  }
  return height + depth * 0.3 + 40
}

function clockFace({ b }: Context, y: number, z: number, size: number) {
  b.quad(0, y, z, size, size, 0xffffff, { uv: townAtlasRects.clock, glow: -0.4 })
  b.box(0, y + size * 0.16, z + 1.5, 3, size * 0.34, 1.5, 0x2b2638)
  b.box(size * 0.13, y, z + 2.2, size * 0.28, 3, 1.5, 0x2b2638, { rz: 0.4 })
}

function townhall(context: Context, width: number, depth: number) {
  const { b } = context
  const height = civic(context, width, depth, 'TOWN HALL')
  const top = 256
  const tower = 96
  b.frame(0, -depth / 2, 0, () => {
    b.box(0, top + 120, 0, tower, 240, tower, 0xe8dcc6, { surface: surface.stone })
    b.box(0, top + 244, 0, tower + 14, 10, tower + 14, palette.trim)
    for (const wall of wallFaces(tower, tower)) {
      b.frame(wall.x, wall.z + tower / 2, wall.yaw, () => {
        clockFace(context, top + 190, 2, 64)
        b.box(0, top + 90, 1.5, 30, 60, 3, palette.glass, { glow: 0.7, faces: face.pz })
      })
    }
    b.box(0, top + 268, 0, 70, 40, 70, palette.trim)
    for (const [x, z] of [
      [-28, -28],
      [28, -28],
      [-28, 28],
      [28, 28]
    ])
      b.box(x, top + 268, z, 10, 40, 10, palette.cream)
    b.hip(0, top + 288, 0, 92, 110, 92, 0x3f6a8a, { surface: surface.metal })
    b.cylinder(0, top + 420, 0, 2, 50, palette.frame)
    b.box(14, top + 436, 0, 26, 16, 1, 0xe8574f, { faces: face.pz | face.nz })
  })
  return Math.max(height, top + 445)
}

function hospital(context: Context, width: number, depth: number) {
  const { b } = context
  const floors = 4
  const floorHeight = 96
  const height = floors * floorHeight + 18
  plinth(context, width, depth)
  body(context, width, depth, height, 0xf7f7f2, surface.plain)
  for (let floor = 1; floor <= floors; floor++)
    band(context, width, depth, floor * floorHeight + 4, 0xa9d3d8, 5)
  b.box(0, 120, 46, 220, 10, 92, 0xf2f2ee)
  for (const side of [-1, 1]) b.box(side * 100, 58, 84, 10, 116, 10, palette.trim)
  signBoard(context.b, 'HOSPITAL', 0, 140, 92, 24, 0xd8434e)
  door(context, 0, palette.glass, { width: 70, double: true })
  windowRows(
    context,
    width,
    depth,
    Array.from({ length: floors }, (_, floor) => ({ y: floor * floorHeight + 56, height: 42 })),
    {
      spacing: 66,
      windowWidth: 40,
      frame: 0xd5e7ea,
      skip: (front, floor, x) => front && floor === 0 && Math.abs(x) < 130
    }
  )
  for (const x of [-width / 2 + 60, width / 2 - 60]) {
    b.box(x, height - 60, 4, 70, 70, 4, 0xffffff)
    b.quad(x, height - 60, 6.1, 60, 60, 0xffffff, { uv: townAtlasRects.cross, glow: -0.5 })
  }
  flatRoof(context, width, depth, height, 0xe9eeee)
  b.cylinder(0, height + 4, -depth / 2, 70, 4, 0x56606a, { segments: 20 })
  b.box(-12, height + 7, -depth / 2, 8, 2, 50, palette.trim)
  b.box(12, height + 7, -depth / 2, 8, 2, 50, palette.trim)
  b.box(0, height + 7, -depth / 2, 24, 2, 8, palette.trim)
  ambulance(context, width / 2 - 90, 130)
  return height + 40
}

function ambulance({ b }: Context, x: number, z: number) {
  b.frame(x, z, Math.PI / 2, () => {
    b.box(0, 26, 0, 46, 40, 86, 0xffffff)
    b.box(0, 30, 44, 42, 22, 6, palette.glass)
    b.box(0, 46, -10, 44, 4, 50, 0xe04452)
    b.box(0, 49, 30, 20, 6, 8, 0xe04452, { glow: -0.8 })
    for (const sx of [-1, 1])
      for (const sz of [-28, 28])
        b.cylinder(sx * 22, 10, sz, 10, 8, 0x2e2a35, { rz: Math.PI / 2, segments: 10 })
  })
}

function school(context: Context, width: number, depth: number) {
  const { b } = context
  const floors = 3
  const floorHeight = 100
  const height = floors * floorHeight + 20
  const wall = 0xf3ead2
  plinth(context, width, depth)
  body(context, width, depth, height, wall, surface.plain)
  for (let floor = 1; floor <= floors; floor++)
    band(context, width, depth, floor * floorHeight + 4, 0x8fb7d9, 6)
  b.box(0, height / 2 + 30, 18, 120, height + 60, 36, 0xe7dcc0)
  b.frame(0, 36, 0, () => clockFace(context, height - 30, 1, 70))
  signBoard(context.b, 'SCHOOL', 0, 150, 37, 22)
  door(context, 0, palette.glass, { width: 64, double: true })
  for (const z of [36]) b.box(0, 3, z + 30, 140, 6, 40, palette.stone)
  windowRows(
    context,
    width,
    depth,
    Array.from({ length: floors }, (_, floor) => ({ y: floor * floorHeight + 58, height: 52 })),
    {
      spacing: 64,
      windowWidth: 46,
      mullion: true,
      frame: palette.trim,
      skip: (front, _floor, x) => front && Math.abs(x) < 80
    }
  )
  hipRoof(context, width, depth, height, depth * 0.28, 0x4d6fb3, 14)
  b.hip(0, height + 60, 18, 120, 60, 40, 0x4d6fb3)
  return height + 100
}

function fireStation(context: Context, width: number, depth: number) {
  const { b } = context
  const height = 230
  plinth(context, width, depth)
  body(context, width, depth, height, 0xd35d4c, surface.brick)
  band(context, width, depth, 124, palette.trim, 8)
  band(context, width, depth, height, palette.trim, 12)
  const bays = 2
  for (let index = 0; index < bays; index++) {
    const x = -width / 2 + 70 + index * 110
    b.box(x, 54, 1.5, 92, 108, 3, palette.trim, { faces: face.pz | face.px | face.nx | face.py })
    b.box(x, 52, 3.4, 82, 100, 1, 0xe8e2d8, { faces: face.pz, surface: surface.siding })
  }
  signBoard(context.b, 'FIRE DEPT', -width / 2 + 125, 150, 2, 22)
  door(context, width / 2 - 56, palette.doors[2], { lamp: true })
  windowRows(context, width, depth, [{ y: 176, height: 44 }], { spacing: 80, mullion: true })
  flatRoof(context, width, depth, height, palette.trim, false)
  // The hose tower.
  b.box(width / 2 - 40, height + 70, -depth + 40, 60, 140, 60, 0xd35d4c, { surface: surface.brick })
  b.hip(width / 2 - 40, height + 140, -depth + 40, 76, 40, 76, 0x4f5468)
  roofClutter(context, width / 2 - 40, -depth + 40, 30)
  b.frame(-width / 2 + 125, 60, 0, () => {
    b.box(0, 30, 0, 170, 44, 56, 0xd8322f)
    b.box(55, 56, 0, 52, 26, 52, 0xd8322f)
    b.box(78, 58, 0, 6, 18, 46, palette.glass)
    b.box(-30, 58, 0, 110, 6, 30, 0xd8d8d8, { surface: surface.metal })
    b.box(55, 72, 0, 18, 6, 30, 0x55a0ff, { glow: -1 })
    for (const x of [-55, 45])
      for (const z of [-28, 28])
        b.cylinder(x, 12, z, 12, 8, 0x2e2a35, { rx: Math.PI / 2, segments: 10 })
  })
  return height + 160
}

function hotel(context: Context, width: number, depth: number) {
  const { b, rng } = context
  const floors = 6
  const floorHeight = 92
  const height = floors * floorHeight + 30
  const wall = pick(rng, [0xf0d9b5, 0xe9c7c0, 0xd6e2ea])
  plinth(context, width, depth)
  body(context, width, depth, height, wall, surface.plain)
  b.box(0, 60, -depth / 2, width + 4, 120, depth + 4, 0x8c5a6a, { surface: surface.stone })
  for (let floor = 2; floor <= floors; floor++)
    band(context, width, depth, floor * floorHeight + 4, palette.trim, 4)
  windowRows(
    context,
    width,
    depth,
    Array.from({ length: floors - 1 }, (_, floor) => ({
      y: (floor + 1) * floorHeight + 60,
      height: 48
    })),
    { spacing: 60, windowWidth: 34, mullion: true, frame: palette.trim }
  )
  b.box(0, 116, 50, 180, 10, 100, 0x5b2e52)
  for (const side of [-1, 1]) {
    b.box(side * 82, 58, 96, 8, 116, 8, 0xe9c46a)
    b.cylinder(side * 120, 90, 96, 2, 180, palette.frame)
    b.box(side * 120 + 16, 160, 96, 30, 22, 1, side < 0 ? 0xe8574f : 0x4d6fb3, {
      faces: face.pz | face.nz
    })
  }
  door(context, 0, palette.glass, { width: 64, double: true })
  for (const x of [-width / 3, width / 3]) windowAt(context, x, 60, 70, 60, { mullion: true })
  flatRoof(context, width, depth, height, palette.trim)
  for (const side of [-1, 1]) b.box(side * 110, height + 40, -depth * 0.3, 6, 80, 6, palette.frame)
  signBoard(context.b, 'HOTEL', 0, height + 64, -depth * 0.3, 52, 0x5b2e52, true)
  roofClutter(context, 0, -depth * 0.3, 116, 6)
  return height + 100
}

function cinema(context: Context, width: number, depth: number) {
  const { b } = context
  const height = 260
  plinth(context, width, depth)
  body(context, width, depth, height, 0x6d4a7a, surface.plain)
  b.box(0, height / 2, -2, width - 40, height, 6, 0x82598f)
  for (const side of [-1, 1])
    b.box(side * (width / 2 - 20), height / 2 + 10, 0, 16, height + 20, 12, 0xf2c94c)
  b.box(0, 132, 34, width - 20, 40, 68, 0x2a1830)
  b.quad(0, 132, 68.1, width - 30, 32, 0xffffff, { uv: townAtlasRects.marquee, glow: -1 })
  for (const side of [-1, 1])
    b.quad(side * (width / 2 - 60), 60, 2, 44, 60, 0xffffff, {
      uv: townAtlasRects.posters[side < 0 ? 0 : 2],
      glow: -0.6
    })
  door(context, 0, palette.glass, { width: 70, double: true })
  // A vertical blade sign above the marquee.
  b.frame(0, 40, 0, () => {
    b.box(0, 220, 0, 20, 110, 72, 0x2a1830)
    b.frame(11, 0, Math.PI / 2, () => signBoard(context.b, 'CINEMA', 0, 220, 0, 20, 0x2a1830, true))
  })
  windowRows(context, width, depth, [{ y: 70, height: 40 }], {
    skip: (front) => front,
    spacing: 120
  })
  flatRoof(context, width, depth, height, 0xf2c94c)
  return height + 40
}

function church(context: Context, width: number, depth: number) {
  const { b } = context
  const height = 190
  const wall = 0xf7f2e8
  plinth(context, width, depth)
  body(context, width, depth, height, wall, surface.stone)
  gableRoof(context, width, depth, height, depth * 0.55, 0x56689a, wall, surface.stone, 12)
  door(context, 0, 0x7b4e37, { width: 50 })
  b.box(0, 150, 1, 52, 52, 2, palette.trim)
  b.cylinder(0, 150, 2, 22, 2, 0xd5a6e8, { rx: Math.PI / 2, segments: 12, glow: 0.6 })
  windowRows(context, width, depth, [{ y: 95, height: 80 }], {
    spacing: 70,
    windowWidth: 26,
    glass: 0x9b7fc9
  })
  const towerX = width / 2 - 40
  b.frame(towerX, -30, 0, () => {
    b.box(0, 170, 0, 70, 340, 70, wall, { surface: surface.stone })
    b.box(0, 300, 36, 26, 40, 1, 0x3a3348, { faces: face.pz })
    b.box(0, 344, 0, 80, 10, 80, palette.trim)
    b.cone(0, 430, 0, 46, 170, 0x56689a, { segments: 8 })
    b.box(0, 528, 0, 4, 30, 4, 0xe9c46a)
    b.box(0, 532, 0, 18, 4, 4, 0xe9c46a)
  })
  return 540
}

function warehouse(context: Context, width: number, depth: number) {
  const { b, rng } = context
  const color = pick(rng, [0x7aa6c2, 0xc96b5a, 0x8fb08a, 0xd9b45a])
  const height = 150
  plinth(context, width, depth)
  body(context, width, depth, height, color, surface.metal)
  b.cylinder(0, height, -depth / 2, depth / 2 + 8, width + 10, darken(color, 0.75), {
    rz: Math.PI / 2,
    arc: Math.PI,
    segments: 16,
    surface: surface.metal
  })
  const doors = Math.max(1, Math.floor(width / 140))
  for (let index = 0; index < doors; index++) {
    const x = -width / 2 + ((index + 0.5) * width) / doors
    b.box(x, 50, 1.5, 90, 100, 3, palette.frame, { faces: face.pz | face.px | face.nx | face.py })
    b.box(x, 48, 3.3, 82, 94, 0.6, 0xdfe2e4, { faces: face.pz, surface: surface.siding })
  }
  b.box(0, 120, 2, width * 0.5, 22, 3, palette.trim)
  windowRows(context, width, depth, [{ y: 115, height: 26 }], {
    skip: (front) => front,
    spacing: 90
  })
  for (let index = 0; index < 4; index++) {
    const x = (rng() - 0.5) * (width - 40)
    const stack = 1 + Math.floor(rng() * 2)
    for (let level = 0; level < stack; level++)
      b.box(
        x,
        14 + level * 28,
        40 + rng() * 20,
        30,
        28,
        30,
        pick(rng, [0xb07a4a, 0x9c6a42, 0x6f9fc9]),
        { surface: surface.planks }
      )
  }
  return height + depth / 2 + 10
}

function fishmarket(context: Context, width: number, depth: number) {
  const { b, rng } = context
  const height = 140
  b.box(0, 3, -depth / 2, width, 6, depth, palette.stone, { surface: surface.paving })
  for (const x of [-width / 2 + 8, 0, width / 2 - 8])
    for (const z of [-10, -depth + 10]) b.box(x, height / 2, z, 12, height, 12, 0x2f6c8f)
  b.box(0, height + 4, -depth / 2, width + 30, 8, depth + 30, 0x2f6c8f)
  b.prism(0, height + 8, -depth / 2, width + 30, 50, depth + 30, 0x3b84b0, {
    surface: surface.metal
  })
  signBoard(context.b, 'FISH MARKET', 0, height - 20, 2, 26, 0x1f5f8b)
  for (let index = 0; index < 4; index++) {
    const x = -width / 2 + 50 + index * ((width - 100) / 3)
    b.box(x, 24, -depth / 2 + 10, 70, 48, 50, palette.trim)
    b.box(x, 50, -depth / 2 + 10, 64, 6, 44, 0xd6eef6)
    for (let fish = 0; fish < 3; fish++)
      b.blob(
        x - 18 + fish * 18,
        56,
        -depth / 2 + 10 + (rng() - 0.5) * 20,
        18,
        6,
        8,
        pick(rng, [0xa9b8c9, 0xe58f6f, 0xc7cfd8])
      )
  }
  return height + 60
}

function station(context: Context, width: number, depth: number) {
  const { b } = context
  const height = 200
  const wall = 0xf3e2c4
  plinth(context, width, depth)
  body(context, width, depth, height, wall, surface.brick)
  b.box(0, 50, -depth / 2, width + 4, 100, depth + 4, 0xc46a52, { surface: surface.brick })
  hipRoof(context, width, depth, height, depth * 0.35, 0x3f6a8a, 18)
  b.frame(0, 0, 0, () => {
    b.box(0, 170, 30, 260, 120, 60, wall, { surface: surface.brick })
    b.prism(0, 230, 30, 76, 60, 280, 0x3f6a8a, { ry: Math.PI / 2, surface: surface.tiles })
    clockFace(context, 210, 61, 54)
    signBoard(context.b, 'STATION', 0, 152, 61, 26)
    b.box(0, 108, 60, 300, 8, 90, 0x3f6a8a, { rx: 0.1 })
  })
  door(context, -60, palette.glass, { width: 54, double: true })
  door(context, 60, palette.glass, { width: 54, double: true })
  windowRows(context, width, depth, [{ y: 60, height: 54 }], {
    spacing: 90,
    mullion: true,
    skip: (front, _floor, x) => front && Math.abs(x) < 170
  })
  return height + depth * 0.35 + 20
}

function office(context: Context, width: number, depth: number, floors: number) {
  const { b, rng } = context
  const floorHeight = 90
  const height = floors * floorHeight + 20
  const wall = pick(rng, [0x9bb7c9, 0xb8c4b0, 0xcdb9a6])
  plinth(context, width, depth)
  body(context, width, depth, height, wall, surface.plain)
  for (const wallFace of wallFaces(width, depth)) {
    b.frame(wallFace.x, wallFace.z, wallFace.yaw, () => {
      for (let floor = 1; floor < floors; floor++) {
        b.box(0, floor * floorHeight + 46, 1, wallFace.span - 24, 56, 1, 0x5f8fae, {
          faces: face.pz,
          glow: lit(rng) * 0.8
        })
        b.box(0, floor * floorHeight + 12, 2, wallFace.span - 10, 10, 4, palette.trim)
      }
    })
  }
  storefront(context, width - 30, 0, palette.glass)
  flatRoof(context, width, depth, height, palette.trim)
  rear(context, width, depth, height, palette.frame)
  return height + 30
}

export function buildBuilding(b: TownBuilder, spec: BuildingSpec) {
  const context: Context = { b, rng: mulberry32(spec.seed) }
  const height = buildingHeight(context, spec)
  return { height, door: context.door ?? 0, roof: context.roof }
}

function buildingHeight(context: Context, spec: BuildingSpec) {
  const { width, depth } = spec
  switch (spec.kind) {
    case 'house':
      return house(context, width, depth, spec.floors ?? 2)
    case 'cottage':
      return house(context, width, depth, 1)
    case 'townhouse':
      return townhouse(context, width, depth, spec.floors ?? 3)
    case 'apartment':
      return apartment(context, width, depth, spec.floors ?? 5)
    case 'shop':
      return shop(context, width, depth, spec.floors ?? 2, spec.label)
    case 'civic':
      return civic(context, width, depth, spec.label)
    case 'townhall':
      return townhall(context, width, depth)
    case 'hospital':
      return hospital(context, width, depth)
    case 'school':
      return school(context, width, depth)
    case 'fire':
      return fireStation(context, width, depth)
    case 'hotel':
      return hotel(context, width, depth)
    case 'cinema':
      return cinema(context, width, depth)
    case 'church':
      return church(context, width, depth)
    case 'warehouse':
      return warehouse(context, width, depth)
    case 'fishmarket':
      return fishmarket(context, width, depth)
    case 'station':
      return station(context, width, depth)
    case 'office':
      return office(context, width, depth, spec.floors ?? 4)
  }
}
