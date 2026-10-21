import { PCFShadowMap, WebGLRenderer } from 'three'
import type { SceneSize } from './scene-math'
import type { TownArticle } from './town-posts'
import { createTownScene } from './town-three.client'
import type { TownView } from './town-view'

export type ResidentScreenPosition = ReturnType<
  ReturnType<typeof createTownScene>['projectResidents']
>[number]

export function createArticleTown(
  canvas: HTMLCanvasElement,
  articles: TownArticle[],
  onPositions: (positions: ResidentScreenPosition[], view: TownView) => void,
  onFailure: () => void
) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const town = createTownScene(articles)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let unavailable = false
  let hasSize = false

  function stop() {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    frame = 0
    town.pause()
  }
  function fail(error?: unknown) {
    if (disposed || unavailable) return
    if (error !== undefined) console.error('Town renderer unavailable', error)
    unavailable = true
    stop()
    onFailure()
  }
  function render(now: number) {
    frame = 0
    if (disposed || unavailable || document.hidden || !hasSize) return
    try {
      renderer.clear()
      const view = town.render(renderer, now, !reducedMotion.matches)
      onPositions(town.projectResidents(now), view)
      if (!disposed && !unavailable)
        timer = setTimeout(wake, reducedMotion.matches ? 1000 : 1000 / 30)
    } catch (error) {
      fail(error)
    }
  }
  function wake() {
    clearTimeout(timer)
    if (!disposed && !unavailable && !document.hidden && !frame)
      frame = requestAnimationFrame(render)
  }
  function visibilityChanged() {
    if (document.hidden) stop()
    else wake()
  }
  function contextLost(event: Event) {
    event.preventDefault()
    fail()
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  reducedMotion.addEventListener('change', wake)
  canvas.addEventListener('webglcontextlost', contextLost)

  return {
    beginResidentDrag(slug: string) {
      town.beginResidentDrag(slug)
      wake()
    },
    moveResidentDrag(dx: number, dy: number) {
      town.moveResidentDrag(dx, dy)
      wake()
    },
    endResidentDrag(cancel = false) {
      town.endResidentDrag(cancel)
      wake()
    },
    update(view: TownView, size: SceneSize) {
      if (disposed || unavailable || !size.width || !size.height) return
      try {
        hasSize = true
        if (
          canvas.clientWidth !== size.width ||
          canvas.width !== Math.floor(size.width * renderer.getPixelRatio()) ||
          canvas.height !== Math.floor(size.height * renderer.getPixelRatio())
        )
          renderer.setSize(size.width, size.height, false)
        town.update(view, size)
        wake()
      } catch (error) {
        fail(error)
      }
    },
    select(slug: string | null) {
      town.select(slug)
      wake()
    },
    follow(slug: string | null) {
      town.follow(slug)
      wake()
    },
    focus(slug: string | null) {
      town.focus(slug)
      wake()
    },
    filter(slugs: string[]) {
      town.filter(slugs)
      wake()
    },
    residentPosition: town.residentPosition,
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      document.removeEventListener('visibilitychange', visibilityChanged)
      reducedMotion.removeEventListener('change', wake)
      canvas.removeEventListener('webglcontextlost', contextLost)
      town.dispose()
      renderer.dispose()
    }
  }
}
