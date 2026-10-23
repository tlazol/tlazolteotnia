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
  terrainSurfaceHeight,
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
  it('accepts hills, farmland and dry sand while rejecting sea, lakes and solid structures', () => {
    const navigation = createTownNavigation(statics.obstacles, containsTownGround)
    for (const [x, z] of [
      [-1800, -3000],
      [4200, 0],
      [-1200, 3400]
    ]) {
      expect(containsTownGround({ x, z })).toBe(true)
    }
    expect(terrainSurfaceHeight(-1800, -3000)).toBeGreaterThan(100)
    expect(terrainSurfaceHeight(-1200, 3400)).toBeLessThan(-1.5)
    for (const [x, z] of [
      [-4100, 700],
      [7000, 0]
    ]) {
      expect(navigation.canStand({ x, z })).toBe(false)
    }
    for (const box of statics.occluders) {
      expect(
        navigation.canStand({ x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 })
      ).toBe(false)
    }
  })
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
        if (field) expect(waterDistance(x, z)).toBeLessThan(-200)
      }
  })

  it('keeps the beach out of farmed plots', () => {
    // Plot centres away from the farmyard: a farmed plot is cropped right up to its edges.
    for (let column = 0; column < 4; column++)
      for (let row = 0; row < 8; row++) {
        const left = 3520 + column * 560
        const top = -1760 + row * 480
        const centre = fieldAt(left + 240, top + 200)
        if (!centre) continue
        for (const [x, z] of [
          [left + 4, top + 4],
          [left + 476, top + 4],
          [left + 4, top + 396],
          [left + 476, top + 396]
        ])
          expect(fieldAt(x, z)).not.toBeNull()
      }
  })
})
