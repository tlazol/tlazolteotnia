import { OrthographicCamera } from 'three'
import type { BoardSize } from './sticker-board'
import type { TownView } from './town-view'

const elevation = Math.PI / 4
const sinElevation = Math.sin(elevation)

export function createTownCamera() {
  const camera = new OrthographicCamera(0, 1, 0, -1, 1, 100000)
  orientCamera(camera, 0)
  return camera
}

function orientCamera(camera: OrthographicCamera, rotation: number) {
  const angle = Math.PI / 4 + rotation
  const horizontal = 50000 * Math.cos(elevation)
  camera.position.set(
    horizontal * Math.sin(angle),
    50000 * sinElevation,
    horizontal * Math.cos(angle)
  )
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
}

export function updateTownCamera(camera: OrthographicCamera, view: TownView, size: BoardSize) {
  orientCamera(camera, view.rotation ?? 0)
  camera.left = -view.x / view.zoom
  camera.right = (size.width - view.x) / view.zoom
  camera.top = view.y / view.zoom
  camera.bottom = (view.y - size.height) / view.zoom
  camera.updateProjectionMatrix()
}
