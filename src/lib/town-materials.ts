import {
  AdditiveBlending,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  LinearFilter,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type PixelFormat,
  RedFormat,
  RGBAFormat
} from 'three'
import { createTownAtlas } from './town-atlas'
import { contactMap, groundMapBounds, heightRange, shoreMap } from './town-ground-maps'
import { halloweenColor, townHalloween } from './town-halloween'
import { shoreColors } from './town-static'
import { coastDistanceField, coastTextureBounds } from './town-world'

const noiseChunk = /* glsl */ `
  float townHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float townNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(townHash(i), townHash(i + vec2(1.0, 0.0)), u.x),
      mix(townHash(i + vec2(0.0, 1.0)), townHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
`

// Surface ids match `surface` in town-mesh-builder.
const patternChunk = /* glsl */ `
  float townAlong(vec3 p, vec3 n) {
    return abs(n.x) > 0.5 ? p.z : p.x;
  }
  // Meadow mottling at several scales: sunburnt swathes, lush hollows,
  // clumps and a fine grain, so open ground never reads as a flat fill.
  vec3 townMeadow(vec2 p, vec3 color, float amount) {
    float large = townNoise(p / 640.0);
    float medium = townNoise(p / 170.0 + 3.0);
    float clump = townNoise(p / 34.0 + 17.0);
    color = mix(color, color * vec3(1.16, 1.07, 0.72), smoothstep(0.42, 0.85, large) * 0.6 * amount);
    color = mix(color, color * vec3(0.78, 0.9, 0.82), smoothstep(0.55, 0.15, medium) * 0.55 * amount);
    return color * (1.0 + amount * (0.1 * clump - 0.07 + 0.04 * townHash(floor(p / 6.0))));
  }
  vec3 townPattern(float id, vec3 p, vec3 n, vec3 color, vec4 shore) {
    int kind = int(id + 0.5);
    float k = 1.0;
    if (kind == 1) {
      vec2 grid = p.xz / 36.0;
      vec2 f = fract(grid);
      float joint = max(step(f.x, 0.05), step(f.y, 0.05));
      k = (0.95 + 0.08 * townHash(floor(grid))) * (1.0 - 0.13 * joint);
    } else if (kind == 2) {
      k = 0.93 + 0.08 * townNoise(p.xz / 120.0) + 0.05 * townHash(floor(p.xz / 4.0));
    } else if (kind == 3) {
      // Tended lawns: gentle mottling under broad mowing stripes.
      color = townMeadow(p.xz, color, 0.55);
      k = 1.0 + 0.045 * (step(0.5, fract((p.x - p.z) / 96.0)) * 2.0 - 1.0);
    } else if (kind == 4) {
      float course = floor(p.y / 8.0);
      float column = fract((p.x + p.z) / 15.0 + course * 0.5);
      k = (1.0 - 0.2 * step(fract(p.y / 8.0), 0.2)) * (1.0 - 0.1 * step(column, 0.09));
      k *= 0.94 + 0.1 * townHash(vec2(floor((p.x + p.z) / 15.0 + course * 0.5), course));
    } else if (kind == 5) {
      float row = floor(p.y / 9.0);
      float along = townAlong(p, n) / 22.0 + mod(row, 2.0) * 0.5;
      float mortar = max(step(fract(p.y / 9.0), 0.15), step(fract(along), 0.07));
      if (abs(n.y) > 0.5) mortar = 0.0;
      color *= 0.9 + 0.18 * townHash(vec2(floor(along), row));
      color = mix(color, vec3(0.62, 0.58, 0.52), mortar * 0.75);
    } else if (kind == 6) {
      k = abs(n.y) > 0.5 ? 1.0 : 1.0 - 0.14 * step(fract(p.y / 11.0), 0.17);
    } else if (kind == 7) {
      float board = floor(p.z / 14.0);
      k = (0.9 + 0.14 * townHash(vec2(board, floor(p.x / 140.0 + board * 0.37))));
      k *= 1.0 - 0.2 * step(fract(p.z / 14.0), 0.1);
    } else if (kind == 8) {
      k = 0.95 + 0.06 * townNoise(p.xz / 70.0) + 0.05 * townHash(floor(p.xz / 3.0));
    } else if (kind == 9) {
      float row = fract(p.z / 24.0);
      k = 0.8 + 0.32 * smoothstep(0.1, 0.45, row) * (1.0 - smoothstep(0.55, 0.9, row));
      k *= 0.93 + 0.12 * townNoise(p.xz / 60.0);
    } else if (kind == 10) {
      vec2 cell = abs(n.y) > 0.5 ? p.xz / vec2(34.0, 24.0) : vec2(townAlong(p, n) / 34.0, p.y / 18.0);
      cell.x += mod(floor(cell.y), 2.0) * 0.5;
      vec2 f = fract(cell);
      float joint = max(step(f.x, 0.06), step(f.y, 0.1));
      k = (0.88 + 0.16 * townHash(floor(cell))) * (1.0 - 0.22 * joint);
    } else if (kind == 11) {
      float wave = sin(dot(p.xz, vec2(0.05, 0.03)) + uTime * 1.6 + townNoise(p.xz / 50.0) * 6.0);
      k = 0.94 + 0.08 * wave;
      color = mix(color, vec3(1.0), step(0.96, wave) * 0.4);
    } else if (kind == 12) {
      k = 0.88 + 0.14 * step(0.5, fract(townAlong(p, n) / 9.0));
    } else if (kind == 13) {
      k = 0.82 + 0.3 * townHash(floor(p.xz / 5.0));
    } else if (kind == 14) {
      color = townMeadow(p.xz, color, 1.0);
      // The shore map's margins are smooth, so the beach edge is a curve rather
      // than the terrain's triangles; noise frays it into dunes and tide lines.
      float wobble = (townNoise(p.xz / 150.0) - 0.5) * 0.32 + (townNoise(p.xz / 38.0 + 9.0) - 0.5) * 0.12;
      // Keep the edge a couple of pixels wide however gently the margin changes.
      float edge = shore.r + wobble - 0.5;
      float width = max(fwidth(edge) * 1.5, 0.008);
      float sandK = smoothstep(-width, width, edge);
      float wetK = smoothstep(0.44, 0.56, shore.g + wobble * 0.5);
      vec3 sand = mix(uSand, uWetSand, wetK);
      sand *= 0.95 + 0.06 * townNoise(p.xz / 70.0) + 0.05 * townHash(floor(p.xz / 3.0));
      float rim = smoothstep(0.36, 0.5, shore.r + wobble) * (1.0 - sandK);
      color = mix(color * (1.0 - 0.12 * rim), sand, sandK);
    } else if (kind == 15) {
      // Bedded rock: wavering strata with lighter ledges and weathered streaks.
      float bed = p.y / 16.0 + townNoise(p.xz / 180.0) * 2.5;
      float ledge = smoothstep(0.75, 0.95, fract(bed));
      k = (0.88 + 0.12 * townHash(vec2(floor(bed), 3.0))) * (1.0 + 0.1 * ledge);
      k *= 0.92 + 0.12 * townNoise(vec2(townAlong(p, n) / 14.0, p.y / 70.0));
    }
    return color * k;
  }
`

export function radialTexture() {
  const size = 64
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      const alpha = Math.max(0, 1 - distance) ** 1.6
      pixels.set([255, 255, 255, Math.round(alpha * 255)], (y * size + x) * 4)
    }
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat)
  texture.magFilter = texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

function dataTexture(data: Uint8Array, width: number, height: number, format: PixelFormat) {
  const texture = new DataTexture(data, width, height, format)
  texture.magFilter = texture.minFilter = LinearFilter
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping
  texture.unpackAlignment = 1
  texture.needsUpdate = true
  return texture
}

export function createTownMaterials() {
  const shore = shoreMap()
  const uniforms = {
    uTime: { value: 0 },
    uShore: { value: dataTexture(shore.data, shore.width, shore.height, RGBAFormat) },
    // Filled in once the static town knows where everything stands.
    uContact: { value: dataTexture(new Uint8Array(1), 1, 1, RedFormat) },
    uGroundBounds: {
      value: [groundMapBounds.x, groundMapBounds.z, groundMapBounds.width, groundMapBounds.depth]
    },
    uSand: { value: new Color(halloweenColor(shoreColors.sand)) },
    uWetSand: { value: new Color(halloweenColor(shoreColors.wetSand)) },
    uNight: { value: 0 },
    uCloud: { value: 0.3 },
    uCoast: { value: null as DataTexture | null },
    uCoastBounds: {
      value: [coastTextureBounds.x, coastTextureBounds.z, coastTextureBounds.size, 0]
    },
    // A violet witch's sea on Halloween.
    uShallow: { value: new Color(townHalloween ? 0x9a78d8 : 0x74dcd2) },
    uDeep: { value: new Color(townHalloween ? 0x3a2470 : 0x2a7bb6) }
  }
  const atlas = createTownAtlas()
  const town = new MeshLambertMaterial({ vertexColors: true, map: atlas.texture })
  town.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uNight = uniforms.uNight
    shader.uniforms.uCloud = uniforms.uCloud
    shader.uniforms.uShore = uniforms.uShore
    shader.uniforms.uContact = uniforms.uContact
    shader.uniforms.uGroundBounds = uniforms.uGroundBounds
    shader.uniforms.uSand = uniforms.uSand
    shader.uniforms.uWetSand = uniforms.uWetSand
    shader.vertexShader = `attribute vec3 townExtra;
varying vec3 vTownExtra;
varying vec3 vTownWorld;
uniform float uTime;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      vTownExtra = townExtra;
      if (townExtra.z > 0.0) {
        vec4 swayBase = modelMatrix * vec4(transformed, 1.0);
        float phase = swayBase.x * 0.0041 + swayBase.z * 0.0027;
        float gust = 0.65 + 0.35 * sin(uTime * 0.37 + phase * 0.5);
        transformed.x += sin(uTime * 1.7 + phase) * townExtra.z * gust;
        transformed.z += cos(uTime * 1.3 + phase * 1.4) * townExtra.z * 0.6 * gust;
      }
      vTownWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    )
    shader.fragmentShader = `varying vec3 vTownExtra;
varying vec3 vTownWorld;
uniform float uTime;
uniform float uNight;
uniform float uCloud;
uniform sampler2D uShore;
uniform sampler2D uContact;
uniform vec4 uGroundBounds;
uniform vec3 uSand;
uniform vec3 uWetSand;
${noiseChunk}
${patternChunk}
${shader.fragmentShader}`
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 townFaceNormal = normalize(cross(dFdx(vTownWorld), dFdy(vTownWorld)));
        vec2 townGroundUv = (vTownWorld.xz - uGroundBounds.xy) / uGroundBounds.zw;
        vec4 townShore = texture2D(uShore, townGroundUv);
        diffuseColor.rgb = townPattern(vTownExtra.x, vTownWorld, townFaceNormal, diffuseColor.rgb, townShore);
        // Baked contact shadows: walls darken towards their footing and the
        // ground darkens around whatever stands on it.
        float townAbove = vTownWorld.y - mix(${heightRange.min.toFixed(1)}, ${heightRange.max.toFixed(1)}, townShore.b);
        float townOcclusion = 1.0;
        if (abs(townFaceNormal.y) < 0.5) {
          // Terrain is its own ground, so only things standing on it are occluded.
          if (int(vTownExtra.x + 0.5) < 14) townOcclusion = mix(0.66, 1.0, smoothstep(0.0, 46.0, townAbove));
        } else if (townAbove < 16.0) {
          townOcclusion = 1.0 - 0.5 * texture2D(uContact, townGroundUv).r;
        }
        diffuseColor.rgb *= townOcclusion;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        if (vTownExtra.y > 0.0) {
          totalEmissiveRadiance += ${townHalloween ? 'vec3(1.0, 0.5, 0.16)' : 'vec3(1.0, 0.62, 0.28)'} * vTownExtra.y * uNight * 1.5;
        } else if (vTownExtra.y < 0.0) {
          totalEmissiveRadiance += diffuseColor.rgb * -vTownExtra.y * mix(${townHalloween ? '0.5' : '0.12'}, 1.5, uNight);
        }`
      )
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        vec2 cloudUv = vTownWorld.xz / 2600.0 + vec2(uTime * 0.011, uTime * 0.005);
        float cloud = townNoise(cloudUv) * 0.65 + townNoise(cloudUv * 2.3 + 7.0) * 0.35;
        reflectedLight.directDiffuse *= 1.0 - smoothstep(0.5, 0.7, cloud) * uCloud;`
      )
  }
  town.customProgramCacheKey = () => 'town-surface'

  const coastSize = 384
  const coast = new DataTexture(coastDistanceField(coastSize), coastSize, coastSize, RedFormat)
  coast.magFilter = coast.minFilter = LinearFilter
  coast.needsUpdate = true
  uniforms.uCoast.value = coast
  const water = new MeshLambertMaterial({ transparent: true, depthWrite: false })
  water.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uCoast = uniforms.uCoast
    shader.uniforms.uCoastBounds = uniforms.uCoastBounds
    shader.uniforms.uShallow = uniforms.uShallow
    shader.uniforms.uDeep = uniforms.uDeep
    shader.vertexShader = `varying vec3 vTownWorld;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vTownWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    )
    shader.fragmentShader = `varying vec3 vTownWorld;
uniform float uTime;
uniform sampler2D uCoast;
uniform vec4 uCoastBounds;
uniform vec3 uShallow;
uniform vec3 uDeep;
${noiseChunk}
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      /* glsl */ `#include <color_fragment>
      vec2 coastUv = (vTownWorld.xz - uCoastBounds.xy) / uCoastBounds.z;
      float coast = texture2D(uCoast, coastUv).r * 1200.0;
      float ripple = townNoise(vTownWorld.xz / 160.0 + vec2(uTime * 0.05, -uTime * 0.03));
      float depthTone = smoothstep(0.0, 1000.0, coast + (ripple - 0.5) * 160.0);
      diffuseColor.rgb = mix(uShallow, uDeep, depthTone);
      float swell = sin(coast * 0.05 - uTime * 1.3 + ripple * 5.0);
      float foam = smoothstep(0.86, 1.0, swell) * (1.0 - smoothstep(20.0, 220.0, coast)) * 0.8;
      foam += 1.0 - smoothstep(4.0, 22.0 + ripple * 28.0, coast);
      vec2 glintCell = floor(vTownWorld.xz / vec2(30.0, 10.0));
      float glint = step(0.992, townHash(glintCell + floor(uTime * 1.5 + townHash(glintCell) * 3.0)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);
      diffuseColor.rgb += glint * smoothstep(120.0, 400.0, coast) * 0.4;
      diffuseColor.a = max(mix(0.5, 0.96, smoothstep(0.0, 300.0, coast)), clamp(foam, 0.0, 1.0));`
    )
  }
  water.customProgramCacheKey = () => 'town-water'

  function setContacts(solids: Parameters<typeof contactMap>[0]) {
    const map = contactMap(solids)
    uniforms.uContact.value.dispose()
    uniforms.uContact.value = dataTexture(map.data, map.width, map.height, RedFormat)
  }

  const glowTexture = radialTexture()
  const pools = new MeshBasicMaterial({
    color: 0xffb35c,
    map: glowTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending
  })

  return {
    uniforms,
    atlas,
    town,
    water,
    pools,
    setContacts,
    dispose() {
      uniforms.uShore.value.dispose()
      uniforms.uContact.value.dispose()
      town.dispose()
      water.dispose()
      pools.dispose()
      glowTexture.dispose()
      coast.dispose()
      atlas.texture.dispose()
    }
  }
}

export type TownMaterials = ReturnType<typeof createTownMaterials>
