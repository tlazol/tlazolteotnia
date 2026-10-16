import { Box3, Color, DirectionalLight, HemisphereLight, type Scene, Vector3 } from 'three'
import type { SceneSize } from './scene-math'
import { townDaylight } from './town-daylight'
import { townColors } from './town-model-parts'
import type { createTownSceneResources } from './town-scene-resources'
import { boardToTown, type TownView } from './town-view'

export function createTownLighting(
  scene: Scene,
  resources: ReturnType<typeof createTownSceneResources>
) {
  const sun = new DirectionalLight()
  const ambient = new HemisphereLight()
  sun.castShadow = true
  sun.shadow.normalBias = 0.6
  sun.shadow.bias = -0.00005
  scene.add(sun, sun.target, ambient)
  const warm = new Color(0xffb86b)
  const sky = new Color(0xc9dfff)
  const nightSky = new Color(0x708acb)
  const ground = new Color(0xc4bb9b)
  const nightGround = new Color(0x394363)
  const ocean = new Color(townColors.ocean)
  const darkOcean = new Color(0x101d38)
  const direction = new Vector3()
  const bounds = new Box3()
  const point = new Vector3()
  let timeKey = ''
  let lightKey = ''
  let viewKey = ''

  return {
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
          sun.color.setHex(0xfff5df).lerp(warm, light.warmth)
          sun.intensity = light.sun
          sun.castShadow = light.sun > 0
          ambient.color.copy(sky).lerp(nightSky, light.night)
          ambient.groundColor.copy(ground).lerp(nightGround, light.night)
          ambient.intensity = light.ambient
          resources.windowMaterial.emissiveIntensity = light.night * 0.85
          resources.lampMaterial.emissiveIntensity = light.night * 1.8
          resources.lampGlowMaterial.opacity = light.night * 0.32
          if (scene.background instanceof Color)
            scene.background.copy(ocean).lerp(darkOcean, light.night)
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
      sun.position.copy(sun.target.position).addScaledVector(direction, radius + 4000)
      sun.target.updateMatrixWorld()
      sun.updateMatrixWorld()
      const camera = sun.shadow.camera
      camera.position.copy(sun.position)
      camera.lookAt(sun.target.position)
      camera.updateMatrixWorld()
      bounds.makeEmpty()
      // Include visible ground/coast and roofs, not just the center of the camera.
      for (const x of [0, size.width])
        for (const y of [0, size.height])
          for (const height of [-250, 650]) {
            const groundPoint = boardToTown(
              (x - view.x) / view.zoom,
              (y - view.y) / view.zoom + height / Math.SQRT2,
              view.rotation
            )
            point.set(groundPoint.x, height, groundPoint.z).applyMatrix4(camera.matrixWorldInverse)
            bounds.expandByPoint(point)
          }
      const halfWidth = (bounds.max.x - bounds.min.x) / 2 + 100
      const halfHeight = (bounds.max.y - bounds.min.y) / 2 + 100
      const texelX = (2 * halfWidth) / resolution
      const texelY = (2 * halfHeight) / resolution
      // Snap the projection in world light-space so panning does not crawl over texels.
      const origin = new Vector3(0, 0, 0).applyMatrix4(camera.matrixWorldInverse)
      const cx =
        Math.round(((bounds.min.x + bounds.max.x) / 2 - origin.x) / texelX) * texelX + origin.x
      const cy =
        Math.round(((bounds.min.y + bounds.max.y) / 2 - origin.y) / texelY) * texelY + origin.y
      camera.left = cx - halfWidth
      camera.right = cx + halfWidth
      camera.bottom = cy - halfHeight
      camera.top = cy + halfHeight
      camera.near = 1
      camera.far = -bounds.min.z + 2000
      camera.updateProjectionMatrix()
      return true
    },
    dispose() {
      sun.shadow.dispose()
      scene.remove(sun, sun.target, ambient)
    }
  }
}
