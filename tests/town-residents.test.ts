import { describe, expect, it } from 'vitest'
import { createTownNavigation } from '../src/lib/town-navigation'
import { nearestResidentRoute, type TownArticle } from '../src/lib/town-posts'
import { createTownResidents } from '../src/lib/town-residents'
import { trafficPose } from '../src/lib/town-traffic'

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
  it('restores the pose when a drop has no walkable return path', () => {
    const { simulation, resident } = setup()
    const before = { ...resident.pose }
    simulation.beginResidentDrag(article.slug)
    simulation.moveResidentDrag({ x: 100, z: -20 })
    simulation.endResidentDrag(createTownNavigation([], () => false))
    expect(resident.pose).toEqual(before)
    expect(resident.returning).toBeUndefined()
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
