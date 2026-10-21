import type { WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'
import { type ActiveResident, updateTownActivities } from '../src/lib/town-activity'
import { createTownScene } from '../src/lib/town-three.client'
import { walkerLane, walkSegments } from '../src/lib/town-world'

function walker(x: number, phase = 1): ActiveResident {
  return { kind: 'walker', scale: 1, pose: { x, z: 0, yaw: 0 }, phase }
}

describe('town activities', () => {
  it('stops two nearby residents facing each other, then gives them time to walk away', () => {
    const a = walker(0)
    const b = walker(75)
    updateTownActivities([a, b], 2)
    expect(a.activity?.kind).toBe('talk')
    expect(a.activity?.partner).toBe(b)
    expect(b.activity?.partner).toBe(a)
    expect(a.pose.yaw).toBeCloseTo(Math.PI / 2)
    expect(b.pose.yaw).toBeCloseTo((Math.PI * 3) / 2)
    updateTownActivities([a, b], 14)
    expect(a.activity).toBeUndefined()
    expect(b.activity).toBeUndefined()
    updateTownActivities([a, b], 15)
    expect(a.activity).toBeUndefined()
    expect(b.activity).toBeUndefined()
  })

  it('shares the play rhythm and does not recruit a third resident', () => {
    const a = walker(0, 1)
    const b = walker(75, 2)
    const c = walker(150)
    updateTownActivities([a, b, c], 2)
    expect(a.activity?.kind).toBe('play')
    expect(b.activity?.start).toBe(a.activity?.start)
    expect(b.activity?.end).toBe(a.activity?.end)
    expect(c.activity).toBeUndefined()
  })

  it('ends an interaction when its partner is filtered out or dragged away', () => {
    const a = walker(0)
    const b = walker(75)
    updateTownActivities([a, b], 2)
    updateTownActivities([a], 3)
    expect(a.activity).toBeUndefined()
    updateTownActivities([a, b], 4)
    expect(b.activity).toBeUndefined()
  })

  it('keeps bicycles, overlapping bodies and distant residents out of conversations', () => {
    for (const distance of [20, 200]) {
      const a = walker(0)
      const b = walker(distance)
      updateTownActivities([a, b], 2)
      expect(a.activity).toBeUndefined()
    }
    const a = walker(0)
    const bike = { ...walker(75), kind: 'bicycle' as const }
    updateTownActivities([a, bike], 2)
    expect(a.activity).toBeUndefined()
    expect(bike.activity).toBeUndefined()
  })

  it('staggers solo pauses and resumes without immediately repeating them', () => {
    const a = walker(0, 2)
    const b = walker(300, 5)
    updateTownActivities([a, b], 8)
    expect(a.activity?.kind).toBe('stretch')
    expect(b.activity).toBeUndefined()
    updateTownActivities([a, b], 11)
    expect(b.activity?.kind).toBe('look')
    updateTownActivities([a, b], 20)
    expect(a.activity).toBeUndefined()
    expect(b.activity).toBeUndefined()
  })

  it('holds the scene positions while playing and resumes the same route afterwards', () => {
    const { start, end } = walkSegments[4]
    const length = Math.hypot(end.x - start.x, end.z - start.z) - 160
    const town = createTownScene(
      [0, 2].map((variant, index) => ({
        slug: `player-${index}`,
        variant,
        kind: 'walker',
        route: { start, end, lane: -walkerLane, progress: 0.28 + (index * 75) / length, speed: 12 }
      }))
    )
    const renderer = {
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      clear: () => {},
      render: () => {}
    } as unknown as WebGLRenderer
    try {
      town.filter(['player-0', 'player-1'])
      town.update({ x: 0, y: 0, zoom: 1 }, { width: 1280, height: 720 })
      for (let time = 0; time <= 3000; time += 100) town.render(renderer, time, true)
      const paused = ['player-0', 'player-1'].map((slug) => ({ ...town.residentPosition(slug) }))
      for (let time = 3100; time <= 7000; time += 100) town.render(renderer, time, true)
      expect(['player-0', 'player-1'].map((slug) => town.residentPosition(slug))).toEqual(paused)
      for (let time = 7100; time <= 14000; time += 100) town.render(renderer, time, true)
      for (const [index, pose] of paused.entries()) {
        expect(town.residentPosition(`player-${index}`)?.x).toBeGreaterThan(pose.x ?? 0)
      }
    } finally {
      town.dispose()
    }
  })
})
