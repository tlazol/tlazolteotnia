// Shared screen-space geometry and deterministic seeds for procedural visuals.
export type SceneView = { x: number; y: number; zoom: number }
export type SceneSize = { width: number; height: number }

export function hashSlug(slug: string) {
  let hash = 2166136261
  for (const char of slug) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return hash >>> 0
}

export function zoomViewAt(
  view: SceneView,
  factor: number,
  point: { x: number; y: number }
): SceneView {
  const zoom = Math.max(0.02, Math.min(2.5, view.zoom * factor))
  const ratio = zoom / view.zoom
  return { zoom, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }
}
