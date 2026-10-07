import { describe, expect, it } from 'vitest'
import { nearestTownRoad, onettBuildings, onettRoads, onettToTown } from '../src/lib/town-layout'

describe('Onett map', () => {
  it('connects the three main streets to the diagonal avenues', () => {
    for (const [x, y] of [
      [900, 850],
      [1850, 850],
      [2850, 850],
      [300, 1450],
      [1250, 1450],
      [2250, 1450],
      [700, 2000],
      [1700, 2000]
    ]) {
      const point = onettToTown(x, y)
      const streets = onettRoads.filter(
        (road) => !road.trail && nearestTownRoad(point, [road]).distance < 0
      )
      expect(streets.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('places the recognizable landmarks in their original neighborhoods', () => {
    const hall = onettBuildings.find((building) => building.kind === 'city-hall')
    const hotel = onettBuildings.find((building) => building.kind === 'hotel')
    const hospital = onettBuildings.find((building) => building.kind === 'hospital')
    const library = onettBuildings.find((building) => building.label === 'LIBRARY')
    const arcade = onettBuildings.find((building) => building.kind === 'arcade')
    if (!hall || !hotel || !hospital || !library || !arcade) throw new Error('Missing landmark')
    expect(hotel.x).toBeGreaterThan(hall.x)
    expect(hospital.x).toBeLessThan(hall.x)
    expect(library.z).toBeLessThan(hall.z)
    expect(arcade.z).toBeGreaterThan(hall.z)
    expect(onettBuildings.some((building) => building.label === "NESS'S HOUSE")).toBe(true)
    for (const building of onettBuildings) {
      expect(
        nearestTownRoad(
          building,
          onettRoads.filter((road) => !road.trail)
        ).distance
      ).toBeGreaterThan(0)
    }
  })
})
