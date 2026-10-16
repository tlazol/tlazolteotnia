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
    beach: 100 + Math.round(Math.exp(-(((x - 3500) / 1700) ** 2)) * 320)
  }
})

export function containsTownGround(point: TownPoint) {
  const coast = coastColumns[Math.round((point.x - coastColumns[0].x) / coastStep)]
  return (
    !!coast &&
    point.z > coast.north + 12 &&
    point.z < coast.south - 12 &&
    !inTownLake(point.x, point.z, 12)
  )
}
