export const LIGHTS_OUT_SIZE = 5
export const LIGHTS_OUT_CELL_COUNT = LIGHTS_OUT_SIZE * LIGHTS_OUT_SIZE

export type LightsOutBoard = boolean[]

export function getAffectedCells(index: number): number[] {
  const row = Math.floor(index / LIGHTS_OUT_SIZE)
  const column = index % LIGHTS_OUT_SIZE
  const cells = [index]

  if (row > 0) cells.push(index - LIGHTS_OUT_SIZE)
  if (row < LIGHTS_OUT_SIZE - 1) cells.push(index + LIGHTS_OUT_SIZE)
  if (column > 0) cells.push(index - 1)
  if (column < LIGHTS_OUT_SIZE - 1) cells.push(index + 1)

  return cells
}

export function pressCell(board: LightsOutBoard, index: number): LightsOutBoard {
  const nextBoard = [...board]
  for (const affectedIndex of getAffectedCells(index)) {
    nextBoard[affectedIndex] = !nextBoard[affectedIndex]
  }
  return nextBoard
}

export function createBoardFromPresses(presses: readonly number[]): LightsOutBoard {
  return presses.reduce<LightsOutBoard>(
    (board, index) => pressCell(board, index),
    Array.from({ length: LIGHTS_OUT_CELL_COUNT }, () => false)
  )
}

export function createSolvableBoard(random: () => number = Math.random): LightsOutBoard {
  const presses = Array.from({ length: LIGHTS_OUT_CELL_COUNT }, (_, index) => index).filter(
    () => random() < 0.42
  )

  if (presses.length === 0) {
    presses.push(Math.floor(random() * LIGHTS_OUT_CELL_COUNT))
  }

  const board = createBoardFromPresses(presses)
  return isBoardCleared(board)
    ? pressCell(board, Math.floor(random() * LIGHTS_OUT_CELL_COUNT))
    : board
}

export function isBoardCleared(board: LightsOutBoard): boolean {
  return board.every((cell) => !cell)
}
