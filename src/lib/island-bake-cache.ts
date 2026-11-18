import { BAKE_CHUNK, type BakedChunk, type BakedModel } from './island-bake'
import { TILE_SIZE } from './island-world'

export type BakeSnapshot = {
  version: string
  columns: number
  rows: number
  ground: Uint8Array
  decor: Uint8Array
  chunks: BakedChunk[]
}

// Keep only the latest island. Storage denial or eviction must never prevent
// rendering; this cache only avoids repeating identical lighting calculations.
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('island-bake', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('snapshot')
    let blocked = false
    request.onsuccess = () => {
      if (blocked) request.result.close()
      else {
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      blocked = true
      reject(new Error('Island cache unavailable'))
    }
  })
}

async function read(key: string): Promise<{ value: unknown; writable: boolean }> {
  let db: IDBDatabase | undefined
  try {
    db = await database()
    const value = await new Promise((resolve, reject) => {
      const request = db?.transaction('snapshot').objectStore('snapshot').get(key)
      if (!request) return resolve(null)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
    return { value, writable: true }
  } catch {
    return { value: null, writable: false }
  } finally {
    db?.close()
  }
}

async function write(key: string, value: unknown) {
  let db: IDBDatabase | undefined
  try {
    db = await database()
    await new Promise<void>((resolve, reject) => {
      const transaction = db?.transaction('snapshot', 'readwrite')
      if (!transaction) return resolve()
      transaction.objectStore('snapshot').put(value, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } catch {
    // The live scene is already available, even when storage is full.
  } finally {
    db?.close()
  }
}

export async function readBakeSnapshot(): Promise<{ snapshot: unknown; writable: boolean }> {
  const { value, writable } = await read('latest')
  return { snapshot: value, writable }
}

export async function writeBakeSnapshot(snapshot: BakeSnapshot) {
  await write('latest', snapshot)
}

// Decoration models, kept apart from the island: they stay valid however the
// shared island is edited, so a returning visitor skips most of the work.
export type ModelCache = { version: string; models: BakedModel[] }

export async function readModelCache(): Promise<{ cache: unknown; writable: boolean }> {
  const { value, writable } = await read('models')
  return { cache: value, writable }
}

export async function writeModelCache(cache: ModelCache) {
  await write('models', cache)
}

// The usable models of a cache from this renderer version; broken entries are skipped.
export function cachedModels(cache: unknown, version: string): BakedModel[] {
  if (!cache || typeof cache !== 'object') return []
  const { version: cachedVersion, models } = cache as Partial<ModelCache>
  if (cachedVersion !== version || !Array.isArray(models)) return []
  return models.filter(validModel)
}

function validModel(model: unknown): model is BakedModel {
  if (!model || typeof model !== 'object') return false
  const { key, template: t, shadow: s } = model as Partial<BakedModel>
  return (
    typeof key === 'string' &&
    !!t &&
    Number.isInteger(t.count) &&
    t.count >= 0 &&
    t.x instanceof Int16Array &&
    t.x.length === t.count &&
    t.y instanceof Int16Array &&
    t.y.length === t.count &&
    t.depth instanceof Float32Array &&
    t.depth.length === t.count &&
    t.slot instanceof Uint16Array &&
    t.slot.length === t.count &&
    t.sway instanceof Float32Array &&
    t.sway.length === t.count &&
    t.glow instanceof Uint8Array &&
    t.glow.length === t.count &&
    !!s &&
    Number.isFinite(s.x0) &&
    Number.isFinite(s.y0) &&
    Number.isInteger(s.width) &&
    Number.isInteger(s.height) &&
    s.light instanceof Float32Array &&
    s.light.length === s.width * s.height
  )
}

export function matchesBakeSnapshot(
  snapshot: unknown,
  version: string,
  columns: number,
  rows: number,
  ground: Uint8Array,
  decor: Uint8Array
): snapshot is BakeSnapshot {
  if (!snapshot || typeof snapshot !== 'object') return false
  const cached = snapshot as Partial<BakeSnapshot>
  const count =
    Math.ceil((columns * TILE_SIZE) / BAKE_CHUNK) * Math.ceil((rows * TILE_SIZE) / BAKE_CHUNK)
  const indices = new Set<number>()
  return (
    cached.version === version &&
    cached.columns === columns &&
    cached.rows === rows &&
    cached.ground instanceof Uint8Array &&
    cached.decor instanceof Uint8Array &&
    cached.ground.length === ground.length &&
    cached.decor.length === decor.length &&
    ground.every((value, i) => value === cached.ground?.[i]) &&
    decor.every((value, i) => value === cached.decor?.[i]) &&
    Array.isArray(cached.chunks) &&
    cached.chunks.length === count &&
    cached.chunks.every((chunk) => {
      if (
        !chunk ||
        !Number.isInteger(chunk.index) ||
        chunk.index < 0 ||
        chunk.index >= count ||
        indices.has(chunk.index)
      )
        return false
      indices.add(chunk.index)
      return (
        validPoints(chunk.terrain) &&
        validPoints(chunk.decor) &&
        chunk.decor.anim instanceof Float32Array &&
        chunk.decor.anim.length === (chunk.decor.position.length / 3) * 4 &&
        Array.isArray(chunk.glows) &&
        chunk.glows.every(
          (glow) =>
            glow &&
            Number.isInteger(glow.tile) &&
            Number.isFinite(glow.x) &&
            Number.isFinite(glow.y) &&
            typeof glow.soft === 'boolean'
        )
      )
    })
  )
}

function validPoints(points: BakedChunk['terrain'] | undefined) {
  return (
    points?.position instanceof Int16Array &&
    points.color instanceof Uint8Array &&
    points.position.length % 3 === 0 &&
    points.position.length === points.color.length
  )
}
