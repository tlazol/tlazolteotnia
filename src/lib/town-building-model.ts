import type { TownPartWriter, townColors } from './town-model-parts'
import type { createTownSceneryModels } from './town-scenery-model'
import type { townTerrain } from './town-terrain'

export function createTownBuildingModels(
  { part, box, withYaw }: TownPartWriter,
  {
    colors,
    roofs,
    walls,
    architecture,
    detailed
  }: {
    colors: typeof townColors
    roofs: number[]
    walls: number[]
    architecture: ReturnType<typeof townTerrain>['architecture']
    detailed: boolean
  },
  { bench, flowerbed, sign, fence }: ReturnType<typeof createTownSceneryModels>
) {
  // Work in facade coordinates so front and side details share the same construction.
  function facade(x: number, z: number, side = false) {
    return (u: number, y: number, out: number, w: number, h: number, d: number, c: number) => {
      return side ? box(x + out, y, z + u, d, h, w, c) : box(x + u, y, z + out, w, h, d, c)
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
    face(0, y, 5, 30, 28, 3, colors.window).emission = 'window'
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
    face(-8, y + 5, 7.5, 5, 15, 1, colors.glass).emission = 'window'
    face(7, y - 6, 7, 8, 8, 1, colors.glass).emission = 'window'
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

  function house(x: number, z: number, variant: number) {
    const flatRoof = architecture === 'desert' || architecture === 'mesa' || variant % 3 === 2
    const width = 180 + (variant % 3) * 18
    const depth = variant % 3 === 2 ? 126 : 152
    const height = 88 + (variant % 2) * 24
    box(x, 6, z, width + 12, 12, depth + 12, colors.curb)
    box(x, height / 2 + 12, z, width, height, depth, walls[variant % walls.length])
    box(x, height + 14, z, width + 28, 8, depth + 28, colors.ink)
    if (flatRoof) {
      box(x, height + 23, z, width + 30, 16, depth + 30, roofs[variant % roofs.length])
      box(x - 40, height + 39, z, 60, 16, 58, colors.cream)
    } else {
      part('roof', x, height + 18, z, width + 30, 62, depth + 30, roofs[variant % roofs.length])
    }
    const chimneyY = height + (flatRoof ? 53 : 63)
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
      front(26, 49, 9, 6, 9, 3, colors.sand).emission = 'lamp'
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
      if (flatRoof) {
        parapet(x, height + 34, z, width + 24, depth + 24)
        roofEquipment(x + 30, height + 32, z + 12)
      } else {
        box(x, height + 80, z, 9, 5, depth + 36, roofs[variant % roofs.length])
        for (const dz of [-depth / 2 - 16, depth / 2 + 16]) {
          box(x, height + 77, z + dz, 12, 7, 5, colors.cream)
        }
      }
      if (!flatRoof) {
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

  function building(x: number, z: number, kind: 'office' | 'apartment', variant: number) {
    const floors = kind === 'office' ? 4 + (variant % 2) : 3 + (variant % 2)
    const width = 230
    const depth = 164
    const height = floors * 48 + 20
    const tint = kind === 'office' ? colors.glass : colors.brick
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
      // Upper floors have balconies; the ground-floor entrance stays open.
      if (kind === 'apartment' && floor > 0) {
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
      front(0, 56, 18, 58, 5, 34, colors.window)
      for (const dx of [-22, 22]) front(dx, 33, 27, 4, 43, 4, colors.cream)
    }
    if (kind === 'office') {
      if (variant % 2 === 0) {
        // The low office has a recessed rooftop studio and a broad entrance brise-soleil.
        box(-26, height + 55, -13, 133, 64, 112, colors.glass)
        box(-26, height + 90, -13, 145, 7, 124, colors.cream)
        for (const dx of [-78, -52, -26, 0, 26]) box(dx, height + 55, 45, 4, 64, 4, colors.window)
        for (const dx of [-51, -34, -17, 0, 17, 34, 51]) box(dx, 72, 112, 5, 8, 56, colors.cream)
      } else {
        // The taller office has a solid service spine and deep vertical sun fins.
        box(-78, height / 2 + 30, 77, 49, height + 40, 23, colors.window)
        for (const dx of [-39, 1, 41, 81])
          box(dx, height / 2 + 40, 94, 8, height - 36, 25, colors.pavement)
        box(0, height + 31, 0, 246, 9, 178, colors.window)
      }
    }
  }

  function glazedEntrance(x: number, z: number, width = 38) {
    box(x, 37, z + 2, width + 8, 62, 6, colors.cream)
    box(x, 37, z + 6, width, 54, 3, colors.window)
    for (const side of [-1, 1]) {
      box(x + (side * width) / 4, 43, z + 8, width / 2 - 5, 34, 2, colors.glass)
      box(x + side * 4, 31, z + 10, 2, 10, 2, colors.cream)
    }
    box(x, 37, z + 9, 3, 54, 2, colors.cream)
    box(x, 4, z + 24, width + 16, 8, 40, colors.pavement)
  }

  function pharmacy() {
    // A tall stepped dispensary front and a green cross, with a lower stockroom behind.
    box(0, 5, 0, 260, 10, 176, colors.curb)
    box(0, 52, -12, 244, 94, 140, colors.cream)
    box(0, 101, -12, 252, 8, 150, colors.hedge)
    box(0, 69, 59, 244, 128, 34, colors.pavement)
    box(0, 140, 59, 136, 22, 38, colors.hedge)
    box(0, 158, 59, 72, 16, 38, colors.hedge)
    box(0, 141, 81, 30, 9, 4, colors.cream)
    box(0, 141, 81, 9, 30, 4, colors.cream)
    for (const x of [-78, 78]) {
      box(x, 48, 79, 69, 59, 6, colors.hedge)
      box(x, 48, 83, 59, 49, 3, colors.window)
      box(x, 52, 85, 51, 34, 2, colors.glass)
      if (detailed) {
        for (const y of [32, 46]) {
          box(x, y, 88, 54, 3, 4, colors.cream)
          for (const dx of [-18, -6, 6, 18]) {
            box(x + dx, y + 7, 88, 7, 11, 3, dx > 0 ? colors.sand : colors.pavement)
          }
        }
      }
    }
    glazedEntrance(0, 79)
    box(0, 84, 95, 66, 6, 32, colors.hedge)
    sign('DRUGS', 111, 81, colors.hedge, 2)
    box(0, 2, 149, 48, 4, 86, colors.pavement)
    for (const z of [-42, 14]) windowDetail(123, 49, z, true)
    roofEquipment(-64, 105, -30)
  }

  function burgerDiner() {
    // Rounded chrome end bays and an oversailing red roof make a low roadside diner.
    box(0, 5, 0, 256, 10, 172, colors.curb)
    box(0, 41, 0, 174, 72, 148, colors.pavement)
    for (const x of [-86, 86]) {
      part('disc', x, 41, 0, 76, 72, 148, colors.pavement)
      part('disc', x, 58, 0, 78, 31, 150, colors.glass)
      part('disc', x, 82, 0, 88, 10, 170, colors.flower)
    }
    box(0, 58, 76, 174, 32, 4, colors.glass)
    for (const x of [-72, -43, 43, 72]) box(x, 58, 79, 4, 34, 4, colors.cream)
    box(0, 31, 77, 174, 7, 5, colors.flower)
    box(0, 82, 0, 174, 10, 170, colors.flower)
    box(0, 90, 0, 186, 6, 152, colors.cream)
    glazedEntrance(0, 78, 30)
    box(0, 77, 111, 80, 7, 62, colors.flower)
    sign('BURGER', 102, 88, colors.flower, 2)
    box(0, 2, 150, 44, 4, 84, colors.pavement)
    box(70, 129, 0, 7, 76, 7, colors.cream)
    part('disc', 70, 177, 0, 74, 20, 62, colors.sand)
    part('disc', 70, 164, 0, 78, 6, 64, colors.hedge)
    part('disc', 70, 157, 0, 74, 8, 62, colors.brick)
    part('disc', 70, 148, 0, 74, 10, 62, colors.sand)
    for (const x of [-83, 83]) {
      box(x, 28, 127, 43, 5, 28, colors.cream)
      box(x, 14, 127, 6, 28, 6, colors.window)
      for (const z of [106, 148]) box(x, 15, z, 46, 7, 13, colors.flower)
    }
    if (detailed) {
      for (const x of [51, 67, 83]) box(x, 188, -4, 6, 2, 3, colors.cream)
      for (const y of [17, 23]) box(0, y, 79, 169, 2, 2, colors.curb)
      roofEquipment(-48, 94, -25)
    }
  }

  function bakery(variant: number) {
    const twin = variant % 2 === 1
    box(0, 5, 0, 250, 10, 170, colors.curb)
    box(0, 53, 0, 232, 96, 150, colors.sand)
    // The coastal bakery has twin narrow gables; the town bakery has one deep roof and oven.
    for (const x of twin ? [-59, 59] : [0]) {
      const width = twin ? 124 : 248
      part('roof', x, 104, 0, width, twin ? 65 : 91, 174, colors.wood)
      part('gable', x, 105, 88, width - 12, twin ? 59 : 85, 3, colors.cream)
      windowDetail(x, twin ? 129 : 141, 91)
    }
    for (const x of [-74, 74]) {
      box(x, 44, 79, 65, 55, 6, colors.wood)
      box(x, 44, 83, 55, 45, 3, colors.window)
      box(x, 31, 88, 60, 6, 13, colors.wood)
      for (const dx of [-17, 0, 17]) {
        part('disc', x + dx, 39, 89, 13, 9, 8, colors.sand)
      }
    }
    glazedEntrance(0, 77, 30)
    box(0, 80, 103, 219, 7, 48, colors.wood)
    sign('BAKERY', 97, 91, colors.door, 2)
    const chimneyX = twin ? -92 : 86
    box(chimneyX, 147, -35, 28, 130, 30, colors.brick)
    box(chimneyX, 215, -35, 37, 8, 39, colors.cream)
    box(chimneyX, 220, -35, 23, 3, 25, colors.ink)
    box(0, 2, 149, 44, 4, 88, colors.pavement)
    if (!twin) {
      box(108, 35, 21, 42, 64, 65, colors.brick)
      part('roof', 108, 68, 21, 48, 22, 69, colors.brick)
      box(131, 29, 21, 3, 32, 33, colors.ink)
    }
    if (detailed) {
      brickwork(0, 75, 232, 91)
      planter(-85, 144, colors.sand)
      box(77, 24, 141, 43, 44, 7, colors.wood)
      box(77, 26, 146, 34, 33, 2, colors.window)
      for (const y of [18, 27, 36]) box(77, y, 148, 23, 2, 2, colors.cream)
    }
  }

  function arcade() {
    // A dark, windowless game hall with a pixel crown and neon portal.
    box(0, 5, -13, 254, 10, 194, colors.curb)
    box(0, 60, -13, 238, 110, 178, colors.window)
    box(0, 120, -13, 254, 10, 194, roofs[2])
    for (const [x, height] of [
      [-96, 32],
      [-48, 55],
      [0, 78],
      [48, 55],
      [96, 32]
    ]) {
      box(x, 125 + height / 2, 54, 42, height, 42, roofs[0])
      box(x, 129 + height, 54, 46, 7, 46, colors.flower)
    }
    box(0, 57, 83, 110, 100, 15, colors.flower)
    box(0, 53, 92, 86, 89, 6, colors.ink)
    glazedEntrance(0, 88, 56)
    for (const x of [-87, 87]) {
      box(x, 52, 81, 34, 66, 9, roofs[2])
      box(x, 59, 87, 24, 27, 3, colors.ink)
      box(x, 61, 90, 14, 14, 2, colors.water)
      box(x, 38, 92, 28, 6, 14, colors.flower)
    }
    sign('GAME', 151, 84, roofs[0], 3)
    box(0, 2, 153, 76, 4, 76, roofs[0])
    for (const z of [-62, -18, 26]) {
      box(121, 65, z, 5, 87, 7, roofs[2])
      box(125, 83, z, 3, 18, 18, colors.water)
    }
  }

  function policeStation() {
    // An L-shaped station: a blue command tower and a low motor-pool wing.
    box(0, 5, -5, 406, 10, 188, colors.curb)
    box(-68, 79, -12, 238, 148, 158, colors.pavement)
    box(-68, 158, -12, 250, 10, 170, colors.window)
    box(137, 44, 11, 140, 78, 204, colors.cream)
    box(137, 88, 11, 151, 10, 216, colors.window)
    for (const y of [45, 106]) {
      for (const x of [-151, -96, -41]) windowDetail(x, y, 68)
    }
    box(8, 111, 72, 48, 210, 30, colors.window)
    box(8, 221, 72, 58, 10, 40, colors.cream)
    part('disc', 8, 178, 91, 31, 5, 35, colors.sand, 0, Math.PI / 2)
    box(8, 183, 95, 7, 22, 3, colors.cream)
    box(8, 233, 72, 15, 14, 17, colors.flower)
    for (const x of [104, 167]) {
      box(x, 40, 115, 53, 65, 6, colors.curb)
      for (const y of [16, 27, 38, 49, 60]) box(x, y, 119, 49, 2, 2, colors.window)
      box(x, 2, 150, 54, 4, 68, colors.pavement)
    }
    glazedEntrance(0, 90, 32)
    box(0, 73, 115, 89, 7, 60, colors.window)
    sign('POLICE', 133, 92, colors.window, 2)
    box(0, 2, 153, 55, 4, 76, colors.pavement)
    box(-129, 195, -27, 5, 66, 5, colors.window)
    for (const y of [197, 216]) box(-129, y, -27, 49, 3, 3, colors.cream)
    roofEquipment(-64, 165, -32)
    if (detailed) {
      wallUtilities(208, 7)
      bench(-122, 125)
      box(-166, 34, 160, 33, 58, 8, colors.window)
      box(-166, 39, 166, 24, 40, 3, colors.cream)
    }
  }

  function library(variant: number) {
    if (variant === 1) {
      school(0, 0)
      fence(480, 370)
      return
    }
    if (variant === 2) {
      // Keep the roof a single solid prism: no overlaid gables, ridge or eave strips.
      // Walls meet its underside; the shallow windows sit directly on the wall faces.
      box(0, 6, 0, 412, 12, 154, colors.curb)
      box(0, 78, 0, 400, 132, 144, colors.cream)
      withYaw(Math.PI / 2, () => {
        part('gable', 0, 144, 0, 156, 52, 412, colors.window)
      })
      for (const y of [48, 111]) {
        for (const x of [-164, -110, -56, 56, 110, 164]) {
          box(x, y, 73, 34, 32, 2, colors.window)
          box(x, y, 75, 3, 32, 2, colors.cream)
        }
        for (const z of [-37, 37]) {
          box(201, y, z, 2, 32, 34, colors.window)
          box(203, y, z, 2, 32, 3, colors.cream)
        }
      }
      // The clock and paired classroom windows carry the school's identity.
      box(0, 113, 73, 30, 30, 2, colors.window)
      box(0, 117, 75, 3, 11, 2, colors.cream)
      box(6, 113, 75, 9, 3, 2, colors.cream)
      box(0, 41, 73, 44, 58, 2, colors.window)
      box(0, 41, 75, 3, 58, 2, colors.cream)
      for (const x of [-6, 6]) box(x, 34, 75, 2, 9, 2, colors.cream)
      box(0, 79, 94, 80, 6, 44, colors.window)
      for (const x of [-34, 34]) box(x, 38, 110, 6, 76, 6, colors.cream)
      box(0, 2, 135, 60, 4, 114, colors.pavement)
      for (const x of [-119, 119]) {
        bench(x, 110)
        flowerbed(x, 151)
      }
      box(188, 77, 134, 4, 150, 4, colors.curb)
      box(204, 137, 134, 30, 22, 3, colors.pavement)
      box(204, 137, 137, 8, 8, 2, colors.flower)
      return
    }
    // The library is a brick reading hall with a monumental gable and glazed roof lantern.
    box(0, 6, 0, 432, 12, 198, colors.curb)
    box(0, 66, 0, 412, 120, 180, colors.brick)
    part('roof', 0, 132, 0, 436, 103, 194, colors.window)
    part('gable', 0, 133, 99, 414, 94, 4, colors.cream)
    box(0, 237, -4, 112, 30, 110, colors.glass)
    box(0, 255, -4, 126, 8, 122, colors.window)
    for (const x of [-47, -23, 0, 23, 47]) box(x, 238, 53, 4, 30, 4, colors.cream)
    for (const x of [-156, -96, 96, 156]) {
      box(x, 70, 93, 42, 79, 6, colors.cream)
      box(x, 70, 98, 32, 67, 3, colors.window)
      box(x, 76, 100, 23, 48, 2, colors.glass)
      box(x, 70, 102, 3, 66, 3, colors.cream)
    }
    glazedEntrance(0, 92, 52)
    box(0, 86, 113, 106, 9, 45, colors.window)
    sign('LIBRARY', 156, 105, colors.window, 2)
    box(0, 2, 157, 72, 4, 66, colors.pavement)
    for (const x of [-127, 127]) bench(x, 137)
    if (detailed) {
      brickwork(0, 90, 412, 120)
      brickwork(207, 0, 180, 120, true)
      for (const z of [-54, 8, 64]) windowDetail(207, 70, z, true)
    }
  }

  function hotel() {
    // A narrow vertical hotel above a broad lobby, with a mansard-like pavilion roof.
    box(0, 5, 0, 246, 10, 176, colors.curb)
    box(0, 38, 0, 230, 66, 160, colors.sand)
    box(0, 77, 0, 246, 12, 176, colors.cream)
    box(-20, 175, -10, 170, 184, 138, colors.brick)
    for (const y of [112, 166, 220]) {
      for (const x of [-71, -20, 31]) windowDetail(x, y, 60)
      for (const z of [-49, 7]) windowDetail(66, y, z, true)
    }
    box(-20, 272, -10, 190, 12, 154, colors.cream)
    part('roof', -20, 280, -10, 194, 75, 158, roofs[2])
    part('gable', -20, 281, 70, 180, 67, 3, colors.sand)
    windowDetail(-20, 309, 74)
    glazedEntrance(0, 81, 46)
    for (const x of [-78, 78]) windowDetail(x, 40, 81)
    box(0, 73, 123, 116, 9, 88, roofs[2])
    for (const x of [-51, 51]) box(x, 36, 157, 6, 72, 6, colors.cream)
    sign('HOTEL', 255, 72, colors.flower, 2)
    box(0, 2, 159, 52, 4, 66, colors.pavement)
    for (const x of [-83, 83]) planter(x, 139, colors.flower)
  }

  function hospital() {
    // A white stepped ward block and a blue emergency canopy, without apartment balconies.
    box(0, 5, 0, 256, 10, 178, colors.curb)
    box(0, 54, 0, 242, 98, 164, colors.pavement)
    box(-27, 157, -16, 176, 108, 132, colors.cream)
    box(-48, 236, -26, 132, 50, 112, colors.pavement)
    for (const [x, y, z, width, depth] of [
      [0, 106, 0, 252, 174],
      [-27, 214, -16, 186, 142],
      [-48, 264, -26, 142, 122]
    ])
      box(x, y, z, width, 6, depth, colors.water)
    for (const y of [134, 182]) {
      box(-27, y, 52, 156, 29, 5, colors.window)
      for (const x of [-89, -58, -27, 4, 35]) box(x, y, 56, 23, 23, 3, colors.glass)
      box(63, y, -17, 5, 29, 111, colors.glass)
    }
    box(-48, 242, 33, 34, 10, 4, colors.flower)
    box(-48, 242, 33, 10, 34, 4, colors.flower)
    for (const x of [-83, 83]) windowDetail(x, 49, 83)
    glazedEntrance(0, 84, 52)
    box(0, 82, 125, 124, 9, 82, colors.water)
    for (const x of [-55, 55]) box(x, 40, 160, 6, 80, 6, colors.cream)
    sign('HOSPITAL', 101, 88, colors.window, 2)
    box(0, 2, 161, 59, 4, 60, colors.pavement)
    roofEquipment(88, 110, -37)
    if (detailed) {
      for (const x of [-79, 79]) {
        box(x, 32, 130, 23, 54, 9, colors.cream)
        box(x, 34, 136, 15, 5, 3, colors.flower)
        box(x, 34, 136, 5, 15, 3, colors.flower)
      }
    }
  }

  function townhouse(variant: number) {
    const flatRoof = architecture === 'desert' || architecture === 'mesa'
    // Narrow adjoining homes have separate doors, stepped cornices and twin gables.
    for (const side of [-1, 1]) {
      const x = side * 57
      const height = side === -1 ? 144 : 168
      const tint = side === -1 ? colors.brick : colors.sand
      const roof = roofs[(variant + (side === -1 ? 0 : 1)) % roofs.length]
      box(x, 6, 0, 114, 12, 162, colors.curb)
      box(x, height / 2 + 12, 0, 110, height, 150, tint)
      box(x, height + 15, 0, 116, 6, 160, colors.cream)
      if (flatRoof) {
        box(x, height + 20, 0, 116, 12, 164, roof)
        parapet(x, height + 28, 0, 110, 156)
      } else {
        part('roof', x, height + 18, 0, 116, 48, 164, roof)
        part('gable', x, height + 18, 83, 106, 43, 3, tint)
        box(x, height + 33, 86, 18, 16, 3, colors.window)
      }
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

  function specialtyShop(kind: 'cafe' | 'florist' | 'workshop', label: string, variant: number) {
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
    if (cafe && variant === 0) {
      // The corner cafe is a flat-roofed espresso bar with a shaded roof terrace.
      box(0, height + 23, 0, 248, 8, 174, colors.window)
      for (const x of [-102, 102]) {
        box(x, height + 44, 0, 4, 36, 146, colors.cream)
        for (const z of [-69, 69]) box(x, height + 63, z, 6, 76, 6, colors.wood)
      }
      for (const x of [-105, -70, -35, 0, 35, 70, 105])
        box(x, height + 103, 0, 8, 6, 163, colors.wood)
      box(0, height + 100, -70, 218, 6, 8, colors.wood)
      box(0, height + 100, 70, 218, 6, 8, colors.wood)
      for (const x of [-56, 56]) {
        part('disc', x, height + 49, -3, 35, 5, 35, colors.cream)
        box(x, height + 37, -3, 5, 24, 5, colors.window)
      }
    } else if (cafe) {
      part('roof', 0, height + 20, 0, width + 24, 64, 174, roofs[3])
      part('gable', 0, height + 20, 88, width + 12, 58, 3, colors.cream)
      box(-72, height + 66, -30, 24, 58, 26, colors.brick)
      box(-72, height + 97, -30, 30, 6, 32, colors.cream)
    } else if (florist && variant === 0) {
      // The nursery branch has an asymmetric glass lean-to beside a tall potting shed.
      box(-71, height + 32, -2, 73, 48, 146, colors.wood)
      box(-71, height + 60, -2, 84, 8, 159, colors.hedge)
      box(42, height + 25, -2, 141, 5, 155, colors.glass, -0.27)
      for (const z of [-76, -38, 0, 38, 76]) box(42, height + 28, z, 144, 4, 4, colors.cream, -0.27)
      for (const x of [-23, 41, 106])
        box(x, height + 28 - (x - 42) * Math.tan(0.27), -2, 4, 4, 158, colors.cream)
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
    } else if (variant === 0) {
      // The coastal workshop has three sawtooth roof bays and high glazed north lights.
      for (const x of [-78, 0, 78]) {
        part('roof', x, height + 20, 0, 78, 48, 172, colors.window)
        part('gable', x, height + 21, 88, 68, 41, 3, colors.glass)
        box(x, height + 69, 0, 7, 5, 176, colors.cream)
      }
      box(-92, height + 59, -54, 16, 80, 16, colors.brick)
      box(-92, height + 102, -54, 24, 6, 24, colors.ink)
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
    sign(label, cafe ? (variant === 0 ? 110 : 143) : florist ? 99 : 110, cafe ? 92 : 84, accent, 2)
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
    const flatRoof = architecture === 'desert' || architecture === 'mesa'
    // A low, broad porch and a steep roof give the cottages a distinct silhouette.
    box(12, 1, 15, 218, 1, 194, colors.shadow)
    box(0, 6, 0, 176, 12, 146, colors.curb)
    box(0, 48, 0, 164, 78, 134, variant % 2 ? colors.sand : colors.brick)
    if (flatRoof) {
      box(0, 93, 0, 184, 12, 152, accent)
      parapet(0, 101, 0, 178, 146)
    } else {
      part('roof', 0, 89, 0, 192, 92, 160, accent)
      part('gable', 0, 90, 81, 178, 83, 3, colors.cream)
      windowDetail(0, 124, 84, false, false, variant)
    }
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
    const chimneyTop = flatRoof ? 128 : 178
    box(-47, chimneyTop - 35, -34, 22, 66, 24, colors.brick)
    box(-47, chimneyTop, -34, 29, 6, 31, colors.cream)
    if (detailed) {
      for (let x = -84; x <= 84; x += 14) box(x, 15, 108, 1, 1, 66, colors.sand)
      planter(-55, 137, colors.flower)
      planter(55, 137, colors.sand)
      wallUtilities(83, -31)
    }
  }

  function civicShop(kind: 'post-office' | 'cinema' | 'fire-station' | 'market', variant: number) {
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
      if (variant === 1) {
        // A single broad market hall with a raised ventilation lantern.
        part('roof', 0, height + 22, 0, 254, 79, 178, colors.hedge)
        part('gable', 0, height + 23, 90, 242, 72, 3, colors.wood)
        box(0, height + 111, -2, 64, 24, 144, colors.window)
        part('roof', 0, height + 126, -2, 82, 25, 158, colors.hedge)
        for (const z of [-52, -24, 4, 32, 60]) box(34, height + 111, z, 3, 17, 17, colors.cream)
      }
      // Three individual pitched bays and open produce stalls under a striped canopy.
      for (const x of [-78, 0, 78]) {
        if (variant === 0) {
          part('roof', x, height + 22, 0, 80, 44, 176, roofs[1])
          part('gable', x, height + 22, 89, 74, 38, 3, colors.sand)
        }
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
      sign('MARKET', variant === 0 ? 142 : 117, 93, accent, 2)
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
      if (variant === 0) {
        box(0, height + 30, 0, 152, 20, 165, accent)
        box(0, height + 47, 0, 76, 14, 159, colors.cream)
      } else {
        // The second cinema has a tall corner blade sign instead of a stepped crown.
        box(-88, 164, 56, 42, 174, 42, colors.window)
        box(-88, 256, 56, 52, 10, 52, colors.flower)
        for (const y of [128, 158, 188, 218]) {
          box(-88, y, 80, 25, 19, 4, colors.sand)
          box(-88, y, 84, 13, 7, 3, colors.flower)
        }
        box(39, height + 30, -12, 141, 22, 137, colors.flower)
      }
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
      if (variant === 0) {
        part('roof', 0, height + 22, 0, 256, 48, 174, roofs[3])
      } else {
        // The coastal post office pairs a low sorting wing with a tall entrance pavilion.
        box(0, height + 24, 0, 254, 8, 172, colors.flower)
        box(0, height + 50, 38, 83, 58, 78, colors.brick)
        part('roof', 0, height + 82, 38, 97, 48, 94, colors.window)
        for (const x of [-80, 80]) box(x, height + 32, -8, 43, 10, 96, colors.glass)
      }
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
      box(0, variant === 0 ? 174 : 158, variant === 0 ? 0 : 81, 65, 39, 8, colors.cream)
      for (const side of [-1, 1])
        box(
          side * 14,
          variant === 0 ? 174 : 158,
          variant === 0 ? 6 : 87,
          35,
          4,
          3,
          accent,
          side * 0.5
        )
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

  return {
    house,
    building,
    townhouse,
    cottage,
    civicShop,
    specialtyShop,
    library,
    policeStation,
    pharmacy,
    burgerDiner,
    bakery,
    arcade,
    hotel,
    hospital,
    windowDetail
  }
}
