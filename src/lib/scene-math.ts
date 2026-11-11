// Shared screen-space geometry and deterministic seeds for procedural visuals.
export type SceneSize = { width: number; height: number }

export function hashSlug(slug: string) {
  let hash = 2166136261
  for (const char of slug) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return hash >>> 0
}
