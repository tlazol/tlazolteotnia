export const LIGHTS_OUT_FACE_SIZE = 3
export const LIGHTS_OUT_FACE_COUNT = 6
export const LIGHTS_OUT_CELL_COUNT =
  LIGHTS_OUT_FACE_SIZE * LIGHTS_OUT_FACE_SIZE * LIGHTS_OUT_FACE_COUNT

export const LIGHTS_OUT_FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'] as const

export type LightsOutFace = (typeof LIGHTS_OUT_FACES)[number]
export type LightsOutBoard = boolean[]
export type LightsOutCell = {
  face: LightsOutFace
  row: number
  column: number
}

export type LightsOutDirection = 'up' | 'right' | 'down' | 'left'

type Vector = readonly [number, number, number]

export type LightsOutFaceFrame = {
  face: LightsOutFace
  normal: Vector
  right: Vector
  down: Vector
}

export const LIGHTS_OUT_FACE_FRAMES: readonly LightsOutFaceFrame[] = [
  { face: 'front', normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
  { face: 'back', normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] },
  { face: 'left', normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
  { face: 'right', normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
  { face: 'top', normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
  { face: 'bottom', normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] }
]

const faceIndexByName = new Map(LIGHTS_OUT_FACES.map((face, index) => [face, index]))
const directions: readonly LightsOutDirection[] = ['up', 'right', 'down', 'left']
const orthogonalNeighbors = createOrthogonalNeighbors()

export function getCellIndex(face: LightsOutFace, row: number, column: number): number {
  const faceIndex = faceIndexByName.get(face)
  if (
    faceIndex === undefined ||
    row < 0 ||
    row >= LIGHTS_OUT_FACE_SIZE ||
    column < 0 ||
    column >= LIGHTS_OUT_FACE_SIZE
  ) {
    throw new RangeError(`Invalid Lights Out cell: ${face} (${row}, ${column})`)
  }

  return faceIndex * LIGHTS_OUT_FACE_SIZE ** 2 + row * LIGHTS_OUT_FACE_SIZE + column
}

export function getCellCoordinates(index: number): LightsOutCell {
  if (!Number.isInteger(index) || index < 0 || index >= LIGHTS_OUT_CELL_COUNT) {
    throw new RangeError(`Invalid Lights Out cell index: ${index}`)
  }

  const cellsPerFace = LIGHTS_OUT_FACE_SIZE ** 2
  const faceIndex = Math.floor(index / cellsPerFace)
  const indexOnFace = index % cellsPerFace

  return {
    face: LIGHTS_OUT_FACES[faceIndex],
    row: Math.floor(indexOnFace / LIGHTS_OUT_FACE_SIZE),
    column: indexOnFace % LIGHTS_OUT_FACE_SIZE
  }
}

export function getAffectedCells(index: number): number[] {
  getCellCoordinates(index)
  return [index, ...orthogonalNeighbors[index]]
}

export function getNeighbor(index: number, direction: LightsOutDirection): number {
  getCellCoordinates(index)
  return orthogonalNeighbors[index][directions.indexOf(direction)]
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

export function findShortestSolution(board: LightsOutBoard): number[] | null {
  if (board.length !== LIGHTS_OUT_CELL_COUNT) {
    throw new RangeError(`Invalid Lights Out board length: ${board.length}`)
  }

  if (isBoardCleared(board)) return []

  const matrix = Array.from({ length: LIGHTS_OUT_CELL_COUNT }, (_, row) => [
    ...Array.from({ length: LIGHTS_OUT_CELL_COUNT }, (_, column) =>
      getAffectedCells(column).includes(row) ? 1 : 0
    ),
    board[row] ? 1 : 0
  ])
  const pivotColumns: number[] = []
  let pivotRow = 0

  for (let column = 0; column < LIGHTS_OUT_CELL_COUNT; column += 1) {
    const nextPivot = matrix.findIndex((row, index) => index >= pivotRow && row[column] === 1)
    if (nextPivot === -1) continue

    ;[matrix[pivotRow], matrix[nextPivot]] = [matrix[nextPivot], matrix[pivotRow]]
    for (let row = 0; row < LIGHTS_OUT_CELL_COUNT; row += 1) {
      if (row === pivotRow || matrix[row][column] === 0) continue
      for (let index = column; index <= LIGHTS_OUT_CELL_COUNT; index += 1) {
        matrix[row][index] ^= matrix[pivotRow][index]
      }
    }

    pivotColumns.push(column)
    pivotRow += 1
  }

  const inconsistent = matrix.some(
    (row) =>
      row.slice(0, LIGHTS_OUT_CELL_COUNT).every((value) => value === 0) &&
      row[LIGHTS_OUT_CELL_COUNT] === 1
  )
  if (inconsistent) return null

  const pivotColumnSet = new Set(pivotColumns)
  const freeColumns = Array.from({ length: LIGHTS_OUT_CELL_COUNT }, (_, index) => index).filter(
    (index) => !pivotColumnSet.has(index)
  )
  const particular = Array.from({ length: LIGHTS_OUT_CELL_COUNT }, () => false)

  for (const [row, column] of pivotColumns.entries()) {
    particular[column] = matrix[row][LIGHTS_OUT_CELL_COUNT] === 1
  }

  const nullspaceBasis = freeColumns.map((freeColumn) => {
    const basis = Array.from({ length: LIGHTS_OUT_CELL_COUNT }, () => false)
    basis[freeColumn] = true
    for (const [row, column] of pivotColumns.entries()) {
      basis[column] = matrix[row][freeColumn] === 1
    }
    return basis
  })

  let shortest: number[] | null = null
  for (let mask = 0; mask < 2 ** nullspaceBasis.length; mask += 1) {
    const candidate = [...particular]
    for (let basisIndex = 0; basisIndex < nullspaceBasis.length; basisIndex += 1) {
      if ((mask & (1 << basisIndex)) === 0) continue
      for (let index = 0; index < LIGHTS_OUT_CELL_COUNT; index += 1) {
        candidate[index] = candidate[index] !== nullspaceBasis[basisIndex][index]
      }
    }

    const presses = candidate.flatMap((pressed, index) => (pressed ? [index] : []))
    if (
      shortest === null ||
      presses.length < shortest.length ||
      (presses.length === shortest.length && isLexicographicallyEarlier(presses, shortest))
    ) {
      shortest = presses
    }
  }

  return shortest
}

function isLexicographicallyEarlier(first: readonly number[], second: readonly number[]): boolean {
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) return first[index] < second[index]
  }
  return false
}

function createOrthogonalNeighbors(): number[][] {
  const neighbors = Array.from({ length: LIGHTS_OUT_CELL_COUNT }, () => [] as number[])
  const cellsByEdge = new Map<string, { direction: number; index: number }[]>()

  for (const frame of LIGHTS_OUT_FACE_FRAMES) {
    for (let row = 0; row < LIGHTS_OUT_FACE_SIZE; row += 1) {
      for (let column = 0; column < LIGHTS_OUT_FACE_SIZE; column += 1) {
        const index = getCellIndex(frame.face, row, column)
        const center = add(
          scale(frame.normal, LIGHTS_OUT_FACE_SIZE),
          scale(frame.right, column * 2 - (LIGHTS_OUT_FACE_SIZE - 1)),
          scale(frame.down, row * 2 - (LIGHTS_OUT_FACE_SIZE - 1))
        )
        const edges: [Vector, Vector][] = [
          [
            add(center, scale(frame.down, -1), scale(frame.right, -1)),
            add(center, scale(frame.down, -1), frame.right)
          ],
          [add(center, frame.right, scale(frame.down, -1)), add(center, frame.right, frame.down)],
          [add(center, frame.down, scale(frame.right, -1)), add(center, frame.down, frame.right)],
          [
            add(center, scale(frame.right, -1), scale(frame.down, -1)),
            add(center, scale(frame.right, -1), frame.down)
          ]
        ]

        for (const [direction, [start, end]] of edges.entries()) {
          const key = edgeKey(start, end)
          const cells = cellsByEdge.get(key) ?? []
          cells.push({ direction, index })
          cellsByEdge.set(key, cells)
        }
      }
    }
  }

  for (const cells of cellsByEdge.values()) {
    if (cells.length !== 2) throw new Error('Invalid cube topology')
    const [first, second] = cells
    neighbors[first.index][first.direction] = second.index
    neighbors[second.index][second.direction] = first.index
  }

  if (neighbors.some((cells) => cells.length !== 4)) throw new Error('Invalid cube topology')
  return neighbors
}

function add(...vectors: Vector[]): Vector {
  return vectors.reduce<Vector>(
    (total, vector) => [total[0] + vector[0], total[1] + vector[1], total[2] + vector[2]],
    [0, 0, 0]
  )
}

function scale(vector: Vector, factor: number): Vector {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor]
}

function edgeKey(start: Vector, end: Vector): string {
  return [start.join(','), end.join(',')].sort().join('|')
}
