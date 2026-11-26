// A shade is open at both ends. Each ring lists its height and circumradius.
import type { Vec3 } from './island-sdf'

export type GlassShade = {
  x: number
  y: number
  rings: [height: number, radius: number][]
  sides: number
  tint: Vec3
  opacity: number
}

function shadeRing(shade: GlassShade, [z, r]: [number, number]): Vec3[] {
  return Array.from({ length: shade.sides }, (_, i) => {
    const angle = ((i + 0.25) * 2 * Math.PI) / shade.sides
    return [shade.x + r * Math.cos(angle), shade.y + r * Math.sin(angle), z]
  })
}

function between(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

// Both cameras and the palette use the same cut faces and reflection colors.
export function glassFacets(shade: GlassShade) {
  const rings = shade.rings.map((ring) => shadeRing(shade, ring))
  const faces: { corners: Vec3[]; rgb: number[]; opacity: number }[] = []
  for (let j = 1; j < rings.length; j++) {
    const lower = rings[j - 1],
      upper = rings[j]
    for (let i = 0; i < shade.sides; i++) {
      const next = (i + 1) % shade.sides
      const angle = ((i + 0.75) * 2 * Math.PI) / shade.sides
      const sky = Math.max(0, Math.cos(angle - 1.9 + 0.6 * (j - 1))) ** 5
      const glint = 0.06 + sky * 0.65
      const [a, b, c, d] = [lower[i], lower[next], upper[next], upper[i]]
      faces.push({
        corners: [a, b, c, d],
        rgb: shade.tint.map((c) => c + (1 - c) * glint),
        opacity: shade.opacity + 0.22 * sky
      })
      // The edge of cut glass picks up a narrow reflection. A blown cylinder is seamless.
      if (shade.rings.length > 2) {
        const bevel = shade.tint.map((channel) => 0.62 + channel * 0.38)
        faces.push({
          corners: [a, between(a, b, 0.085), between(d, c, 0.085), d],
          rgb: bevel,
          opacity: 0.38 + sky * 0.42
        })
        if (j === 1)
          faces.push({
            corners: [a, b, between(b, c, 0.09), between(a, d, 0.09)],
            rgb: bevel,
            opacity: 0.65
          })
      }
    }
  }
  return faces
}
