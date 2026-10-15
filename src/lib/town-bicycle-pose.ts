export type CyclingMotion = 'thigh' | 'shin' | 'shoe' | 'crank' | 'pedal'
type Joint = { y: number; z: number }

export const bicycleCrank = { y: 13, z: 0, radius: 6 }
export const bicycleGrip = { y: 35, z: 18 }

// Local Y is the limb's long axis; overlap rounded ends at the joints.
export function bicycleSegment(from: Joint, to: Joint, overlap = 2) {
  return {
    y: (from.y + to.y) / 2,
    z: (from.z + to.z) / 2,
    height: Math.hypot(to.y - from.y, to.z - from.z) + overlap,
    pitch: Math.atan2(to.z - from.z, to.y - from.y)
  }
}

export function bicyclePose(motion: CyclingMotion, side: number, cycle: number) {
  // Opposing cranks share a phase with the shoes and both leg segments.
  const pedal = {
    y: bicycleCrank.y + Math.cos(cycle) * side * bicycleCrank.radius,
    z: bicycleCrank.z + Math.sin(cycle) * side * bicycleCrank.radius
  }
  if (motion === 'pedal') return { ...pedal, height: 2, pitch: 0 }
  if (motion === 'crank') return bicycleSegment(bicycleCrank, pedal, 0)
  if (motion === 'shoe') return { y: pedal.y + 4, z: pedal.z - 2, height: 6, pitch: 0 }

  const hip = { y: 35, z: -7 }
  const ankle = { y: pedal.y + 5, z: pedal.z - 4 }
  const thighLength = 16
  const shinLength = 17
  const dy = ankle.y - hip.y
  const dz = ankle.z - hip.z
  const distance = Math.hypot(dy, dz)
  const along = (thighLength ** 2 - shinLength ** 2 + distance ** 2) / (2 * distance)
  const forward = Math.sqrt(Math.max(0, thighLength ** 2 - along ** 2))
  const knee = {
    y: hip.y + (dy * along + dz * forward) / distance,
    z: hip.z + (dz * along - dy * forward) / distance
  }
  return motion === 'thigh' ? bicycleSegment(knee, hip) : bicycleSegment(ankle, knee)
}
