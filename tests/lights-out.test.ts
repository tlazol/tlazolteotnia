import { describe, expect, it } from 'vitest'
import {
  createBoardFromPresses,
  createSolvableBoard,
  getAffectedCells,
  isBoardCleared,
  LIGHTS_OUT_CELL_COUNT,
  LIGHTS_OUT_SIZE,
  pressCell
} from '#/lib/lights-out'

describe('Lights Out', () => {
  it('targets only the cell and its orthogonal neighbors', () => {
    expect(getAffectedCells(12).sort((a, b) => a - b)).toEqual([7, 11, 12, 13, 17])
    expect(getAffectedCells(0).sort((a, b) => a - b)).toEqual([0, 1, 5])
    expect(getAffectedCells(2).sort((a, b) => a - b)).toEqual([1, 2, 3, 7])
    expect(getAffectedCells(4).sort((a, b) => a - b)).toEqual([3, 4, 9])
  })

  it('returns to the same board after pressing a cell twice', () => {
    const board = createBoardFromPresses([0, 6, 12, 18, 24])
    expect(pressCell(pressCell(board, 7), 7)).toEqual(board)
  })

  it('builds a solvable board by applying reversible presses', () => {
    const presses = [0, 4, 6, 12, 18, 20, 24]
    const board = createBoardFromPresses(presses)
    const solved = presses.reduce((current, index) => pressCell(current, index), board)

    expect(board).toHaveLength(LIGHTS_OUT_CELL_COUNT)
    expect(isBoardCleared(board)).toBe(false)
    expect(isBoardCleared(solved)).toBe(true)
  })

  it('never generates an already-cleared board', () => {
    expect(isBoardCleared(createSolvableBoard(() => 0.99))).toBe(false)
    expect(isBoardCleared(createSolvableBoard(() => 0))).toBe(false)
  })

  it('generates boards with at least one solution', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      expect(hasSolution(createSolvableBoard(createSeededRandom(seed)))).toBe(true)
    }
  })
})

function hasSolution(board: boolean[]): boolean {
  for (let firstRow = 0; firstRow < 2 ** LIGHTS_OUT_SIZE; firstRow += 1) {
    let candidate = [...board]

    for (let column = 0; column < LIGHTS_OUT_SIZE; column += 1) {
      if (firstRow & (1 << column)) candidate = pressCell(candidate, column)
    }

    for (let row = 1; row < LIGHTS_OUT_SIZE; row += 1) {
      for (let column = 0; column < LIGHTS_OUT_SIZE; column += 1) {
        const indexAbove = (row - 1) * LIGHTS_OUT_SIZE + column
        if (candidate[indexAbove]) {
          candidate = pressCell(candidate, row * LIGHTS_OUT_SIZE + column)
        }
      }
    }

    if (isBoardCleared(candidate)) return true
  }

  return false
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}
