import { expect, it } from 'vitest'
import { townPersonStyles } from '../src/lib/town-person'
import { cyclistParts, type MovingPart, personParts } from '../src/lib/town-vehicles'

const examples = [
  ...townPersonStyles.flatMap((_, variant) =>
    Array.from({ length: 4 }, (_, sample) => ({
      variant,
      identity: `resident-${variant}-${sample}`
    }))
  ),
  { variant: 0, identity: 'skills-inventory' }
]

function span(part: MovingPart, axis: 'x' | 'y' | 'z') {
  const size = { x: part.width, y: part.height, z: part.depth }[axis]
  return [part[axis] - size / 2, part[axis] + size / 2]
}

it('gives every walker a night lantern clear of their hems and props', () => {
  for (const { variant, identity } of examples) {
    const parts = personParts(variant, identity)
    const gear = parts.filter((part) => part.night)
    expect(gear.length, identity).toBeGreaterThan(0)
    // Lanterns swing with a free hand, or hang still from the belt when both are busy.
    const held = gear[0]?.motion === 'arm'
    expect(gear.every((part) => (part.motion === 'arm') === held)).toBe(true)
    const lantern = gear.find((part) => part.shape === 'light')
    expect(lantern).toBeDefined()
    if (!lantern) continue
    const [left, right] = span(lantern, 'x')
    const [bottom, top] = span(lantern, 'y')
    const [back, front] = span(lantern, 'z')
    for (const part of parts) {
      if (part.night || part.motion === 'arm') continue
      const [l, r] = span(part, 'x')
      const [b, t] = span(part, 'y')
      const [k, f] = span(part, 'z')
      const overlaps = l < right && r > left && b < top && t > bottom && k < front && f > back
      expect(overlaps, `${identity} ${part.shape}`).toBe(false)
    }
    // Hand-held props stay on the other hand, or swing inside a belt lantern.
    const side = Math.sign(lantern.x)
    const props = parts.filter(
      (part) =>
        !part.night &&
        part.motion === 'arm' &&
        Math.sign(part.x) === side &&
        Math.abs(part.x) > 11.4 &&
        part.y < 19
    )
    if (held) expect(props, identity).toEqual([])
    else
      for (const part of props)
        expect(Math.abs(part.x) + part.width / 2, identity).toBeLessThan(Math.abs(lantern.x))
  }
})

it('fits bicycles with a headlamp and a rear reflector', () => {
  const lights = cyclistParts(0, 'rider').filter((part) => part.shape === 'light')
  expect(lights.some((part) => part.z > 15)).toBe(true)
  expect(lights.some((part) => part.z < -10)).toBe(true)
})
