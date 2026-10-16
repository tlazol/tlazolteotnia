import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  Float32BufferAttribute,
  LatheGeometry,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  TorusGeometry,
  Vector2
} from 'three'
import { coastColumns, coastStep } from './town-coast'
import {
  createPersonFaceTexture,
  createPersonGeometries,
  personBlinkFrames
} from './town-person-geometry'
import { townTerrain } from './town-terrain'

function shadeFaces(geometry: BufferGeometry) {
  const normals = geometry.getAttribute('normal')
  const shades = new Float32Array(normals.count * 3)
  for (let i = 0; i < normals.count; i++) {
    // The main faces retain the sampled color; only side faces have a fixed shade.
    const shade =
      normals.getX(i) > 0.9 ? 0.72 : normals.getX(i) > 0.25 && normals.getY(i) > 0.1 ? 0.84 : 1
    shades.set([shade, shade, shade], i * 3)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(shades, 3))
}

// Small repeating tiles keep surface detail on a deliberate pixel grid.
function tileTexture(kind: 'grass' | 'roof') {
  const pixels = new Uint8Array(16 * 16 * 4)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const seam = y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0
      const tuft =
        (y === 3 && (x === 2 || x === 4)) ||
        (y === 4 && x === 3) ||
        (y === 10 && (x === 10 || x === 12)) ||
        (y === 11 && x === 11)
      const course = Math.floor(y / 4)
      const tile = Math.floor((x + (course % 2) * 4) / 8)
      const tileTone = 242 - ((tile * 7 + course * 13) % 3) * 9
      const value = kind === 'roof' ? (seam ? 165 : y % 4 === 0 ? 255 : tileTone) : tuft ? 206 : 255
      const index = (y * 16 + x) * 4
      pixels.set([value, value, value, 255], index)
    }
  }
  const texture = new DataTexture(pixels, 16, 16, RGBAFormat)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  // Small grass patches repeat the tile below pixel size; mipmaps prevent shimmer.
  texture.minFilter = kind === 'grass' ? LinearMipmapLinearFilter : NearestFilter
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(kind === 'roof' ? 3 : 375, kind === 'roof' ? 3 : 375)
  texture.generateMipmaps = kind === 'grass'
  texture.needsUpdate = true
  return texture
}

function treeGeometry() {
  // Revolve the stepped crown so the foliage has volume from every camera angle.
  const profile = [
    [0, -0.8],
    [0.5, -0.8],
    [0.5, -0.6],
    [0.8, -0.6],
    [0.8, -0.3],
    [1, -0.3],
    [1, 0.4],
    [0.8, 0.4],
    [0.8, 0.7],
    [0.5, 0.7],
    [0.5, 0.9],
    [0, 0.9]
  ]
  const geometry = new LatheGeometry(
    profile.map(([radius, y]) => new Vector2(radius, y)),
    8
  )
    .rotateY(Math.PI / 8)
    .toNonIndexed()
  geometry.computeVertexNormals()
  return geometry
}

function roofGeometry() {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5],
      3
    )
  )
  geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3])
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute([0, 0, 1, 0, 0.5, 0, 0, 1, 1, 1, 0.5, 1], 2)
  )
  const flat = geometry.toNonIndexed()
  geometry.dispose()
  flat.computeVertexNormals()
  return flat
}

function landGeometry() {
  const positions: number[] = []
  const uvs: number[] = []
  const tints: number[] = []
  const tint = new Color()
  for (const { x, north, south } of coastColumns) {
    const left = x - coastStep / 2
    const right = x + coastStep / 2
    for (let z = north; z < south; z += coastStep) {
      const bottom = Math.min(z + coastStep, south)
      tint.setHex(townTerrain(x, (z + bottom) / 2).ground)
      for (const [px, pz] of [
        [left, z],
        [left, bottom],
        [right, z],
        [right, z],
        [left, bottom],
        [right, bottom]
      ]) {
        positions.push(px, -1, pz)
        // Keep the repeating pixel texture continuous across seasonal boundaries.
        uvs.push(px / 30000, pz / 30000)
        tints.push(tint.r, tint.g, tint.b)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(tints, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function createTownSceneResources() {
  const geometries = {
    box: new BoxGeometry(1, 1, 1),
    ...createPersonGeometries(),
    disc: new CylinderGeometry(0.5, 0.5, 1, 20),
    wheel: new TorusGeometry(0.5, 0.09, 4, 12).rotateY(Math.PI / 2),
    ground: new BoxGeometry(1, 1, 1),
    land: landGeometry(),
    roof: roofGeometry(),
    gable: roofGeometry(),
    tree: treeGeometry()
  }
  for (const [shape, geometry] of Object.entries(geometries)) {
    if (shape !== 'land' && !shape.startsWith('girl')) shadeFaces(geometry)
    geometry.computeBoundingBox()
  }
  const material = new MeshBasicMaterial({ vertexColors: true })
  const faceTexture = createPersonFaceTexture()
  const faceMaterial = new MeshBasicMaterial({
    map: faceTexture,
    transparent: true,
    alphaTest: 0.02
  })
  // Each face selects its own eyelid row while sharing the same texture and draw call.
  faceMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float blinkFrame;\n${shader.vertexShader}`.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>\nvMapUv.y = (vMapUv.y + blinkFrame) / ${personBlinkFrames.toFixed(1)};`
    )
  }
  const grassTexture = tileTexture('grass')
  const roofTexture = tileTexture('roof')
  const grassMaterial = new MeshBasicMaterial({ map: grassTexture, vertexColors: true })
  const roofMaterial = new MeshBasicMaterial({ map: roofTexture, vertexColors: true })
  return {
    geometries,
    material,
    faceMaterial,
    grassMaterial,
    roofMaterial,
    dispose() {
      for (const geometry of Object.values(geometries)) geometry.dispose()
      material.dispose()
      faceMaterial.dispose()
      faceTexture.dispose()
      grassMaterial.dispose()
      roofMaterial.dispose()
      grassTexture.dispose()
      roofTexture.dispose()
    }
  }
}
