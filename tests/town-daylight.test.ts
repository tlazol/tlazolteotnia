import { Color, DirectionalLight, Mesh, Scene, Vector3 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { townDaylight } from '../src/lib/town-daylight'
import { createTownLighting } from '../src/lib/town-lighting'
import { createTownMaterials } from '../src/lib/town-materials'

const localTime = (hour: number, minute = 0, second = 0) =>
  new Date(2026, 9, 16, hour, minute, second)
afterEach(() => vi.useRealTimers())

describe('town daylight', () => {
  it('has long opposite morning/evening shadows and a high midday sun', () => {
    const morning = townDaylight(localTime(6))
    const noon = townDaylight(localTime(12))
    const evening = townDaylight(localTime(17))
    const night = townDaylight(localTime(21))
    expect(morning.direction.x).toBeLessThan(0)
    expect(evening.direction.x).toBeGreaterThan(0)
    expect(noon.direction.y).toBeGreaterThan(morning.direction.y * 3)
    expect(morning.warmth).toBeGreaterThan(noon.warmth)
    expect(morning.warmth).toBeLessThan(evening.warmth)
    expect(noon.sun).toBeGreaterThan(morning.sun)
    expect(noon.sun).toBeGreaterThan(evening.sun)
    expect(noon.ambient).toBeGreaterThan(morning.ambient)
    expect(morning.ambient).toBeGreaterThan(evening.ambient)
    expect(evening.ambient).toBeGreaterThan(night.ambient)
    expect(noon.night).toBe(0)
    expect(night.night).toBe(1)
    expect(night.sun).toBe(0)
    expect(night.ambient).toBeGreaterThan(0)
  })

  it.each([0, 5, 6, 9, 12, 15, 17, 18, 19, 24])(
    'stays continuous across the %s:00 boundary',
    (hour) => {
      const before = townDaylight(localTime(hour, 0, -1))
      const after = townDaylight(localTime(hour, 0, 1))
      for (const key of ['sun', 'ambient', 'warmth', 'night'] as const)
        expect(Math.abs(after[key] - before[key])).toBeLessThan(0.001)
      expect(
        new Vector3(...Object.values(before.direction)).distanceTo(
          new Vector3(...Object.values(after.direction))
        )
      ).toBeLessThan(0.001)
    }
  )

  it('uses the viewer timezone for the same instant, including a local date change', () => {
    const previous = process.env.TZ
    try {
      const instant = new Date('2026-10-16T03:00:00Z')
      process.env.TZ = 'Asia/Tokyo'
      expect(townDaylight(instant).night).toBe(0)
      process.env.TZ = 'America/Los_Angeles'
      expect(instant.getDate()).toBe(15)
      expect(townDaylight(instant).night).toBe(1)
    } finally {
      if (previous === undefined) delete process.env.TZ
      else process.env.TZ = previous
    }
  })
})

describe('town lighting integration', () => {
  const view = { x: 0, y: 0, zoom: 1 }
  const size = { width: 1280, height: 720 }
  function setup() {
    const scene = new Scene()
    scene.background = new Color()
    const materials = createTownMaterials()
    const pools = new Mesh()
    const lighting = createTownLighting(scene, materials, pools)
    return { scene, materials, pools, lighting }
  }

  it('lights windows and lamp pools after dark and hides them by day', () => {
    const { scene, materials, pools, lighting } = setup()
    lighting.update(localTime(21), view, size)
    expect(materials.uniforms.uNight.value).toBe(1)
    expect(materials.pools.opacity).toBeGreaterThan(0)
    expect(pools.visible).toBe(true)
    const night = (scene.background as Color).clone()
    const sun = scene.children.find((child) => child instanceof DirectionalLight)
    expect(sun?.castShadow).toBe(false)
    lighting.update(localTime(12), view, size)
    expect(materials.uniforms.uNight.value).toBe(0)
    expect(materials.uniforms.uCloud.value).toBeGreaterThan(0)
    expect(pools.visible).toBe(false)
    expect(sun?.castShadow).toBe(true)
    expect((scene.background as Color).getHex()).not.toBe(night.getHex())
    lighting.dispose()
    materials.dispose()
  })

  it('keeps unchanged night lighting cached across midnight and resumes updates at dawn', () => {
    const { materials, lighting } = setup()
    expect(lighting.update(localTime(23, 59, 58), view, size)).toBe(true)
    expect(lighting.update(new Date(2026, 9, 17, 0, 0, 2), view, size)).toBe(false)
    expect(lighting.update(new Date(2026, 9, 17, 6, 0, 0), view, size)).toBe(true)
    expect(lighting.update(new Date(2026, 9, 17, 6, 0, 0), { ...view, x: 10 }, size)).toBe(true)
    lighting.dispose()
    materials.dispose()
  })

  it('sizes and releases the shadow map with the viewport', () => {
    const { scene, materials, lighting } = setup()
    const sun = scene.children.find((child) => child instanceof DirectionalLight)
    if (!(sun instanceof DirectionalLight)) throw new Error('Sun missing')
    lighting.update(localTime(12), view, size)
    expect(sun.shadow.mapSize.x).toBe(2048)
    const dispose = vi.fn()
    sun.shadow.map = { dispose } as unknown as typeof sun.shadow.map
    lighting.update(localTime(12), view, { width: 390, height: 844 })
    expect(sun.shadow.mapSize.x).toBe(1024)
    expect(dispose).toHaveBeenCalled()
    expect(sun.shadow.map).toBeNull()
    // The shadow camera covers the view center on the ground.
    const target = new Vector3().copy(sun.target.position)
    expect(Number.isFinite(target.x) && Number.isFinite(target.z)).toBe(true)
    lighting.dispose()
    materials.dispose()
  })
})
