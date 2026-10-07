type Point = { x: number; z: number }

export type TrafficRoute = {
  start: Point
  end: Point
  lane: number
  progress: number
  speed: number
}

// A capsule-shaped circuit joins the two lanes with continuous, rounded turns.
// Inset the ends so the entire turn stays on the road surface.
export function trafficPose(route: TrafficRoute, seconds: number) {
  const dx = route.end.x - route.start.x
  const dz = route.end.z - route.start.z
  const length = Math.hypot(dx, dz)
  const inset = Math.min(80, length / 4)
  const straight = length - inset * 2
  const radius = Math.abs(route.lane)
  const turn = Math.PI * radius
  const circuit = 2 * (straight + turn)
  const initial =
    route.lane < 0 ? route.progress * straight : straight + turn + (1 - route.progress) * straight
  const distance = (initial + seconds * route.speed) % circuit
  let across: number
  let along: number
  let yaw: number
  if (distance < straight) {
    across = -radius
    along = distance
    yaw = 0
  } else if (distance < straight + turn) {
    const angle = (distance - straight) / radius
    across = -radius * Math.cos(angle)
    along = straight + radius * Math.sin(angle)
    yaw = angle
  } else if (distance < 2 * straight + turn) {
    across = radius
    along = 2 * straight + turn - distance
    yaw = Math.PI
  } else {
    const angle = (distance - 2 * straight - turn) / radius
    across = radius * Math.cos(angle)
    along = -radius * Math.sin(angle)
    yaw = Math.PI + angle
  }
  const heading = Math.atan2(dx, dz)
  return {
    x: route.start.x + Math.sin(heading) * (along + inset) + Math.cos(heading) * across,
    z: route.start.z + Math.cos(heading) * (along + inset) - Math.sin(heading) * across,
    yaw: heading + yaw
  }
}
