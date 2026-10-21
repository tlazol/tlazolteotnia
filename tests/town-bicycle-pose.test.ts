import { expect, it } from 'vitest'
import { bicyclePose } from '../src/lib/town-bicycle-pose'

function endpoints(pose: ReturnType<typeof bicyclePose>, overlap = 2) {
  const half = (pose.height - overlap) / 2
  return [-1, 1].map((sign) => ({
    y: pose.y + sign * Math.cos(pose.pitch) * half,
    z: pose.z + sign * Math.sin(pose.pitch) * half
  }))
}

function samePoint(a: { y: number; z: number }, b: { y: number; z: number }) {
  expect(a.y).toBeCloseTo(b.y, 10)
  expect(a.z).toBeCloseTo(b.z, 10)
}

it('keeps legs connected and soles on opposing pedals throughout a revolution', () => {
  for (let step = 0; step <= 72; step++) {
    const cycle = (step / 72) * Math.PI * 2
    const left = bicyclePose('pedal', -1, cycle)
    const right = bicyclePose('pedal', 1, cycle)
    expect(left.y + right.y).toBeCloseTo(26)
    expect(left.z + right.z).toBeCloseTo(0)
    for (const side of [-1, 1]) {
      const pedal = bicyclePose('pedal', side, cycle)
      const shoe = bicyclePose('shoe', side, cycle)
      const thigh = bicyclePose('thigh', side, cycle)
      const shin = bicyclePose('shin', side, cycle)
      const [knee, hip] = endpoints(thigh)
      const [ankle, shinKnee] = endpoints(shin)
      samePoint(hip, { y: 35, z: -7 })
      samePoint(knee, shinKnee)
      samePoint(ankle, { y: shoe.y + 1, z: shoe.z - 2 })
      expect(thigh.height - 2).toBeCloseTo(12)
      expect(shin.height - 2).toBeCloseTo(12.5)
      expect(knee.z).toBeGreaterThan(ankle.z)
      expect(shoe.y - shoe.height / 2).toBeCloseTo(pedal.y + pedal.height / 2)
      expect(shoe.pitch).toBe(0)
      expect(pedal.pitch).toBe(0)
      const [axle, crankEnd] = endpoints(bicyclePose('crank', side, cycle), 0)
      samePoint(axle, { y: 13, z: 0 })
      samePoint(crankEnd, pedal)
      expect(pedal.y - pedal.height / 2).toBeGreaterThan(0)
    }
  }
})

it('moves pedals forward, down, back and up in the bicycle travel direction', () => {
  const poses = [0, 0.5, 1, 1.5].map((turn) => bicyclePose('pedal', 1, turn * Math.PI))
  for (const [index, point] of [
    { y: 19, z: 0 },
    { y: 13, z: 6 },
    { y: 7, z: 0 },
    { y: 13, z: -6 }
  ].entries())
    samePoint(poses[index], point)
})
