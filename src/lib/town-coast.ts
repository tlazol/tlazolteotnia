import { townLayoutScale } from './town-layout'
import type { TownPoint } from './town-navigation'
import { inTownLake } from './town-terrain'
// A headland with stepped coves. Share its outline between the ground,
// cliff terraces and planting so no trees or grass extend over the water.
export const coastStep = 96 * townLayoutScale
export const coastColumns = Array.from({ length: 100 }, (_, index) => {
  const x = -2352 + index * 96
  const reach = Math.sqrt(Math.max(0, 1 - ((x - 2400) / 4850) ** 2))
  const inlet = Math.sin(x / 490) * 160 + Math.sin(x / 173) * 65
  const bay = Math.exp(-(((x - 4400) / 1150) ** 2)) * 380
  return {
    x: x * townLayoutScale,
    north: Math.round((-1000 - reach * 4200 + inlet) / 32) * 32 * townLayoutScale,
    south: Math.round((-1000 + reach * 3400 + inlet - bay) / 32) * 32 * townLayoutScale,
    beach: 440 + Math.round(Math.exp(-(((x - 3500) / 1700) ** 2)) * 1000)
  }
})

export function containsTownGround(point: TownPoint) {
  // Apply the same margin to both axes, including the sides of stepped coves.
  const first = Math.round((point.x - 12 - coastColumns[0].x) / coastStep)
  const last = Math.round((point.x + 12 - coastColumns[0].x) / coastStep)
  if (!coastColumns[first] || !coastColumns[last]) return false
  for (let index = first; index <= last; index++) {
    const coast = coastColumns[index]
    if (!(point.z > coast.north + 12 && point.z < coast.south + coast.beach - 12)) return false
  }
  return !inTownLake(point.x, point.z, 12)
}

// Keep each complete walking circuit inside the shared dry sand of adjacent coves.
export const beachWalkingSegments = [44, 50, 56, 62, 68, 74].map((index) => {
  const columns = coastColumns.slice(index, index + 5)
  const inland = Math.max(...columns.map((column) => column.south))
  const shore = Math.min(...columns.map((column) => column.south + column.beach))
  const z = (inland + shore) / 2
  return {
    start: { x: columns[0].x, z },
    end: { x: columns[columns.length - 1].x, z },
    lane: 48
  }
})
