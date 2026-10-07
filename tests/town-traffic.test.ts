import type { InstancedMesh, Scene, WebGLRenderer, WebGLRenderTarget } from 'three'
import { describe, expect, it } from 'vitest'
import { createTownScene } from '../src/lib/town-three.client'
import { type TrafficRoute, trafficPose } from '../src/lib/town-traffic'

const route: TrafficRoute = {
  start: { x: 0, z: 0 },
  end: { x: 0, z: 1000 },
  lane: -19,
  progress: 0,
  speed: 54
}

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
