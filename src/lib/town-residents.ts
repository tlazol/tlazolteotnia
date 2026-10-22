import type { Box3 } from 'three'
import { hashSlug } from './scene-math'
import { type ActiveResident, updateTownActivities } from './town-activity'
import type { createTownNavigation, TownPoint } from './town-navigation'
import { townPersonStyle } from './town-person'
import { nearestResidentRoute, type TownArticle } from './town-posts'
import { avoidTraffic, type TrafficRoute, trafficPose } from './town-traffic'
import { carLane, townRoads, townWaterSurface } from './town-world'

// Swimmers paddle ashore at about a walker's pace.
const swimSpeed = 12

export type Resident = ActiveResident & {
  variant: number
  bounds?: Box3
  slug?: string
  time?: number
  // Swim legs carry the water surface height; a missing route means stopping ashore.
  returning?: { path: (TownPoint & { swim?: number })[]; route?: TrafficRoute }
  // The water surface below a swimmer, or below a resident dragged over water.
  water?: number
  swimming?: boolean
  route: TrafficRoute
  phase: number
  blinkPhase: number
  placed?: boolean
  stationary?: boolean
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
  let dragged: {
    resident: Resident
    pose: Resident['pose']
    water?: number
    swimming?: boolean
  } | null = null
  let visibleSlugs = articles ? new Set(articles.map((article) => article.slug)) : null
  // Cars loop along individual block faces, keeping the island's traffic gentle.
  for (const [roadIndex, road] of townRoads.entries()) {
    if (roadIndex % 2) continue
    const key = `car:${roadIndex}`
    const seed = hashSlug(key)
    const variant = seed % 97
    const route: TrafficRoute = {
      start: road.start,
      end: road.end,
      lane: (seed & 1 ? 1 : -1) * carLane,
      progress: 0.15 + ((seed >>> 8) % 70) / 100,
      speed: 58 + (seed % 12)
    }
    residents.push({
      variant,
      route,
      kind: 'car',
      scale: 1,
      phase: variant * 1.7,
      blinkPhase: (seed / 0xffffffff) * 10,
      pose: trafficPose(route, elapsed)
    })
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
          !resident.stationary &&
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
            let remaining = delta
            while (resident.returning.path.length) {
              const next = resident.returning.path[0]
              const speed = next.swim === undefined ? resident.route.speed : swimSpeed
              resident.swimming = next.swim !== undefined
              resident.water = next.swim
              const dx = next.x - resident.pose.x
              const dz = next.z - resident.pose.z
              const distance = Math.hypot(dx, dz)
              if (distance > remaining * speed) {
                if (remaining > 0)
                  resident.pose = {
                    x: resident.pose.x + (dx * remaining * speed) / distance,
                    z: resident.pose.z + (dz * remaining * speed) / distance,
                    yaw: Math.atan2(dx, dz)
                  }
                remaining = 0
                break
              }
              resident.pose = { x: next.x, z: next.z, yaw: Math.atan2(dx, dz) }
              remaining -= distance / speed
              resident.returning.path.shift()
            }
            if (!resident.returning.path.length) {
              const { route } = resident.returning
              if (route) {
                resident.route = route
                resident.time = remaining
              } else {
                resident.stationary = true
              }
              resident.returning = undefined
              resident.swimming = false
              resident.water = undefined
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
            !resident.stationary &&
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
      dragged = {
        resident,
        pose: { ...resident.pose },
        water: resident.water,
        swimming: resident.swimming
      }
      resident.swimming = false
    },
    moveResidentDrag(delta: TownPoint) {
      if (!dragged) return
      dragged.resident.pose = {
        ...dragged.resident.pose,
        x: dragged.resident.pose.x + delta.x,
        z: dragged.resident.pose.z + delta.z
      }
      dragged.resident.water = townWaterSurface(dragged.resident.pose) ?? undefined
    },
    endResidentDrag(navigation: TownNavigation, cancel = false) {
      if (!dragged) return
      const { resident, pose } = dragged
      const water = navigation.canStand(resident.pose) ? null : townWaterSurface(resident.pose)
      // Residents dropped in water swim to the nearest shore before walking back.
      const shore = water === null ? null : navigation.findShore(resident.pose)
      if (cancel || (!navigation.canStand(resident.pose) && !shore)) {
        resident.pose = pose
        resident.water = dragged.water
        resident.swimming = dragged.swimming
      } else {
        const start = shore ?? resident.pose
        const route = nearestResidentRoute(start, resident.route, navigation.canStand)
        const path = navigation.findPath(start, trafficPose(route, 0))
        const swim = shore && water !== null ? [{ ...shore, swim: water }] : []
        resident.returning =
          path || swim.length
            ? { path: [...swim, ...(path ?? [])], route: path ? route : undefined }
            : undefined
        resident.stationary = !path && !swim.length
        resident.swimming = !!swim.length
        resident.water = water ?? undefined
        resident.avoidance = undefined
        resident.previousPose = undefined
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
