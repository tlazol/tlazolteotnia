import { describe, expect, it } from 'vitest'
import { createTownNavigation, type TownPoint } from '../src/lib/town-navigation'

const ground = (p: TownPoint) => Math.abs(p.x) < 300 && Math.abs(p.z) < 300

describe('walking back to a road', () => {
  it('walks directly across open grass and rejects buildings and water', () => {
    const nav = createTownNavigation([{ left: 50, right: 100, top: 50, bottom: 100 }], ground)
    expect(nav.findPath({ x: 0, z: 0 }, { x: 200, z: 0 })).toEqual([{ x: 200, z: 0 }])
    expect(nav.findPath({ x: 70, z: 70 }, { x: 200, z: 0 })).toBeNull()
    expect(nav.findPath({ x: 400, z: 0 }, { x: 200, z: 0 })).toBeNull()
  })

  it('walks around a building without cutting through its corners', () => {
    const nav = createTownNavigation([{ left: -60, right: 60, top: -100, bottom: 100 }], ground)
    const from = { x: -140, z: 0 }
    const to = { x: 140, z: 0 }
    const path = nav.findPath(from, to)
    expect(path).not.toBeNull()
    expect(path?.length).toBeGreaterThan(1)
    let previous = from
    for (const point of path ?? []) {
      const steps = Math.ceil(Math.hypot(point.x - previous.x, point.z - previous.z))
      for (let i = 0; i <= steps; i++) {
        expect(
          nav.canStand({
            x: previous.x + ((point.x - previous.x) * i) / steps,
            z: previous.z + ((point.z - previous.z) * i) / steps
          })
        ).toBe(true)
      }
      previous = point
    }
    expect(previous).toEqual(to)
  })

  it('does not cross a wall into disconnected terrain', () => {
    const nav = createTownNavigation([{ left: -20, right: 20, top: -300, bottom: 300 }], ground)
    expect(nav.findPath({ x: -140, z: 0 }, { x: 140, z: 0 })).toBeNull()
  })
})
