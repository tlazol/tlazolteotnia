import { InstancedMesh, MeshToonMaterial, type Scene, type WebGLRenderer } from 'three'
import { expect, it } from 'vitest'
import { townPersonStyles } from '../src/lib/town-person'
import type { TownArticle } from '../src/lib/town-posts'
import { createTownScene } from '../src/lib/town-three.client'

it('batches repeated costumes without adding draw calls per resident', () => {
  // Include several identities per costume so every colorway occurs in both sets.
  const batchCounts = [120, 240].map((count) => {
    const articles: TownArticle[] = Array.from({ length: count }, (_, i) => ({
      slug: `batch-${i}`,
      variant: i % townPersonStyles.length,
      kind: i % 2 ? 'walker' : 'bicycle',
      route: {
        start: { x: -2000 - i * 100, z: -1100 },
        end: { x: -2000 - i * 100, z: -900 },
        lane: -19,
        progress: 0.5,
        speed: 10
      }
    }))
    const town = createTownScene(articles)
    let batches = 0
    let faces = 0
    const renderer = {
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      clear: () => {},
      render: (scene: Scene) => {
        if (!scene.background) return
        const traffic = scene.getObjectByName('town-residents')
        for (const mesh of traffic?.children ?? []) {
          if (!(mesh instanceof InstancedMesh)) continue
          batches++
          if (mesh.material instanceof MeshToonMaterial && mesh.material.map) faces += mesh.count
        }
      }
    } as unknown as WebGLRenderer
    try {
      town.update({ x: 0, y: 0, zoom: 1 }, { width: 1280, height: 720 })
      town.render(renderer, 0, false)
      expect(faces).toBe(count)
      return batches
    } finally {
      town.dispose()
    }
  })
  expect(batchCounts[0]).toBeGreaterThan(0)
  expect(batchCounts[1]).toBe(batchCounts[0])
})
