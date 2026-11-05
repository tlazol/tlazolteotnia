import { sandMargin, terrainGrid, terrainVertexHeight, waterDistance } from './town-world'

// Top-down maps over the terrain grid, sampled by the town material in world
// space. Texel centres sit on the terrain's vertices.
export const groundMapBounds = {
  x: terrainGrid.x - terrainGrid.step / 2,
  z: terrainGrid.z - terrainGrid.step / 2,
  width: (terrainGrid.columns + 1) * terrainGrid.step,
  depth: (terrainGrid.rows + 1) * terrainGrid.step
}

// Signed margins are stored around 0.5 so that linear filtering turns them into
// smooth curves; the shader thresholds them per pixel instead of per triangle.
export const shoreRange = 160
export const heightRange = { min: -64, max: 1216 }
const wetSandWidth = 70

function encode(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 255)
}

// R: sand margin, G: wet sand margin, B: ground height, A: unused.
export function shoreMap() {
  const width = terrainGrid.columns + 1
  const height = terrainGrid.rows + 1
  const data = new Uint8Array(width * height * 4)
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const x = terrainGrid.x + column * terrainGrid.step
      const z = terrainGrid.z + row * terrainGrid.step
      const ground = terrainVertexHeight(column, row)
      const offset = (row * width + column) * 4
      data[offset] = encode(0.5 + sandMargin(x, z, ground) / shoreRange)
      data[offset + 1] = encode(0.5 + (waterDistance(x, z) + wetSandWidth) / shoreRange)
      data[offset + 2] = encode((ground - heightRange.min) / (heightRange.max - heightRange.min))
      data[offset + 3] = 255
    }
  }
  return { data, width, height }
}

export type GroundFootprint = { left: number; right: number; top: number; bottom: number }

// Separable box blur, repeated to approximate a gaussian falloff.
function blur(values: Float32Array, width: number, height: number, radius: number) {
  const scratch = new Float32Array(values.length)
  const span = radius * 2 + 1
  for (let pass = 0; pass < 3; pass++) {
    for (let row = 0; row < height; row++) {
      let sum = 0
      const base = row * width
      for (let column = -radius; column <= radius; column++)
        sum += values[base + Math.max(0, Math.min(width - 1, column))]
      for (let column = 0; column < width; column++) {
        scratch[base + column] = sum / span
        sum +=
          values[base + Math.min(width - 1, column + radius + 1)] -
          values[base + Math.max(0, column - radius)]
      }
    }
    for (let column = 0; column < width; column++) {
      let sum = 0
      for (let row = -radius; row <= radius; row++)
        sum += scratch[Math.max(0, Math.min(height - 1, row)) * width + column]
      for (let row = 0; row < height; row++) {
        values[row * width + column] = sum / span
        sum +=
          scratch[Math.min(height - 1, row + radius + 1) * width + column] -
          scratch[Math.max(0, row - radius) * width + column]
      }
    }
  }
}

// Soft contact shadows around everything that stands on the ground. Buildings
// occlude fully; smaller props such as trees, lamps and parked cars less so.
export function contactMap(
  solids: { footprint: GroundFootprint; strength: number }[],
  width = 1024,
  height = Math.round((width * groundMapBounds.depth) / groundMapBounds.width)
) {
  const values = new Float32Array(width * height)
  const scaleX = width / groundMapBounds.width
  const scaleZ = height / groundMapBounds.depth
  for (const { footprint, strength } of solids) {
    const left = Math.max(0, Math.floor((footprint.left - groundMapBounds.x) * scaleX))
    const right = Math.min(width, Math.ceil((footprint.right - groundMapBounds.x) * scaleX))
    const top = Math.max(0, Math.floor((footprint.top - groundMapBounds.z) * scaleZ))
    const bottom = Math.min(height, Math.ceil((footprint.bottom - groundMapBounds.z) * scaleZ))
    for (let row = top; row < bottom; row++)
      for (let column = left; column < right; column++) {
        const index = row * width + column
        values[index] = Math.max(values[index], strength)
      }
  }
  blur(values, width, height, 2)
  const data = new Uint8Array(width * height)
  for (let index = 0; index < values.length; index++) data[index] = encode(values[index])
  return { data, width, height }
}
