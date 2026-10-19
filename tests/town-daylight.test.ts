import {
  Color,
  DirectionalLight,
  type InstancedMesh,
  PointLight,
  Scene,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget
} from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { townDaylight } from '../src/lib/town-daylight'
import { createTownLighting } from '../src/lib/town-lighting'
import { createTownSceneResources } from '../src/lib/town-scene-resources'
import { createTownStaticModel } from '../src/lib/town-static-model'
import { createTownScene } from '../src/lib/town-three.client'
import { boardToTown } from '../src/lib/town-view'

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
    expect(noon.night).toBe(0)
    expect(night.night).toBe(1)
    expect(night.sun).toBe(0)
    expect(night.ambient).toBeGreaterThan(0)
  })

  it.each([0, 5, 6, 12, 17, 19, 24])('stays continuous across the %s:00 boundary', (hour) => {
    const before = townDaylight(localTime(hour, 0, -1))
    const after = townDaylight(localTime(hour, 0, 1))
    for (const key of ['sun', 'ambient', 'warmth', 'night'] as const)
      expect(Math.abs(after[key] - before[key])).toBeLessThan(0.001)
    expect(
      new Vector3(...Object.values(before.direction)).distanceTo(
        new Vector3(...Object.values(after.direction))
      )
    ).toBeLessThan(0.001)
  })

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
  it('lights streetlamp positions at night and preserves their state through detail rebuilds', () => {
    const scene = new Scene()
    const resources = createTownSceneResources()
    const lighting = createTownLighting(scene, resources)
    const view = { x: 640, y: 360, zoom: 1 }
    const size = { width: 1280, height: 720 }
    const lights = () =>
      scene.children.filter((child): child is PointLight => child instanceof PointLight)
    try {
      const detailed = createTownStaticModel(true)
      lighting.setStreetLamps(detailed.streetLamps)
      expect(lights()).toHaveLength(
        detailed.parts.disc.filter((part) => part.emission === 'glow').length
      )
      lighting.update(localTime(12), view, size)
      expect(lights().every((light) => light.intensity === 0)).toBe(true)
      lighting.update(localTime(21), view, size)
      for (const [index, light] of lights().entries()) {
        const lamp = detailed.streetLamps[index]
        expect(light.position.toArray()).toEqual([lamp.x, lamp.y, lamp.z])
        expect(light.intensity).toBeGreaterThan(0)
        expect(light.distance).toBeGreaterThan(lamp.y)
        expect(light.castShadow).toBe(false)
      }
      const oldLights = lights()
      const disposals = oldLights.map((light) => vi.spyOn(light, 'dispose'))
      lighting.setStreetLamps(createTownStaticModel(false).streetLamps)
      expect(lighting.update(localTime(21), view, size)).toBe(true)
      expect(lights()).toHaveLength(oldLights.length)
      expect(lights().every((light) => light.intensity > 0)).toBe(true)
      expect(oldLights.every((light) => light.parent === null)).toBe(true)
      for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce()
      lighting.update(localTime(12), view, size)
      expect(lights().every((light) => light.intensity === 0)).toBe(true)
    } finally {
      lighting.dispose()
      resources.dispose()
    }
    expect(scene.children).toHaveLength(0)
  })

  it.each([0, Math.PI / 2])('keeps off-screen light spill at camera rotation %s', (rotation) => {
    const scene = new Scene()
    const resources = createTownSceneResources()
    const lighting = createTownLighting(scene, resources)
    const size = { width: 800, height: 500 }
    try {
      for (const zoom of [0.4, 1, 2.5]) {
        const view = { x: 400, y: 250, zoom, rotation }
        const radius = 130 * zoom
        const screenPoints = [
          [400, 250],
          [-radius + 1, 250],
          [800 + radius - 1, 250],
          [400, -radius + 1],
          [400, 500 + radius - 1],
          [-radius - 1, 250],
          [800 + radius + 1, 250],
          [400, -radius - 1],
          [400, 500 + radius + 1]
        ]
        lighting.setStreetLamps(
          screenPoints.map(([x, y]) => ({
            ...boardToTown((x - view.x) / zoom, (y - view.y) / zoom + 90 / Math.SQRT2, rotation),
            y: 90
          }))
        )
        lighting.update(localTime(21), view, size)
        const lights = scene.children.filter((child) => child instanceof PointLight)
        expect(lights.map((light) => light.visible)).toEqual([
          true,
          true,
          true,
          true,
          true,
          false,
          false,
          false,
          false
        ])
        expect(lighting.update(localTime(21), view, size)).toBe(false)
        // A stationary night still responds to panning and viewport changes.
        lighting.update(localTime(21), { ...view, x: view.x + 2 }, size)
        expect(lights[5].visible).toBe(true)
        expect(lights[2].visible).toBe(false)
        lighting.update(localTime(21), view, { width: 802, height: 502 })
        expect(lights[6].visible).toBe(true)
        expect(lights[8].visible).toBe(true)
        lighting.update(localTime(12), view, size)
        expect(lights.every((light) => !light.visible)).toBe(true)
      }
    } finally {
      lighting.dispose()
      resources.dispose()
    }
  })

  it('keeps unchanged night lighting cached across midnight and resumes updates at dawn', () => {
    const scene = new Scene()
    const resources = createTownSceneResources()
    const lighting = createTownLighting(scene, resources)
    const view = { x: 640, y: 360, zoom: 1 }
    const size = { width: 1280, height: 720 }
    try {
      expect(lighting.update(localTime(21), view, size)).toBe(true)
      for (const hour of [22, 23, 24, 25, 28, 29])
        expect(lighting.update(localTime(hour), view, size)).toBe(false)
      expect(lighting.update(localTime(29, 1), view, size)).toBe(true)
    } finally {
      lighting.dispose()
      resources.dispose()
    }
  })

  it('updates lights and explicit luminous materials and releases resized shadow maps', () => {
    const scene = new Scene()
    scene.background = new Color()
    const resources = createTownSceneResources()
    const lighting = createTownLighting(scene, resources)
    const view = { x: 640, y: 360, zoom: 1 }
    const size = { width: 1280, height: 720 }
    try {
      expect(lighting.update(localTime(12), view, size)).toBe(true)
      expect(lighting.update(localTime(12), view, size)).toBe(false)
      const sun = scene.children.find(
        (child): child is DirectionalLight => child instanceof DirectionalLight
      )
      expect(sun).toBeDefined()
      if (!sun) return
      expect(sun.shadow.mapSize.x).toBe(2048)
      sun.shadow.map = new WebGLRenderTarget(16, 16)
      const disposeMap = vi.spyOn(sun.shadow.map, 'dispose')
      expect(sun.castShadow).toBe(true)
      expect(resources.windowMaterial.emissiveIntensity).toBe(0)
      expect(lighting.update(localTime(21), view, size)).toBe(true)
      expect(sun.intensity).toBe(0)
      expect(sun.castShadow).toBe(false)
      expect(resources.windowMaterial.emissiveIntensity).toBeGreaterThan(0)
      expect(resources.lampGlowMaterial.opacity).toBeGreaterThan(0)
      expect(resources.material.emissiveIntensity * resources.material.emissive.getHex()).toBe(0)
      lighting.update(
        localTime(6),
        { ...view, rotation: 1, zoom: 0.4 },
        { width: 390, height: 844 }
      )
      expect(sun.shadow.mapSize.x).toBe(1024)
      expect(disposeMap).toHaveBeenCalledOnce()
      expect(sun.shadow.map).toBeNull()
      expect(sun.shadow.camera.far).toBeGreaterThan(sun.shadow.camera.near)
      const dispose = vi.spyOn(sun.shadow, 'dispose')
      lighting.dispose()
      expect(dispose).toHaveBeenCalledOnce()
      expect(scene.children).toHaveLength(0)
    } finally {
      resources.dispose()
    }
  })

  it('marks window panes and lamps without lighting other objects of the same color', () => {
    for (const detailed of [false, true]) {
      const { parts } = createTownStaticModel(detailed)
      const windows = parts.box.filter((part) => part.emission === 'window')
      expect(windows.length).toBeGreaterThan(0)
      expect(parts.box.some((part) => !part.emission && part.color === windows[0].color)).toBe(true)
      expect(parts.box.some((part) => part.emission === 'lamp')).toBe(true)
      expect(parts.disc.some((part) => part.emission === 'glow')).toBe(true)
    }
  })

  it('invalidates a motionless cached scene when wall time changes, even after a long pause', () => {
    vi.useFakeTimers()
    vi.setSystemTime(localTime(12))
    const town = createTownScene([])
    const render = vi.fn()
    const renderer = {
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      clear: () => {},
      render
    } as unknown as WebGLRenderer
    try {
      town.update({ x: 640, y: 360, zoom: 1 }, { width: 1280, height: 720 })
      town.render(renderer, 0, false)
      const world = render.mock.calls[0][0] as Scene
      const traffic = world.children.find((child) => child.type === 'Scene')
      if (!traffic) throw new Error('Missing residents')
      const versions = () =>
        traffic.children.map((mesh) => (mesh as InstancedMesh).instanceMatrix.version)
      const initialVersions = versions()
      render.mockClear()
      town.render(renderer, 10, false)
      expect(render).toHaveBeenCalledTimes(1)
      town.pause()
      vi.setSystemTime(localTime(21))
      render.mockClear()
      town.render(renderer, 20, false)
      expect(render).toHaveBeenCalledTimes(2)
      expect(versions()).toEqual(initialVersions)
      const sun = world.children.find(
        (child) => child instanceof DirectionalLight
      ) as DirectionalLight
      expect(sun.intensity).toBe(0)
    } finally {
      town.dispose()
    }
  })
})
