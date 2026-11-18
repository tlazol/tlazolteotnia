import { describe, expect, it } from 'vitest'
import {
  type BakeSnapshot,
  matchesBakeSnapshot,
  readBakeSnapshot,
  writeBakeSnapshot
} from '../src/lib/island-bake-cache'

const snapshot: BakeSnapshot = {
  version: 'renderer-v1',
  columns: 2,
  rows: 1,
  ground: new Uint8Array([1, 2]),
  decor: new Uint8Array([0, 3]),
  chunks: [
    {
      index: 0,
      terrain: { position: new Int16Array(), color: new Uint8Array() },
      decor: { position: new Int16Array(), color: new Uint8Array(), anim: new Float32Array() },
      glows: []
    }
  ]
}

describe('baked island cache', () => {
  it('reuses only an identical world from the same renderer version', () => {
    const matches = (value: BakeSnapshot) =>
      matchesBakeSnapshot(
        value,
        'renderer-v1',
        2,
        1,
        new Uint8Array([1, 2]),
        new Uint8Array([0, 3])
      )
    expect(matches(snapshot)).toBe(true)
    expect(matches({ ...snapshot, version: 'renderer-v2' })).toBe(false)
    expect(matches({ ...snapshot, columns: 1, rows: 2 })).toBe(false)
    expect(matches({ ...snapshot, ground: new Uint8Array([1]) })).toBe(false)
    expect(matches({ ...snapshot, ground: new Uint8Array([2, 2]) })).toBe(false)
    expect(matches({ ...snapshot, decor: new Uint8Array([0, 4]) })).toBe(false)
  })

  it('rejects broken or incomplete persistent data without breaking rendering', () => {
    const matches = (value: unknown) =>
      matchesBakeSnapshot(
        value,
        'renderer-v1',
        2,
        1,
        new Uint8Array([1, 2]),
        new Uint8Array([0, 3])
      )
    for (const value of [
      null,
      {},
      { ...snapshot, ground: null },
      { ...snapshot, chunks: [] },
      { ...snapshot, chunks: [{ ...snapshot.chunks[0], index: 1 }] },
      { ...snapshot, chunks: [{ ...snapshot.chunks[0], terrain: null }] },
      {
        ...snapshot,
        chunks: [
          {
            ...snapshot.chunks[0],
            decor: {
              ...snapshot.chunks[0].decor,
              anim: new Float32Array(4)
            }
          }
        ]
      }
    ])
      expect(matches(value)).toBe(false)
  })

  it('falls back to calculation when IndexedDB is unavailable', async () => {
    expect(await readBakeSnapshot()).toEqual({ snapshot: null, writable: false })
    await expect(writeBakeSnapshot(snapshot)).resolves.toBeUndefined()
  })
})
