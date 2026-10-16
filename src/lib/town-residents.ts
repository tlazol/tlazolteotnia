import type { Box3 } from 'three'
import { hashSlug } from './scene-math'
import { type ActiveResident, updateTownActivities } from './town-activity'
import { nearestTownRoad, onettRoads } from './town-layout'
import type { createTownNavigation, TownPoint } from './town-navigation'
import { townPersonStyle } from './town-person'
import { nearestResidentRoute, type TownArticle } from './town-posts'
import { avoidTraffic, type TrafficRoute, trafficPose } from './town-traffic'

export type Resident = ActiveResident & {
  variant: number
  bounds?: Box3
  slug?: string
  time?: number
  returning?: { path: TownPoint[]; route: TrafficRoute }
  route: TrafficRoute
  phase: number
  blinkPhase: number
  placed?: boolean
}
function personScale(variant: number) {
  return townPersonStyle(variant).scale
}

type TownNavigation = ReturnType<typeof createTownNavigation>
export function createTownResidents(articles?: TownArticle[]) {
  const residents: Resident[] = []
  const articleResidents = new Map<string, Resident>()
  let elapsed = 0
  let lastTime: number | undefined
  let lastMotion = false
  let selectedSlug: string | null = null
  let followedSlug: string | null = articles?.[0]?.slug ?? null
  let focusedSlug: string | null = null
  let dragged: { resident: Resident; pose: Resident['pose'] } | null = null
  let visibleSlugs = articles ? new Set(articles.map((article) => article.slug)) : null
  for (const [roadIndex, road] of onettRoads.entries()) {
    if (road.trail) continue
    for (let segment = 1; segment < road.points.length; segment++) {
      const a = road.points[segment - 1]
      const b = road.points[segment]
      const heading = Math.atan2(b.x - a.x, b.z - a.z)
      const placements = [
        { t: 0.24, lane: -19, kind: 'car' },
        { t: 0.68, lane: 29, kind: 'bicycle' },
        { t: 0.16, lane: 48, kind: 'walker' },
        { t: 0.47, lane: -48, kind: 'walker' },
        { t: 0.79, lane: 48, kind: 'walker' }
      ] as const
      for (const [index, placement] of placements.entries()) {
        if (articles && placement.kind !== 'car') continue
        // The short hospital approach only has room for a pedestrian.
        if (road.width < 78 && index !== 2) continue
        const lane = road.width < 78 ? road.width / 2 + 9 : placement.lane
        const point = {
          x: a.x + (b.x - a.x) * placement.t + Math.cos(heading) * lane,
          z: a.z + (b.z - a.z) * placement.t - Math.sin(heading) * lane
        }
        // Leave intersections clear, including sidewalks crossing another street.
        if (
          nearestTownRoad(
            point,
            onettRoads.filter((other) => other !== road && !other.trail)
          ).distance < 45
        )
          continue
        const variant = roadIndex + segment + index
        const route: TrafficRoute = {
          start: a,
          end: b,
          lane,
          progress: placement.t,
          speed: placement.kind === 'car' ? 54 : placement.kind === 'bicycle' ? 30 : 12
        }
        const key = `${roadIndex}:${segment}:${index}`
        const resident: Resident = {
          variant,
          route,
          kind: placement.kind,
          scale: placement.kind === 'car' ? 1 : personScale(variant),
          phase: variant * 1.7,
          blinkPhase: (hashSlug(key) / 0xffffffff) * 10,
          time: placement.kind === 'walker' ? elapsed : undefined,
          pose: trafficPose(route, elapsed)
        }
        residents.push(resident)
      }
    }
  }
  for (const article of articles ?? []) {
    const resident: Resident = {
      variant: article.variant,
      slug: article.slug,
      time: 0,
      route: article.route,
      kind: article.kind,
      scale: personScale(article.variant),
      phase: article.variant * 1.7,
      blinkPhase: (hashSlug(article.slug) / 0xffffffff) * 10,
      pose: trafficPose(article.route, 0)
    }
    articleResidents.set(article.slug, resident)
    residents.push(resident)
  }

  return {
    residents,
    articleResidents,
    get elapsed() {
      return elapsed
    },
    get selectedSlug() {
      return selectedSlug
    },
    get followedSlug() {
      return followedSlug
    },
    get dragged() {
      return dragged?.resident ?? null
    },
    get visibleSlugs() {
      return visibleSlugs
    },
    pause() {
      lastTime = undefined
    },
    advance(now: number, motion: boolean) {
      const previousElapsed = elapsed
      const motionChanged = motion !== lastMotion
      if (motion && lastMotion && lastTime !== undefined) {
        elapsed += Math.max(0, Math.min((now - lastTime) / 1000, 0.1))
      }
      const delta = elapsed - previousElapsed
      for (const resident of residents) {
        if (!resident.slug && resident.time !== undefined && !resident.activity)
          resident.time += delta
      }
      for (const [slug, resident] of articleResidents) {
        if (
          resident !== dragged?.resident &&
          (resident.slug === selectedSlug || resident.slug !== focusedSlug) &&
          visibleSlugs?.has(slug)
        ) {
          if (!resident.activity) resident.time = (resident.time ?? 0) + delta
          if (resident.returning) {
            if (delta <= 0) continue
            resident.pose = {
              ...resident.pose,
              x: resident.pose.x - (resident.avoidance?.x ?? 0),
              z: resident.pose.z - (resident.avoidance?.z ?? 0)
            }
            let remaining = delta * resident.route.speed
            while (resident.returning.path.length) {
              const next = resident.returning.path[0]
              const dx = next.x - resident.pose.x
              const dz = next.z - resident.pose.z
              const distance = Math.hypot(dx, dz)
              if (distance > remaining) {
                if (remaining > 0)
                  resident.pose = {
                    x: resident.pose.x + (dx * remaining) / distance,
                    z: resident.pose.z + (dz * remaining) / distance,
                    yaw: Math.atan2(dx, dz)
                  }
                break
              }
              resident.pose = { ...next, yaw: Math.atan2(dx, dz) }
              remaining -= distance
              resident.returning.path.shift()
            }
            if (!resident.returning.path.length) {
              resident.route = resident.returning.route
              resident.time = remaining / resident.route.speed
              resident.returning = undefined
            }
          }
        }
      }
      lastTime = now
      lastMotion = motion
      return { delta, changed: motionChanged || elapsed !== previousElapsed }
    },
    updatePoses(delta: number, navigation: TownNavigation) {
      const active = residents.filter(
        (resident) =>
          resident !== dragged?.resident && (!resident.slug || visibleSlugs?.has(resident.slug))
      )
      const available = active.filter(
        (resident) =>
          !resident.returning &&
          (!resident.slug || resident.slug === selectedSlug || resident.slug !== focusedSlug)
      )
      for (const resident of residents) {
        if (!available.includes(resident)) resident.activity = undefined
      }
      // End activities before deciding which route clocks and poses can move.
      if (delta > 0) updateTownActivities(available, elapsed)
      const moving = new Set(
        active.filter(
          (resident) =>
            !resident.activity &&
            (!resident.placed ||
              (delta > 0 &&
                (!resident.slug ||
                  resident.slug === selectedSlug ||
                  resident.slug !== focusedSlug)))
        )
      )
      for (const resident of moving) {
        if (!resident.returning)
          resident.pose = trafficPose(resident.route, resident.time ?? elapsed)
      }
      avoidTraffic(
        active,
        delta,
        (body) => moving.has(body),
        (point) => navigation.canStand(point)
      )
      for (const resident of active) resident.placed = true
    },
    beginResidentDrag(slug: string) {
      const resident = articleResidents.get(slug)
      if (!resident) return
      resident.activity = undefined
      followedSlug = null
      dragged = { resident, pose: { ...resident.pose } }
    },
    moveResidentDrag(delta: TownPoint) {
      if (!dragged) return
      dragged.resident.pose = {
        ...dragged.resident.pose,
        x: dragged.resident.pose.x + delta.x,
        z: dragged.resident.pose.z + delta.z
      }
    },
    endResidentDrag(navigation: TownNavigation, cancel = false) {
      if (!dragged) return
      const { resident, pose } = dragged
      if (cancel) {
        resident.pose = pose
      } else {
        const route = nearestResidentRoute(resident.pose, resident.route, navigation.canStand)
        const path = navigation.findPath(resident.pose, trafficPose(route, 0))
        if (path) {
          resident.returning = { path, route }
          resident.avoidance = undefined
          resident.previousPose = undefined
        } else resident.pose = pose
      }
      dragged = null
    },
    select(slug: string | null) {
      selectedSlug = slug
    },
    follow(slug: string | null) {
      followedSlug = slug && visibleSlugs?.has(slug) ? slug : null
    },
    focus(slug: string | null) {
      focusedSlug = slug
    },
    filter(slugs: string[]) {
      visibleSlugs = new Set(slugs)
      if (followedSlug && !visibleSlugs.has(followedSlug)) followedSlug = null
    },
    residentPosition(slug: string) {
      return articleResidents.get(slug)?.pose
    }
  }
}
