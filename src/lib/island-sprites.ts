import {
  blit,
  createBuffer,
  hex,
  outline,
  type PixelBuffer,
  type Rgba,
  setPixel
} from './island-art'

const white = hex('#ffffff')
const ink = hex('#474f39')
const creamShade = hex('#ddceb4')

function disc(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  paint: (x: number, y: number) => Rgba | null
) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      if (dx * dx + dy * dy > 1) continue
      const color = paint(x, y)
      if (color) setPixel(buffer, x, y, color)
    }
  }
}

function rect(buffer: PixelBuffer, x: number, y: number, w: number, h: number, color: Rgba) {
  for (let py = y; py < y + h; py++)
    for (let px = x; px < x + w; px++) setPixel(buffer, px, py, color)
}

function line(buffer: PixelBuffer, x0: number, y0: number, x1: number, y1: number, color: Rgba) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0
    setPixel(buffer, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), color)
  }
}

export function paintShadow() {
  const width = 12
  const height = 4
  const buffer = createBuffer(width, height)
  disc(buffer, width / 2, height / 2, width / 2, height / 2, (x, y) => {
    const distance = ((x - width / 2) / (width / 2)) ** 2 + ((y - height / 2) / (height / 2)) ** 2
    return [22, 35, 28, Math.round(88 * (1 - distance * 0.8))]
  })
  return buffer
}

// ---- Wildlife ---------------------------------------------------------------

// A gull seen from above in two wingbeats, side by side in one sheet.
export const GULL_FRAME = { width: 16, height: 11 } as const
export function paintGull() {
  const sheet = createBuffer(GULL_FRAME.width * 2, GULL_FRAME.height)
  const tip = hex('#7b88a7')
  ;[0, 1].forEach((f) => {
    const frame = createBuffer(GULL_FRAME.width, GULL_FRAME.height)
    const wing = f === 0 ? 2 : 8
    line(frame, 7, 5, 2, wing, white)
    line(frame, 8, 5, 13, wing, white)
    line(frame, 7, 6, 3, wing + 1, creamShade)
    line(frame, 8, 6, 12, wing + 1, creamShade)
    setPixel(frame, 1, wing, tip)
    setPixel(frame, 14, wing, tip)
    rect(frame, 6, 4, 4, 3, white)
    rect(frame, 9, 4, 2, 2, white)
    setPixel(frame, 11, 5, hex('#ffb13d'))
    outline(frame, ink)
    blit(sheet, frame, f * GULL_FRAME.width, 0)
  })
  return sheet
}

// Shapes under the water, tinted and faded by their material.
export function paintFishSchool() {
  const buffer = createBuffer(22, 14)
  for (const [x, y] of [
    [2, 3],
    [9, 1],
    [14, 5],
    [5, 8],
    [12, 10],
    [17, 9]
  ]) {
    rect(buffer, x + 1, y, 3, 1, white)
    setPixel(buffer, x + 2, y + 1, white)
    setPixel(buffer, x, y - 1, white)
    setPixel(buffer, x, y + 1, white)
  }
  return buffer
}

export function paintTurtle() {
  const buffer = createBuffer(16, 12)
  const shell = [hex('#6fe76d'), hex('#4ebe5d'), hex('#2f993d')]
  for (const [x, y] of [
    [3, 1],
    [10, 1],
    [3, 9],
    [10, 9]
  ])
    rect(buffer, x, y, 3, 2, shell[1])
  rect(buffer, 12, 5, 3, 2, shell[0])
  disc(buffer, 7, 6, 5, 4, (x, y) => ((x + y) % 3 === 0 ? shell[2] : y < 5 ? shell[0] : shell[1]))
  return buffer
}
