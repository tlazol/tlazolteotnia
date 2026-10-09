import type { InstancedMesh, Scene, WebGLRenderer, WebGLRenderTarget } from 'three'
import { describe, expect, it } from 'vitest'
import { createTownScene } from '../src/lib/town-three.client'
import {
  avoidTraffic,
  type TrafficBody,
  type TrafficRoute,
  trafficPose
} from '../src/lib/town-traffic'

const route: TrafficRoute = {
  start: { x: 0, z: 0 },
  end: { x: 0, z: 1000 },
  lane: -19,
  progress: 0,
  speed: 54
}

describe('town traffic avoidance', () => {
  const kinds = ['walker', 'bicycle', 'car'] as const
  const halfWidth = { walker: 15, bicycle: 15, car: 20 }
  const halfLength = { walker: 17, bicycle: 29, car: 35 }

  // Independently check separating axes of the models' physical footprints.
  function separated(a: TrafficBody, b: TrafficBody) {
    return [a.pose.yaw, a.pose.yaw + Math.PI / 2, b.pose.yaw, b.pose.yaw + Math.PI / 2].some(
      (yaw) => {
        const extent = (body: TrafficBody) =>
          (Math.abs(Math.cos(body.pose.yaw - yaw)) * halfLength[body.kind] +
            Math.abs(Math.sin(body.pose.yaw - yaw)) * halfWidth[body.kind]) *
          body.scale
        const distance = Math.abs(
          (a.pose.x - b.pose.x) * Math.sin(yaw) + (a.pose.z - b.pose.z) * Math.cos(yaw)
        )
        return distance >= extent(a) + extent(b)
      }
    )
  }

  for (const first of kinds) {
    for (const second of kinds) {
      it(`separates ${first} and ${second} while passing, overtaking and crossing`, () => {
        for (const angle of [0, Math.PI / 2, Math.PI]) {
          const a: TrafficBody = { kind: first, scale: 1, pose: { x: 0, z: 0, yaw: 0 } }
          const b: TrafficBody = { kind: second, scale: 1, pose: { x: 0, z: 0, yaw: angle } }
          for (let frame = 0; frame < 300; frame++) {
            const distance = -150 + frame
            a.pose = { x: 0, z: 0, yaw: 0 }
            b.pose = { x: Math.sin(angle) * distance, z: Math.cos(angle) * distance, yaw: angle }
            avoidTraffic([a, b], 1 / 60)
            expect(separated(a, b), `angle ${angle}, frame ${frame}`).toBe(true)
          }
        }
      })
    }
  }

  it('spreads a group that starts in the same place without pushing into a third resident', () => {
    const bodies: TrafficBody[] = Array.from({ length: 6 }, (_, index) => ({
      kind: kinds[index % 3],
      scale: index % 2 ? 0.72 : 1,
      pose: { x: 0, z: 0, yaw: 0 }
    }))
    avoidTraffic(bodies, 0)
    bodies.forEach((body, index) => {
      for (const other of bodies.slice(index + 1)) expect(separated(body, other)).toBe(true)
    })
  })

  it('tries the other side of an obstacle and leaves a focused resident in place', () => {
    const a: TrafficBody = { kind: 'walker', scale: 1, pose: { x: 0, z: 0, yaw: 0 } }
    const b: TrafficBody = { kind: 'bicycle', scale: 1, pose: { x: 0, z: 0, yaw: 0 } }
    avoidTraffic(
      [a, b],
      0,
      (body) => body === b,
      (point) => point.x <= 0
    )
    expect(a.pose).toEqual({ x: 0, z: 0, yaw: 0 })
    expect(b.pose.x).toBeLessThan(0)
    expect(separated(a, b)).toBe(true)
  })

  it('yields in a narrow crowded lane without overlapping or jumping across the crowd', () => {
    const bodies: TrafficBody[] = kinds.map((kind, index) => ({
      kind,
      scale: 1,
      pose: { x: 0, z: -index * 120, yaw: 0 }
    }))
    const speeds = [12, 30, 54]
    for (let frame = 0; frame < 600; frame++) {
      const previous = bodies.map((body) => ({ ...body.pose }))
      bodies.forEach((body, index) => {
        body.pose = { x: 0, z: -index * 120 + frame * 0.05 * speeds[index], yaw: 0 }
      })
      avoidTraffic(
        bodies,
        0.05,
        () => true,
        (point) => Math.abs(point.x) <= 12
      )
      bodies.forEach((body, index) => {
        expect(
          Math.hypot(body.pose.x - previous[index].x, body.pose.z - previous[index].z)
        ).toBeLessThan(10)
        for (const other of bodies.slice(index + 1)) expect(separated(body, other)).toBe(true)
      })
    }
  })

  it('smoothly returns to the route once clear, and freezes the detour when paused', () => {
    const a: TrafficBody = { kind: 'walker', scale: 1, pose: { x: 0, z: 0, yaw: 0 } }
    const b: TrafficBody = { kind: 'walker', scale: 1, pose: { x: 0, z: 0, yaw: 0 } }
    avoidTraffic([a, b], 0)
    const stopped = { ...b.pose }
    avoidTraffic([a, b], 0, () => false)
    expect(b.pose).toEqual(stopped)
    for (let frame = 0; frame < 360; frame++) {
      const previous = b.pose.x
      b.pose = { x: 0, z: 200, yaw: 0 }
      avoidTraffic([b], 1 / 60)
      expect(Math.abs(b.pose.x - previous)).toBeLessThan(1.5)
    }
    expect(Math.abs(b.pose.x)).toBeLessThan(0.01)
  })
})

describe('town traffic routes', () => {
  it('travels forward in each lane at the assigned speed', () => {
    for (const lane of [-19, 29, -48, 48]) {
      for (const speed of [12, 30, 54]) {
        const path = { ...route, progress: 0.5, lane, speed }
        const a = trafficPose(path, 0)
        const b = trafficPose(path, 1)
        expect(b.x).toBeCloseTo(a.x)
        expect(Math.abs(b.z - a.z)).toBeCloseTo(speed)
        expect((b.z - a.z) * Math.cos(a.yaw)).toBeGreaterThan(0)
      }
    }
  })

  it('joins both turns and the loop without position or heading jumps', () => {
    const straight = 840
    const turn = Math.PI * 19
    const circuit = 2 * (straight + turn)
    for (const distance of [straight, straight + turn, 2 * straight + turn, circuit]) {
      const a = trafficPose(route, (distance - 0.001) / route.speed)
      const b = trafficPose(route, (distance + 0.001) / route.speed)
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(0.002, 5)
      expect(Math.cos(b.yaw - a.yaw)).toBeCloseTo(1, 6)
    }
    const start = trafficPose(route, 0)
    const end = trafficPose(route, circuit / route.speed)
    expect(end.x).toBeCloseTo(start.x)
    expect(end.z).toBeCloseTo(start.z)
  })

  it('keeps the full circuit on the road, including short and rotated segments', () => {
    for (const end of [
      { x: 200, z: 0 },
      { x: 0, z: 850 },
      { x: 600, z: 800 }
    ]) {
      const length = Math.hypot(end.x, end.z)
      const path = { ...route, end, lane: 48 }
      for (let time = 0; time < 200; time += 0.5) {
        const pose = trafficPose(path, time)
        const along = (pose.x * end.x + pose.z * end.z) / length
        const across = (pose.x * end.z - pose.z * end.x) / length
        expect(along).toBeGreaterThanOrEqual(0)
        expect(along).toBeLessThanOrEqual(length)
        expect(Math.abs(across)).toBeLessThanOrEqual(48.000001)
      }
    }
  })
})

describe('town animation lifecycle', () => {
  it('caches the town and freezes residents during reduced motion and tab suspension', () => {
    const town = createTownScene()
    let target: WebGLRenderTarget | null = null
    let townDraws = 0
    let trafficDraws = 0
    let positions: number[] = []
    const renderer = {
      getRenderTarget: () => target,
      setRenderTarget: (next: WebGLRenderTarget | null) => {
        target = next
      },
      clear: () => {},
      render: (scene: Scene) => {
        if (scene.background) townDraws++
        else if (scene.children[0]?.type === 'Mesh') {
          const mesh = scene.children[0] as InstancedMesh
          if (mesh.isInstancedMesh) {
            trafficDraws++
            positions = Array.from(mesh.instanceMatrix.array)
          }
        }
      }
    } as unknown as WebGLRenderer
    try {
      const view = { x: -240, y: -370, zoom: 0.8 }
      const size = { width: 1280, height: 720 }
      town.update(view, size)
      town.render(renderer, 0, true)
      const initial = positions
      expect(initial.length).toBeGreaterThan(0)
      town.render(renderer, 50, true)
      expect(positions).not.toEqual(initial)
      expect(townDraws).toBe(1)
      expect(trafficDraws).toBe(2)
      const moving = positions
      town.render(renderer, 100, false)
      town.render(renderer, 10000, false)
      expect(positions).toEqual(moving)
      expect(trafficDraws).toBe(2)
      town.update({ ...view, x: 20 }, size)
      town.render(renderer, 10050, false)
      expect(positions).toEqual(moving)
      expect(townDraws).toBe(2)
      town.render(renderer, 10100, true)
      town.render(renderer, 10150, true)
      expect(positions).not.toEqual(moving)
      const resumed = positions
      town.pause()
      town.render(renderer, 90000, true)
      expect(positions).toEqual(resumed)
      town.render(renderer, 90050, true)
      expect(positions).not.toEqual(resumed)
      expect(target).toBeNull()
    } finally {
      town.dispose()
    }
  })
})
