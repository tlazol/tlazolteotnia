// Local civil time deliberately defines the town's day, without location access.
const stops = [
  { hour: 0, sun: 0, ambient: 0.45, warmth: 0, night: 1, altitude: 0.18, azimuth: -1.3 },
  { hour: 5, sun: 0, ambient: 0.45, warmth: 0, night: 1, altitude: 0.18, azimuth: -1.3 },
  // Morning clears quickly into cool daylight; the golden light belongs to dusk.
  { hour: 6, sun: 1.9, ambient: 1.15, warmth: 0.15, night: 0.08, altitude: 0.25, azimuth: -1.1 },
  { hour: 9, sun: 2.6, ambient: 1.35, warmth: 0, night: 0, altitude: 0.8, azimuth: -0.55 },
  { hour: 12, sun: 2.8, ambient: 1.4, warmth: 0, night: 0, altitude: 1.05, azimuth: 0 },
  { hour: 15, sun: 2.6, ambient: 1.3, warmth: 0.08, night: 0, altitude: 0.75, azimuth: 0.65 },
  { hour: 17, sun: 2, ambient: 0.8, warmth: 1, night: 0.2, altitude: 0.25, azimuth: 1.1 },
  { hour: 18, sun: 0.7, ambient: 0.6, warmth: 0.85, night: 0.65, altitude: 0.18, azimuth: 1.25 },
  { hour: 19, sun: 0, ambient: 0.45, warmth: 0, night: 1, altitude: 0.18, azimuth: 1.3 },
  { hour: 24, sun: 0, ambient: 0.45, warmth: 0, night: 1, altitude: 0.18, azimuth: -1.3 }
]

export function townDaylight(date: Date) {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const index = stops.findIndex((stop) => stop.hour > hour)
  const start = stops[index - 1]
  const end = stops[index]
  const progress = (hour - start.hour) / (end.hour - start.hour)
  const blend = progress * progress * (3 - 2 * progress)
  const mix = (key: 'sun' | 'ambient' | 'warmth' | 'night' | 'altitude' | 'azimuth') =>
    start[key] + (end[key] - start[key]) * blend
  const altitude = mix('altitude')
  const azimuth = mix('azimuth')
  return {
    sun: mix('sun'),
    ambient: mix('ambient'),
    warmth: mix('warmth'),
    night: mix('night'),
    direction: {
      x: Math.sin(azimuth) * Math.cos(altitude),
      y: Math.sin(altitude),
      z: Math.cos(azimuth) * Math.cos(altitude)
    }
  }
}
