type Point = { x: number; z: number }

export type TrafficRoute = {
  start: Point
  end: Point
  lane: number
  progress: number
  speed: number
}

export type TrafficBody = {
  kind: 'car' | 'bicycle' | 'walker'
  scale: number
  pose: { x: number; z: number; yaw: number }
  avoidance?: Point
  previousPose?: { x: number; z: number; yaw: number }
}

// Overlapping circles cover the body, including handlebars, bumpers and swinging arms.
function footprint(body: TrafficBody) {
  const radius = (body.kind === 'car' ? 28 : body.kind === 'bicycle' ? 21 : 23) * body.scale
  const length = (body.kind === 'car' ? 16 : body.kind === 'bicycle' ? 15 : 0) * body.scale
  return (length ? [-length, 0, length] : [0]).map((along) => ({
    x: body.pose.x + Math.sin(body.pose.yaw) * along,
    z: body.pose.z + Math.cos(body.pose.yaw) * along,
    radius
  }))
}

// Call after setting nominal route poses. Retain the detour between frames, then
// gently return to the route once there is room. Fixed residents still block traffic.
export function avoidTraffic<T extends TrafficBody>(
  bodies: T[],
  delta: number,
  canMove: (body: T) => boolean = () => true,
  canStand: (point: Point, body: T) => boolean = () => true
) {
  const placed = new Set(bodies.filter((body) => body.avoidance))
  const nominal = new Map(bodies.map((body) => [body, body.pose]))
  for (const body of bodies) {
    if (!canMove(body)) continue
    const distance = Math.hypot(body.avoidance?.x ?? 0, body.avoidance?.z ?? 0)
    const decay = 1 - Math.min(1 - Math.exp(-delta * 2), (delta * 24) / (distance || 1))
    body.avoidance = {
      x: (body.avoidance?.x ?? 0) * decay,
      z: (body.avoidance?.z ?? 0) * decay
    }
    body.pose = {
      ...body.pose,
      x: body.pose.x + body.avoidance.x,
      z: body.pose.z + body.avoidance.z
    }
  }

  function sidestep(body: T, others: T[], turn = 0, limit = true) {
    if (!canMove(body)) return true
    const right = { x: Math.cos(body.pose.yaw + turn), z: -Math.sin(body.pose.yaw + turn) }
    const intervals: { low: number; high: number }[] = []
    const neighbours = others.flatMap(footprint)
    for (const a of footprint(body)) {
      for (const b of neighbours) {
        const dx = a.x - b.x
        const dz = a.z - b.z
        const across = dx * right.x + dz * right.z
        const along = dx * -right.z + dz * right.x
        const radius = a.radius + b.radius + 4
        // Start yielding before contact. This envelope contains the collision circle
        // and grows smoothly from zero instead of snapping sideways at its tangent.
        const reach = turn ? radius : radius * 1.6
        if (Math.abs(along) >= reach) continue
        const width = turn
          ? Math.sqrt(radius * radius - along * along)
          : radius * Math.cos(((along / reach) * Math.PI) / 2)
        intervals.push({ low: -across - width, high: -across + width })
      }
    }
    let low = 0
    let high = 0
    // Find the edges of the union containing zero, including adjoining circles.
    for (let pass = 0; pass < intervals.length; pass++) {
      for (const interval of intervals) {
        if (interval.low < high && interval.high > low) {
          low = Math.min(low, interval.low)
          high = Math.max(high, interval.high)
        }
      }
    }
    if (high - low < 0.001) return true
    const shifts = Math.abs(low) < high ? [low, high] : [high, low]
    if (Math.abs(shifts[0]) < 0.001) return true
    for (const shift of shifts) {
      // In a crowded lane, yield lengthwise instead of jumping across the crowd.
      if (limit && placed.has(body) && delta > 0 && Math.abs(shift) > delta * 120) continue
      const offset = { x: right.x * shift, z: right.z * shift }
      // Check the whole sidestep so a narrow obstacle cannot be crossed.
      const steps = Math.max(1, Math.ceil(Math.abs(shift) / 4))
      let clear = true
      // Existing routes can graze a prop's padded footprint. Allow leaving that
      // footprint, while still rejecting entry into another obstacle on the way.
      let outside = canStand(body.pose, body)
      for (let step = 1; step <= steps; step++) {
        const allowed = canStand(
          {
            x: body.pose.x + (offset.x * step) / steps,
            z: body.pose.z + (offset.z * step) / steps
          },
          body
        )
        if (!allowed && (outside || step === steps)) {
          clear = false
          break
        }
        outside ||= allowed
      }
      if (!clear) continue
      body.pose = { ...body.pose, x: body.pose.x + offset.x, z: body.pose.z + offset.z }
      body.avoidance = {
        x: (body.avoidance?.x ?? 0) + offset.x,
        z: (body.avoidance?.z ?? 0) + offset.z
      }
      return true
    }
    return false
  }

  const priority = { car: 0, bicycle: 1, walker: 2 }
  const ordered = [...bodies].sort(
    (a, b) => Number(canMove(a)) - Number(canMove(b)) || priority[a.kind] - priority[b.kind]
  )
  // Solve against all earlier residents together, so a sidestep cannot hit a third.
  for (let i = 0; i < ordered.length; i++) {
    const body = ordered[i]
    // Reserve the previous positions of residents yet to move. If there is no
    // safe detour this frame, they can wait there instead of jumping or overlapping.
    const others = [
      ...ordered.slice(0, i),
      ...ordered
        .slice(i + 1)
        .flatMap((other) => (other.previousPose ? [{ ...other, pose: other.previousPose }] : []))
    ]
    if (sidestep(body, others)) continue
    if ([Math.PI / 4, -Math.PI / 4, Math.PI / 2].some((turn) => sidestep(body, others, turn)))
      continue
    const base = nominal.get(body)
    if (body.previousPose && base) {
      body.pose = body.previousPose
      body.avoidance = { x: body.pose.x - base.x, z: body.pose.z - base.z }
    } else if (!sidestep(body, others, 0, false)) sidestep(body, others, Math.PI / 2, false)
  }
  for (const body of bodies) body.previousPose = { ...body.pose }
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
