import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  type Mesh,
  type Scene,
  Vector3
} from 'three'
import type { SceneSize } from './scene-math'
import { townDaylight } from './town-daylight'
import type { TownMaterials } from './town-materials'
import { boardToTown, type TownView } from './town-view'

export function createTownLighting(scene: Scene, materials: TownMaterials, pools?: Mesh) {
  const sun = new DirectionalLight()
  const ambient = new HemisphereLight()
  sun.castShadow = true
  sun.shadow.normalBias = 0.8
  sun.shadow.bias = -0.0001
  sun.shadow.radius = 2
  scene.add(sun, sun.target, ambient)
  const warm = new Color(0xffa45c)
  const sky = new Color(0xdcefff)
  const duskSky = new Color(0xc9a6d6)
  const nightSky = new Color(0x8a9ee0)
  const ground = new Color(0xc9cba8)
  const duskGround = new Color(0xc98d78)
  const nightGround = new Color(0x404c70)
  const sea = new Color(0x2a7bb6)
  const nightSea = new Color(0x0f1d3c)
  const direction = new Vector3()
  const bounds = new Box3()
  const point = new Vector3()
  const origin = new Vector3()
  let timeKey = ''
  let lightKey = ''
  let viewKey = ''
  let night = 0

  return {
    get night() {
      return night
    },
    update(date: Date, view: TownView, size: SceneSize) {
      const nextTimeKey = `${Math.floor(date.getTime() / 1000)}:${date.getTimezoneOffset()}`
      let lightingChanged = false
      if (nextTimeKey !== timeKey) {
        timeKey = nextTimeKey
        const light = townDaylight(date)
        // An unlit sun can move overnight without changing the rendered town.
        const nextLightKey = [
          light.sun,
          light.ambient,
          light.warmth,
          light.night,
          ...(light.sun > 0 ? [light.direction.x, light.direction.y, light.direction.z] : [])
        ].join(':')
        lightingChanged = nextLightKey !== lightKey
        lightKey = nextLightKey
        if (lightingChanged) {
          direction.set(light.direction.x, light.direction.y, light.direction.z)
          sun.color.setHex(0xfff6e6).lerp(warm, light.warmth)
          sun.intensity = light.sun
          sun.castShadow = light.sun > 0
          ambient.color.copy(sky).lerp(duskSky, light.warmth).lerp(nightSky, light.night)
          ambient.groundColor
            .copy(ground)
            .lerp(duskGround, light.warmth)
            .lerp(nightGround, light.night)
          ambient.intensity = light.ambient
          night = light.night
          materials.uniforms.uNight.value = night
          materials.uniforms.uCloud.value = 0.3 * Math.min(1, light.sun / 2)
          materials.pools.opacity = night * 0.55
          if (pools) pools.visible = night > 0.02
          if (scene.background instanceof Color) scene.background.copy(sea).lerp(nightSea, night)
        }
      }
      const nextViewKey = [view.x, view.y, view.zoom, view.rotation, size.width, size.height].join(
        ':'
      )
      if (!lightingChanged && nextViewKey === viewKey) return false
      viewKey = nextViewKey
      const resolution = size.width < 768 ? 1024 : 2048
      if (sun.shadow.mapSize.x !== resolution) {
        sun.shadow.map?.dispose()
        sun.shadow.map = null
        sun.shadow.mapSize.set(resolution, resolution)
      }
      const center = boardToTown(
        (size.width / 2 - view.x) / view.zoom,
        (size.height / 2 - view.y) / view.zoom,
        view.rotation
      )
      const radius = Math.hypot(size.width, size.height) / view.zoom
      sun.target.position.set(center.x, 0, center.z)
      sun.position.copy(sun.target.position).addScaledVector(direction, radius + 6000)
      sun.target.updateMatrixWorld()
      sun.updateMatrixWorld()
      const camera = sun.shadow.camera
      camera.position.copy(sun.position)
      camera.lookAt(sun.target.position)
      camera.updateMatrixWorld()
      bounds.makeEmpty()
      // Cover the visible ground, rooftops and hills, not just the center of the view.
      for (const x of [0, size.width])
        for (const y of [0, size.height])
          for (const height of [-60, 1000]) {
            const groundPoint = boardToTown(
              (x - view.x) / view.zoom,
              (y - view.y) / view.zoom + height / Math.SQRT2,
              view.rotation
            )
            point.set(groundPoint.x, height, groundPoint.z).applyMatrix4(camera.matrixWorldInverse)
            bounds.expandByPoint(point)
          }
      const halfWidth = (bounds.max.x - bounds.min.x) / 2 + 120
      const halfHeight = (bounds.max.y - bounds.min.y) / 2 + 120
      const texelX = (2 * halfWidth) / resolution
      const texelY = (2 * halfHeight) / resolution
      // Snap the projection in world light-space so panning does not crawl over texels.
      origin.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse)
      const cx =
        Math.round(((bounds.min.x + bounds.max.x) / 2 - origin.x) / texelX) * texelX + origin.x
      const cy =
        Math.round(((bounds.min.y + bounds.max.y) / 2 - origin.y) / texelY) * texelY + origin.y
      camera.left = cx - halfWidth
      camera.right = cx + halfWidth
      camera.bottom = cy - halfHeight
      camera.top = cy + halfHeight
      camera.near = 1
      camera.far = -bounds.min.z + 3000
      camera.updateProjectionMatrix()
      return true
    },
    dispose() {
      sun.shadow.dispose()
      scene.remove(sun, sun.target, ambient)
    }
  }
}
