import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial
} from 'three'
import { palette } from './town-buildings'
import type { TownMaterials } from './town-materials'
import { createTownBuilder, face, surface, type TownBuilder } from './town-mesh-builder'
import { plazaFountain, windmillPosition } from './town-static'
import { lighthouse, quayEdge, railEnds, railway, station, waterLevel } from './town-world'

// Things that move on their own: the train, boats, gulls, the windmill and the
// lighthouse beam. They are deterministic functions of the scene clock.

function ease(value: number, kind: 'in' | 'out') {
  const t = Math.max(0, Math.min(1, value))
  return kind === 'in' ? t * t : 1 - (1 - t) * (1 - t)
}

const westEnd = railEnds[0] - 300
const eastEnd = railEnds[1] + 300
const legs = [
  { from: westEnd, to: station.x, duration: 26, ease: 'out' as const },
  { from: station.x, to: station.x, duration: 7 },
  { from: station.x, to: eastEnd, duration: 22, ease: 'in' as const },
  { from: eastEnd, to: eastEnd, duration: 10 },
  { from: eastEnd, to: station.x, duration: 22, ease: 'out' as const },
  { from: station.x, to: station.x, duration: 7 },
  { from: station.x, to: westEnd, duration: 26, ease: 'in' as const },
  { from: westEnd, to: westEnd, duration: 10 }
]
const trainPeriod = legs.reduce((sum, leg) => sum + leg.duration, 0)

// The train shuttles between the two tunnels and stops at the station each way.
export function trainPosition(seconds: number) {
  let time = ((seconds % trainPeriod) + trainPeriod) % trainPeriod
  for (const leg of legs) {
    if (time <= leg.duration) {
      const progress = leg.ease ? ease(time / leg.duration, leg.ease) : 0
      return { x: leg.from + (leg.to - leg.from) * progress, heading: leg.to < leg.from ? -1 : 1 }
    }
    time -= leg.duration
  }
  return { x: westEnd, heading: 1 }
}

function compile(materials: TownMaterials, draw: (b: TownBuilder) => void) {
  const b = createTownBuilder(Number.POSITIVE_INFINITY, materials.atlas.white)
  draw(b)
  const group = new Group()
  for (const chunk of b.build()) {
    const mesh = new Mesh(chunk.geometry, materials.town)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  return group
}

function coach(b: TownBuilder, locomotive: boolean) {
  const length = 190
  const body = locomotive ? 0x3f8f87 : 0xf3ead8
  const stripe = locomotive ? 0xf3ead8 : 0x3f8f87
  b.box(0, 18, 0, length - 10, 10, 50, 0x3d3a4a)
  for (const x of [-length / 2 + 40, length / 2 - 40]) {
    b.box(x, 14, 0, 50, 12, 58, 0x2e2a35)
    for (const side of [-1, 1])
      for (const dx of [-14, 14])
        b.cylinder(x + dx, 13, side * 24, 10, 6, 0x2e2a35, { rx: Math.PI / 2, segments: 10 })
  }
  b.box(0, 58, 0, length, 70, 66, body)
  b.box(0, 44, 0, length + 1, 8, 67, stripe)
  b.cylinder(0, 92, 0, 34, length - 6, locomotive ? 0x2f6b66 : 0xd85a4c, {
    rz: Math.PI / 2,
    arc: Math.PI,
    radiusZ: 34,
    segments: 12
  })
  for (const side of [-1, 1]) {
    b.frame(0, side * 33, side > 0 ? 0 : Math.PI, () => {
      const windows = locomotive ? 3 : 6
      for (let index = 0; index < windows; index++) {
        const x = -length / 2 + 30 + index * ((length - 60) / (windows - 1))
        b.box(locomotive ? x * 0.5 - 20 : x, 70, 0.8, 22, 22, 1, palette.glass, {
          faces: face.pz,
          glow: 0.9
        })
      }
      b.box(locomotive ? 50 : length / 2 - 12, 52, 0.8, 18, 52, 1, 0x2f6b66, { faces: face.pz })
    })
  }
  if (locomotive) {
    b.box(length / 2 - 6, 60, 0, 14, 60, 60, 0x2f6b66)
    b.box(length / 2 + 1, 74, 0, 2, 22, 46, palette.glass, { faces: face.px, glow: 0.4 })
    for (const side of [-1, 1])
      b.box(length / 2 + 1.5, 38, side * 18, 2, 8, 10, 0xfff1c2, { glow: -1.5, faces: face.px })
    b.box(0, 118, 0, 20, 10, 6, 0x3d3a4a)
    b.box(0, 134, 0, 50, 3, 3, 0x3d3a4a)
  }
}

function boat(b: TownBuilder, color: number, sail: boolean) {
  b.box(0, 10, -10, 52, 24, 96, color)
  b.cylinder(0, 10, 38, 26, 24, color, { segments: 3 })
  b.box(0, 23, 0, 54, 3, 140, palette.trim)
  b.box(0, 22.5, -4, 44, 1, 110, palette.wood, { surface: surface.planks })
  if (sail) {
    b.cylinder(0, 120, 10, 2.5, 210, palette.trim)
    b.prism(0, 30, -24, 4, 180, 70, 0xfbf8ef)
    b.box(0, 34, -24, 3, 3, 66, palette.trim)
  } else {
    b.box(0, 44, -18, 40, 40, 40, palette.trim)
    b.box(0, 50, 2.5, 34, 14, 1, palette.glass, { faces: face.pz, glow: 0.8 })
    b.box(0, 66, -18, 46, 4, 46, color)
    b.cylinder(0, 96, -18, 2, 60, palette.frame)
    b.box(0, 30, -50, 20, 14, 14, 0xf2c94c)
  }
}

export function createTownAmbient(materials: TownMaterials) {
  const group = new Group()
  group.name = 'town-ambient'
  const disposables: { dispose(): void }[] = []

  const cars = [0, 1, 2].map((index) => {
    const car = compile(materials, (b) => coach(b, index === 0))
    group.add(car)
    return car
  })

  const moored = [
    { x: 590, z: quayEdge + 220, color: 0xe8574f, sail: false },
    { x: 810, z: quayEdge + 360, color: 0x4d7be0, sail: true },
    { x: 1790, z: quayEdge + 180, color: 0xf2c94c, sail: false },
    { x: 2010, z: quayEdge + 330, color: 0x3e8f84, sail: true },
    { x: 2600, z: quayEdge + 260, color: 0xfbf8ef, sail: false }
  ].map((spec, index) => {
    const mesh = compile(materials, (b) => boat(b, spec.color, spec.sail))
    mesh.position.set(spec.x, waterLevel + 2, spec.z)
    mesh.rotation.y = index % 2 ? 0.08 : -0.06
    group.add(mesh)
    return { mesh, phase: index * 1.7 }
  })
  const sailboat = compile(materials, (b) => boat(b, 0x9a72d6, true))
  sailboat.scale.setScalar(1.3)
  group.add(sailboat)

  const sails = compile(materials, (b) => {
    for (let blade = 0; blade < 4; blade++) {
      const angle = (blade / 4) * Math.PI * 2
      const x = Math.sin(angle)
      const y = Math.cos(angle)
      b.box(x * 80, y * 80, 0, 6, 160, 4, palette.wood, { rz: -angle })
      b.box(x * 92 + y * 14, y * 92 - x * 14, 2, 30, 130, 1.5, 0xf6f1e4, {
        rz: -angle,
        faces: face.pz | face.nz
      })
    }
    b.cylinder(0, 0, -6, 14, 18, palette.frame, { rx: Math.PI / 2, segments: 10 })
  })
  sails.position.set(
    windmillPosition.x,
    windmillPosition.y + windmillPosition.hub.y,
    windmillPosition.z + windmillPosition.hub.z
  )
  group.add(sails)

  const balloon = compile(materials, (b) => {
    const rings = [
      [0, 30],
      [24, 70],
      [56, 98],
      [92, 108],
      [128, 102],
      [160, 82],
      [186, 50],
      [200, 18]
    ]
    const colors = [0xe8574f, 0xf2c94c, 0x4d7be0, 0xfbf8ef]
    for (let index = 1; index < rings.length; index++) {
      const [y0, r0] = rings[index - 1]
      const [y1, r1] = rings[index]
      b.cylinder(0, 80 + (y0 + y1) / 2, 0, r0, y1 - y0, colors[index % colors.length], {
        top: r1 / r0,
        segments: 16
      })
    }
    b.box(0, 26, 0, 40, 30, 40, 0x9b6a4a, { surface: surface.planks })
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) b.box(sx * 22, 60, sz * 22, 1.5, 60, 1.5, palette.frame)
  })
  group.add(balloon)

  // Gulls glide in loose circles over the harbor, flapping now and then.
  const gullMaterial = new MeshLambertMaterial({ color: 0xfafafa })
  const gullWing = new BoxGeometry(34, 2, 12).translate(17, 0, 0)
  const gullBody = new BoxGeometry(8, 7, 24)
  disposables.push(gullMaterial, gullWing, gullBody)
  const gulls = Array.from({ length: 7 }, (_, index) => {
    const bird = new Group()
    const body = new Mesh(gullBody, gullMaterial)
    const left = new Mesh(gullWing, gullMaterial)
    const right = new Mesh(gullWing, gullMaterial)
    right.scale.x = -1
    bird.add(body, left, right)
    bird.scale.setScalar(0.7)
    group.add(bird)
    return {
      bird,
      left,
      right,
      phase: index * 0.9,
      radius: 260 + index * 70,
      height: 360 + (index % 3) * 60
    }
  })

  const beamMaterial = new MeshBasicMaterial({
    color: 0xfff1b8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending
  })
  const beamGeometry = new ConeGeometry(110, 1000, 16, 1, true)
    .translate(0, -500, 0)
    .rotateZ(Math.PI / 2)
  disposables.push(beamMaterial, beamGeometry)
  const beam = new Mesh(beamGeometry, beamMaterial)
  beam.position.set(lighthouse.x, 374, lighthouse.z)
  beam.renderOrder = 3
  beam.visible = false
  group.add(beam)

  const jetMaterial = new MeshLambertMaterial({ color: 0xd8f3ff, transparent: true, opacity: 0.75 })
  const jetGeometry = new CylinderGeometry(0.5, 1, 1, 8)
  disposables.push(jetMaterial, jetGeometry)
  const jets = Array.from({ length: 7 }, (_, index) => {
    const jet = new Mesh(jetGeometry, jetMaterial)
    const angle = (index / 6) * Math.PI * 2
    jet.position.set(
      plazaFountain.x + (index ? Math.cos(angle) * 30 : 0),
      0,
      plazaFountain.z + (index ? Math.sin(angle) * 30 : 0)
    )
    group.add(jet)
    return { jet, index }
  })

  return {
    group,
    update(seconds: number, night: number) {
      const train = trainPosition(seconds)
      for (const [index, car] of cars.entries()) {
        const x = train.x - train.heading * index * 196
        car.position.set(x, 0, railway)
        car.rotation.y = train.heading > 0 ? 0 : Math.PI
        car.visible = x > railEnds[0] + 60 && x < railEnds[1] - 60
      }
      for (const { mesh, phase } of moored) {
        mesh.position.y = waterLevel + 2 + Math.sin(seconds * 1.3 + phase) * 2.5
        mesh.rotation.z = Math.sin(seconds * 1.1 + phase) * 0.04
        mesh.rotation.x = Math.sin(seconds * 0.9 + phase * 2) * 0.025
      }
      const sailAngle = seconds * 0.035
      sailboat.position.set(
        2700 + Math.cos(sailAngle) * 1300,
        waterLevel + 2 + Math.sin(seconds * 1.2) * 3,
        4700 + Math.sin(sailAngle) * 520
      )
      sailboat.rotation.set(
        0,
        Math.atan2(-Math.sin(sailAngle) * 1300, Math.cos(sailAngle) * 520),
        Math.sin(seconds * 0.8) * 0.06
      )
      sails.rotation.z = -seconds * 0.6
      const drift = seconds * 0.012
      balloon.position.set(
        2200 + Math.cos(drift) * 1600,
        1150 + Math.sin(seconds * 0.2) * 30,
        -1700 + Math.sin(drift) * 900
      )
      for (const gull of gulls) {
        const angle = seconds * (0.22 + gull.phase * 0.02) + gull.phase
        const cx = 1500 + Math.sin(gull.phase) * 500
        gull.bird.position.set(
          cx + Math.cos(angle) * gull.radius,
          gull.height + Math.sin(seconds * 0.7 + gull.phase) * 20,
          quayEdge + 350 + Math.sin(angle) * gull.radius * 0.6
        )
        gull.bird.rotation.set(0, -angle, 0.25)
        const flap =
          Math.sin(seconds * 9 + gull.phase) *
          (Math.sin(seconds * 0.4 + gull.phase) > 0.3 ? 0.6 : 0.12)
        gull.left.rotation.z = flap + 0.15
        gull.right.rotation.z = -flap - 0.15
      }
      beam.visible = night > 0.05
      beamMaterial.opacity = night * 0.22
      beam.rotation.y = seconds * 0.8
      for (const { jet, index } of jets) {
        const height = index
          ? 34 + Math.sin(seconds * 3 + index) * 6
          : 80 + Math.sin(seconds * 2.2) * 10
        jet.scale.set(index ? 4 : 7, height, index ? 4 : 7)
        jet.position.y = (index ? 66 : 96) + height / 2
        if (index)
          jet.rotation.set(
            Math.sin((index / 6) * Math.PI * 2) * 0.5,
            0,
            -Math.cos((index / 6) * Math.PI * 2) * 0.5
          )
      }
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh && object.material === materials.town) object.geometry.dispose()
      })
      for (const item of disposables) item.dispose()
    }
  }
}
