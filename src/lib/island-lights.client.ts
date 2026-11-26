import {
  BackSide,
  type BoxGeometry,
  CustomBlending,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  type Texture,
  type Vector4
} from 'three'
import { WORLD_HEIGHT, WORLD_WIDTH } from './island-camera'
import type { LightEmitter } from './island-models'
import { hash2, SEA_LEVEL_CODE } from './island-world'

const FLAME = 1
const EMBER = 2
const FIREFLY = 3
const SMOKE = 4

export type DecorPlacement = { tile: number; x: number; y: number; z: number; scale: number }

// Instance attributes stay fixed between edits. The scene clock moves each particle
// around its model-space emitter in either camera.
export function lightGeometry(
  emitters: LightEmitter[],
  placements: DecorPlacement[],
  campfire: boolean
) {
  const origins: number[] = []
  const particles: number[] = []
  for (const { tile, x, y, z, scale } of placements) {
    emitters.forEach(({ at, size, kind }, i) => {
      const add = (type: number, phase: number, seed: number) => {
        origins.push(x + at[0] * scale, -(y + at[1] * scale), z + at[2] * scale)
        particles.push(type, size * scale, phase, seed)
      }
      const phase = hash2(tile, i, 73)
      if (kind === 'firefly') {
        add(FIREFLY, phase, hash2(tile, i, 17))
        return
      }
      if (campfire && i === 0) {
        for (let p = 0; p < 3; p++) add(SMOKE, phase + p / 3, hash2(tile, p, 45))
      }
      add(FLAME, phase, hash2(tile, i, 29))
      const count = size > 2 ? 3 : 1
      for (let p = 0; p < count; p++) add(EMBER, phase + p / count, hash2(tile, i * 3 + p, 31))
    })
  }
  const geometry = new InstancedBufferGeometry()
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)
  )
  geometry.setAttribute('origin', new InstancedBufferAttribute(new Float32Array(origins), 3))
  geometry.setAttribute('particle', new InstancedBufferAttribute(new Float32Array(particles), 4))
  geometry.instanceCount = origins.length / 3
  return geometry
}

export function lightMaterial(
  time: { value: number },
  night: { value: number },
  depth: Texture,
  artRect: { value: Vector4 }
) {
  return new ShaderMaterial({
    uniforms: { uTime: time, uNight: night, uDepth: { value: depth }, uArtRect: artRect },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      attribute vec3 origin;
      attribute vec4 particle;
      uniform vec4 uArtRect;
      uniform float uTime;
      varying vec2 vPoint;
      varying vec3 vDepthUv;
      varying float vType, vAge, vPhase, vSeed;

      void main() {
        vType = particle.x;
        float size = particle.y;
        vPhase = particle.z;
        vSeed = particle.w;
        float angle = 6.2832 * vSeed;
        vec3 center = origin;
        vec2 radius = vec2(size);
        vPoint = position.xy;
        vAge = 0.0;
        if (vType == ${FLAME}.0) {
          // Keep the foot in the fuel bed and the tip vertical in both cameras.
          center.z += size * (position.y + 1.0) * 2.25;
          radius *= vec2(1.65, 0.0);
        } else if (vType == ${SMOKE}.0) {
          vAge = fract(vPhase + uTime * (0.32 + 0.07 * vSeed));
          center.x += size * (0.4 * sin(angle + vAge * 4.0) + 2.8 * vAge * vAge);
          center.y += size * 0.6 * cos(angle + vAge * 3.0);
          center.z += size * (2.9 + 6.4 * vAge);
          radius *= vec2(0.65 + 1.6 * vAge, 1.45 + vAge);
        } else if (vType == ${EMBER}.0) {
          float cycle = vPhase + uTime * (0.34 + vSeed * 0.18);
          vAge = fract(cycle);
          float drift = sin(angle + floor(cycle) * 2.4);
          center.xy += size * vec2(vAge * (1.2 + drift) + 0.6 * sin(4.0 * vAge + angle),
                                   vAge * drift + 0.4 * cos(5.0 * vAge + angle));
          center.z += size * (2.2 + vAge * (4.0 + 3.0 * vSeed));
          radius = vec2(0.65, 1.05) * (0.65 + 0.45 * vSeed);
        } else {
          float t = uTime * (0.52 + vSeed * 0.27) + 6.2832 * vPhase;
          center += size * vec3(3.9 * sin(t) + 0.8 * sin(2.1 * t + angle),
                                3.2 * cos(0.72 * t + angle), 1.8 * sin(1.31 * t + angle));
          vAge = fract(uTime * (0.23 + vSeed * 0.09) + vPhase);
          radius *= 3.35;
        }
        vec4 eye = viewMatrix * vec4(center, 1.0);
        eye.xy += position.xy * radius;
        vec4 clip = projectionMatrix * eye;
        vDepthUv = vec3((clip.xy + clip.w) * 0.5, clip.w);
        // Draw at display resolution, through the same crop as the pixel-art world.
        clip.xy = 2.0 * (vDepthUv.xy - clip.w * uArtRect.xy) / uArtRect.zw - clip.w;
        gl_Position = clip;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uNight;
      uniform sampler2D uDepth;
      varying vec2 vPoint;
      varying vec3 vDepthUv;
      varying float vType, vAge, vPhase, vSeed;

      // Height and width describe one tongue; the rooted base and folded tip share a contour.
      float tongue(vec2 p, float height, float width, float bend, float t) {
        float h = p.y / height;
        float w = width * pow(max(0.0, 1.0 - h), 0.72) * smoothstep(-0.15, 0.18, h);
        float curl = h * (bend * h + 0.20 * sin(t - h * 6.0));
        return min(w - abs(p.x - curl), 1.6 * min(p.y, height - p.y));
      }

      void main() {
        if (gl_FragCoord.z > texture2DProj(uDepth, vDepthUv).r) discard;
        if (vType == ${FLAME}.0) {
          vec2 p = vec2(vPoint.x, 0.5 + 0.5 * vPoint.y);
          float t = (uTime + 9.0 * vPhase) * (4.1 + vSeed);
          float height = 0.83 + 0.09 * sin(t) + 0.055 * sin(t * 2.37);
          float bend = 0.12 + 0.29 * sin(t * 0.81);
          float body = tongue(p, height, 0.69, bend, t);
          float fork = tongue(p - vec2(-0.29, 0.06), 0.48 + 0.13 * sin(t + 2.3), 0.33, -0.36, t);
          float veil = smoothstep(-0.05, 0.11, max(body, fork));
          float gold = smoothstep(-0.07, 0.20, tongue(p, height * 0.76, 0.44, bend * 0.8, t + 0.6));
          float core = smoothstep(-0.02, 0.19, tongue(p - vec2(-0.04, 0.02),
                                                      height * 0.49, 0.28, -0.12, t));
          float lift = smoothstep(0.0, 0.10, p.y);
          float alpha = lift * (0.60 * veil + 0.20 * gold + 0.12 * core);
          vec3 hue = mix(vec3(0.93, 0.25, 0.07), vec3(1.0, 0.65, 0.24), gold);
          hue = mix(hue, vec3(1.0, 0.92, 0.62), core);
          // A solid orange body holds its silhouette against sunlit sand.
          vec3 emission = lift * (vec3(0.21, 0.064, 0.008) * veil +
                                  vec3(0.14, 0.11, 0.044) * core);
          gl_FragColor = vec4(hue * alpha + emission, alpha);
        } else if (vType == ${SMOKE}.0) {
          float curl = sin(vPoint.y * 2.8 + 5.0 * vAge + vSeed * 6.28);
          float wisp = 1.0 - smoothstep(0.0, 0.52, abs(vPoint.x - 0.45 * curl));
          float alpha = 0.12 * wisp * (1.0 - vPoint.y * vPoint.y) * sin(3.14159 * vAge);
          vec3 color = mix(vec3(0.66, 0.54, 0.43), vec3(0.44, 0.46, 0.50), vAge);
          gl_FragColor = vec4(color * alpha, alpha);
        } else if (vType == ${EMBER}.0) {
          float r = length(vec2(vPoint.x + 0.2 * vPoint.y, vPoint.y));
          float ember = (1.0 - smoothstep(0.05, 1.0, r)) * smoothstep(0.03, 0.18, vAge) *
                        (1.0 - smoothstep(0.52, 0.89, vAge));
          vec3 color = mix(vec3(1.0, 0.81, 0.36), vec3(0.83, 0.28, 0.12), vAge);
          gl_FragColor = vec4(color * ember * 0.82, ember * 0.48);
        } else {
          float pulse = smoothstep(0.08, 0.30, vAge) * (1.0 - smoothstep(0.34, 0.78, vAge));
          float r = length(vPoint);
          float core = (1.0 - smoothstep(0.04, 0.40, r)) * pulse * (0.68 + 0.32 * uNight);
          float rim = pow(max(0.0, 1.0 - r), 2.2) * pulse * pulse * (0.08 + 0.38 * uNight);
          vec3 color = mix(vec3(0.69, 0.80, 0.29), vec3(1.0, 0.98, 0.72), pulse);
          // A dark wing case beside the lit abdomen is just visible at eye level.
          float side = vSeed < 0.5 ? -1.0 : 1.0;
          vec2 wing = (vPoint - vec2(side * 0.28, 0.12)) * vec2(4.5, 7.0);
          float body = (1.0 - smoothstep(0.6, 1.0, length(wing))) * (0.46 - 0.24 * uNight);
          gl_FragColor = vec4(vec3(0.24, 0.27, 0.15) * body + color * core +
                              vec3(0.71, 0.80, 0.28) * rim, 0.45 * core + body * (1.0 - core));
        }
      }
    `
  })
}

// One light volume covers the entire fire, including models with several flame tips.
export function firelightVolumes(
  emitters: LightEmitter[],
  placements: DecorPlacement[],
  box: BoxGeometry,
  material: ShaderMaterial
) {
  const fire = emitters.find((e) => e.kind === 'flame')
  if (!fire) return
  const [dx, dy, dz] = fire.at
  return lightVolumes(
    placements,
    box,
    material,
    [dx, dy, dz + fire.size * 1.25],
    16 + fire.size * 7
  )
}

export function lightVolumes(
  placements: DecorPlacement[],
  box: BoxGeometry,
  material: ShaderMaterial,
  [dx, dy, dz]: [number, number, number],
  reach: number
) {
  const mesh = new InstancedMesh(box, material, placements.length)
  const matrix = new Matrix4()
  placements.forEach(({ x, y, z, scale }, i) => {
    const radius = reach * scale
    matrix
      .makeScale(radius, radius, radius)
      .setPosition(x + dx * scale, -(y + dy * scale), z + dz * scale)
    mesh.setMatrixAt(i, matrix)
  })
  return mesh
}

export function firelightMaterial(
  time: { value: number },
  night: { value: number },
  depth: Texture,
  sceneColor: Texture,
  elevation: Texture,
  inverseProjection: { value: Matrix4 }
) {
  return new ShaderMaterial({
    uniforms: {
      uTime: time,
      uNight: night,
      uDepth: { value: depth },
      uSurface: { value: sceneColor },
      uElevation: { value: elevation },
      uInverseProjection: inverseProjection
    },
    side: BackSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      varying vec3 vCenter;
      varying float vRadius, vPhase;
      void main() {
        vec4 center = instanceMatrix[3];
        vCenter = (viewMatrix * center).xyz;
        vRadius = instanceMatrix[0].x;
        vPhase = dot(center.xy, vec2(0.67, 0.13));
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDepth, uSurface, uElevation;
      uniform mat4 uInverseProjection;
      uniform float uTime, uNight;
      varying vec3 vCenter;
      varying float vRadius, vPhase;
      void main() {
        ivec2 pixel = ivec2(gl_FragCoord.xy);
        float depth = texelFetch(uDepth, pixel, 0).r;
        vec2 ndc = gl_FragCoord.xy / vec2(textureSize(uDepth, 0)) * 2.0 - 1.0;
        vec4 eye = uInverseProjection * vec4(ndc, depth * 2.0 - 1.0, 1.0);
        vec3 surface = eye.xyz / eye.w;
        vec3 toward = vCenter - surface;
        float d = length(toward) / vRadius;
        vec3 normal = cross(dFdx(surface), dFdy(surface));
        if (d >= 1.0 || depth == 1.0) discard;
        float cosine = dot(normal, toward) / max(length(normal) * length(toward), 0.0001);
        float incident = 0.18 + 0.82 * clamp(cosine, 0.0, 1.0);
        float falloff = pow(1.0 - d * d, 2.0) / (1.0 + 5.0 * d * d);
        float flicker = 0.94 + 0.045 * sin(uTime * 5.7 + vPhase) + 0.025 * sin(uTime * 12.3 + vPhase);
        vec3 paint = texelFetch(uSurface, pixel, 0).rgb;
        // Recover the receiver's local pigment under amber light, including its dark grain.
        float energy = incident * falloff * flicker;
        float coverage = energy * uNight * 0.90;
        vec3 warm = (paint + 0.06) * vec3(1.16, 0.82, 0.43);
        vec3 lit = warm * coverage + warm * vec3(1.0, 0.69, 0.26) * energy * (0.07 + 0.27 * uNight);
        // The sea and shallows are at z = 0. Break the reflected lamp into
        // short strokes on the waves; the wooden deck keeps its diffuse light.
        vec3 world = transpose(mat3(viewMatrix)) * surface + cameraPosition;
        vec2 mapUv = world.xy / vec2(${WORLD_WIDTH.toFixed(1)}, -${WORLD_HEIGHT.toFixed(1)});
        if (uNight > 0.0 && abs(world.z) < 0.25 &&
            texture2D(uElevation, mapUv).r * 255.0 < ${(SEA_LEVEL_CODE - 0.5).toFixed(1)}) {
          vec3 eyeDir = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-surface);
          vec3 halfway = normalize(normalize(toward) + eyeDir);
          float specular = max(0.0, dot(viewMatrix[2].xyz, halfway));
          float ripple = sin(world.y * 2.1 + 1.8 * sin(world.x * 0.43) + uTime * 1.7);
          lit += vec3(1.0, 0.56, 0.19) * uNight * pow(specular, 9.0) *
                 smoothstep(-0.30, 0.75, ripple) * (1.0 - d * d);
        }
        gl_FragColor = vec4(lit, coverage);
      }
    `
  })
}
