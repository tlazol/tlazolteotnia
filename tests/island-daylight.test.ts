import { describe, expect, it } from 'vitest'
import { daylightAt, daylightNow } from '../src/lib/island-daylight'

describe('island daylight', () => {
  it('leaves midday untouched and unlit', () => {
    expect(daylightAt(12)).toEqual({ tint: [1, 1, 1], glow: 0 })
  })

  it('is dark, blue and torch-lit at night, on both sides of midnight', () => {
    for (const hour of [23, 0, 3]) {
      const { tint, glow } = daylightAt(hour)
      expect(tint[2]).toBeGreaterThan(tint[0])
      expect(tint[0]).toBeLessThan(0.5)
      expect(glow).toBe(1)
    }
    expect(daylightAt(24)).toEqual(daylightAt(0))
    expect(daylightAt(-1)).toEqual(daylightAt(23))
  })

  it('warms the morning and reddens the evening more', () => {
    const morning = daylightAt(7)
    const evening = daylightAt(18)
    expect(morning.tint[0]).toBeGreaterThan(morning.tint[2])
    expect(evening.tint[0]).toBeGreaterThan(evening.tint[2])
    expect(evening.tint[1]).toBeLessThan(morning.tint[1])
  })

  it('changes gradually, with no jump between hours', () => {
    for (let hour = 0; hour < 24; hour += 0.05) {
      const a = daylightAt(hour)
      const b = daylightAt(hour + 0.05)
      for (let i = 0; i < 3; i++) expect(Math.abs(a.tint[i] - b.tint[i])).toBeLessThan(0.03)
      expect(Math.abs(a.glow - b.glow)).toBeLessThan(0.06)
    }
  })

  it('reads the local time of a date', () => {
    expect(daylightNow(new Date(2026, 10, 10, 12, 30))).toEqual(daylightAt(12.5))
    expect(daylightNow(new Date(2026, 10, 10, 18, 12))).toEqual(daylightAt(18.2))
  })
})
