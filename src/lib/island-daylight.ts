// Local time controls the land tint, the lamps and the sunrise and sunset reflected on the sea.
export type Daylight = {
  tint: [number, number, number]
  glow: number
  sunrise: number
  afterglow: number
}

const keys: Array<{ hour: number } & Daylight> = [
  // Deep night keeps unlit ground dark so the tiles around each light stand out.
  { hour: 0, tint: [0.17, 0.2, 0.36], glow: 1, sunrise: 0, afterglow: 0 },
  { hour: 4, tint: [0.17, 0.2, 0.36], glow: 1, sunrise: 0, afterglow: 0 },
  { hour: 4.5, tint: [0.28, 0.3, 0.5], glow: 1, sunrise: 0, afterglow: 0 },
  { hour: 5, tint: [0.5, 0.48, 0.72], glow: 0.84, sunrise: 0.43, afterglow: 0 },
  { hour: 5.75, tint: [0.9, 0.69, 0.82], glow: 0.42, sunrise: 1, afterglow: 0 },
  { hour: 6.5, tint: [1, 0.9, 0.78], glow: 0, sunrise: 0.62, afterglow: 0 },
  { hour: 8, tint: [1, 0.96, 0.91], glow: 0, sunrise: 0, afterglow: 0 },
  { hour: 9.5, tint: [1, 1, 1], glow: 0, sunrise: 0, afterglow: 0 },
  { hour: 15.5, tint: [1, 1, 1], glow: 0, sunrise: 0, afterglow: 0 },
  { hour: 17.5, tint: [1, 0.86, 0.72], glow: 0.12, sunrise: 0, afterglow: 0.28 },
  { hour: 18.5, tint: [1, 0.65, 0.73], glow: 0.6, sunrise: 0, afterglow: 1 },
  { hour: 19.25, tint: [0.77, 0.56, 0.86], glow: 0.94, sunrise: 0, afterglow: 0.96 },
  { hour: 20.5, tint: [0.36, 0.34, 0.62], glow: 1, sunrise: 0, afterglow: 0.45 },
  { hour: 22, tint: [0.17, 0.2, 0.36], glow: 1, sunrise: 0, afterglow: 0 },
  { hour: 24, tint: [0.17, 0.2, 0.36], glow: 1, sunrise: 0, afterglow: 0 }
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
    glow: mix(a.glow, b.glow),
    sunrise: mix(a.sunrise, b.sunrise),
    afterglow: mix(a.afterglow, b.afterglow)
  }
}

export function daylightNow(date = new Date()) {
  return daylightAt(date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600)
}
