import {
  InstancedMesh,
  Mesh,
  type Scene,
  ShaderMaterial,
  type WebGLRenderer,
  type WebGLRenderTarget
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createTownCamera } from '../src/lib/town-camera'
import type { TownArticle } from '../src/lib/town-posts'
import { createTownResidents } from '../src/lib/town-residents'
import { createTownSceneBatches } from '../src/lib/town-scene-batches'
import { createTownSceneCompositor } from '../src/lib/town-scene-compositor'
import { createTownSceneResources } from '../src/lib/town-scene-resources'
import type { StaticTownParts } from '../src/lib/town-static-model'
import { createTownScene } from '../src/lib/town-three.client'

const article: TownArticle = {
  slug: 'resident',
  variant: 0,
  kind: 'bicycle',
  route: {
    start: { x: -1000, z: -1100 },
    end: { x: -1000, z: -900 },
    lane: -19,
    progress: 0.5,
    speed: 10
  }
}
const size = { width: 1280, height: 720 }
function rendererStub() {
  let target: WebGLRenderTarget | null = null
  const render = vi.fn<(scene: Scene) => void>()
  const renderer = {
    getRenderTarget: () => target,
    setRenderTarget: (next: WebGLRenderTarget | null) => {
      target = next
    },
    clear: () => {},
    render
  } as unknown as WebGLRenderer
  return { renderer, render }
}
describe('town scene lifecycle', () => {
  it('caches an unchanged world and redraws shared shadows when traffic or the camera changes', () => {
    const resources = createTownSceneResources()
    const batches = createTownSceneBatches(resources)
    const compositor = createTownSceneCompositor(
      batches.scene,
      batches.traffic,
      batches.selection,
      createTownCamera()
    )
    const { renderer, render } = rendererStub()
    compositor.resize({ x: 0, y: 0, zoom: 1 }, size)
    compositor.render(renderer, compositor.needsUpdate, true)
    expect(render.mock.calls.map(([scene]) => scene)).toEqual([
      batches.scene,
      batches.traffic,
      batches.selection,
      expect.anything()
    ])
    render.mockClear()
    compositor.render(renderer, compositor.needsUpdate, true)
    expect(render).toHaveBeenCalledTimes(1)
    compositor.invalidateTraffic()
    render.mockClear()
    compositor.render(renderer, compositor.needsUpdate, true)
    expect(render.mock.calls.slice(0, 3).map(([scene]) => scene)).toEqual([
      batches.scene,
      batches.traffic,
      batches.selection
    ])
    expect(render).toHaveBeenCalledTimes(4)
    compositor.invalidate()
    render.mockClear()
    compositor.render(renderer, compositor.needsUpdate, false)
    expect(render.mock.calls.map(([scene]) => scene)).toEqual([batches.scene, expect.anything()])
    expect(render).toHaveBeenCalledTimes(2)
    expect(renderer.getRenderTarget()).toBeNull()
    compositor.dispose()
    batches.dispose()
    resources.dispose()
  })
  it('does not sample the dormant selection depth before its framebuffer is rendered after resizing', () => {
    const resources = createTownSceneResources()
    const batches = createTownSceneBatches(resources)
    const compositor = createTownSceneCompositor(
      batches.scene,
      batches.traffic,
      batches.selection,
      createTownCamera()
    )
    const { renderer, render } = rendererStub()
    const bindings: boolean[] = []
    render.mockImplementation((scene) => {
      for (const mesh of scene.children) {
        if (mesh instanceof Mesh && mesh.material instanceof ShaderMaterial) {
          const { selectionDepth, trafficDepth, townDepth } = mesh.material.uniforms
          expect(trafficDepth.value === townDepth.value).toBe(
            selectionDepth.value === townDepth.value
          )
          bindings.push(selectionDepth.value === townDepth.value)
        }
      }
    })
    try {
      for (const size of [
        { width: 1280, height: 720 },
        { width: 390, height: 844 }
      ]) {
        compositor.resize({ x: 0, y: 0, zoom: 1 }, size)
        compositor.invalidate()
        compositor.render(renderer, true, false)
        compositor.render(renderer, true, true)
        compositor.render(renderer, true, false)
      }
      expect(bindings).toEqual([true, false, true, true, false, true])
    } finally {
      compositor.dispose()
      batches.dispose()
      resources.dispose()
    }
  })
  it('releases old instance buffers and cloned face geometry on rebuild, and releases shared resources only on disposal', () => {
    const resources = createTownSceneResources()
    const batches = createTownSceneBatches(resources)
    const simulation = createTownResidents([article])
    const parts: StaticTownParts = {
      box: [],
      ground: [],
      land: [],
      roof: [],
      gable: [],
      tree: [],
      disc: [],
      wheel: []
    }
    const baseGeometry = vi.spyOn(resources.geometries.box, 'dispose')
    const material = vi.spyOn(resources.material, 'dispose')
    const texture = resources.faceMaterial.map
    if (!texture) throw new Error('Missing face texture')
    const faceTexture = vi.spyOn(texture, 'dispose')
    batches.rebuild(parts, {}, simulation.residents, true)
    const meshDisposals = [...batches.traffic.children, ...batches.selection.children].map((mesh) =>
      vi.spyOn(mesh as InstancedMesh, 'dispose')
    )
    const baseGeometries = Object.values(resources.geometries)
    const clonedGeometries = [...batches.traffic.children, ...batches.selection.children]
      .filter(
        (mesh): mesh is InstancedMesh =>
          mesh instanceof InstancedMesh && !baseGeometries.includes(mesh.geometry)
      )
      .map((mesh) => vi.spyOn(mesh.geometry, 'dispose'))
    expect(clonedGeometries.length).toBeGreaterThan(0)
    const resident = simulation.articleResidents.get(article.slug)
    simulation.advance(0, true)
    simulation.advance(100, true)
    const time = resident?.time
    batches.rebuild(parts, {}, simulation.residents, false)
    expect(simulation.articleResidents.get(article.slug)).toBe(resident)
    expect(resident?.time).toBe(time)
    for (const dispose of [...meshDisposals, ...clonedGeometries])
      expect(dispose).toHaveBeenCalledOnce()
    expect(baseGeometry).not.toHaveBeenCalled()
    expect(material).not.toHaveBeenCalled()
    expect(faceTexture).not.toHaveBeenCalled()
    batches.dispose()
    resources.dispose()
    expect(baseGeometry).toHaveBeenCalledOnce()
    expect(material).toHaveBeenCalledOnce()
    expect(faceTexture).toHaveBeenCalledOnce()
    for (const dispose of clonedGeometries) expect(dispose).toHaveBeenCalledOnce()
    expect(batches.traffic.children).toHaveLength(0)
    expect(batches.selection.children).toHaveLength(0)
  })
  it('preserves a dragged pose across detail rebuilds and returns to the original pose on cancel', () => {
    const town = createTownScene([article])
    const { renderer } = rendererStub()
    town.update({ x: 0, y: 0, zoom: 1 }, size)
    town.render(renderer, 0, true)
    const before = { ...town.residentPosition(article.slug) }
    town.beginResidentDrag(article.slug)
    town.moveResidentDrag(32, 18)
    const dragged = { ...town.residentPosition(article.slug) }
    for (const zoom of [0.44, 0.45, 1]) {
      town.update({ x: 0, y: 0, zoom }, size)
      town.render(renderer, 100, false)
      expect(town.residentPosition(article.slug)).toEqual(dragged)
    }
    town.endResidentDrag(true)
    expect(town.residentPosition(article.slug)).toEqual(before)
    town.dispose()
  })
})
