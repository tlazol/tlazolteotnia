// The island's light follows the visitor's clock: a color the whole scene is
// multiplied by, and how strongly torches glow, blended between the hours below.
export type Daylight = {
  tint: [number, number, number]
  glow: number
}

const keys: Array<{ hour: number } & Daylight> = [
  { hour: 0, tint: [0.38, 0.47, 0.82], glow: 1 }, // night
  { hour: 4.5, tint: [0.38, 0.47, 0.82], glow: 1 },
  { hour: 5.5, tint: [0.8, 0.68, 0.84], glow: 0.5 }, // dawn
  { hour: 6.5, tint: [1, 0.9, 0.78], glow: 0 }, // morning
  { hour: 9.5, tint: [1, 1, 1], glow: 0 }, // day
  { hour: 15.5, tint: [1, 1, 1], glow: 0 },
  { hour: 17, tint: [1, 0.87, 0.68], glow: 0 }, // evening
  { hour: 18.2, tint: [1, 0.7, 0.58], glow: 0.35 }, // sunset
  { hour: 19.2, tint: [0.66, 0.55, 0.84], glow: 0.8 }, // dusk
  { hour: 20.5, tint: [0.38, 0.47, 0.82], glow: 1 },
  { hour: 24, tint: [0.38, 0.47, 0.82], glow: 1 }
]

// `hour` is the local time of day in hours, e.g. 17.5 for half past five.
export function daylightAt(hour: number): Daylight {
  const h = ((hour % 24) + 24) % 24
  const next = keys.findIndex((key) => key.hour > h)
  const a = keys[next - 1]
  const b = keys[next]
  const t = (h - a.hour) / (b.hour - a.hour)
  const mix = (from: number, to: number) => from + (to - from) * t
  return {
    tint: [mix(a.tint[0], b.tint[0]), mix(a.tint[1], b.tint[1]), mix(a.tint[2], b.tint[2])],
    glow: mix(a.glow, b.glow)
  }
}

export function daylightNow(date = new Date()) {
  return daylightAt(date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600)
}
