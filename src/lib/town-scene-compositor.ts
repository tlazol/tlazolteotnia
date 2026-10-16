import {
  Color,
  DepthTexture,
  FloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget
} from 'three'
import type { SceneSize } from './scene-math'
import type { TownView } from './town-view'

export function createTownSceneCompositor(
  scene: Scene,
  traffic: Scene,
  selection: Scene,
  camera: OrthographicCamera
) {
  let dirty = true
  let trafficDirty = false
  // Cache the static town so sticker glints don't redraw thousands of town objects.
  const target = new WebGLRenderTarget(1, 1, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    samples: 4,
    generateMipmaps: false
  })
  target.texture.colorSpace = SRGBColorSpace
  // Preserve thin surface layers across the camera's wide depth range in both passes.
  target.depthTexture = new DepthTexture(1, 1, FloatType)
  const trafficTarget = new WebGLRenderTarget(1, 1, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    samples: 4,
    generateMipmaps: false
  })
  trafficTarget.texture.colorSpace = SRGBColorSpace
  trafficTarget.depthTexture = new DepthTexture(1, 1, FloatType)
  const selectionTarget = new WebGLRenderTarget(1, 1, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    samples: 4,
    generateMipmaps: false
  })
  selectionTarget.depthTexture = new DepthTexture(1, 1, FloatType)
  const backdrop = new Scene()
  const backdropCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const backdropGeometry = new PlaneGeometry(2, 2)
  // Compare the cached town depth with the moving residents so trees and buildings
  // still occlude them, without rendering the whole town on every animation frame.
  const backdropMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      townMap: { value: target.texture },
      townDepth: { value: target.depthTexture },
      trafficMap: { value: trafficTarget.texture },
      trafficDepth: { value: trafficTarget.depthTexture },
      selectionDepth: { value: target.depthTexture },
      selectionEnabled: { value: false },
      selectionColor: { value: new Color(0x96e5ef) },
      texelSize: { value: new Vector2(1, 1) },
      outlineDepth: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D townMap;
      uniform sampler2D townDepth;
      uniform sampler2D trafficMap;
      uniform sampler2D trafficDepth;
      uniform sampler2D selectionDepth;
      uniform bool selectionEnabled;
      uniform vec3 selectionColor;
      uniform vec2 texelSize;
      uniform float outlineDepth;
      varying vec2 vUv;

      float visibleDepth(vec2 uv) {
        return min(texture2D(townDepth, uv).r, texture2D(trafficDepth, uv).r);
      }

      void main() {
        vec2 uv = vUv;
        float townZ = texture2D(townDepth, uv).r;
        float trafficZ = texture2D(trafficDepth, uv).r;
        gl_FragColor = trafficZ < townZ
          ? texture2D(trafficMap, uv)
          : texture2D(townMap, uv);
        float depth = min(townZ, trafficZ);
        float neighborDepth = max(
          max(visibleDepth(uv + vec2(texelSize.x, 0.0)),
              visibleDepth(uv - vec2(texelSize.x, 0.0))),
          max(visibleDepth(uv + vec2(0.0, texelSize.y)),
              visibleDepth(uv - vec2(0.0, texelSize.y)))
        );
        // Ink only the nearer side: a single pixel, without a halo through occluders.
        float outline = step(outlineDepth, neighborDepth - depth);
        // Darken the surface color so each contour keeps its material's hue.
        gl_FragColor.rgb *= mix(1.0, 0.45, outline);
        // Reveal only selected parts behind the town; nearer residents stay intact.
        if (selectionEnabled) {
          float selectedZ = texture2D(selectionDepth, uv).r;
          if (selectedZ < 1.0 && townZ < selectedZ && townZ <= trafficZ) {
            gl_FragColor.rgb = mix(gl_FragColor.rgb, selectionColor, 0.35);
          }
        }
        #include <colorspace_fragment>
      }
    `
  })
  backdrop.add(new Mesh(backdropGeometry, backdropMaterial))

  return {
    get needsUpdate() {
      return dirty || trafficDirty
    },
    invalidate() {
      dirty = true
    },
    invalidateTraffic() {
      trafficDirty = true
    },
    resize(view: TownView, size: SceneSize) {
      // Use CSS-pixel resolution with MSAA to smooth edges while bounding GPU cost.
      target.setSize(Math.max(1, Math.ceil(size.width)), Math.max(1, Math.ceil(size.height)))
      trafficTarget.setSize(target.width, target.height)
      selectionTarget.setSize(target.width, target.height)
      backdropMaterial.uniforms.texelSize.value.set(1 / target.width, 1 / target.height)
      // Ignore the ordinary depth slope of flat ground at every zoom level.
      const worldPixelSize = size.height / target.height / view.zoom
      backdropMaterial.uniforms.outlineDepth.value =
        Math.max(3, worldPixelSize * 1.5) / (camera.far - camera.near)
    },
    render(renderer: WebGLRenderer, updateTraffic: boolean, selected: boolean) {
      const previousTarget = renderer.getRenderTarget()
      if (dirty) {
        renderer.setRenderTarget(target)
        renderer.clear()
        renderer.render(scene, camera)
        dirty = false
      }
      if (updateTraffic) {
        renderer.setRenderTarget(trafficTarget)
        renderer.clear()
        renderer.render(traffic, camera)
        if (selected) {
          renderer.setRenderTarget(selectionTarget)
          renderer.clear()
          renderer.render(selection, camera)
        }
      }
      // An unrendered selection target may still have its pre-resize depth size.
      // Do not upload it through a sampler before Three initializes its framebuffer.
      backdropMaterial.uniforms.selectionDepth.value = selected
        ? selectionTarget.depthTexture
        : target.depthTexture
      backdropMaterial.uniforms.selectionEnabled.value = selected
      renderer.setRenderTarget(previousTarget)
      renderer.render(backdrop, backdropCamera)
      trafficDirty = false
    },
    dispose() {
      target.dispose()
      trafficTarget.dispose()
      selectionTarget.dispose()
      backdropGeometry.dispose()
      backdropMaterial.dispose()
    }
  }
}
