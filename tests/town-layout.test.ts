import { Box3, InstancedMesh, Matrix4, type Scene, type WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'
import {
  nearestTownRoad,
  onettBuildings,
  onettRoads,
  onettToTown,
  townBuildingAccess,
  townBuildingBounds
} from '../src/lib/town-layout'
import { createTownScene } from '../src/lib/town-three.client'

type Bounds = { left: number; right: number; back: number; front: number }
const overlaps = (a: Bounds, b: Bounds) =>
  Math.min(a.right, b.right) > Math.max(a.left, b.left) + 0.01 &&
  Math.min(a.front, b.front) > Math.max(a.back, b.back) + 0.01

// Roads render as rectangles with square caps, including the sidewalk width.
const streets = onettRoads.flatMap((road) =>
  road.points.slice(1).map((b, index) => {
    const a = road.points[index]
    const half = road.width / 2 + (road.trail ? 0 : 18)
    return {
      left: Math.min(a.x, b.x) - half,
      right: Math.max(a.x, b.x) + half,
      back: Math.min(a.z, b.z) - half,
      front: Math.max(a.z, b.z) + half
    }
  })
)

describe('Onett map', () => {
  it('keeps whole lots clear of streets, sidewalks and neighboring lots', () => {
    onettBuildings.forEach((lot, index) => {
      const bounds = townBuildingBounds(lot)
      expect(
        streets.filter((street) => overlaps(bounds, street)),
        `${index}: ${lot.kind}`
      ).toEqual([])
      expect(
        onettBuildings
          .slice(index + 1)
          .filter((other) => overlaps(bounds, townBuildingBounds(other))),
        `${index}: ${lot.kind}`
      ).toEqual([])
      for (const access of townBuildingAccess(lot)) {
        expect(access.end).toBeGreaterThan(access.start)
        expect(nearestTownRoad({ x: access.x, z: access.end }, onettRoads).distance).toBeCloseTo(-2)
        expect(
          onettBuildings.filter(
            (other) =>
              other !== lot &&
              overlaps(
                {
                  left: access.x - access.width / 2,
                  right: access.x + access.width / 2,
                  back: access.start,
                  front: access.end
                },
                townBuildingBounds(other)
              )
          )
        ).toEqual([])
      }
    })
  })

  it('connects every street and outlying footpath to the main street network', () => {
    // This map has perpendicular street axes after the board-to-world transform.
    for (const road of onettRoads)
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1],
          b = road.points[i]
        expect(a.x === b.x || a.z === b.z).toBe(true)
      }
    const connected = new Set([0])
    for (let pass = 0; pass < streets.length; pass++) {
      streets.forEach((street, index) => {
        if ([...connected].some((other) => overlaps(street, streets[other]))) connected.add(index)
      })
    }
    expect(connected.size).toBe(streets.length)
  })

  it.each([0.2, 1])('keeps rendered scenery off the road at zoom %s', (zoom) => {
    const town = createTownScene([])
    const collisions: { road: number; bounds: Bounds }[] = []
    const blockedEntrances: number[] = []
    const entrances = onettBuildings.flatMap(townBuildingAccess).map((access) => ({
      left: access.x - access.width / 2,
      right: access.x + access.width / 2,
      back: access.start,
      front: access.end
    }))
    let captured = false
    const matrix = new Matrix4()
    const box = new Box3()
    const renderer = {
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      clear: () => {},
      render: (scene: Scene) => {
        if (captured) return
        captured = true
        for (const mesh of scene.children) {
          if (!(mesh instanceof InstancedMesh)) continue
          mesh.geometry.computeBoundingBox()
          if (!mesh.geometry.boundingBox) throw new Error('Missing geometry bounds')
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, matrix)
            box.copy(mesh.geometry.boundingBox).applyMatrix4(matrix)
            if (box.max.y <= 6 || box.min.y >= 60) continue
            const bounds = { left: box.min.x, right: box.max.x, back: box.min.z, front: box.max.z }
            streets.forEach((street, road) => {
              if (overlaps(bounds, street)) collisions.push({ road, bounds })
            })
            // Check ground-level obstructions; awnings above the paving are intentional.
            if (box.max.y > 15 && box.min.y < 15)
              entrances.forEach((entrance, index) => {
                if (overlaps(bounds, entrance)) blockedEntrances.push(index)
              })
          }
        }
      }
    } as unknown as WebGLRenderer
    try {
      town.update({ x: 0, y: 0, zoom }, { width: 1280, height: 720 })
      town.render(renderer, 0, false)
      expect(captured).toBe(true)
      expect(collisions).toEqual([])
      expect([...new Set(blockedEntrances)]).toEqual([])
    } finally {
      town.dispose()
    }
  })

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
