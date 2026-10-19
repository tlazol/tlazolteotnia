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
  MeshLambertMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  ShaderChunk,
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
    // White vertex colors preserve instance tints without baking a light direction.
    if (shape !== 'land') {
      const colors = new Float32Array(geometry.getAttribute('position').count * 3).fill(1)
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    }
    geometry.computeBoundingBox()
  }
  const material = new MeshLambertMaterial({ vertexColors: true })
  // Three discrete light bands, shared by skin, hair, clothes and facial features.
  const personGradient = new DataTexture(new Uint8Array([45, 130, 255]), 3, 1, RedFormat)
  personGradient.minFilter = personGradient.magFilter = NearestFilter
  personGradient.needsUpdate = true
  const personMaterial = new MeshToonMaterial({
    vertexColors: true,
    gradientMap: personGradient
  })
  const faceTexture = createPersonFaceTexture()
  const faceMaterial = new MeshToonMaterial({
    gradientMap: personGradient,
    map: faceTexture,
    transparent: true,
    alphaTest: 0.02
  })
  for (const toonMaterial of [personMaterial, faceMaterial]) {
    toonMaterial.onBeforeCompile = (shader) => {
      // Keep the time-of-day fill light uniform so it cannot soften the cel bands.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_pars_begin>',
        ShaderChunk.lights_pars_begin.replace(
          'float hemiDiffuseWeight = 0.5 * dotNL + 0.5;',
          'float hemiDiffuseWeight = 0.5;'
        )
      )
    }
  }
  // Each face selects its own eyelid row while sharing the same texture and draw call.
  const compileFaceLighting = faceMaterial.onBeforeCompile
  faceMaterial.onBeforeCompile = (shader, renderer) => {
    compileFaceLighting.call(faceMaterial, shader, renderer)
    shader.vertexShader = `attribute float blinkFrame;\n${shader.vertexShader}`.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>\nvMapUv.y = (vMapUv.y + blinkFrame) / ${personBlinkFrames.toFixed(1)};`
    )
  }
  const grassTexture = tileTexture('grass')
  const roofTexture = tileTexture('roof')
  const grassMaterial = new MeshLambertMaterial({ map: grassTexture, vertexColors: true })
  const roofMaterial = new MeshLambertMaterial({ map: roofTexture, vertexColors: true })
  const windowMaterial = new MeshLambertMaterial({ emissive: 0xffbc68, emissiveIntensity: 0 })
  const lampMaterial = new MeshLambertMaterial({ emissive: 0xffcf83, emissiveIntensity: 0 })
  const lampGlowMaterial = new MeshBasicMaterial({
    color: 0xffcf83,
    transparent: true,
    opacity: 0,
    depthWrite: false
  })
  lampGlowMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec2 glowUv;\n${shader.vertexShader}`.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\nglowUv = uv;'
    )
    shader.fragmentShader = `varying vec2 glowUv;\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.a *= pow(max(0.0, 1.0 - length(glowUv - 0.5) * 2.0), 2.0);'
    )
  }
  return {
    windowMaterial,
    lampMaterial,
    lampGlowMaterial,
    geometries,
    material,
    personMaterial,
    faceMaterial,
    grassMaterial,
    roofMaterial,
    dispose() {
      for (const geometry of Object.values(geometries)) geometry.dispose()
      material.dispose()
      personMaterial.dispose()
      personGradient.dispose()
      windowMaterial.dispose()
      lampMaterial.dispose()
      lampGlowMaterial.dispose()
      faceMaterial.dispose()
      faceTexture.dispose()
      grassMaterial.dispose()
      roofMaterial.dispose()
      grassTexture.dispose()
      roofTexture.dispose()
    }
  }
}
