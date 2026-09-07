import { describe, expect, it } from 'vitest'
import {
  createBoardFromPresses,
  createSolvableBoard,
  findShortestSolution,
  getAffectedCells,
  getCellCoordinates,
  getCellIndex,
  getNeighbor,
  isBoardCleared,
  LIGHTS_OUT_CELL_COUNT,
  LIGHTS_OUT_FACES,
  LIGHTS_OUT_FACE_SIZE,
  pressCell
} from '#/lib/lights-out'

describe('Lights Out cube', () => {
  it('maps every face cell to one unique index and back', () => {
    const indexes = LIGHTS_OUT_FACES.flatMap((face) =>
      Array.from({ length: LIGHTS_OUT_FACE_SIZE }, (_, row) =>
        Array.from({ length: LIGHTS_OUT_FACE_SIZE }, (_, column) => {
          const index = getCellIndex(face, row, column)
          expect(getCellCoordinates(index)).toEqual({ face, row, column })
          return index
        })
      ).flat()
    )

    expect(new Set(indexes).size).toBe(LIGHTS_OUT_CELL_COUNT)
    expect(indexes).toHaveLength(54)
  })

  it('targets the cell and four orthogonal neighbors on a face', () => {
    const center = getCellIndex('front', 1, 1)
    expect(getAffectedCells(center).sort((a, b) => a - b)).toEqual(
      [
        center,
        getCellIndex('front', 0, 1),
        getCellIndex('front', 1, 0),
        getCellIndex('front', 1, 2),
        getCellIndex('front', 2, 1)
      ].sort((a, b) => a - b)
    )
  })

  it('continues orthogonal neighbors across cube edges', () => {
    const topEdge = getCellIndex('front', 0, 1)
    const corner = getCellIndex('front', 0, 0)

    expect(getAffectedCells(topEdge)).toContain(getCellIndex('top', 2, 1))
    expect(getNeighbor(topEdge, 'up')).toBe(getCellIndex('top', 2, 1))
    expect(getAffectedCells(corner)).toEqual(
      expect.arrayContaining([
        getCellIndex('top', 2, 0),
        getCellIndex('left', 0, 2),
        getCellIndex('front', 0, 1),
        getCellIndex('front', 1, 0),
        corner
      ])
    )
  })

  it('has four reciprocal neighbors for every cell', () => {
    for (let index = 0; index < LIGHTS_OUT_CELL_COUNT; index += 1) {
      const neighbors = getAffectedCells(index).slice(1)
      expect(new Set(neighbors).size).toBe(4)
      for (const neighbor of neighbors) expect(getAffectedCells(neighbor)).toContain(index)
    }
  })

  it('returns to the same board after pressing a cell twice', () => {
    const board = createBoardFromPresses([0, 6, 12, 18, 24, 36, 45, 53])
    expect(pressCell(pressCell(board, 7), 7)).toEqual(board)
  })

  it('builds solvable boards by applying reversible presses', () => {
    const presses = [0, 4, 8, 10, 22, 31, 40, 49, 53]
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

  it('finds the shortest solution for the current board', () => {
    const pressedCell = getCellIndex('right', 1, 2)
    expect(findShortestSolution(createBoardFromPresses([pressedCell]))).toEqual([pressedCell])
  })

  it('chooses the shorter equivalent when a board has multiple solutions', () => {
    const longerSolution = [0, 2, 6, 8, 9, 11, 15, 17, 18, 20, 24, 26]
    expect(findShortestSolution(createBoardFromPresses(longerSolution))).toEqual([27, 29, 33, 35])
  })

  it('solves boards after arbitrary play', () => {
    const initialBoard = createBoardFromPresses([0, 4, 8, 10, 22, 31, 40, 49, 53])
    const currentBoard = [7, 12, 38, 45].reduce(pressCell, initialBoard)
    const solution = findShortestSolution(currentBoard)

    expect(solution).not.toBeNull()
    expect(isBoardCleared(solution?.reduce(pressCell, currentBoard) ?? currentBoard)).toBe(true)
  })

  it('handles cleared, invalid, and unreachable boards', () => {
    expect(
      findShortestSolution(Array.from({ length: LIGHTS_OUT_CELL_COUNT }, () => false))
    ).toEqual([])
    expect(() => findShortestSolution([])).toThrow(RangeError)

    const unreachableBoard = Array.from(
      { length: LIGHTS_OUT_CELL_COUNT },
      (_, index) => index === 0
    )
    expect(findShortestSolution(unreachableBoard)).toBeNull()
  })
})
