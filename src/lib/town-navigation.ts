export type TownPoint = { x: number; z: number }
export type TownObstacle = { left: number; right: number; top: number; bottom: number }

// Use the scene's solid footprints for both dropping and the walk back to a road.
export function createTownNavigation(
  obstacles: TownObstacle[],
  containsGround: (point: TownPoint) => boolean
) {
  const cellSize = 24
  const bucketSize = 96
  const buckets = new Map<string, TownObstacle[]>()
  for (const obstacle of obstacles) {
    for (
      let x = Math.floor(obstacle.left / bucketSize);
      x <= Math.floor(obstacle.right / bucketSize);
      x++
    ) {
      for (
        let z = Math.floor(obstacle.top / bucketSize);
        z <= Math.floor(obstacle.bottom / bucketSize);
        z++
      ) {
        const key = `${x}:${z}`
        const items = buckets.get(key) ?? []
        items.push(obstacle)
        buckets.set(key, items)
      }
    }
  }
  function canStand(point: TownPoint) {
    if (!containsGround(point)) return false
    const items = buckets.get(
      `${Math.floor(point.x / bucketSize)}:${Math.floor(point.z / bucketSize)}`
    )
    return !items?.some(
      (box) =>
        point.x >= box.left && point.x <= box.right && point.z >= box.top && point.z <= box.bottom
    )
  }
  function clearSegment(a: TownPoint, b: TownPoint) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 6))
    for (let i = 0; i <= steps; i++) {
      if (!canStand({ x: a.x + ((b.x - a.x) * i) / steps, z: a.z + ((b.z - a.z) * i) / steps }))
        return false
    }
    return true
  }
  function findPath(from: TownPoint, to: TownPoint): TownPoint[] | null {
    if (!canStand(from) || !canStand(to)) return null
    if (clearSegment(from, to)) return [to]
    type Node = TownPoint & { key: string; cost: number; score: number; parent?: Node }
    const open: Node[] = []
    const costs = new Map<string, number>()
    function enqueue(x: number, z: number, cost: number, parent?: Node) {
      const key = `${x}:${z}`
      if (cost >= (costs.get(key) ?? Infinity)) return
      costs.set(key, cost)
      open.push({ x, z, key, cost, score: cost + Math.hypot(to.x - x, to.z - z), parent })
    }
    const startX = Math.round(from.x / cellSize) * cellSize
    const startZ = Math.round(from.z / cellSize) * cellSize
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const next = { x: startX + dx * cellSize, z: startZ + dz * cellSize }
        if (clearSegment(from, next))
          enqueue(next.x, next.z, Math.hypot(next.x - from.x, next.z - from.z))
      }
    }
    // Bound work for disconnected terrain, such as a fenced enclosure.
    for (let visited = 0; open.length && visited < 20000; visited++) {
      let best = 0
      for (let i = 1; i < open.length; i++) if (open[i].score < open[best].score) best = i
      const current = open.splice(best, 1)[0]
      if (current.cost !== costs.get(current.key)) continue
      if (
        Math.hypot(current.x - to.x, current.z - to.z) <= cellSize * 2 &&
        clearSegment(current, to)
      ) {
        const path: TownPoint[] = [to]
        let node: Node | undefined = current
        while (node) {
          path.unshift({ x: node.x, z: node.z })
          node = node.parent
        }
        // Remove grid corners wherever a straight, unobstructed walk is possible.
        const smooth: TownPoint[] = []
        let anchor = from
        for (let i = 0; i < path.length; ) {
          let end = path.length - 1
          while (end > i && !clearSegment(anchor, path[end])) end--
          smooth.push(path[end])
          anchor = path[end]
          i = end + 1
        }
        return smooth
      }
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dz) continue
          const next = { x: current.x + dx * cellSize, z: current.z + dz * cellSize }
          const cost = current.cost + Math.hypot(dx, dz) * cellSize
          if (cost >= (costs.get(`${next.x}:${next.z}`) ?? Infinity)) continue
          if (clearSegment(current, next)) enqueue(next.x, next.z, cost, current)
        }
      }
    }
    return null
  }
  return { canStand, findPath }
}
