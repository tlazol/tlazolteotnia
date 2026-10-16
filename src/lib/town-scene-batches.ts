import {
  Box3,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  Scene
} from 'three'
import { bicyclePose } from './town-bicycle-pose'
import { createTownPartWriter, type Part, type TownShape, townColors } from './town-model-parts'
import { personBlinkFrames } from './town-person-geometry'
import type { Resident } from './town-residents'
import type { createTownSceneResources } from './town-scene-resources'
import type { StaticTownParts } from './town-static-model'
import { createTownVehicleModels } from './town-vehicle-model'

type MovingPart = { part: Part; resident: Resident }
export const residentLiftHeight = 28

export function createTownSceneBatches(resources: ReturnType<typeof createTownSceneResources>) {
  const { geometries, material, faceMaterial, grassMaterial, roofMaterial } = resources
  const scene = new Scene()
  scene.background = new Color(townColors.ocean)
  const traffic = new Scene()
  const selection = new Scene()
  scene.add(traffic)
  const meshes: InstancedMesh[] = []
  const occluders: InstancedMesh[] = []
  const transform = new Object3D()
  const color = new Color()
  const trafficMeshes: {
    mesh: InstancedMesh
    selectionMesh: InstancedMesh
    items: MovingPart[]
    blink?: InstancedBufferAttribute
    selectionBlink?: InstancedBufferAttribute
  }[] = []
  function clear() {
    for (const mesh of meshes) {
      scene.remove(mesh)
      mesh.dispose()
    }
    meshes.length = 0
    occluders.length = 0
    for (const { mesh, selectionMesh, blink } of trafficMeshes) {
      traffic.remove(mesh)
      mesh.dispose()
      selection.remove(selectionMesh)
      selectionMesh.dispose()
      if (blink) {
        mesh.geometry.dispose()
        selectionMesh.geometry.dispose()
      }
    }
    trafficMeshes.length = 0
  }
  function rebuild(
    parts: StaticTownParts,
    forestParts: Partial<Record<TownShape, Part[]>>,
    residents: Resident[],
    detailed: boolean
  ) {
    clear()
    const movingParts: Partial<Record<TownShape, MovingPart[]>> = {}
    for (const resident of residents) {
      resident.bounds = new Box3()
      const modelPlacement = { x: 0, z: 0, yaw: 0, scale: resident.scale }
      const writer = createTownPartWriter((shape, item) => {
        movingParts[shape] ??= []
        movingParts[shape].push({ part: item, resident })
        transform.position.set(item.x, item.y, item.z)
        transform.rotation.set(item.pitch, item.yaw, item.angle, 'YXZ')
        transform.scale.set(item.width, item.height, item.depth)
        transform.updateMatrix()
        const bounds = geometries[shape].boundingBox
        if (bounds) resident.bounds?.union(bounds.clone().applyMatrix4(transform.matrix))
      }, modelPlacement)
      const { car, cyclist, person } = createTownVehicleModels(writer, detailed, resident.slug)
      if (resident.kind === 'car') car(resident.variant)
      else if (resident.kind === 'bicycle') cyclist(resident.variant)
      else person(resident.variant)
    }
    for (const collection of [parts, forestParts]) {
      for (const shape of [
        'box',
        'ground',
        'land',
        'roof',
        'gable',
        'tree',
        'disc',
        'wheel'
      ] as const) {
        // Spatial batches allow the view and shadow cameras to cull distant details.
        const groups = new Map<string, Part[]>()
        for (const item of collection[shape] ?? []) {
          const key = `${Math.floor(item.x / 768)}:${Math.floor(item.z / 768)}:${item.emission ?? ''}`
          const group = groups.get(key) ?? []
          group.push(item)
          groups.set(key, group)
        }
        for (const items of groups.values()) {
          const emission = items[0].emission
          const mesh = new InstancedMesh(
            geometries[shape],
            emission === 'window'
              ? resources.windowMaterial
              : emission === 'lamp'
                ? resources.lampMaterial
                : emission === 'glow'
                  ? resources.lampGlowMaterial
                  : shape === 'ground' || shape === 'land'
                    ? grassMaterial
                    : shape === 'roof'
                      ? roofMaterial
                      : material,
            items.length
          )
          items.forEach((item, index) => {
            transform.position.set(item.x, item.y, item.z)
            transform.rotation.set(item.pitch, item.yaw, item.angle, 'YXZ')
            transform.scale.set(item.width, item.height, item.depth)
            transform.updateMatrix()
            mesh.setMatrixAt(index, transform.matrix)
            mesh.setColorAt(index, color.setHex(item.color))
          })
          mesh.castShadow = shape !== 'land' && shape !== 'ground' && emission !== 'glow'
          mesh.receiveShadow = emission !== 'glow'
          mesh.instanceMatrix.needsUpdate = true
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
          mesh.computeBoundingSphere()
          meshes.push(mesh)
          if (collection === parts && emission !== 'glow') occluders.push(mesh)
          scene.add(mesh)
        }
      }
    }
    for (const shape of Object.keys(movingParts) as TownShape[]) {
      const items = movingParts[shape] ?? []
      if (!items.length) continue
      const isFace = shape.startsWith('girlFace')
      const partMaterial = isFace ? faceMaterial : material
      const geometry = isFace ? geometries[shape].clone() : geometries[shape]
      const blink = isFace
        ? new InstancedBufferAttribute(new Float32Array(items.length), 1).setUsage(DynamicDrawUsage)
        : undefined
      if (blink) geometry.setAttribute('blinkFrame', blink)
      const mesh = new InstancedMesh(geometry, partMaterial, items.length)
      mesh.castShadow = !isFace
      mesh.receiveShadow = true
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      // Residents travel outside their initial bounds; let the GPU clip these batches.
      mesh.frustumCulled = false
      items.forEach(({ part }, index) => {
        mesh.setColorAt(index, color.setHex(part.color))
      })
      const partCounts = new Map<string, number>()
      for (const { resident } of items) {
        if (resident.slug) partCounts.set(resident.slug, (partCounts.get(resident.slug) ?? 0) + 1)
      }
      const selectionCount = Math.max(1, ...partCounts.values())
      const selectionGeometry = isFace ? geometries[shape].clone() : geometries[shape]
      const selectionBlink = isFace
        ? new InstancedBufferAttribute(new Float32Array(selectionCount), 1).setUsage(
            DynamicDrawUsage
          )
        : undefined
      if (selectionBlink) selectionGeometry.setAttribute('blinkFrame', selectionBlink)
      const selectionMesh = new InstancedMesh(selectionGeometry, partMaterial, selectionCount)
      selectionMesh.instanceMatrix.setUsage(DynamicDrawUsage)
      selectionMesh.frustumCulled = false
      selectionMesh.count = 0
      trafficMeshes.push({ mesh, selectionMesh, items, blink, selectionBlink })
      traffic.add(mesh)
      selection.add(selectionMesh)
    }
  }
  function update({
    elapsed,
    motion,
    selectedSlug,
    visibleSlugs,
    dragged
  }: {
    elapsed: number
    motion: boolean
    selectedSlug: string | null
    visibleSlugs: Set<string> | null
    dragged: Resident | null
  }) {
    const liftHeight = residentLiftHeight
    for (const { mesh, selectionMesh, items, blink, selectionBlink } of trafficMeshes) {
      selectionMesh.count = 0
      items.forEach(({ part, resident }, index) => {
        const { x, z } = resident.pose
        const activity = resident.activity
        const age = activity ? elapsed - activity.start : 0
        // Ease gestures in and out, with different rhythms for each participant.
        const envelope = activity ? Math.min(1, age * 3, (activity.end - elapsed) * 3) : 0
        const beat = Math.sin(age * 5 + resident.phase)
        const yaw =
          resident.pose.yaw +
          (activity?.kind === 'look' ? Math.sin(age * 1.5) * 0.65 * envelope : 0)
        const cycle =
          (resident.time ?? elapsed) * (resident.kind === 'walker' ? 5 : 7) + resident.phase
        const swing = Math.sin(cycle) * Math.sign(part.x)
        let y = part.y
        let localZ = part.z
        let pitch = part.pitch
        let height = part.height
        if (part.motion === 'leg' || part.motion === 'arm') {
          const direction = part.motion === 'leg' ? 1 : -1
          let rotation = activity ? 0 : swing * 0.32 * direction
          if (activity && part.motion === 'arm') {
            if (activity.kind === 'talk') {
              rotation = (part.x > 0 ? -0.65 + beat * 0.3 : -0.15) * envelope
            } else if (activity.kind === 'play') {
              // A shared rock-paper-scissors rhythm, followed by a little celebratory hop.
              rotation = (-0.9 + Math.sin(age * 5) * 0.55) * envelope
            } else if (activity.kind === 'stretch') {
              rotation = -2.6 * envelope
            }
          }
          const pivotY = (part.motion === 'leg' ? 22 : 36) * resident.scale
          const offsetY = part.y - pivotY
          y = pivotY + offsetY * Math.cos(rotation) - part.z * Math.sin(rotation)
          localZ = offsetY * Math.sin(rotation) + part.z * Math.cos(rotation)
          pitch += rotation
        } else if (part.motion === 'wheel') {
          pitch += ((resident.time ?? elapsed) * resident.route.speed) / 9
        } else if (part.motion) {
          const pose = bicyclePose(part.motion, Math.sign(part.x), cycle)
          y = pose.y * resident.scale
          localZ = pose.z * resident.scale
          height = pose.height * resident.scale
          pitch = pose.pitch
        }
        transform.position.set(
          x + part.x * Math.cos(yaw) + localZ * Math.sin(yaw),
          y +
            (resident === dragged ? liftHeight : 0) +
            (activity?.kind === 'play' && age % 3 > 2
              ? Math.max(0, Math.sin((age % 3) * Math.PI * 2)) * 9 * resident.scale * envelope
              : 0),
          z - part.x * Math.sin(yaw) + localZ * Math.cos(yaw)
        )
        transform.rotation.set(pitch, yaw, part.angle, 'YXZ')
        const visible = !resident.slug || visibleSlugs?.has(resident.slug)
        transform.scale.set(
          visible ? part.width : 0,
          visible ? height : 0,
          visible ? part.depth : 0
        )
        transform.updateMatrix()
        mesh.setMatrixAt(index, transform.matrix)
        let blinkFrame = 0
        if (blink) {
          // A quick close, a short hold, and a gentler reopen every 3–5 seconds.
          const interval = 3.1 + (Math.sin(resident.blinkPhase * 1.13) + 1) * 1.05
          const age = ((elapsed + resident.blinkPhase * 0.83) % interval) - (interval - 0.24)
          const closed = motion ? Math.max(0, Math.min(age / 0.08, 1, (0.24 - age) / 0.12)) : 0
          blinkFrame = Math.round(closed * (personBlinkFrames - 1))
          blink.setX(index, blinkFrame)
        }
        if (visible && resident.slug === selectedSlug) {
          selectionBlink?.setX(selectionMesh.count, blinkFrame)
          selectionMesh.setMatrixAt(selectionMesh.count++, transform.matrix)
        }
      })
      mesh.instanceMatrix.needsUpdate = true
      selectionMesh.instanceMatrix.needsUpdate = true
      if (blink) blink.needsUpdate = true
      if (selectionBlink) selectionBlink.needsUpdate = true
    }
  }
  return { scene, traffic, selection, occluders, rebuild, update, dispose: clear }
}
