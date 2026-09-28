import '@tanstack/react-start/client-only'
import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer
} from 'three'
import type { BoardSize, BoardView, Sticker } from './sticker-board'

const palettes = [
  ['#ffbddd', '#f45caa', '#5e1646'],
  ['#bcf3ff', '#55b8ef', '#163d79'],
  ['#e8c8ff', '#aa76ee', '#452170'],
  ['#fff2be', '#ffa766', '#843b36'],
  ['#e6eff5', '#a4b3c7', '#303b55'],
  ['#dcffc4', '#9adc84', '#255647']
]

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath()
  for (let index = 0; index < 8; index++) {
    const angle = (index * Math.PI) / 4
    const r = index % 2 ? radius * 0.24 : radius
    const px = x + Math.cos(angle) * r
    const py = y + Math.sin(angle) * r
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

function createStickerTexture(sticker: Sticker, eyes: boolean) {
  const { width, height, seed, lines, fontSize } = sticker
  const finish = seed % 3
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * 2)
  canvas.height = Math.ceil(height * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.scale(2, 2)
  const colors = palettes[(seed >>> 8) % palettes.length]
  ctx.font = `400 ${fontSize}px "WDXL Lubrifont JP N", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const widths = lines.map((line) => Math.min(width - 68, ctx.measureText(line).width))
  const lineHeight = fontSize * 1.18
  const top = 64
  const outline = new Path2D()
  // Overlapping lobes are filled as a union before any outline is drawn.
  // Stroking the individual paths would leave seams through the printed artwork.
  if (finish === 1) {
    outline.roundRect(25, 23, width - 50, height - 50, [44, 22, 44, 22])
  } else {
    lines.forEach((_, index) => {
      const w = widths[index] + 28
      outline.roundRect(
        (width - w) / 2,
        top + index * lineHeight - lineHeight / 2 - 4,
        w,
        lineHeight + 13,
        18
      )
    })
    outline.roundRect(width / 2 - 58, 23, 116, 38, 18)
    outline.roundRect(width / 2 - 57, height - 78, 114, 50, 15)
  }
  ctx.fillStyle = '#fff'
  ctx.fill(outline)

  // Dilate the filled silhouette, giving the complete sticker one clean vinyl edge.
  const mask = document.createElement('canvas')
  mask.width = canvas.width
  mask.height = canvas.height
  const maskCtx = mask.getContext('2d')
  if (!maskCtx) throw new Error('Canvas 2D unavailable')
  maskCtx.drawImage(canvas, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.shadowColor = '#00000080'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 9
  ctx.fill(outline)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
    ctx.drawImage(mask, Math.cos(angle) * 5, Math.sin(angle) * 5, width, height)
  }

  const foil = ctx.createLinearGradient(0, height, width, 0)
  const spectrum = ['#b8c9e3', '#eeccf6', '#96e5ef', '#f9f4b4', '#efb4d9', '#a7b4ed', '#daf7ed']
  spectrum.forEach((color, index) => {
    foil.addColorStop(index / (spectrum.length - 1), color)
  })
  ctx.fillStyle = foil
  ctx.fill(outline)

  ctx.save()
  ctx.clip(outline)
  let random = seed
  for (let index = 0; index < (width * height) / 5; index++) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0
    const x = ((random % 10000) / 10000) * width
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0
    const y = ((random % 10000) / 10000) * height
    ctx.fillStyle = index % 3 === 0 ? '#ffffffb0' : '#5d477a40'
    ctx.fillRect(x, y, 0.65, 0.65)
  }
  ctx.restore()

  if (finish === 1) {
    const enamel = ctx.createLinearGradient(0, 30, width, height)
    enamel.addColorStop(0, colors[0])
    enamel.addColorStop(0.5, colors[1])
    enamel.addColorStop(1, colors[0])
    ctx.fillStyle = enamel
    ctx.beginPath()
    ctx.roundRect(32, 30, width - 64, height - 64, [38, 17, 38, 17])
    ctx.fill()
    ctx.strokeStyle = '#ffffff9a'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.lineJoin = 'round'
  lines.forEach((line, index) => {
    const y = top + index * lineHeight
    const textWidth = width - 68
    ctx.strokeStyle = finish === 1 ? colors[2] : '#27213b'
    ctx.lineWidth = finish === 1 ? 4 : 7
    // A small extrusion gives the lettering a printed, dimensional face.
    for (let depth = 4; depth >= 0; depth--) {
      ctx.strokeText(line, width / 2 + depth * 0.45, y + depth, textWidth)
    }
    const ink = ctx.createLinearGradient(0, y - fontSize / 2, 0, y + fontSize / 2)
    if (finish === 2) {
      ink.addColorStop(0, '#ffffff')
      ink.addColorStop(0.42, '#dce9f1')
      ink.addColorStop(0.49, '#fafcff')
      ink.addColorStop(0.53, '#798ca8')
      ink.addColorStop(1, '#e3e4f5')
    } else {
      ink.addColorStop(0, finish === 1 ? '#fff7e1' : palettes[(seed + index) % palettes.length][0])
      ink.addColorStop(1, finish === 1 ? '#ffe2ad' : palettes[(seed + index) % palettes.length][1])
    }
    ctx.fillStyle = ink
    ctx.fillText(line, width / 2, y, textWidth)
  })

  ctx.fillStyle = '#302942'
  ctx.font = '700 9px "IBM Plex Mono", monospace'
  if (!eyes) ctx.fillText('0RGA / NOTES', width / 2, 36)
  ctx.font = '600 9px "IBM Plex Mono", monospace'
  ctx.fillText(sticker.post.date.replaceAll('-', '.'), width / 2, height - 40)
  ctx.fillStyle = finish === 1 ? '#fff9dd' : '#ffffff'
  sparkle(ctx, width / 2 - 46, 36, 6)
  sparkle(ctx, width / 2 + 46, height - 40, 5)

  // A broad reflected softbox is part of the laminate, even without animation.
  ctx.save()
  ctx.clip(outline)
  const gloss = ctx.createLinearGradient(0, 0, width * 0.7, height)
  gloss.addColorStop(0, '#ffffff00')
  gloss.addColorStop(0.38, '#ffffff00')
  gloss.addColorStop(0.46, '#ffffff30')
  gloss.addColorStop(0.49, '#ffffff05')
  gloss.addColorStop(0.73, '#ffffff00')
  gloss.addColorStop(1, '#ffffff20')
  ctx.fillStyle = gloss
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
  return new CanvasTexture(canvas)
}

export function createStickerScene(
  canvas: HTMLCanvasElement,
  stickers: Sticker[],
  onError: () => void,
  { eyes = false }: { eyes?: boolean } = {}
) {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power'
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x101114, 0)
  const scene = new Scene()
  const camera = new OrthographicCamera(0, 1, 0, 1, 0.1, 100)
  camera.position.z = 10
  const geometry = new PlaneGeometry(1, 1, 24, 20)
  const meshes: Mesh<PlaneGeometry, ShaderMaterial>[] = []
  const textures: CanvasTexture[] = []
  let size: BoardSize = { width: 1, height: 1 }
  let view: BoardView = { x: 0, y: 0, zoom: 1 }
  let hovered = -1
  let frame = 0
  let idleTimer = 0
  let activeUntil = 0
  let gazeUntil = 0
  let disposed = false
  const pointer = new Vector2(0.5, 0.5)
  const eyePointer = new Vector2()
  const surface = canvas.parentElement
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function dispose() {
    disposed = true
    cancelAnimationFrame(frame)
    window.clearTimeout(idleTimer)
    canvas.removeEventListener('webglcontextlost', lost)
    document.removeEventListener('visibilitychange', visibility)
    reducedMotion.removeEventListener('change', requestRender)
    surface?.removeEventListener('pointermove', move)
    surface?.removeEventListener('pointerleave', leave)
    geometry.dispose()
    for (const mesh of meshes) mesh.material.dispose()
    for (const texture of textures) texture.dispose()
    renderer.dispose()
  }

  try {
    for (const sticker of stickers) {
      const texture = createStickerTexture(sticker, eyes)
      textures.push(texture)
      const material = new ShaderMaterial({
        side: DoubleSide,
        transparent: true,
        depthTest: false,
        uniforms: {
          art: { value: texture },
          time: { value: 0 },
          activity: { value: 0 },
          pointer: { value: new Vector2(0.5, 0.5) },
          finish: { value: sticker.seed % 3 },
          eyes: { value: eyes ? 1 : 0 },
          eyeOpen: { value: 1 },
          gaze: { value: new Vector2() },
          dimensions: { value: new Vector2(sticker.width * 2, sticker.height * 2) }
        },
        vertexShader: `varying vec2 vUv;
          varying float vCurl;
          uniform float activity;
          uniform vec2 pointer;
          void main() {
            vUv = uv;
            vec3 p = position;
            float edge = smoothstep(0.35, 1.0, uv.x * 0.65 + (1.0 - uv.y) * 0.5);
            vCurl = edge * edge * activity;
            p.x -= vCurl * 0.025;
            p.y += vCurl * 0.085;
            p.y += (uv.x - 0.5) * (pointer.x - 0.5) * activity * 0.025;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `uniform sampler2D art;
          uniform float time;
          uniform float activity;
          uniform float finish;
          uniform vec2 pointer;
          uniform vec2 dimensions;
          uniform float eyes;
          uniform float eyeOpen;
          uniform vec2 gaze;
          varying vec2 vUv;
          varying float vCurl;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main() {
            vec4 base = texture2D(art, vUv);
            if (base.a < 0.01) discard;
            vec2 cell = floor(vUv * dimensions / 2.0);
            float noise = hash(cell);
            float light = pow(max(0.0, sin(noise * 80.0 + time * 2.0 + vUv.x * 8.0)), 18.0);
            float foil = smoothstep(0.42, 0.85, min(base.r, min(base.g, base.b)));
            float sparkle = step(0.9, noise) * light * foil;
            float direction = vUv.x * 1.3 + vUv.y * 0.7 + (pointer.x - 0.5) * 0.7 + (pointer.y - 0.5) * 0.3;
            vec3 iridescence = 0.6 + 0.4 * cos(vec3(0.0, 2.1, 4.2) + direction * 10.0);
            float laminate = pow(max(0.0, 1.0 - abs(direction - 1.0)), 22.0);
            float opaque = smoothstep(0.8, 1.0, base.a);
            vec3 color = base.rgb;
            color += (iridescence - 0.5) * foil * (finish < 0.5 ? 0.3 : 0.13);
            color += sparkle * iridescence * foil * (0.12 + activity * 0.4);
            color += laminate * (0.08 + activity * 0.24) * opaque;
            color *= 1.0 - vCurl * 0.28;
            color += pow(vCurl, 3.0) * 0.35;
            if (eyes > 0.5) {
              // Work in sticker pixels so the eyes stay the same size on every title.
              vec2 eye = vec2((vUv.x - 0.5) * dimensions.x * 0.5,
                (1.0 - vUv.y) * dimensions.y * 0.5 - 35.0) - gaze;
              eye.x = abs(eye.x) - 12.0;
              vec2 halfSize = vec2(4.8, mix(0.65, 8.0 + activity, eyeOpen));
              float radius = min(2.2, halfSize.y);
              vec2 d = abs(eye) - halfSize + radius;
              float distance = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
              float aa = max(0.35, fwidth(distance));
              // Apply monochrome ink after the foil lighting, with a fine white keyline.
              color = mix(color, vec3(1.0), 1.0 - smoothstep(0.8 - aa, 0.8 + aa, distance));
              color = mix(color, vec3(0.025), 1.0 - smoothstep(-aa, aa, distance));
            }
            gl_FragColor = vec4(color, base.a);
          }`
      })
      const mesh = new Mesh(geometry, material)
      mesh.position.set(sticker.x, sticker.y, 0)
      mesh.scale.set(sticker.width, -sticker.height, 1)
      mesh.rotation.z = sticker.angle
      meshes.push(mesh)
      scene.add(mesh)
    }
  } catch (error) {
    dispose()
    throw error
  }

  function render(now: number) {
    frame = 0
    if (disposed || document.hidden) return
    camera.left = -view.x / view.zoom
    camera.right = (size.width - view.x) / view.zoom
    camera.top = -view.y / view.zoom
    camera.bottom = (size.height - view.y) / view.zoom
    camera.updateProjectionMatrix()
    let animating = false
    meshes.forEach((mesh, index) => {
      mesh.material.uniforms.time.value = reducedMotion.matches ? 0 : now / 1000
      const target = index === hovered && !reducedMotion.matches ? 1 : 0
      const activity = mesh.material.uniforms.activity.value
      const next = reducedMotion.matches ? 0 : activity + (target - activity) * 0.16
      mesh.material.uniforms.activity.value = Math.abs(next - target) < 0.002 ? target : next
      if (Math.abs(next - target) >= 0.002) animating = true
      if (reducedMotion.matches) mesh.material.uniforms.pointer.value.set(0.5, 0.5)
      else if (index === hovered) mesh.material.uniforms.pointer.value.copy(pointer)
      if (eyes) {
        const sticker = stickers[index]
        const gaze = mesh.material.uniforms.gaze.value as Vector2
        const phase = (sticker.seed % 1000) / 1000
        const seconds = now / 1000
        const blink = (seconds + phase * 7) % (3.6 + phase * 2.8)
        mesh.material.uniforms.eyeOpen.value = reducedMotion.matches
          ? 1
          : 1 - Math.max(0, 1 - Math.abs(blink - 0.12) / 0.12)
        if (reducedMotion.matches) gaze.set(0, 0)
        else {
          let x = Math.sin(seconds * 0.65 + phase * Math.PI * 2) * 3
          let y = Math.sin(seconds * 0.43 + phase * Math.PI * 2) * 0.8
          if (now < gazeUntil) {
            const dx = (eyePointer.x - view.x) / view.zoom - sticker.x
            const dy = (eyePointer.y - view.y) / view.zoom - sticker.y
            const cosine = Math.cos(sticker.angle)
            const sine = Math.sin(sticker.angle)
            x = Math.tanh((dx * cosine + dy * sine) / 160) * 4
            y = Math.tanh((-dx * sine + dy * cosine + sticker.height / 2 - 35) / 160) * 1.5
          }
          gaze.x += (x - gaze.x) * 0.16
          gaze.y += (y - gaze.y) * 0.16
        }
      }
      mesh.renderOrder = index === hovered ? stickers.length : index
    })
    renderer.render(scene, camera)
    if (!reducedMotion.matches && (now < activeUntil || animating))
      frame = requestAnimationFrame(render)
    else if (eyes && stickers.length && !reducedMotion.matches)
      idleTimer = window.setTimeout(requestRender, 1000 / 30)
  }

  function move(event: PointerEvent) {
    if (reducedMotion.matches) return
    const rect = canvas.getBoundingClientRect()
    if (eyes) {
      eyePointer.set(event.clientX - rect.left, event.clientY - rect.top)
      gazeUntil = performance.now() + 2200
      requestRender()
    }
    if (hovered < 0) return
    const sticker = stickers[hovered]
    if (!sticker) return
    const x = (event.clientX - rect.left - view.x) / view.zoom - sticker.x
    const y = (event.clientY - rect.top - view.y) / view.zoom - sticker.y
    const cosine = Math.cos(sticker.angle)
    const sine = Math.sin(sticker.angle)
    pointer.set(
      Math.max(0, Math.min(1, (x * cosine + y * sine) / sticker.width + 0.5)),
      Math.max(0, Math.min(1, 0.5 - (-x * sine + y * cosine) / sticker.height))
    )
    activeUntil = performance.now() + 650
    requestRender()
  }

  function leave() {
    gazeUntil = 0
  }

  function requestRender() {
    window.clearTimeout(idleTimer)
    if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(render)
  }
  function lost(event: Event) {
    event.preventDefault()
    dispose()
    onError()
  }
  function visibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame)
      window.clearTimeout(idleTimer)
      frame = 0
    } else requestRender()
  }
  canvas.addEventListener('webglcontextlost', lost)
  document.addEventListener('visibilitychange', visibility)
  reducedMotion.addEventListener('change', requestRender)
  surface?.addEventListener('pointermove', move)
  surface?.addEventListener('pointerleave', leave)

  return {
    update(nextView: BoardView, nextSize: BoardSize, nextHovered: number) {
      if (disposed) return
      view = nextView
      hovered = nextHovered
      if (size.width !== nextSize.width || size.height !== nextSize.height) {
        size = nextSize
        renderer.setSize(size.width, size.height, false)
      }
      activeUntil = performance.now() + 650
      requestRender()
    },
    dispose
  }
}
