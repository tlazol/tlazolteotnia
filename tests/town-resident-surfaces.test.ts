import {
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  type Scene,
  Vector3,
  type WebGLRenderer
} from 'three'
import { describe, expect, it } from 'vitest'
import { townPersonStyle, townPersonStyles } from '../src/lib/town-person'
import type { TownArticle } from '../src/lib/town-posts'
import { createTownScene } from '../src/lib/town-three.client'
import { trafficPose } from '../src/lib/town-traffic'

describe('resident head surfaces', () => {
  it.each(['walker', 'bicycle'] as const)(
    'keeps visible hair and skin surfaces apart on every %s costume',
    (kind) => {
      const articles: TownArticle[] = Array.from(
        { length: townPersonStyles.length },
        (_, variant) => ({
          slug: `hairstyle-${variant}`,
          variant,
          kind,
          route: {
            start: { x: -1000 - variant * 100, z: -1100 },
            end: { x: -1000 - variant * 100, z: -900 },
            lane: -19,
            progress: 0.5,
            speed: 10
          }
        })
      )
      const town = createTownScene(articles)
      const heads: Mesh[][] = articles.map(() => [])
      const matrix = new Matrix4()
      const position = new Vector3()
      const color = new Color()
      const renderer = {
        getRenderTarget: () => null,
        setRenderTarget: () => {},
        clear: () => {},
        render: (scene: Scene) => {
          if (scene.background) return
          for (const batch of scene.children) {
            if (!(batch instanceof InstancedMesh)) continue
            for (let index = 0; index < batch.count; index++) {
              batch.getMatrixAt(index, matrix)
              position.setFromMatrixPosition(matrix)
              articles.forEach((article, variant) => {
                const pose = trafficPose(article.route, 0)
                const scale = townPersonStyle(variant).scale
                const lift = kind === 'bicycle' ? 10 : 0
                const lean = kind === 'bicycle' ? -7 : 0
                if (
                  Math.abs(position.x - pose.x) > 25 ||
                  Math.abs(position.z - pose.z) > 25 ||
                  position.y < (40 + lift) * scale
                )
                  return
                const mesh = new Mesh(batch.geometry, batch.material)
                mesh.applyMatrix4(matrix)
                mesh.updateMatrixWorld()
                batch.getColorAt(index, color)
                mesh.userData.tint = color.getHex()
                mesh.userData.face =
                  batch.material instanceof MeshBasicMaterial && !!batch.material.map
                mesh.userData.scalp =
                  !mesh.userData.face &&
                  Math.abs(position.x - pose.x) < 0.001 &&
                  Math.abs(position.y - (54 + lift) * scale) < 0.001 &&
                  Math.abs(position.z - pose.z - (lean + 1) * scale) < 0.001
                heads[variant].push(mesh)
              })
            }
          }
        }
      } as unknown as WebGLRenderer
      try {
        town.update({ x: 0, y: 0, zoom: 1 }, { width: 1280, height: 720 })
        town.render(renderer, 0, false)
        for (const [variant, article] of articles.entries()) {
          const pose = trafficPose(article.route, 0)
          const scale = townPersonStyle(variant).scale
          const lift = kind === 'bicycle' ? 10 : 0
          const lean = kind === 'bicycle' ? -7 : 0
          expect(heads[variant].length).toBeGreaterThan(0)
          expect(heads[variant].filter((mesh) => mesh.userData.scalp)).toHaveLength(1)
          const ray = new Raycaster()
          // Hair or headwear hides both eyes, including on helmets and riding poses.
          for (const side of [-1, 1]) {
            const origin = new Vector3(side * 5.7, 52.164 + lift, lean + 60)
              .multiplyScalar(scale)
              .add(new Vector3(pose.x, 0, pose.z))
            ray.set(origin, new Vector3(0, 0, -1))
            const first = ray.intersectObjects(heads[variant], false)[0]
            expect(first, `missing eye cover on costume ${variant}`).toBeDefined()
            expect(first?.object.userData.face, `exposed eye on costume ${variant}`).toBe(false)
            expect(first?.object.userData.scalp, `bare eye area on costume ${variant}`).toBe(false)
          }
          // Look down across the crown, including its bevels: skin must not poke through hair.
          for (let x = -13.75; x < 14; x += 1) {
            for (let z = -14.75; z < 16; z += 1) {
              const origin = new Vector3(x, 100 + lift, lean + z)
                .multiplyScalar(scale)
                .add(new Vector3(pose.x, 0, pose.z))
              ray.set(origin, new Vector3(0, -1, 0))
              const hits = ray.intersectObjects(heads[variant], false)
              if (!hits.some((hit) => hit.object.userData.scalp)) continue
              expect(
                hits[0].object.userData.scalp,
                `exposed scalp on hairstyle ${variant}, ray ${origin.toArray()}, hit ${hits[0].point.toArray()}`
              ).toBe(false)
            }
          }
          for (const direction of [
            new Vector3(0, 0, -1),
            new Vector3(-1, 0, 0),
            new Vector3(1, 0, 0)
          ]) {
            for (let y = 44.25; y < 62; y += 1) {
              for (let u = -10.25; u < 10; u += 1) {
                const origin = direction.z
                  ? new Vector3(u, y + lift, lean + 30)
                  : new Vector3(-direction.x * 30, y + lift, lean + u)
                origin.multiplyScalar(scale).add(new Vector3(pose.x, 0, pose.z))
                ray.set(origin, direction)
                const hits = ray.intersectObjects(heads[variant], false)
                const first = hits[0]
                if (!first) continue
                const other = hits.find(
                  (hit) => hit.object.userData.tint !== first.object.userData.tint
                )
                // Intersecting bevels can meet along an edge; only reject overlapping flat faces.
                if (
                  other?.face &&
                  first.face &&
                  Math.abs(first.face.normal.dot(direction)) > 0.999 &&
                  Math.abs(other.face.normal.dot(direction)) > 0.999
                ) {
                  expect(
                    other.distance - first.distance,
                    `hairstyle ${variant}, ray ${origin.toArray()}`
                  ).toBeGreaterThan(0.001 * scale)
                }
              }
            }
          }
        }
      } finally {
        town.dispose()
      }
    },
    // Curved head meshes have more triangles, and the crown scan covers their full depth.
    20000
  )
})

it('batches repeated costumes without adding draw calls per resident', () => {
  const batchCounts = [30, 60].map((count) => {
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
        if (scene.background) return
        for (const mesh of scene.children) {
          if (!(mesh instanceof InstancedMesh)) continue
          batches++
          if (mesh.material instanceof MeshBasicMaterial && mesh.material.map) faces += mesh.count
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
