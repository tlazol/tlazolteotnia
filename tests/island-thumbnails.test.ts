import { describe, expect, it } from 'vitest'
import { bakeTemplate } from '../src/lib/island-bake'
import { decorModel } from '../src/lib/island-models'
import { decorThumbnail, groundThumbnail } from '../src/lib/island-thumbnails'
import { decorKinds, decorLooks, landGrounds } from '../src/lib/island-world'

describe('palette thumbnails', () => {
  it('draw every look of every decoration from its baked model', () => {
    for (const kind of decorKinds)
      for (let look = 0; look < decorLooks[kind]; look++) {
        const thumbnail = decorThumbnail(kind, look)
        let drawn = 0
        for (let i = 3; i < thumbnail.data.length; i += 4) if (thumbnail.data[i]) drawn++
        const model = decorModel(kind, look)
        const solids = bakeTemplate(model).count
        if (model.shades) {
          expect(drawn).toBeGreaterThanOrEqual(solids)
          if (drawn > solids)
            expect(thumbnail.data.some((v, i) => i % 4 === 3 && v > 0 && v < 255)).toBe(true)
        } else expect(drawn).toBe(solids)
        expect(thumbnail.data.length).toBe(thumbnail.width * thumbnail.height * 4)
      }
    // Bakes every look twice over, the big trees too: slow beside the others.
  }, 30_000)

  it('fill every ground swatch, pools with their water', () => {
    for (const ground of landGrounds) {
      const swatch = groundThumbnail(ground, 9)
      expect(swatch.width).toBe(9)
      for (let i = 3; i < swatch.data.length; i += 4) expect(swatch.data[i]).toBe(255)
    }
  })
})
