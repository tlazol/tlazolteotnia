import { describe, expect, it } from 'vitest'
import { townAirAmount } from '../src/lib/town-atmosphere'

describe('town aerial perspective', () => {
  const [width, height] = [1440, 900]

  it('leaves the middle of the view clear and thickens towards the corners', () => {
    expect(townAirAmount(0, 0, width, height)).toBe(0)
    expect(townAirAmount(100, 100, width, height)).toBe(0)
    const side = townAirAmount(width / 2, 0, width, height)
    const corner = townAirAmount(width / 2, height / 2, width, height)
    expect(side).toBeGreaterThan(0.5)
    expect(corner).toBe(1)
  })

  it('depends only on the on-screen distance from the middle', () => {
    expect(townAirAmount(300, 0, width, height)).toBeCloseTo(townAirAmount(0, -300, width, height))
    expect(townAirAmount(-240, 180, width, height)).toBeCloseTo(
      townAirAmount(300, 0, width, height)
    )
    // A tall phone keeps a round clear middle rather than hazing its narrow sides.
    expect(townAirAmount(195, 0, 390, 844)).toBeLessThan(townAirAmount(0, 422, 390, 844))
  })
})
