import { describe, expect, it } from 'vitest'
import { createTownNavigation } from '../src/lib/town-navigation'
import { nearestResidentRoute, type TownArticle } from '../src/lib/town-posts'
import { createTownResidents } from '../src/lib/town-residents'
import { trafficPose } from '../src/lib/town-traffic'
import { containsTownGround, parkPond, townWaterSurface, waterLevel } from '../src/lib/town-world'

const article: TownArticle = {
  slug: 'resident',
  variant: 0,
  kind: 'walker',
  route: {
    start: { x: -1000, z: -1100 },
    end: { x: -1000, z: -900 },
    lane: -19,
    progress: 0.5,
    speed: 10
  }
}
article.route = nearestResidentRoute(trafficPose(article.route, 0), article.route)
const navigation = createTownNavigation([], () => true)
function setup() {
  const simulation = createTownResidents([article])
  const resident = simulation.articleResidents.get(article.slug)
  if (!resident) throw new Error('Missing test resident')
  const tick = (now: number, motion = true) => {
    const { delta } = simulation.advance(now, motion)
    simulation.updatePoses(delta, navigation)
  }
  tick(0)
  return { simulation, resident, tick }
}
describe('resident simulation', () => {
  it('pauses route clocks for focused and filtered residents while selection resumes movement', () => {
    const { simulation, resident, tick } = setup()
    simulation.focus(article.slug)
    tick(100)
    expect(resident.time).toBe(0)
    simulation.select(article.slug)
    tick(200)
    expect(resident.time).toBeCloseTo(0.1)
    simulation.filter([])
    expect(simulation.followedSlug).toBeNull()
    tick(300)
    expect(resident.time).toBeCloseTo(0.1)
    simulation.follow(article.slug)
    expect(simulation.followedSlug).toBeNull()
    simulation.filter([article.slug])
    simulation.follow(article.slug)
    tick(400)
    expect(simulation.followedSlug).toBe(article.slug)
    expect(resident.time).toBeCloseTo(0.2)
  })
  it('keeps drag position independent of simulation and restores the original pose on cancellation', () => {
    const { simulation, resident, tick } = setup()
    const before = { ...resident.pose }
    simulation.beginResidentDrag(article.slug)
    expect(simulation.followedSlug).toBeNull()
    simulation.moveResidentDrag({ x: 100, z: -20 })
    tick(100)
    expect(resident.pose).toEqual({ ...before, x: before.x + 100, z: before.z - 20 })
    expect(resident.time).toBe(0)
    simulation.endResidentDrag(navigation, true)
    expect(resident.pose).toEqual(before)
    expect(simulation.dragged).toBeNull()
  })
  it('restores the pose when dropped outside valid ground', () => {
    const { simulation, resident } = setup()
    const before = { ...resident.pose }
    simulation.beginResidentDrag(article.slug)
    simulation.moveResidentDrag({ x: 100, z: -20 })
    simulation.endResidentDrag(createTownNavigation([], () => false))
    expect(resident.pose).toEqual(before)
    expect(resident.returning).toBeUndefined()
  })
  it('keeps a resident on disconnected ground until it is dragged back to a reachable area', () => {
    const { simulation, resident, tick } = setup()
    simulation.beginResidentDrag(article.slug)
    simulation.moveResidentDrag({ x: 300, z: 300 })
    const dropped = { ...resident.pose }
    const isolated = createTownNavigation(
      [],
      (point) => Math.hypot(point.x - dropped.x, point.z - dropped.z) < 30
    )
    simulation.endResidentDrag(isolated)
    for (let i = 1; i <= 200; i++) tick(i * 100)
    expect(resident.pose.x).toBe(dropped.x)
    expect(resident.pose.z).toBe(dropped.z)
    expect(resident.time).toBe(0)
    expect(resident.returning).toBeUndefined()
    simulation.beginResidentDrag(article.slug)
    simulation.moveResidentDrag({ x: -285, z: -300 })
    simulation.endResidentDrag(navigation)
    expect(resident.returning?.path.length).toBeGreaterThan(0)
    tick(20100)
    expect(resident.time).toBeGreaterThan(0)
  })
  it('walks a dropped resident back to its route and resumes its route clock', () => {
    const { simulation, resident, tick } = setup()
    simulation.beginResidentDrag(article.slug)
    simulation.moveResidentDrag({ x: 15, z: 0 })
    simulation.endResidentDrag(navigation)
    expect(resident.returning?.path.length).toBeGreaterThan(0)
    for (let i = 1; i <= 500 && resident.returning; i++) tick(i * 100)
    expect(resident.returning).toBeUndefined()
    expect(resident.pose.x).toBeCloseTo(trafficPose(resident.route, resident.time ?? 0).x)
  })
  it('swims ashore from the sea before walking back to its route', () => {
    const { simulation, resident, tick } = setup()
    const town = createTownNavigation([], containsTownGround)
    const target = { x: -1000, z: 3700 }
    expect(townWaterSurface(target)).toBe(waterLevel)
    simulation.beginResidentDrag(article.slug)
    simulation.moveResidentDrag({ x: target.x - resident.pose.x, z: target.z - resident.pose.z })
    simulation.endResidentDrag(town)
    expect(resident.pose).toMatchObject(target)
    expect(resident.swimming).toBe(true)
    expect(resident.returning?.path[0].swim).toBe(waterLevel)
    for (let i = 1; i <= 20000 && resident.swimming; i++) tick(i * 100)
    expect(resident.swimming).toBe(false)
    expect(town.canStand(resident.pose)).toBe(true)
  })
  it('keeps a resident dropped on a flat roof up there until it is carried down', () => {
    const { simulation, resident, tick } = setup()
    const start = { ...resident.pose }
    const footprint = {
      left: start.x + 100,
      right: start.x + 300,
      top: start.z - 100,
      bottom: start.z + 100
    }
    const town = createTownNavigation([footprint], () => true, [
      { ...footprint, height: 250, clutter: [] }
    ])
    simulation.beginResidentDrag(article.slug)
    simulation.moveResidentDrag({ x: 200, z: 0 }, 250)
    simulation.endResidentDrag(town)
    expect(resident.roof).toBe(250)
    expect(resident.stationary).toBe(true)
    expect(resident.returning).toBeUndefined()
    const onRoof = { ...resident.pose }
    for (let i = 1; i <= 20; i++) {
      const { delta } = simulation.advance(i * 100, true)
      simulation.updatePoses(delta, town)
    }
    expect(resident.pose.x).toBeCloseTo(onRoof.x)
    expect(resident.pose.z).toBeCloseTo(onRoof.z)

    // Missing the standable deck puts the resident back on the roof it came from.
    simulation.beginResidentDrag(article.slug)
    simulation.moveResidentDrag({ x: 95, z: 0 }, 250)
    simulation.endResidentDrag(town)
    expect(resident.pose).toEqual(onRoof)
    expect(resident.roof).toBe(250)

    simulation.beginResidentDrag(article.slug)
    simulation.moveResidentDrag({ x: start.x - 40 - resident.pose.x, z: 0 })
    simulation.endResidentDrag(town)
    expect(resident.roof).toBeUndefined()
    expect(resident.stationary).toBe(false)
    for (let i = 1; i <= 500 && resident.returning; i++) tick(3000 + i * 100)
    expect(resident.returning).toBeUndefined()
  })
  it('treats the park pond as water even though its rim blocks walking', () => {
    expect(townWaterSurface({ x: parkPond.x - 150, z: parkPond.z })).toBe(parkPond.surface)
    expect(
      townWaterSurface({ x: parkPond.x + parkPond.island.dx, z: parkPond.z + parkPond.island.dz })
    ).toBeNull()
    const town = createTownNavigation(
      [
        {
          left: parkPond.x - 250,
          right: parkPond.x + 250,
          top: parkPond.z - 190,
          bottom: parkPond.z + 190
        }
      ],
      () => true
    )
    const shore = town.findShore(parkPond)
    expect(shore && town.canStand(shore)).toBe(true)
  })
  it('does not advance in reduced motion or jump after a hidden-tab pause', () => {
    const { simulation, resident, tick } = setup()
    tick(100)
    const before = resident.time ?? 0
    tick(10000, false)
    tick(20000, false)
    expect(resident.time).toBe(before)
    tick(30000)
    expect(resident.time).toBe(before)
    tick(30100)
    expect(resident.time).toBeCloseTo(before + 0.1)
    simulation.pause()
    tick(90000)
    expect(resident.time).toBeCloseTo(before + 0.1)
    tick(90100)
    expect(resident.time).toBeCloseTo(before + 0.2)
  })
})
