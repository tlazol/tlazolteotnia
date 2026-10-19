import { Raycaster, Vector2, Vector3, type WebGLRenderer } from 'three'
import type { SceneSize } from './scene-math'
import { createTownCamera, updateTownCamera } from './town-camera'
import { containsTownGround } from './town-coast'
import { createTownLighting } from './town-lighting'
import { createTownNavigation } from './town-navigation'
import { clampTownView, type TownArticle } from './town-posts'
import { createTownResidents } from './town-residents'
import { createTownSceneBatches, residentLiftHeight } from './town-scene-batches'
import { createTownSceneCompositor } from './town-scene-compositor'
import { createTownSceneResources } from './town-scene-resources'
import { createTownStaticModel } from './town-static-model'
import { boardToTown, type TownView, townToBoard } from './town-view'

export function createTownScene(articles?: TownArticle[]) {
  const camera = createTownCamera()
  const resources = createTownSceneResources()
  const batches = createTownSceneBatches(resources)
  const { scene, occluders } = batches
  const lighting = createTownLighting(scene, resources)
  const compositor = createTownSceneCompositor(scene, batches.traffic, batches.selection, camera)
  const residents = createTownResidents(articles)
  let navigation = createTownNavigation([], containsTownGround)
  let blockKey = ''
  let viewKey = ''
  let currentView: TownView = { x: 0, y: 0, zoom: 1 }
  let zoom = 1
  const raycaster = new Raycaster()
  const projected = new Vector3()
  const world = new Vector3()
  const screen = new Vector2()
  let viewport: SceneSize = { width: 0, height: 0 }
  const visibility = new Map<string, boolean>()
  let visibilityTime = -Infinity
  return {
    beginResidentDrag(slug: string) {
      residents.beginResidentDrag(slug)
      compositor.invalidateTraffic()
    },
    moveResidentDrag(dx: number, dy: number) {
      residents.moveResidentDrag(boardToTown(dx / zoom, dy / zoom, currentView.rotation))
      compositor.invalidateTraffic()
      visibilityTime = -Infinity
    },
    endResidentDrag(cancel = false) {
      residents.endResidentDrag(navigation, cancel)
      compositor.invalidateTraffic()
      visibilityTime = -Infinity
    },
    select(slug: string | null) {
      residents.select(slug)
      compositor.invalidateTraffic()
    },
    follow: residents.follow,
    focus: residents.focus,
    filter(slugs: string[]) {
      residents.filter(slugs)
      compositor.invalidate()
      visibilityTime = -Infinity
    },
    residentPosition: residents.residentPosition,
    projectResidents(now: number) {
      // Pan and zoom preserve the orthographic viewing direction. Keep occlusion
      // checks on their own cadence, including while the camera follows a resident.
      const checkVisibility = now - visibilityTime >= 180
      if (checkVisibility) {
        visibilityTime = now
        scene.updateMatrixWorld()
      }
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
          world.project(camera)
          screen.set(world.x, world.y)
          world.set(x, (riding ? 60 : 50) * resident.scale + (lifted ? residentLiftHeight : 0), z)
          raycaster.setFromCamera(screen, camera)
          raycaster.far = raycaster.ray.origin.distanceTo(world) - 8
          visibility.set(slug, raycaster.intersectObjects(occluders, false).length === 0)
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
      if ((view.rotation ?? 0) !== (currentView.rotation ?? 0)) visibilityTime = -Infinity
      currentView = view
      viewport = size
      zoom = view.zoom
      const nextKey = [view.x, view.y, view.zoom, view.rotation ?? 0, size.width, size.height].join(
        ':'
      )
      if (nextKey === viewKey) return
      viewKey = nextKey
      compositor.invalidate()
      updateTownCamera(camera, view, size)
      const detailed = view.zoom >= 0.45
      const nextBlockKey = `${detailed}`
      if (nextBlockKey !== blockKey) {
        const model = createTownStaticModel(detailed)
        batches.rebuild(model.parts, model.forestParts, residents.residents, detailed)
        lighting.setStreetLamps(model.streetLamps)
        navigation = createTownNavigation(model.obstacles, containsTownGround)
        blockKey = nextBlockKey
        visibilityTime = -Infinity
      }
      compositor.resize(view, size)
    },
    pause: residents.pause,
    render(renderer: WebGLRenderer, now: number, motion: boolean) {
      const lightingChanged = lighting.update(new Date(), currentView, viewport)
      const { delta, changed } = residents.advance(now, motion)
      let updateTraffic = compositor.needsUpdate || changed
      if (updateTraffic) {
        residents.updatePoses(delta, navigation)
        batches.update({
          elapsed: residents.elapsed,
          motion,
          selectedSlug: residents.selectedSlug,
          visibleSlugs: residents.visibleSlugs,
          dragged: residents.dragged
        })
      }
      // A lighting-only redraw does not change resident poses or instance buffers.
      if (lightingChanged) compositor.invalidate()
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
          viewKey = ''
          compositor.invalidate()
          updateTraffic = true
          updateTownCamera(camera, currentView, viewport)
          lighting.update(new Date(), currentView, viewport)
        }
      }
      compositor.render(
        renderer,
        updateTraffic,
        !!residents.selectedSlug && !!residents.visibleSlugs?.has(residents.selectedSlug)
      )
      return currentView
    },
    dispose() {
      lighting.dispose()
      batches.dispose()
      resources.dispose()
      compositor.dispose()
    }
  }
}
