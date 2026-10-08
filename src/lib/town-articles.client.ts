import { WebGLRenderer } from 'three'
import type { BoardSize, BoardView } from './sticker-board'
import type { TownArticle } from './town-posts'
import { createTownScene } from './town-three.client'

export type ResidentScreenPosition = ReturnType<
  ReturnType<typeof createTownScene>['projectResidents']
>[number]

export function createArticleTown(
  canvas: HTMLCanvasElement,
  articles: TownArticle[],
  onPositions: (positions: ResidentScreenPosition[]) => void,
  onFailure: () => void
) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false })
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
  function render(now: number) {
    frame = 0
    if (disposed || document.hidden || !hasSize) return
    try {
      renderer.clear()
      town.render(renderer, now, !reducedMotion.matches)
      onPositions(town.projectResidents(now))
      if (!reducedMotion.matches) timer = setTimeout(wake, 1000 / 30)
    } catch (error) {
      console.error('Town renderer unavailable', error)
      unavailable = true
      stop()
      onFailure()
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
    unavailable = true
    stop()
    onFailure()
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  reducedMotion.addEventListener('change', wake)
  canvas.addEventListener('webglcontextlost', contextLost)

  return {
    update(view: BoardView, size: BoardSize) {
      if (!size.width || !size.height) return
      hasSize = true
      if (
        canvas.clientWidth !== size.width ||
        canvas.width !== Math.floor(size.width * renderer.getPixelRatio()) ||
        canvas.height !== Math.floor(size.height * renderer.getPixelRatio())
      )
        renderer.setSize(size.width, size.height, false)
      town.update(view, size)
      wake()
    },
    select(slug: string | null) {
      town.select(slug)
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
