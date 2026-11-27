import { describe, expect, it } from 'vitest'
import { decorThumbnail, groundThumbnail } from '../src/lib/island-thumbnails'
import { decorInfo, decorKinds, landGrounds } from '../src/lib/island-world'

describe('palette thumbnails', () => {
  it('draw every look of every decoration from its island mesh', () => {
    for (const kind of decorKinds)
      for (let look = 0; look < decorInfo[kind].looks; look++) {
        const thumbnail = decorThumbnail(kind, look)
        expect(thumbnail.data.length).toBe(thumbnail.width * thumbnail.height * 4)
        let drawn = 0
        for (let i = 3; i < thumbnail.data.length; i += 4) if (thumbnail.data[i]) drawn++
        // Fireflies are a few glowing specks; everything else has a body.
        expect(drawn, `${kind} ${look}`).toBeGreaterThan(kind === 'fireflies' ? 2 : 20)
        // Cropped to the outline: something drawn on every edge.
        const { width, height, data } = thumbnail
        const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3]
        const row = (y: number) => Array.from({ length: width }, (_, x) => alpha(x, y))
        const column = (x: number) => Array.from({ length: height }, (_, y) => alpha(x, y))
        for (const edge of [row(0), row(height - 1), column(0), column(width - 1)])
          expect(edge.some(Boolean), `${kind} ${look}`).toBe(true)
      }
  }, 30_000)

  it('light a face turned to the sun brighter than one turned away', () => {
    // A plain rock: its sunlit top is brighter than its shaded east flank.
    const { width, height, data } = decorThumbnail('rock', 0)
    const brightness = (x: number, y: number) => {
      const at = (y * width + x) * 4
      return data[at + 3] ? data[at] + data[at + 1] + data[at + 2] : null
    }
    const lit = []
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const b = brightness(x, y)
        if (b !== null) lit.push(b)
      }
    expect(Math.max(...lit)).toBeGreaterThan(Math.min(...lit) * 1.2)
  })

  it('fill every ground swatch, pools with their water', () => {
    for (const ground of landGrounds) {
      const swatch = groundThumbnail(ground, 9)
      expect(swatch.width).toBe(9)
      for (let i = 3; i < swatch.data.length; i += 4) expect(swatch.data[i]).toBe(255)
    }
  })
})
