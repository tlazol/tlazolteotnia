import { hashSlug } from './scene-math'
import { townArchitecture } from './town-architecture'
import { createTownBuildingModels } from './town-building-model'
import { coastColumns, coastStep } from './town-coast'
import {
  nearestTownRoad,
  onettBuildings,
  onettGroves,
  onettHills,
  onettParks,
  onettRoads,
  onettToTown,
  townBuildingAccess,
  townBuildingBounds,
  townLayoutScale,
  townRoadJunctions
} from './town-layout'
import { createTownPartWriter, type Part, type TownShape, townColors } from './town-model-parts'
import type { TownObstacle } from './town-navigation'
import { regionalBuildingDetails } from './town-regional-model'
import { createTownSceneryModels } from './town-scenery-model'
import { inTownLake, townLakeStrips, townTerrain } from './town-terrain'

export type StaticTownParts = Record<
  'box' | 'ground' | 'land' | 'roof' | 'gable' | 'tree' | 'disc' | 'wheel',
  Part[]
>
export function createTownStaticModel(detailed: boolean) {
  const colors = townColors
  const parts: StaticTownParts = {
    box: [],
    ground: [],
    land: [],
    roof: [],
    gable: [],
    tree: [],
    disc: [],
    wheel: []
  }
  const forestParts: Partial<Record<TownShape, Part[]>> = {}
  const obstacles: TownObstacle[] = []
  const streetLamps: Part[] = []
  let distantForest = false
  const placement = { x: 0, z: 0, yaw: 0, scale: 1 }
  const writer = createTownPartWriter((shape, item) => {
    if (item.color === colors.shadow) item.color = townTerrain(item.x, item.z).shadow
    // Solid geometry at body height blocks walking; flat roads and grass do not.
    if (
      item.y + item.height / 2 > 5 &&
      item.y - item.height * (shape === 'tree' ? 0.8 : 0.5) < 60
    ) {
      // The rounded tree crown spans a unit radius in both horizontal axes.
      const extent = shape === 'tree' ? 1 : 0.5
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

    const collection: Partial<Record<TownShape, Part[]>> = distantForest ? forestParts : parts
    collection[shape] ??= []
    collection[shape].push(item)
  }, placement)
  const { part, box } = writer
  const terrainAt = (x: number, z: number) =>
    townTerrain(x * placement.scale + placement.x, z * placement.scale + placement.z)
  const { tree, park } = createTownSceneryModels(writer, colors, terrainAt)
  box(2000, -246, -1000, 60000, 8, 60000, colors.ocean)
  part('land', 0, 0, 0, 1, 1, 1, 0xffffff)
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
    let rimStart = north
    let rimTint = townTerrain(x, north + coastStep / 2).shadow
    for (let z = north + coastStep; z < south + coastStep; z += coastStep) {
      const end = Math.min(z, south)
      const nextTint = townTerrain(x, Math.min(z + coastStep / 2, south)).shadow
      if (nextTint === rimTint && end < south) continue
      box(x, -6, (rimStart + end) / 2, coastStep, 8, end - rimStart, rimTint)
      rimStart = end
      rimTint = nextTint
    }
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
  // Citrine lakes: pale mineral banks, chartreuse shallows and jade depths.
  for (const [index, { x, north, south }] of townLakeStrips.entries()) {
    const center = (north + south) / 2
    const depth = south - north
    box(x, -0.5, center, 96, 1, depth + 64, 0xe7e7a2)
    box(x, 0.25, center, 64, 0.5, depth, 0xc5e66c)
    if (depth > 240) box(x, 0.75, center, 64, 0.5, depth - 128, 0xafd65e)
    if (depth > 600) box(x, 1.25, center, 64, 0.5, depth - 400, 0x8dc777)
    for (let z = north + 120; z < south - 80; z += 160) {
      box(x - 4, 2, z + (index % 3) * 12, 30, 0.5, 4, 0xf2ffc2)
    }
    if (index % 3 === 0 && depth > 300) {
      const z = south - 70
      box(x, 2, z, 24, 1, 18, 0x66ae86)
      box(x + 3, 4, z, 9, 3, 9, 0xffd2e4)
      box(x + 3, 6, z, 3, 2, 3, 0xfff1b8)
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
    placement.x = point.x
    placement.z = point.z
    box(0, hill.height / 2, 0, hill.width, hill.height, hill.depth, colors.brick)
    for (let x = -hill.width / 2; x < hill.width / 2; x += 24) {
      box(x, hill.height / 2, hill.depth / 2 + 2, 12, hill.height - 12, 6, colors.sand)
      for (let y = 12; y < hill.height; y += 20)
        box(x + 6, y, hill.depth / 2 + 6, 12, 3, 3, colors.wood)
    }
    box(
      0,
      hill.height,
      0,
      hill.width + 12,
      12,
      hill.depth + 12,
      townTerrain(point.x, point.z).shadow
    )
    part(
      'ground',
      0,
      hill.height + 8,
      0,
      hill.width,
      4,
      hill.depth,
      townTerrain(point.x, point.z).ground
    )
  }
  placement.x = placement.z = 0
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
        placement.x = (point.x + previous.x) / 2
        placement.z = (point.z + previous.z) / 2
        placement.yaw = Math.atan2(dx, dz)
        box(0, y, 0, width, 1, Math.hypot(dx, dz) + width, tint)
      }
    }
    if (!road.trail) {
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1]
        const b = road.points[i]
        const length = Math.hypot(b.x - a.x, b.z - a.z)
        placement.yaw = Math.atan2(b.x - a.x, b.z - a.z)
        for (let distance = 40; distance < length; distance += 95) {
          placement.x = a.x + ((b.x - a.x) * distance) / length
          placement.z = a.z + ((b.z - a.z) * distance) / length
          box(0, 2.2, 0, 3, 0.4, 38, colors.stripe)
        }
      }
    }
    placement.x = placement.z = placement.yaw = 0
  }

  for (const lot of onettBuildings) {
    // The entrance paths meet the sidewalk without paving over the carriageway.
    for (const access of townBuildingAccess(lot)) {
      box(
        access.x,
        1.2,
        (access.start + access.end) / 2,
        access.width,
        1,
        access.end - access.start,
        townColors.pavement
      )
    }
    placement.x = lot.x
    placement.z = lot.z
    placement.scale = lot.scale
    const terrain = townTerrain(lot.x, lot.z)
    const architecture = terrain.architecture
    const palette = townArchitecture[architecture]
    const colors = {
      ...townColors,
      cream: palette.trim,
      brick: palette.wall,
      sand: palette.wall,
      wood: palette.timber,
      door: palette.timber,
      curb: palette.timber,
      window: palette.roof,
      glass: palette.glass,
      asphalt: palette.roof,
      flower: terrain.flower,
      hedge: terrain.leaf
    }
    const roofs = [palette.roof, palette.roof, palette.accent, palette.roof]
    const walls = [palette.wall, palette.trim, palette.wall, palette.wall]
    const scenery = createTownSceneryModels(writer, colors, terrainAt)
    const { sign, flowerbed } = scenery
    const {
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
    } = createTownBuildingModels(writer, { colors, roofs, walls, architecture, detailed }, scenery)
    const firstBox = parts.box.length
    const firstRoof = parts.roof.length
    const firstGable = parts.gable.length
    const kind = lot.kind
    if (kind === 'house') {
      house(0, 0, lot.variant)
      if (lot.label) sign(lot.label, 96, 86, colors.window, 2)
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
      specialtyShop(kind, lot.label ?? kind.toUpperCase(), lot.variant)
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
    } else if (kind === 'library') {
      library(lot.variant)
    } else if (kind === 'police') {
      policeStation()
    } else if (kind === 'shop') {
      pharmacy()
    } else if (kind === 'burger') {
      burgerDiner()
    } else if (kind === 'bakery') {
      bakery(lot.variant)
    } else if (kind === 'arcade') {
      arcade()
    } else if (kind === 'hotel') {
      hotel()
    } else if (kind === 'hospital') {
      hospital()
    } else {
      building(0, 0, kind, lot.variant)
    }
    regionalBuildingDetails(
      parts,
      writer,
      placement,
      architecture,
      colors,
      firstBox,
      firstRoof,
      firstGable
    )
    placement.x = placement.z = 0
    placement.scale = 1
  }
  placement.x = placement.z = placement.yaw = 0
  placement.scale = 1

  // Closely spaced, staggered rows make the characteristic scalloped forest edges.
  const planted = new Set<string>()
  function plant(bx: number, by: number, size: number) {
    const key = `${Math.round(bx / 40)}:${Math.round(by / 40)}`
    if (planted.has(key)) return
    const point = onettToTown(bx, by)
    const terrain = townTerrain(point.x, point.z)
    if (hashSlug(`scenery:${key}`) % 100 >= terrain.density) return
    const coast = coastColumns[Math.round((point.x - coastColumns[0].x) / coastStep)]
    if (!coast || point.z < coast.north + 60 || point.z > coast.south - 60) return
    if (inTownLake(point.x, point.z, 80 * size)) return
    if (nearestTownRoad(point, onettRoads).distance < 70 * size) return
    if (
      onettParks.some(
        (park) =>
          Math.abs(point.x - park.x) < 150 && point.z > park.z - 150 && point.z < park.frontage + 60
      )
    )
      return
    if (
      onettBuildings.some((lot) => {
        const bounds = townBuildingBounds(lot)
        const margin = 65 * size
        return (
          point.x > bounds.left - margin &&
          point.x < bounds.right + margin &&
          point.z > bounds.back - margin &&
          point.z < lot.frontage.z + margin
        )
      })
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
    for (let z = north + 85, row = 0; z < south - 85; z += 88 * townLayoutScale, row++) {
      const seed = hashSlug(`forest:${column}:${row}`)
      const px = x + (seed % 35) - 17
      const pz = z + ((seed >>> 8) % 29) - 14
      if (inTownLake(px, pz, 80)) continue
      const by = (pz / townLayoutScale + 1595) / Math.SQRT2
      const bx = px / townLayoutScale - by + 445
      const fringe = Math.sin(by / 210) * 80 + Math.sin(bx / 290) * 65
      if (bx > -400 + fringe && bx < 3390 + fringe && by > -380 + fringe && by < 2570 + fringe)
        continue
      const terrain = townTerrain(px, pz)
      if (terrain.scenery !== 'tree') {
        plant(bx, by, 0.85 + ((seed >>> 16) % 5) * 0.12)
        continue
      }
      const woodland = Math.sin(px / 720) + Math.cos(pz / 590) + Math.sin((px + pz) / 310) * 0.45
      if (woodland > 0.65 && seed % 100 < 72 && pz < south - 220) {
        plant(bx, by, 0.65 + ((seed >>> 16) % 6) * 0.07)
        continue
      }
      // Keep the hilltops and northern trails clear of ground-level flowers.
      if (by < -350 || nearestTownRoad({ x: px, z: pz }, onettRoads).distance < 100) continue
      const flowers = Math.sin(px / 410) * Math.cos(pz / 530)
      if (woodland > 0.65 || flowers < 0.25 || seed % 5 === 0) continue
      const tint = townTerrain(px, pz).flower
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
  for (const point of onettParks) {
    placement.x = point.x
    placement.z = point.z
    placement.scale = 0.55
    park(0, 0, 2)
    const end = (point.frontage - point.z + 2) / placement.scale
    box(0, 2, (155 + end) / 2, 30, 1, end - 155, colors.sand)
  }
  placement.scale = 1
  for (const by of [850, 1450, 2000]) {
    for (let bx = 330; bx < 2800 - (by === 2000 ? 700 : 0); bx += 380) {
      const point = onettToTown(bx, by + 66)
      // Keep the whole sign/lamp pair off intersections, private lots and entrances.
      if (
        [0, 100, 120].some(
          (dx) => nearestTownRoad({ x: point.x + dx, z: point.z }, onettRoads).distance < 18
        )
      )
        continue
      if (
        onettBuildings.some((lot) => {
          const bounds = townBuildingBounds(lot)
          return (
            point.x + 138 > bounds.left &&
            point.x - 14 < bounds.right &&
            point.z + 14 > bounds.back &&
            point.z - 14 < lot.frontage.z
          )
        })
      )
        continue
      placement.x = point.x
      placement.z = point.z
      box(0, 30, 0, 4, 60, 4, colors.window)
      box(0, 63, 0, 22, 22, 5, colors.flower)
      box(0, 63, 4, 12, 4, 2, colors.cream)
      box(100, 47, 0, 5, 94, 5, colors.wood)
      box(110, 94, 0, 24, 5, 5, colors.wood)
      const lamp = box(120, 90, 0, 15, 8, 14, colors.cream)
      lamp.emission = 'lamp'
      streetLamps.push(lamp)
      part('disc', 120, 3, 0, 140, 0.1, 140, 0xffce87).emission = 'glow'
    }
  }
  // Place a lamp just outside each junction's sidewalk, including trail joins.
  // Search outward so diagonal corners stay clear of all adjoining road surfaces.
  for (const junction of townRoadJunctions()) {
    let position: { x: number; z: number } | undefined
    for (let radius = 40; radius <= 200 && !position; radius += 4) {
      for (let step = 0; step < 64; step++) {
        const angle = (step * Math.PI * 2) / 64
        const point = {
          x: junction.x + Math.cos(angle) * radius,
          z: junction.z + Math.sin(angle) * radius
        }
        const clearance = nearestTownRoad(point, onettRoads).distance
        if (clearance < 10 || clearance > 18) continue
        if (
          onettBuildings.some((lot) => {
            const bounds = townBuildingBounds(lot)
            return (
              point.x + 10 > bounds.left &&
              point.x - 10 < bounds.right &&
              point.z + 10 > bounds.back &&
              point.z - 10 < lot.frontage.z
            )
          })
        )
          continue
        if (
          obstacles.some(
            (obstacle) =>
              point.x > obstacle.left - 5 &&
              point.x < obstacle.right + 5 &&
              point.z > obstacle.top - 5 &&
              point.z < obstacle.bottom + 5
          )
        )
          continue
        position = point
        break
      }
    }
    if (!position) continue
    placement.x = position.x
    placement.z = position.z
    placement.yaw = Math.atan2(position.z - junction.z, junction.x - position.x)
    box(0, 5, 0, 10, 10, 10, colors.curb)
    box(0, 47, 0, 5, 94, 5, colors.wood)
    box(10, 94, 0, 24, 5, 5, colors.wood)
    const lamp = box(20, 90, 0, 15, 8, 14, colors.cream)
    lamp.emission = 'lamp'
    streetLamps.push(lamp)
    part('disc', 20, 3, 0, 140, 0.1, 140, 0xffce87).emission = 'glow'
  }
  return { parts, forestParts, obstacles, streetLamps }
}
