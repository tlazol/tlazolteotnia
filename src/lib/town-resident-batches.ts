import {
  AdditiveBlending,
  Box3,
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DynamicDrawUsage,
  Float32BufferAttribute,
  GreaterDepth,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  type Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  RedFormat,
  ShaderChunk,
  TorusGeometry
} from 'three'
import { bicyclePose } from './town-bicycle-pose'
import { radialTexture } from './town-materials'
import {
  createPersonFaceTexture,
  createPersonGeometries,
  personBlinkFrames
} from './town-person-geometry'
import { personHipHeight, personShoulderHeight } from './town-person-model'
import type { Resident } from './town-residents'
import {
  carParts,
  cyclistParts,
  type MovingPart,
  type MovingShape,
  personParts
} from './town-vehicles'
import { pavementHeight, townGroundHeight } from './town-world'

export const residentLiftHeight = 28

export function residentBaseHeight(resident: Resident) {
  if (resident.kind === 'car') return 1.2
  if (resident.roof !== undefined) return resident.roof + 0.5
  const ground = townGroundHeight(resident.pose.x, resident.pose.z) + pavementHeight + 0.5
  if (resident.water === undefined) return ground
  // Swimmers float with the waterline at their shoulders; cyclists sit higher on the saddle.
  if (resident.swimming)
    return (
      resident.water -
      (personShoulderHeight + (resident.kind === 'bicycle' ? 14 : 0)) * resident.scale
    )
  return Math.max(ground, resident.water)
}

type Batch = {
  mesh: InstancedMesh
  selection: InstancedMesh
  items: { part: MovingPart; resident: Resident }[]
  blink?: InstancedBufferAttribute
  ownsGeometry: boolean
}

function withWhite(geometry: BufferGeometry) {
  if (!geometry.getAttribute('color')) {
    const colors = new Float32Array(geometry.getAttribute('position').count * 3).fill(1)
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  }
  geometry.computeBoundingBox()
  return geometry
}

export function residentModel(resident: Resident) {
  const identity = resident.slug ?? String(resident.variant)
  if (resident.kind === 'car') return carParts(resident.variant)
  if (resident.kind === 'bicycle') return cyclistParts(resident.variant, identity)
  return personParts(resident.variant, identity)
}

export function createResidentBatches() {
  const geometries: Record<MovingShape, BufferGeometry> = {
    ...createPersonGeometries(),
    box: new BoxGeometry(1, 1, 1),
    light: new BoxGeometry(1, 1, 1),
    wheel: new CylinderGeometry(0.5, 0.5, 1, 12).rotateZ(Math.PI / 2),
    tyre: new TorusGeometry(0.5, 0.09, 4, 14).rotateY(Math.PI / 2)
  }
  for (const geometry of Object.values(geometries)) withWhite(geometry)

  // Three discrete light bands, shared by skin, hair, clothes and facial features.
  const gradient = new DataTexture(new Uint8Array([60, 140, 255]), 3, 1, RedFormat)
  gradient.minFilter = gradient.magFilter = NearestFilter
  gradient.needsUpdate = true
  const personMaterial = new MeshToonMaterial({ vertexColors: true, gradientMap: gradient })
  // Faces take a gentler ramp, so the terminator never splits a cheek in two.
  const softGradient = new DataTexture(new Uint8Array([185, 225, 255]), 3, 1, RedFormat)
  softGradient.minFilter = softGradient.magFilter = NearestFilter
  softGradient.needsUpdate = true
  const skinMaterial = new MeshToonMaterial({ vertexColors: true, gradientMap: softGradient })
  const faceTexture = createPersonFaceTexture()
  const faceMaterial = new MeshToonMaterial({
    gradientMap: softGradient,
    map: faceTexture,
    transparent: true,
    alphaTest: 0.02
  })
  // After dusk residents are lit by their own lanterns and bicycle lamps.
  const lamp = { value: 0 }
  for (const material of [personMaterial, skinMaterial, faceMaterial]) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uLamp = lamp
      // Keep the time-of-day fill light uniform so it cannot soften the cel bands.
      shader.fragmentShader = `uniform float uLamp;\n${shader.fragmentShader}`
        .replace(
          '#include <lights_pars_begin>',
          ShaderChunk.lights_pars_begin.replace(
            'float hemiDiffuseWeight = 0.5 * dotNL + 0.5;',
            'float hemiDiffuseWeight = 0.5;'
          )
        )
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.86, 0.7) * uLamp;'
        )
    }
  }
  // Each face selects its own eyelid row while sharing the same texture and draw call.
  const compileFace = faceMaterial.onBeforeCompile
  faceMaterial.onBeforeCompile = (shader, renderer) => {
    compileFace.call(faceMaterial, shader, renderer)
    shader.vertexShader = `attribute float blinkFrame;\n${shader.vertexShader}`.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>\nvMapUv.y = (vMapUv.y + blinkFrame) / ${personBlinkFrames.toFixed(1)};`
    )
  }
  const vehicleMaterial = new MeshLambertMaterial({ vertexColors: true })
  const lightMaterial = new MeshBasicMaterial({ vertexColors: true })
  // Neon trims and lenses ignore the daylight, so they glow at night.
  const neonMaterial = new MeshBasicMaterial({ vertexColors: true })
  // Silhouettes of the selected resident show through buildings. Drawn after the
  // town and before residents, so only the hidden parts remain.
  const xrayMaterial = new MeshBasicMaterial({
    color: 0x2fa7c4,
    blending: AdditiveBlending,
    depthFunc: GreaterDepth,
    depthWrite: false
  })

  // Lamplight on the ground under each article resident, and a cyclist's beam ahead.
  const glowTexture = radialTexture()
  const glowGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const glowMaterial = new MeshBasicMaterial({
    map: glowTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending
  })
  let pools: InstancedMesh | null = null
  let glowItems: { resident: Resident; ahead: number; width: number; depth: number }[] = []

  const group = new Group()
  group.name = 'town-residents'
  const batches: Batch[] = []
  const transform = new Object3D()
  const color = new Color()

  function materialFor(shape: MovingShape, glow: boolean): Material {
    if (glow) return neonMaterial
    if (shape.startsWith('girlFace')) return faceMaterial
    if (shape === 'girlHead') return skinMaterial
    if (shape.startsWith('girl')) return personMaterial
    if (shape === 'light') return lightMaterial
    return vehicleMaterial
  }

  function clear() {
    for (const batch of batches) {
      group.remove(batch.mesh, batch.selection)
      batch.mesh.dispose()
      batch.selection.dispose()
      if (batch.ownsGeometry) {
        batch.mesh.geometry.dispose()
        batch.selection.geometry.dispose()
      }
    }
    batches.length = 0
    if (pools) {
      group.remove(pools)
      pools.dispose()
      pools = null
    }
    glowItems = []
  }

  function rebuild(residents: Resident[]) {
    clear()
    const grouped = new Map<string, { shape: MovingShape; glow: boolean; items: Batch['items'] }>()
    for (const resident of residents) {
      resident.bounds = new Box3()
      for (const part of residentModel(resident)) {
        const scaled = {
          ...part,
          x: part.x * resident.scale,
          y: part.y * resident.scale,
          z: part.z * resident.scale,
          width: part.width * resident.scale,
          height: part.height * resident.scale,
          depth: part.depth * resident.scale
        }
        const glow = !!part.glow
        const key = `${part.shape}${glow ? ':glow' : ''}`
        const entry = grouped.get(key) ?? { shape: part.shape, glow, items: [] }
        entry.items.push({ part: scaled, resident })
        grouped.set(key, entry)
        transform.position.set(scaled.x, scaled.y, scaled.z)
        transform.rotation.set(scaled.pitch, 0, scaled.angle, 'YXZ')
        transform.scale.set(scaled.width, scaled.height, scaled.depth)
        transform.updateMatrix()
        const bounds = geometries[part.shape].boundingBox
        if (bounds) resident.bounds.union(bounds.clone().applyMatrix4(transform.matrix))
      }
    }
    for (const resident of residents) {
      if (!resident.slug) continue
      const size = 150 * resident.scale
      glowItems.push({ resident, ahead: 0, width: size, depth: size })
      if (resident.kind === 'bicycle')
        glowItems.push({
          resident,
          ahead: 70 * resident.scale,
          width: 70 * resident.scale,
          depth: 110 * resident.scale
        })
    }
    if (glowItems.length) {
      const mesh = new InstancedMesh(glowGeometry, glowMaterial, glowItems.length)
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.renderOrder = 2
      glowItems.forEach(({ ahead }, index) => {
        mesh.setColorAt(index, color.setHex(ahead ? 0xfff0c8 : 0xffb35c))
      })
      pools = mesh
      group.add(mesh)
    }
    for (const { shape, glow, items } of grouped.values()) {
      const face = shape.startsWith('girlFace')
      const geometry = face ? geometries[shape].clone() : geometries[shape]
      const blink = face
        ? new InstancedBufferAttribute(new Float32Array(items.length), 1).setUsage(DynamicDrawUsage)
        : undefined
      if (blink) geometry.setAttribute('blinkFrame', blink)
      const mesh = new InstancedMesh(geometry, materialFor(shape, glow), items.length)
      mesh.castShadow = !face && !glow && shape !== 'light'
      // Fringe shadows would darken the whole face at town scale.
      mesh.receiveShadow = !face && !glow && shape !== 'girlHead'
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      // Residents travel outside their initial bounds; let the GPU clip these batches.
      mesh.frustumCulled = false
      mesh.renderOrder = 2
      items.forEach(({ part }, index) => {
        mesh.setColorAt(index, color.setHex(part.color))
      })
      const perResident = new Map<string, number>()
      for (const { resident } of items)
        if (resident.slug) perResident.set(resident.slug, (perResident.get(resident.slug) ?? 0) + 1)
      const selection = new InstancedMesh(
        geometries[shape],
        xrayMaterial,
        Math.max(1, ...perResident.values())
      )
      selection.instanceMatrix.setUsage(DynamicDrawUsage)
      selection.frustumCulled = false
      selection.renderOrder = 1
      selection.count = 0
      batches.push({ mesh, selection, items, blink, ownsGeometry: face })
      group.add(mesh, selection)
    }
  }

  function update({
    elapsed,
    motion,
    selectedSlug,
    visibleSlugs,
    dragged,
    night = 0
  }: {
    elapsed: number
    motion: boolean
    selectedSlug: string | null
    visibleSlugs: Set<string> | null
    dragged: Resident | null
    night?: number
  }) {
    const dark = night > 0.05
    const bases = new Map<Resident, number>()
    for (const { mesh, selection, items, blink } of batches) {
      selection.count = 0
      items.forEach(({ part, resident }, index) => {
        const { x, z } = resident.pose
        const activity = resident.activity
        const age = activity ? elapsed - activity.start : 0
        // Ease gestures in and out, with different rhythms for each participant.
        const envelope = activity ? Math.min(1, age * 3, (activity.end - elapsed) * 3) : 0
        const beat = Math.sin(age * 5 + resident.phase)
        // Residents left on a roof dance in place until they are carried down again.
        const dancing =
          resident.roof !== undefined &&
          resident.stationary &&
          resident !== dragged &&
          !activity &&
          resident.kind !== 'car'
        const step = elapsed * 2.4 + resident.phase
        const yaw =
          resident.pose.yaw +
          (activity?.kind === 'look' ? Math.sin(age * 1.5) * 0.65 * envelope : 0) +
          (dancing ? Math.sin(step * Math.PI * 0.25) * 0.7 : 0)
        const swimming = resident.swimming && resident.kind === 'walker'
        const cycle =
          (resident.time ?? elapsed) * (resident.kind === 'walker' && !swimming ? 5 : 7) +
          resident.phase
        const swing = Math.sin(cycle) * Math.sign(part.x)
        let y = part.y
        let localZ = part.z
        let pitch = part.pitch
        let height = part.height
        if (part.motion === 'leg' || part.motion === 'arm') {
          const direction = part.motion === 'leg' ? 1 : -1
          let rotation = activity ? 0 : swing * 0.32 * direction
          // Arms pump up in turn while the feet tap along to the beat.
          if (dancing)
            rotation =
              part.motion === 'arm'
                ? -1.5 - Math.sin(step * Math.PI) * Math.sign(part.x) * 0.9
                : Math.max(0, Math.sin(step * Math.PI) * Math.sign(part.x)) * 0.45
          // Front crawl: arms windmill out of phase while the legs flutter kick.
          if (swimming)
            rotation =
              part.motion === 'arm'
                ? -(cycle * 0.7 + (part.x > 0 ? Math.PI : 0))
                : Math.sin(cycle * 2) * Math.sign(part.x) * 0.45
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
          const pivotY =
            (part.motion === 'leg' ? personHipHeight : personShoulderHeight) * resident.scale
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
        const base = bases.get(resident) ?? residentBaseHeight(resident)
        bases.set(resident, base)
        transform.position.set(
          x + part.x * Math.cos(yaw) + localZ * Math.sin(yaw),
          base +
            y +
            (resident === dragged ? residentLiftHeight : 0) +
            (resident.swimming ? Math.sin(cycle * 1.4) * 1.5 * resident.scale : 0) +
            (dancing ? Math.abs(Math.sin(step * Math.PI)) * 3 * resident.scale : 0) +
            (activity?.kind === 'play' && age % 3 > 2
              ? Math.max(0, Math.sin((age % 3) * Math.PI * 2)) * 9 * resident.scale * envelope
              : 0),
          z - part.x * Math.sin(yaw) + localZ * Math.cos(yaw)
        )
        transform.rotation.set(pitch, yaw, part.angle, 'YXZ')
        // Night gear stays home in daylight and while swimming.
        const visible =
          (!resident.slug || !!visibleSlugs?.has(resident.slug)) &&
          (!part.night || (dark && !resident.swimming))
        transform.scale.set(
          visible ? part.width : 0,
          visible ? height : 0,
          visible ? part.depth : 0
        )
        transform.updateMatrix()
        mesh.setMatrixAt(index, transform.matrix)
        if (blink) {
          // A quick close, a short hold, and a gentler reopen every 3–5 seconds.
          const interval = 3.1 + (Math.sin(resident.blinkPhase * 1.13) + 1) * 1.05
          const phase = ((elapsed + resident.blinkPhase * 0.83) % interval) - (interval - 0.24)
          const closed = motion ? Math.max(0, Math.min(phase / 0.08, 1, (0.24 - phase) / 0.12)) : 0
          blink.setX(index, Math.round(closed * (personBlinkFrames - 1)))
        }
        if (visible && resident.slug && resident.slug === selectedSlug)
          selection.setMatrixAt(selection.count++, transform.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      selection.instanceMatrix.needsUpdate = true
      if (blink) blink.needsUpdate = true
    }
    glowMaterial.opacity = night * 0.9
    lamp.value = night * 0.45
    if (pools) {
      const mesh = pools
      mesh.visible = dark
      if (dark) {
        glowItems.forEach(({ resident, ahead, width, depth }, index) => {
          const { x, z, yaw } = resident.pose
          const shown = !!resident.slug && !!visibleSlugs?.has(resident.slug)
          // Swimmers light the water surface; lifted residents leave the light on the ground.
          const y =
            resident.water !== undefined
              ? resident.water + 0.6
              : townGroundHeight(x, z) + pavementHeight + 1
          transform.position.set(x + Math.sin(yaw) * ahead, y, z + Math.cos(yaw) * ahead)
          transform.rotation.set(0, yaw, 0)
          transform.scale.set(shown ? width : 0, 1, shown ? depth : 0)
          transform.updateMatrix()
          mesh.setMatrixAt(index, transform.matrix)
        })
        mesh.instanceMatrix.needsUpdate = true
      }
    }
  }

  return {
    group,
    rebuild,
    update,
    get batches() {
      return batches
    },
    dispose() {
      clear()
      for (const geometry of Object.values(geometries)) geometry.dispose()
      glowGeometry.dispose()
      glowTexture.dispose()
      gradient.dispose()
      softGradient.dispose()
      faceTexture.dispose()
      for (const material of [
        personMaterial,
        skinMaterial,
        faceMaterial,
        vehicleMaterial,
        lightMaterial,
        neonMaterial,
        xrayMaterial,
        glowMaterial
      ])
        material.dispose()
    }
  }
}
