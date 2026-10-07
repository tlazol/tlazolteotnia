import { OrthographicCamera } from 'three'
import type { BoardSize, BoardView } from './sticker-board'

const elevation = Math.PI / 4
const sinElevation = Math.sin(elevation)

// Ground coordinates whose projection matches the sticker board's x/right, y/down axes.
export function boardToTown(x: number, y: number) {
  return { x: (x + y / sinElevation) / Math.SQRT2, z: (-x + y / sinElevation) / Math.SQRT2 }
}

export function createTownCamera() {
  const camera = new OrthographicCamera(0, 1, 0, -1, 1, 100000)
  const horizontal = (50000 * Math.cos(elevation)) / Math.SQRT2
  camera.position.set(horizontal, 50000 * sinElevation, horizontal)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  return camera
}

export function updateTownCamera(camera: OrthographicCamera, view: BoardView, size: BoardSize) {
  camera.left = -view.x / view.zoom
  camera.right = (size.width - view.x) / view.zoom
  camera.top = view.y / view.zoom
  camera.bottom = (view.y - size.height) / view.zoom
  camera.updateProjectionMatrix()
}
