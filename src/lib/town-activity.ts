import type { TrafficBody } from './town-traffic'

type TownActivity = {
  kind: 'talk' | 'play' | 'stretch' | 'look'
  start: number
  end: number
  yaw: number
  partner?: ActiveResident
}

export type ActiveResident = TrafficBody & {
  phase: number
  activity?: TownActivity
  nextInteraction?: number
  nextSoloActivity?: number
}

// Activities use the scene clock; route clocks stop until residents set off again.
export function updateTownActivities(residents: ActiveResident[], seconds: number) {
  const present = new Set(residents)
  for (const resident of residents) {
    const activity = resident.activity
    if (
      activity &&
      (seconds >= activity.end ||
        (activity.partner &&
          (!present.has(activity.partner) || activity.partner.activity?.partner !== resident)))
    ) {
      resident.activity = undefined
      resident.nextInteraction = seconds + 12 + (resident.phase % 12)
      resident.nextSoloActivity = seconds + 15 + (resident.phase % 9)
    }
  }
  for (const resident of residents) {
    if (resident.kind !== 'walker' || resident.activity) continue
    if (seconds >= (resident.nextInteraction ?? 2)) {
      const partner = residents.find((other) => {
        if (
          other === resident ||
          other.kind !== 'walker' ||
          other.activity ||
          seconds < (other.nextInteraction ?? 2)
        )
          return false
        const distance = Math.hypot(other.pose.x - resident.pose.x, other.pose.z - resident.pose.z)
        return distance >= 23 * (resident.scale + other.scale) + 8 && distance < 125
      })
      if (partner) {
        const kind = Math.floor(resident.phase + partner.phase) % 3 === 0 ? 'play' : 'talk'
        const yaw = Math.atan2(partner.pose.x - resident.pose.x, partner.pose.z - resident.pose.z)
        const end = seconds + (kind === 'play' ? 9 : 11)
        resident.activity = { kind, start: seconds, end, yaw, partner }
        partner.activity = { kind, start: seconds, end, yaw: yaw + Math.PI, partner: resident }
        resident.pose.yaw = yaw
        partner.pose.yaw = yaw + Math.PI
        continue
      }
    }
    if (seconds < (resident.nextSoloActivity ?? 6 + (resident.phase % 10))) continue
    resident.activity = {
      kind: Math.floor(resident.phase) % 2 === 0 ? 'stretch' : 'look',
      start: seconds,
      end: seconds + 5 + (resident.phase % 3),
      yaw: resident.pose.yaw
    }
  }
}
