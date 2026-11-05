import { describe, expect, it } from 'vitest'
import { contactMap, groundMapBounds, shoreMap } from '../src/lib/town-ground-maps'
import { inSand, terrainGrid } from '../src/lib/town-world'

describe('town ground maps', () => {
  it('places one shore texel on every terrain vertex, marking sand above the midpoint', () => {
    const map = shoreMap()
    expect(map.width).toBe(terrainGrid.columns + 1)
    expect(map.height).toBe(terrainGrid.rows + 1)
    let checked = 0
    for (let row = 0; row < map.height; row += 7) {
      for (let column = 0; column < map.width; column += 7) {
        const x = terrainGrid.x + column * terrainGrid.step
        const z = terrainGrid.z + row * terrainGrid.step
        const value = map.data[(row * map.width + column) * 4]
        // Texels within rounding of the edge may land either side of it.
        if (Math.abs(value - 127.5) < 2) continue
        expect(value > 127.5).toBe(inSand(x, z))
        checked++
      }
    }
    expect(checked).toBeGreaterThan(300)
  })

  it('darkens the ground around footprints and fades out with distance', () => {
    const footprint = { left: 0, right: 200, top: 0, bottom: 200 }
    const map = contactMap([{ footprint, strength: 1 }])
    const at = (x: number, z: number) => {
      const column = Math.floor(((x - groundMapBounds.x) / groundMapBounds.width) * map.width)
      const row = Math.floor(((z - groundMapBounds.z) / groundMapBounds.depth) * map.height)
      return map.data[row * map.width + column]
    }
    expect(at(100, 100)).toBe(255)
    expect(at(215, 100)).toBeGreaterThan(40)
    expect(at(215, 100)).toBeLessThan(255)
    expect(at(320, 100)).toBe(0)
  })
})
