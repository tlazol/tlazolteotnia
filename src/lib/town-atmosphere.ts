import {
  BufferGeometry,
  type Camera,
  Color,
  Float32BufferAttribute,
  HalfFloatType,
  LinearSRGBColorSpace,
  Mesh,
  OrthographicCamera,
  type Scene,
  ShaderMaterial,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget
} from 'three'
import { townHalloween } from './town-halloween'

// Aerial perspective. The middle of the view is where the eye rests; the farther
// a point lies from it, the more air stands in between. Distant parts take on the
// color of the air, lose contrast and saturation, and their outlines soften.

// At the corners of the view.
export const townAirStrength = { tint: 0.36, saturation: 0.5, contrast: 0.35, blur: 1 }
// Where the air starts and saturates, as on-screen distance from the middle in
// half-diagonals, so the clear middle stays round on wide and tall screens alike.
export const townAirRange = { start: 0.4, end: 1 }

// The same falloff as the shader, for a point given in pixels from the middle.
export function townAirAmount(x: number, y: number, width: number, height: number) {
  const distance = Math.hypot(x, y) / (Math.hypot(width, height) / 2)
  const t = Math.max(
    0,
    Math.min(1, (distance - townAirRange.start) / (townAirRange.end - townAirRange.start))
  )
  return t * t * (3 - 2 * t)
}

// Colors are applied after the output conversion, so they are kept as sRGB values.
const srgb = (hex: number) => new Color().setHex(hex, LinearSRGBColorSpace)
const airTones = townHalloween
  ? { day: srgb(0xb4a4de), dusk: srgb(0xe09aac), night: srgb(0x281a4d) }
  : { day: srgb(0x8fb6e6), dusk: srgb(0xee9a74), night: srgb(0x1e2a52) }

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

// A quarter-resolution copy averaged over a 4x4 grid of bilinear taps, spread by
// the pixel ratio so the softening is the same size on every screen.
const blurShader = /* glsl */ `
uniform sampler2D uScene;
uniform vec2 uTexel;
uniform float uSpread;
varying vec2 vUv;
void main() {
  vec3 sum = vec3(0.0);
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 offset = (vec2(float(x), float(y)) * 2.0 - 3.0) * uSpread;
      sum += texture2D(uScene, vUv + offset * uTexel).rgb;
    }
  }
  gl_FragColor = vec4(sum / 16.0, 1.0);
}`

const compositeShader = /* glsl */ `
uniform sampler2D uScene;
uniform sampler2D uBlur;
uniform vec2 uBlurTexel;
uniform vec3 uAir;
uniform vec4 uStrength;
uniform vec2 uRange;
uniform vec2 uView;
varying vec2 vUv;
void main() {
  float distance = length((vUv * 2.0 - 1.0) * uView);
  float air = smoothstep(uRange.x, uRange.y, distance);
  vec3 sharp = texture2D(uScene, vUv).rgb;
  vec3 soft = 0.25 * (
    texture2D(uBlur, vUv + uBlurTexel * vec2(0.5, 0.5)).rgb +
    texture2D(uBlur, vUv + uBlurTexel * vec2(-0.5, 0.5)).rgb +
    texture2D(uBlur, vUv + uBlurTexel * vec2(0.5, -0.5)).rgb +
    texture2D(uBlur, vUv + uBlurTexel * vec2(-0.5, -0.5)).rgb
  );
  gl_FragColor = vec4(mix(sharp, soft, clamp(air * uStrength.w, 0.0, 1.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 color = gl_FragColor.rgb;
  const vec3 lumaWeights = vec3(0.2126, 0.7152, 0.0722);
  // Less saturated, then flattened towards the brightness of the air, then tinted by it.
  color = mix(color, vec3(dot(color, lumaWeights)), air * uStrength.y);
  float pivot = dot(uAir, lumaWeights);
  color = (color - pivot) * (1.0 - air * uStrength.z) + pivot;
  color = mix(color, uAir, air * uStrength.x);
  gl_FragColor.rgb = color;
}`

export function createTownAtmosphere() {
  // Linear and unclamped, so tone mapping still happens once, in the final pass.
  const sceneTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 })
  const blurTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })
  const blurMaterial = new ShaderMaterial({
    uniforms: {
      uScene: { value: sceneTarget.texture },
      uTexel: { value: new Vector2() },
      uSpread: { value: 1 }
    },
    vertexShader,
    fragmentShader: blurShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  })
  const compositeMaterial = new ShaderMaterial({
    uniforms: {
      uScene: { value: sceneTarget.texture },
      uBlur: { value: blurTarget.texture },
      uBlurTexel: { value: new Vector2() },
      uAir: { value: new Color() },
      uStrength: {
        value: [
          townAirStrength.tint,
          townAirStrength.saturation,
          townAirStrength.contrast,
          townAirStrength.blur
        ]
      },
      uRange: { value: [townAirRange.start, townAirRange.end] },
      // Width and height over the diagonal, which makes the corners exactly 1.
      uView: { value: new Vector2(1, 1) }
    },
    vertexShader,
    fragmentShader: compositeShader,
    depthTest: false,
    depthWrite: false
  })
  // One triangle covering the whole view.
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
  const screen = new Mesh(geometry, compositeMaterial)
  screen.frustumCulled = false
  const screenCamera = new OrthographicCamera()
  const size = new Vector2()

  return {
    render(
      renderer: WebGLRenderer,
      scene: Scene,
      camera: Camera,
      light: { night: number; warmth: number }
    ) {
      renderer.getDrawingBufferSize(size)
      const width = Math.max(1, size.x)
      const height = Math.max(1, size.y)
      if (sceneTarget.width !== width || sceneTarget.height !== height) {
        sceneTarget.setSize(width, height)
        blurTarget.setSize(Math.ceil(width / 4), Math.ceil(height / 4))
      }
      const output = renderer.getRenderTarget()
      renderer.setRenderTarget(sceneTarget)
      renderer.render(scene, camera)

      blurMaterial.uniforms.uTexel.value.set(1 / width, 1 / height)
      blurMaterial.uniforms.uSpread.value = Math.max(1, renderer.getPixelRatio())
      screen.material = blurMaterial
      renderer.setRenderTarget(blurTarget)
      renderer.render(screen, screenCamera)

      compositeMaterial.uniforms.uBlurTexel.value.set(1 / blurTarget.width, 1 / blurTarget.height)
      const diagonal = Math.hypot(width, height)
      compositeMaterial.uniforms.uView.value.set(width / diagonal, height / diagonal)
      compositeMaterial.uniforms.uAir.value
        .copy(airTones.day)
        .lerp(airTones.dusk, light.warmth)
        .lerp(airTones.night, light.night)
      screen.material = compositeMaterial
      renderer.setRenderTarget(output)
      renderer.render(screen, screenCamera)
    },
    dispose() {
      sceneTarget.dispose()
      blurTarget.dispose()
      blurMaterial.dispose()
      compositeMaterial.dispose()
      geometry.dispose()
    }
  }
}
