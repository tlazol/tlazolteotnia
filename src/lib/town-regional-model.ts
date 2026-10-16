import { townArchitecture } from './town-architecture'
import type { ModelPlacement, TownPartWriter, townColors } from './town-model-parts'
import type { StaticTownParts } from './town-static-model'
import type { townTerrain } from './town-terrain'
export function regionalBuildingDetails(
  parts: StaticTownParts,
  { part, box }: TownPartWriter,
  { x: offsetX, z: offsetZ, scale }: ModelPlacement,
  architecture: ReturnType<typeof townTerrain>['architecture'],
  colors: typeof townColors,
  firstBox: number,
  firstRoof: number,
  firstGable: number
) {
  if (!architecture) return
  const palette = townArchitecture[architecture]
  const buildingBoxes = parts.box.slice(firstBox)
  const buildingRoofs = [...parts.roof.slice(firstRoof), ...parts.gable.slice(firstGable)]
  if (architecture === 'winter') {
    // Lift a solid snow layer above each roof, including rotated school roofs.
    for (const roof of buildingRoofs) {
      if (roof.depth / scale < 30) continue
      parts.gable.push({ ...roof, y: roof.y + 4 * scale, color: palette.trim })
    }
    for (const roof of buildingBoxes) {
      if (
        roof.y / scale < 70 ||
        roof.height / scale > 18 ||
        roof.width / scale < 70 ||
        roof.depth / scale < 40 ||
        roof.angle ||
        roof.pitch
      )
        continue
      parts.box.push({
        ...roof,
        y: roof.y + roof.height / 2 + 2 * scale,
        height: 4 * scale,
        color: palette.trim
      })
    }
    return
  }

  // Use the main ground-floor wall, keeping additions within the existing lot.
  const wall = buildingBoxes
    .filter(
      (item) =>
        item.width / scale >= 100 &&
        item.depth / scale >= 100 &&
        item.height / scale >= 60 &&
        (item.y - item.height / 2) / scale < 30
    )
    .sort((a, b) => b.width * b.height * b.depth - a.width * a.height * a.depth)[0]
  if (!wall) return
  const x = (wall.x - offsetX) / scale
  const z = (wall.z - offsetZ) / scale + wall.depth / scale / 2
  const width = wall.width / scale
  const top = (wall.y + wall.height / 2) / scale
  const bottom = (wall.y - wall.height / 2) / scale

  if (architecture === 'autumn' || architecture === 'mesa') {
    // Exposed timber in autumn; horizontal sandstone courses in the mesa.
    const band = architecture === 'autumn' ? palette.timber : palette.trim
    for (const y of [bottom + 7, top - 7]) box(x, y, z + 2, width, 8, 4, band)
    if (architecture === 'autumn') {
      for (const side of [-1, 1])
        box(x + side * (width / 2 - 5), (top + bottom) / 2, z + 3, 10, top - bottom, 6, band)
    } else {
      for (let y = bottom + 30; y < top - 20; y += 30) box(x, y, z + 2, width, 5, 4, palette.accent)
    }
  } else if (architecture === 'spring') {
    // Blossom boxes below the front windows, visible even at the town overview.
    for (const side of [-1, 1]) {
      const px = x + side * width * 0.32
      box(px, bottom + 21, z + 8, 42, 10, 16, palette.timber)
      for (const dx of [-14, 0, 14]) {
        box(px + dx, bottom + 29, z + 8, 12, 9, 12, palette.accent)
        box(px + dx, bottom + 35, z + 9, 10, 7, 10, dx ? colors.flower : palette.trim)
      }
    }
  } else if (architecture === 'summer' || architecture === 'tropical') {
    const canopyWidth = Math.min(width - 20, 152)
    if (architecture === 'tropical') {
      part('roof', x, 84, z + 18, canopyWidth, 30, 48, palette.roof)
      for (const side of [-1, 1])
        box(x + side * (canopyWidth / 2 - 8), 44, z + 34, 6, 80, 6, palette.timber)
    } else {
      box(x, 84, z + 19, canopyWidth, 5, 42, palette.trim)
      for (let dx = -canopyWidth / 2 + 6; dx < canopyWidth / 2; dx += 18)
        box(x + dx, 88, z + 19, 8, 4, 42, palette.roof)
      box(x, 78, z + 40, canopyWidth, 10, 4, palette.roof)
    }
  } else if (architecture === 'desert') {
    // Adobe parapets and exposed vigas make a dry-climate roofline.
    for (let dx = -width / 2 + 18; dx < width / 2; dx += 28)
      box(x + dx, top - 12, z + 9, 9, 9, 18, palette.timber)
    box(x, top + 15, z - 2, width + 8, 24, 12, palette.trim)
    box(x, 77, z + 17, 74, 7, 36, palette.accent)
  } else if (architecture === 'crystal') {
    // A cluster of faceted roof spires echoes the surrounding crystal outcrops.
    const roofTop = Math.max(top, ...buildingRoofs.map((roof) => (roof.y + roof.height) / scale))
    for (const [dx, height] of [
      [-28, 30],
      [0, 48],
      [28, 24]
    ]) {
      box(x + dx, roofTop + height / 2, 0, 15, height, 15, palette.accent)
      part('gable', x + dx, roofTop + height, 0, 15, 16, 15, palette.glass)
    }
  } else if (architecture === 'mushroom') {
    // A small, tiered mushroom hood over the entrance, with pale cap spots.
    for (const [y, w, d] of [
      [79, 94, 48],
      [90, 78, 40],
      [101, 52, 30]
    ])
      part('disc', x, y, z + 16, w, 12, d, palette.roof)
    for (const dx of [-16, 14]) part('disc', x + dx, 108, z + 16, 10, 2, 9, palette.trim)
  }
}
