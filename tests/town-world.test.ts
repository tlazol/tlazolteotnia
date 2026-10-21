import { describe, expect, it } from 'vitest'
import { createTownMaterials } from '../src/lib/town-materials'
import { createTownNavigation } from '../src/lib/town-navigation'
import { buildTownStatic, fieldAt } from '../src/lib/town-static'
import { trafficPose } from '../src/lib/town-traffic'
import {
  carriageway,
  coastDistanceField,
  containsTownGround,
  railEnds,
  railway,
  terrainHeight,
  townBlocks,
  townRoads,
  walkSegments,
  waterDistance
} from '../src/lib/town-world'

const statics = (() => {
  const materials = createTownMaterials()
  const result = buildTownStatic(materials)
  result.dispose()
  materials.dispose()
  return result
})()

describe('town world', () => {
  it('keeps every building clear of the streets and of each other', () => {
    const roads = townRoads.map(({ start, end }) => ({
      left: Math.min(start.x, end.x) - carriageway,
      right: Math.max(start.x, end.x) + carriageway,
      top: Math.min(start.z, end.z) - carriageway,
      bottom: Math.max(start.z, end.z) + carriageway
    }))
    const boxes = statics.occluders
    for (const [index, box] of boxes.entries()) {
      for (const road of roads)
        expect(
          box.minX < road.right &&
            box.maxX > road.left &&
            box.minZ < road.bottom &&
            box.maxZ > road.top,
          `building ${index} on a street`
        ).toBe(false)
      for (const other of boxes.slice(index + 1))
        expect(
          box.minX < other.maxX - 1 &&
            box.maxX > other.minX + 1 &&
            box.minZ < other.maxZ - 1 &&
            box.maxZ > other.minZ + 1,
          `building ${index} overlaps another`
        ).toBe(false)
    }
  })

  it('keeps every walking and cycling circuit on clear, level ground', () => {
    const navigation = createTownNavigation(statics.obstacles, containsTownGround)
    for (const [index, segment] of walkSegments.entries()) {
      for (const lane of [segment.lane, segment.cycleLane]) {
        for (const side of [-1, 1]) {
          const route = { ...segment, lane: side * lane, progress: 0, speed: 10 }
          for (let time = 0; time < 300; time += 2) {
            const pose = trafficPose(route, time)
            expect(
              navigation.canStand(pose),
              `segment ${index} lane ${side * lane} at ${time}s`
            ).toBe(true)
          }
        }
      }
    }
  })

  it('surrounds the town with sea and runs the railway into tunnels', () => {
    for (const block of townBlocks) {
      for (const x of [block.left, block.right])
        for (const z of [block.top, block.bottom]) expect(waterDistance(x, z)).toBeLessThan(0)
    }
    for (const x of railEnds) {
      expect(terrainHeight(x, railway)).toBeLessThan(2)
      expect(terrainHeight(x + Math.sign(x) * 300, railway)).toBeGreaterThan(150)
    }
    const field = coastDistanceField(64)
    expect(field[32 * 64 + 32]).toBe(0)
    expect(field[0]).toBe(255)
  })

  it('plants crops only on dry land', () => {
    for (let x = 3400; x < 5800; x += 40)
      for (let z = -1800; z < 2000; z += 40) {
        const field = fieldAt(x, z)
        if (field && !field.track) expect(waterDistance(x, z)).toBeLessThan(-400)
      }
  })
})
