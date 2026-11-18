import { BAKE_CHUNK, type BakedChunk } from './island-bake'
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

export async function readBakeSnapshot(): Promise<{ snapshot: unknown; writable: boolean }> {
  let db: IDBDatabase | undefined
  try {
    db = await database()
    const snapshot = await new Promise((resolve, reject) => {
      const request = db?.transaction('snapshot').objectStore('snapshot').get('latest')
      if (!request) return resolve(null)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
    return { snapshot, writable: true }
  } catch {
    return { snapshot: null, writable: false }
  } finally {
    db?.close()
  }
}

export async function writeBakeSnapshot(snapshot: BakeSnapshot) {
  let db: IDBDatabase | undefined
  try {
    db = await database()
    await new Promise<void>((resolve, reject) => {
      const transaction = db?.transaction('snapshot', 'readwrite')
      if (!transaction) return resolve()
      transaction.objectStore('snapshot').put(snapshot, 'latest')
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
