import { Color, Scene, Vector3, type WebGLRenderer } from 'three'
import type { SceneSize } from './scene-math'
import { createTownAmbient } from './town-ambient'
import { createTownCamera, updateTownCamera } from './town-camera'
import { createTownLighting } from './town-lighting'
import { createTownMaterials } from './town-materials'
import { createTownNavigation } from './town-navigation'
import { clampTownView, type TownArticle } from './town-posts'
import { createResidentBatches, residentLiftHeight } from './town-resident-batches'
import { createTownResidents } from './town-residents'
import { buildTownStatic, type TownOccluder } from './town-static'
import { boardToTown, type TownView, townToBoard } from './town-view'
import { containsTownGround } from './town-world'

// Ray/box slab test along the camera's viewing direction.
function blocks(box: TownOccluder, origin: Vector3, direction: Vector3) {
  let near = 0
  let far = Number.POSITIVE_INFINITY
  const ranges: [number, number, number, number][] = [
    [origin.x, direction.x, box.minX, box.maxX],
    [origin.y, direction.y, box.minY, box.maxY],
    [origin.z, direction.z, box.minZ, box.maxZ]
  ]
  for (const [start, step, min, max] of ranges) {
    if (Math.abs(step) < 1e-9) {
      if (start < min || start > max) return false
      continue
    }
    const a = (min - start) / step
    const b = (max - start) / step
    near = Math.max(near, Math.min(a, b))
    far = Math.min(far, Math.max(a, b))
    if (near > far) return false
  }
  return true
}

export function createTownScene(articles?: TownArticle[]) {
  const camera = createTownCamera()
  const scene = new Scene()
  scene.background = new Color(0x2a7bb6)
  const materials = createTownMaterials()
  const statics = buildTownStatic(materials)
  scene.add(statics.group)
  const ambient = createTownAmbient(materials)
  scene.add(ambient.group)
  const lighting = createTownLighting(scene, materials, statics.pools)
  const residents = createTownResidents(articles)
  const batches = createResidentBatches()
  batches.rebuild(residents.residents)
  scene.add(batches.group)
  const navigation = createTownNavigation(statics.obstacles, containsTownGround)
  let currentView: TownView = { x: 0, y: 0, zoom: 1 }
  let zoom = 1
  let viewport: SceneSize = { width: 0, height: 0 }
  let anisotropy = false
  const projected = new Vector3()
  const world = new Vector3()
  const towardCamera = new Vector3()
  const visibility = new Map<string, boolean>()
  let visibilityTime = Number.NEGATIVE_INFINITY

  function occluded(point: Vector3) {
    camera.getWorldDirection(towardCamera).negate()
    return statics.occluders.some((box) => blocks(box, point, towardCamera))
  }

  return {
    get stats() {
      return statics.stats
    },
    beginResidentDrag(slug: string) {
      residents.beginResidentDrag(slug)
    },
    moveResidentDrag(dx: number, dy: number) {
      residents.moveResidentDrag(boardToTown(dx / zoom, dy / zoom, currentView.rotation))
      visibilityTime = Number.NEGATIVE_INFINITY
    },
    endResidentDrag(cancel = false) {
      residents.endResidentDrag(navigation, cancel)
      visibilityTime = Number.NEGATIVE_INFINITY
    },
    select(slug: string | null) {
      residents.select(slug)
    },
    follow: residents.follow,
    focus: residents.focus,
    filter(slugs: string[]) {
      residents.filter(slugs)
      visibilityTime = Number.NEGATIVE_INFINITY
    },
    residentPosition: residents.residentPosition,
    projectResidents(now: number) {
      // Keep occlusion checks on their own cadence, including while following a resident.
      const checkVisibility = now - visibilityTime >= 180
      if (checkVisibility) visibilityTime = now
      return [...residents.articleResidents.entries()].map(([slug, resident]) => {
        const { x, z } = resident.pose
        const riding = resident.kind === 'bicycle'
        const headHeight = (resident.bounds?.max.y ?? 66 * resident.scale) - 8 * resident.scale
        const bounds = resident.bounds
        const width = bounds
          ? 2 *
            Math.hypot(
              Math.max(Math.abs(bounds.min.x), bounds.max.x),
              Math.max(Math.abs(bounds.min.z), bounds.max.z)
            )
          : 44 * resident.scale
        const lifted = resident === residents.dragged
        world.set(x, headHeight + (lifted ? residentLiftHeight : 0), z)
        projected.copy(world).project(camera)
        const px = ((projected.x + 1) * viewport.width) / 2
        const py = ((1 - projected.y) * viewport.height) / 2
        const inView = px >= 0 && px <= viewport.width && py >= 70 && py < viewport.height - 70
        if (
          (checkVisibility || !visibility.has(slug)) &&
          inView &&
          residents.visibleSlugs?.has(slug)
        ) {
          // Visibility is sampled at the face, independently of tall hats and props.
          world.set(x, (riding ? 60 : 50) * resident.scale + (lifted ? residentLiftHeight : 0), z)
          visibility.set(slug, !occluded(world))
        }
        return {
          slug,
          x: px,
          y: py,
          width,
          bodyHeight: (headHeight + (riding ? 20 * resident.scale : 0)) / Math.SQRT2,
          footY: (headHeight + (lifted ? residentLiftHeight : 0)) / Math.SQRT2,
          dropAllowed: !lifted || navigation.canStand(resident.pose),
          inView,
          visible:
            inView &&
            !!residents.visibleSlugs?.has(slug) &&
            (lifted || visibility.get(slug) === true)
        }
      })
    },
    update(view: TownView, size: SceneSize) {
      if ((view.rotation ?? 0) !== (currentView.rotation ?? 0))
        visibilityTime = Number.NEGATIVE_INFINITY
      currentView = view
      viewport = size
      zoom = view.zoom
      updateTownCamera(camera, view, size)
    },
    pause: residents.pause,
    render(renderer: WebGLRenderer, now: number, motion: boolean) {
      if (!anisotropy) {
        anisotropy = true
        materials.atlas.texture.anisotropy = Math.min(
          8,
          renderer.capabilities?.getMaxAnisotropy() ?? 1
        )
      }
      lighting.update(new Date(), currentView, viewport)
      const { delta } = residents.advance(now, motion)
      residents.updatePoses(delta, navigation)
      batches.update({
        elapsed: residents.elapsed,
        motion,
        selectedSlug: residents.selectedSlug,
        visibleSlugs: residents.visibleSlugs,
        dragged: residents.dragged
      })
      materials.uniforms.uTime.value = residents.elapsed
      ambient.update(residents.elapsed, lighting.night)
      const followed = residents.followedSlug
        ? residents.articleResidents.get(residents.followedSlug)
        : undefined
      if (followed) {
        const point = townToBoard(followed.pose.x, followed.pose.z, 28, currentView.rotation)
        const next = clampTownView(
          {
            ...currentView,
            x: viewport.width / 2 - point.x * zoom,
            y: viewport.height * 0.56 - point.y * zoom,
            zoom
          },
          viewport
        )
        if (next.x !== currentView.x || next.y !== currentView.y) {
          currentView = next
          updateTownCamera(camera, currentView, viewport)
          lighting.update(new Date(), currentView, viewport)
        }
      }
      renderer.render(scene, camera)
      return currentView
    },
    dispose() {
      lighting.dispose()
      batches.dispose()
      ambient.dispose()
      statics.dispose()
      materials.dispose()
    }
  }
}
