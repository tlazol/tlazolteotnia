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
import {
  type BoardSize,
  type BoardView,
  hashSlug,
  hologramFinishes,
  type Sticker
} from './sticker-board'
import { foilPalettes, palettes, stickerMaterial } from './sticker-colors'

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
  const colors = palettes[(seed >>> 8) % palettes.length]
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * 2)
  canvas.height = Math.ceil(height * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.scale(2, 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lineHeight = fontSize * 1.22
  // Treat the title as interlocking lettering, with a reproducible rhythm per sticker.
  const lettering = lines.map((line, index) => {
    const direction = (index + seed) % 2 ? 1 : -1
    const size = fontSize * (1.13 + ((seed + index * 7) % 4) * 0.03)
    const rhythm = [1.16, 0.92, 1.04, 0.98, 1.1, 0.94]
    let measured = 0
    const glyphs = Array.from(line.trim()).map((char, charIndex) => {
      const beat = (charIndex + index * 2 + (seed % rhythm.length)) % rhythm.length
      // Keep Latin x-heights close enough for words to read as a unit.
      const emphasis = /[A-Za-z0-9]/.test(char) ? 1 + (rhythm[beat] - 1) * 0.5 : rhythm[beat]
      const glyphSize = size * emphasis
      const bold = beat === 0 || beat === 4
      ctx.font = `400 ${glyphSize}px "WDXL Lubrifont JP N", sans-serif`
      const glyphWidth = ctx.measureText(char).width
      const x = measured + glyphWidth / 2
      measured += glyphWidth - size * 0.015
      return { char, size: glyphSize, bold, x, y: (size - glyphSize) * 0.4 }
    })
    if (glyphs.length) measured += size * 0.015
    for (const glyph of glyphs) glyph.x -= measured / 2
    const targetWidth = width - 58 - ((seed + index * 13) % 3) * 9
    const scaleX = Math.min(1.35, targetWidth / Math.max(1, measured))
    const x = width / 2 + direction * 7
    const y = 64 + index * lineHeight
    const angle = direction * (0.5 + ((seed >>> 4) % 3) * 0.3)
    const transform = new DOMMatrix().translate(x, y).rotate(angle).skewX(-3)
    return { glyphs, size, scaleX, width: measured * scaleX, transform }
  })
  const outline = new Path2D()
  // Overlapping lobes are filled as a union before any outline is drawn.
  // Stroking the individual paths would leave seams through the printed artwork.
  if (sticker.shape === 'die-cut') {
    lettering.forEach((row) => {
      const lobe = new Path2D()
      const top = Math.min(...row.glyphs.map((glyph) => glyph.y - glyph.size / 2), 0) - 2
      const bottom = Math.max(...row.glyphs.map((glyph) => glyph.y + glyph.size / 2), 0) + 4
      lobe.roundRect(-row.width / 2 - 7, top, row.width + 14, bottom - top, 12)
      outline.addPath(lobe, row.transform)
    })
    outline.roundRect(width / 2 - 54, 23, 108, 34, 14)
    outline.roundRect(width / 2 - 52, height - 59, 104, 39, 12)
  } else {
    // Fit the silhouette to the lettering, leaving only room for its ink and edge cuts.
    const left =
      Math.min(width / 2 - 52, ...lettering.map((row) => row.transform.e - row.width / 2)) - 12
    const right =
      Math.max(width / 2 + 52, ...lettering.map((row) => row.transform.e + row.width / 2)) + 12
    const top = 23
    const bottom = height - 20
    const middle = (top + bottom) / 2
    switch (sticker.shape) {
      case 'rounded':
        outline.roundRect(left, top, right - left, bottom - top, [26, 12, 26, 12])
        break
      case 'ticket': {
        const notch = 8
        outline.moveTo(left + 8, top)
        outline.lineTo(right - 8, top)
        outline.quadraticCurveTo(right, top, right, top + 8)
        outline.lineTo(right, middle - notch)
        outline.arc(right, middle, notch, -Math.PI / 2, Math.PI / 2, true)
        outline.lineTo(right, bottom - 8)
        outline.quadraticCurveTo(right, bottom, right - 8, bottom)
        outline.lineTo(left + 8, bottom)
        outline.quadraticCurveTo(left, bottom, left, bottom - 8)
        outline.lineTo(left, middle + notch)
        outline.arc(left, middle, notch, Math.PI / 2, -Math.PI / 2, true)
        outline.lineTo(left, top + 8)
        outline.quadraticCurveTo(left, top, left + 8, top)
        outline.closePath()
        break
      }
      case 'beveled': {
        const cut = 16
        outline.moveTo(left + cut, top)
        outline.lineTo(right - cut, top)
        outline.lineTo(right, top + cut)
        outline.lineTo(right, bottom - cut)
        outline.lineTo(right - cut, bottom)
        outline.lineTo(left + cut, bottom)
        outline.lineTo(left, bottom - cut)
        outline.lineTo(left, top + cut)
        outline.closePath()
        break
      }
      case 'scalloped': {
        const corners = [
          [left, top],
          [right, top],
          [right, bottom],
          [left, bottom]
        ]
        outline.moveTo(left, top)
        corners.forEach(([x, y], index) => {
          const [endX, endY] = corners[(index + 1) % corners.length]
          const dx = endX - x
          const dy = endY - y
          const length = Math.hypot(dx, dy)
          const steps = Math.max(1, Math.round(length / 18))
          for (let step = 1; step <= steps; step++) {
            const midpoint = (step - 0.5) / steps
            outline.quadraticCurveTo(
              x + dx * midpoint - (dy / length) * 7,
              y + dy * midpoint + (dx / length) * 7,
              x + (dx * step) / steps,
              y + (dy * step) / steps
            )
          }
        })
        outline.closePath()
        break
      }
      case 'ribbon':
        outline.moveTo(left, top)
        outline.lineTo(right, top)
        outline.lineTo(right - 9, middle)
        outline.lineTo(right, bottom)
        outline.lineTo(left, bottom)
        outline.lineTo(left + 9, middle)
        outline.closePath()
        break
    }
  }
  ctx.fillStyle = stickerMaterial.edge
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
  // Preserve each article's original stock color independently of its embossed finish.
  const foilColors = foilPalettes[hashSlug(`foil:${sticker.post.slug}`) % foilPalettes.length]
  const spectrum = [foilColors[0], foilColors[1], foilColors[2], foilColors[1], foilColors[0]]
  spectrum.forEach((color, index) => {
    foil.addColorStop(index / (spectrum.length - 1), color)
  })
  ctx.fillStyle = foil
  ctx.fill(outline)

  ctx.lineJoin = 'round'
  const positionLettering = (
    context: CanvasRenderingContext2D,
    row: (typeof lettering)[number]
  ) => {
    const { a, b, c, d, e, f } = row.transform
    context.transform(a, b, c, d, e, f)
    context.scale(row.scaleX, 1)
  }
  // Lay down all outlines first so overlapping rows cannot erase each other's ink.
  lettering.forEach((row) => {
    ctx.save()
    positionLettering(ctx, row)
    ctx.strokeStyle = finish === 1 ? colors[2] : stickerMaterial.keyline
    for (const glyph of row.glyphs) {
      ctx.font = `400 ${glyph.size}px "WDXL Lubrifont JP N", sans-serif`
      ctx.lineWidth = (finish === 1 ? 4 : 5) + (glyph.bold ? glyph.size * 0.018 : 0)
      // A small extrusion gives the lettering a printed, dimensional face.
      for (let depth = 2; depth >= 0; depth--) {
        ctx.strokeText(glyph.char, glyph.x + depth * 0.45, glyph.y + depth)
      }
    }
    ctx.restore()
  })
  lettering.forEach((row, index) => {
    ctx.save()
    positionLettering(ctx, row)
    const ink = ctx.createLinearGradient(0, -row.size / 2, 0, row.size / 2)
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
    ctx.strokeStyle = ink
    for (const glyph of row.glyphs) {
      ctx.font = `400 ${glyph.size}px "WDXL Lubrifont JP N", sans-serif`
      // This display face has one weight; expand only the accented glyphs' ink.
      if (glyph.bold) {
        ctx.lineWidth = glyph.size * 0.018
        ctx.strokeText(glyph.char, glyph.x, glyph.y)
      }
      ctx.fillText(glyph.char, glyph.x, glyph.y)
    }
    ctx.restore()
  })

  ctx.fillStyle = stickerMaterial.keyline
  ctx.font = '700 9px "IBM Plex Mono", monospace'
  if (!eyes) ctx.fillText('0RGA / NOTES', width / 2, 36)
  ctx.font = '700 12px "IBM Plex Mono", monospace'
  ctx.fillText(sticker.post.date.replaceAll('-', '.'), width / 2, height - 30)
  ctx.fillStyle = stickerMaterial.edge
  sparkle(ctx, width / 2 - 46, 36, 6)
  sparkle(ctx, width / 2 + 46, height - 30, 5)

  // The foil is exposed around the opaque ink. Keep this independent of the topcoat.
  maskCtx.scale(2, 2)
  maskCtx.globalCompositeOperation = 'destination-out'
  maskCtx.textAlign = 'center'
  maskCtx.textBaseline = 'middle'
  maskCtx.lineJoin = 'round'
  for (const row of lettering) {
    maskCtx.save()
    positionLettering(maskCtx, row)
    for (const glyph of row.glyphs) {
      maskCtx.font = `400 ${glyph.size}px "WDXL Lubrifont JP N", sans-serif`
      maskCtx.lineWidth = 6 + (glyph.bold ? glyph.size * 0.018 : 0)
      maskCtx.strokeText(glyph.char, glyph.x, glyph.y + 1)
      maskCtx.fillText(glyph.char, glyph.x, glyph.y)
    }
    maskCtx.restore()
  }
  maskCtx.font = '700 9px "IBM Plex Mono", monospace'
  if (!eyes) maskCtx.fillText('0RGA / NOTES', width / 2, 36)
  maskCtx.font = '700 12px "IBM Plex Mono", monospace'
  maskCtx.fillText(sticker.post.date.replaceAll('-', '.'), width / 2, height - 30)
  // Pack both layers in one texture: red = exposed foil, alpha = clear laminate.
  // Black underneath restores the print's surface without exposing foil through it.
  maskCtx.globalCompositeOperation = 'destination-over'
  maskCtx.fillStyle = '#000'
  maskCtx.fill(outline)
  return { art: new CanvasTexture(canvas), materialMask: new CanvasTexture(mask) }
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
  const restingPointer = new Vector2(0.5, 0.5)
  const dragTilt = new Vector2()
  const dragTarget = new Vector2()
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
      textures.push(texture.art, texture.materialMask)
      const material = new ShaderMaterial({
        side: DoubleSide,
        transparent: true,
        depthTest: false,
        uniforms: {
          art: { value: texture.art },
          materialMask: { value: texture.materialMask },
          time: { value: 0 },
          motion: { value: reducedMotion.matches ? 0 : 1 },
          activity: { value: 0 },
          pointer: { value: new Vector2(0.5, 0.5) },
          dragTilt: { value: dragTilt },
          hologram: { value: hologramFinishes.indexOf(sticker.hologram) },
          foilPhase: { value: (sticker.seed % 1000) / 1000 },
          motionStyle: { value: hashSlug(`motion:${sticker.post.slug}`) % 6 },
          eyes: { value: eyes ? 1 : 0 },
          eyeCount: { value: sticker.eyeCount },
          eyeOpen: { value: 1 },
          gaze: { value: new Vector2() },
          dimensions: { value: new Vector2(sticker.width * 2, sticker.height * 2) }
        },
        vertexShader: `varying vec2 vUv;
          varying float vCurl;
          uniform float time;
          uniform float motion;
          uniform float foilPhase;
          uniform float motionStyle;
          uniform float activity;
          uniform vec2 pointer;
          uniform vec2 dimensions;
          void main() {
            vUv = uv;
            vec3 p = position;
            float edge = smoothstep(0.35, 1.0, uv.x * 0.65 + (1.0 - uv.y) * 0.5);
            vCurl = edge * edge * activity;
            p.x -= vCurl * 0.025;
            p.y += vCurl * 0.085;
            p.y += (uv.x - 0.5) * (pointer.x - 0.5) * activity * 0.025;
            // Animate the whole piece of vinyl in pixels, regardless of its aspect ratio.
            // Small excursions stay within the transparent padding of the link target.
            float beat = time * (0.85 + foilPhase * 0.45) + foilPhase * 6.2831853;
            float breathe = sin(beat * 1.4) * 0.014;
            // Take turns performing short gestures, then settle back into the idle sway.
            float cycle = time / 8.0 + foilPhase;
            float progress = clamp(fract(cycle) / 0.38, 0.0, 1.0);
            float pulse = sin(progress * 3.14159265);
            float envelope = pulse * pulse;
            float gesture = mod(motionStyle + floor(cycle), 6.0);
            vec2 travel = vec2(sin(beat * 0.7) * 2.5, sin(beat * 1.15) * 4.0);
            float rock = sin(beat) * 0.032 + (pointer.x - 0.5) * activity * 0.05;
            if (gesture < 0.5) {
              // Two soft hops, with a little squash on landing.
              float hop = abs(sin(progress * 6.2831853)) * envelope;
              travel.y += hop * 10.0;
              breathe -= hop * 0.035;
            } else if (gesture < 1.5) {
              rock += sin(progress * 6.2831853) * envelope * 0.09;
            } else if (gesture < 2.5) {
              travel.x += sin(progress * 12.5663706) * envelope * 7.0;
              rock += sin(progress * 12.5663706) * envelope * 0.035;
            } else if (gesture < 3.5) {
              rock += sin(progress * 37.6991118) * envelope * 0.045;
            } else if (gesture < 4.5) {
              breathe += sin(progress * 6.2831853) * envelope * 0.055;
              travel.y += envelope * 3.0;
            } else {
              travel += vec2(sin(progress * 6.2831853), cos(progress * 6.2831853)) * envelope * 6.0;
              rock += sin(progress * 6.2831853) * envelope * 0.045;
            }
            vec2 body = p.xy * dimensions * 0.5;
            body *= vec2(1.0 + breathe * motion, 1.0 - breathe * motion) * (1.0 + activity * 0.012);
            rock *= motion;
            body = mat2(cos(rock), sin(rock), -sin(rock), cos(rock)) * body;
            body += travel * motion;
            p.xy = body / (dimensions * 0.5);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `uniform sampler2D art;
          uniform sampler2D materialMask;
          uniform float time;
          uniform float motion;
          uniform float activity;
          uniform float hologram;
          uniform float foilPhase;
          uniform vec2 pointer;
          uniform vec2 dragTilt;
          uniform vec2 dimensions;
          uniform float eyes;
          uniform float eyeCount;
          uniform float eyeOpen;
          uniform vec2 gaze;
          varying vec2 vUv;
          varying float vCurl;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          vec3 spectrum(float phase) {
            return 0.54 + 0.46 * cos(6.2831853 * (phase + vec3(0.0, 0.33, 0.67)));
          }
          vec3 shiftHue(vec3 color, float angle) {
            vec3 axis = normalize(vec3(1.0));
            float c = cos(angle);
            return clamp(color * c + cross(axis, color) * sin(angle)
              + axis * dot(axis, color) * (1.0 - c), 0.0, 1.0);
          }
          float softReflection(float position, float center, float width) {
            float distance = (position - center) / width;
            return exp(-distance * distance);
          }
          vec3 glitter(vec2 pixel, float scale, float light) {
            vec2 grid = pixel / scale;
            vec2 cell = floor(grid);
            float grain = hash(cell);
            vec2 center = 0.25 + vec2(grain, hash(cell + 19.0)) * 0.5;
            vec2 point = abs(fract(grid) - center);
            float distance = point.x + point.y;
            float aa = max(fwidth(distance), 0.04);
            float fleck = 1.0 - smoothstep(0.22 - aa, 0.38 + aa, distance);
            // Each embedded flake has a fixed orientation; the light moves over it.
            float flash = pow(max(0.0, cos(grain * 62.8 + light * 10.0)), 24.0);
            vec3 tint = spectrum(grain + light * 0.18);
            return (tint * 0.65 - 0.28 + (0.5 + tint * 0.5) * flash * 1.15) * fleck;
          }
          void main() {
            vec4 base = texture2D(art, vUv);
            if (base.a < 0.01) discard;
            vec2 pixel = vUv * dimensions * 0.5;
            vec2 tilt = pointer - 0.5 + dragTilt;
            // All stickers share a soft moving light, with small differences in foil orientation.
            float shimmer = sin(time * 0.38) * 0.18;
            float shift = dot(tilt, vec2(0.42, 0.28)) + foilPhase * 0.22 + shimmer;
            float direction = vUv.x * 0.82 + vUv.y * 0.38 + shift;
            float opaque = smoothstep(0.8, 1.0, base.a);
            vec4 layers = texture2D(materialMask, vUv);
            float foil = layers.r * layers.a * opaque;
            float surface = layers.a * opaque;
            // Each stock has its own visible structure beneath the shared clear topcoat.
            vec3 reflection;
            float glint = 0.0;
            float grainStrength;
            if (hologram < 0.5) {
              // Prism: sharply separated triangular facets and reflective seams.
              vec2 grid = pixel / 24.0;
              vec2 cell = floor(grid);
              vec2 local = fract(grid);
              float facet = hash(cell + step(local.x, local.y) * 37.0);
              reflection = spectrum(direction * 1.4 + facet * 0.65);
              reflection *= 0.65 + 0.55 * sin(facet * 18.0 + shift * 8.0);
              float seam = abs(local.x - local.y);
              float aa = max(fwidth(local.x - local.y), 0.015);
              glint = (1.0 - smoothstep(0.0, aa, seam)) * 0.22;
              glint += pow(max(0.0, sin(facet * 31.0 + shift * 9.0)), 14.0) * 0.65;
              grainStrength = 0.18;
            } else if (hologram < 1.5) {
              // Glitter: dense flakes at two sizes, each catching the light separately.
              reflection = spectrum(direction) * 0.7 + 0.15;
              grainStrength = 1.0;
            } else if (hologram < 2.5) {
              // Aurora: smooth curved ribbons with broad traveling highlights.
              float wave = vUv.x * 1.5 + vUv.y * 0.65 + sin(vUv.y * 7.0 + shift * 3.0) * 0.22;
              reflection = spectrum(wave + shift);
              glint = pow(max(0.0, cos((wave + shift) * 12.0)), 18.0) * 0.65;
              grainStrength = 0.07;
            } else {
              // Laser: concentric etched rosettes, softened only at distant zoom levels.
              float radius = length(fract(pixel / 48.0) - 0.5);
              float phase = radius * 8.0 - shift * 2.0;
              float grooves = 0.5 + 0.5 * cos(phase * 6.2831853);
              grooves = mix(0.5, grooves, 1.0 - smoothstep(0.18, 0.5, fwidth(phase)));
              reflection = spectrum(radius * 2.5 + direction + shift) * (0.65 + grooves * 0.5);
              glint = pow(grooves, 12.0) * 0.45;
              grainStrength = 0.16;
            }
            // Restore the dyed stock's color changes without refracting the printed ink.
            float hue = (time * (0.18 + foilPhase * 0.08) + activity * 0.9) * motion;
            vec3 dye = shiftHue(base.rgb, hue);
            reflection = mix(reflection, dye * (0.5 + reflection * 0.8), 0.7);
            vec3 vinyl = mix(base.rgb, dye * (0.48 + reflection * 0.95), 0.78);
            vinyl += reflection * 0.14 + glint * 0.6;
            float light = shift + vUv.x * 0.3 + vUv.y * 0.18;
            float fineDetail = 1.0 - smoothstep(1.1, 2.5, fwidth(pixel.x));
            vinyl += glitter(pixel, 1.65, light) * fineDetail * 0.75 * grainStrength;
            vinyl += glitter(pixel + 31.0, 3.8, light) * 0.9 * grainStrength;
            // Sparse sharp glints sit on the film, not in the surrounding page.
            vec2 stars = pixel / 23.0;
            float star = hash(floor(stars));
            vec2 ray = abs(fract(stars) - 0.25 - vec2(star, hash(floor(stars) + 7.0)) * 0.5);
            float rayWidth = max(0.018, fwidth(stars.x) * 0.65);
            float cross = exp(-min(ray.x, ray.y) / rayWidth) * exp(-max(ray.x, ray.y) * 12.0);
            float twinkle = pow(max(0.0, cos(star * 54.0 + light * 12.0)), 18.0);
            vinyl += cross * step(0.68, star) * twinkle * (0.65 + grainStrength * 0.75);
            vec3 color = mix(base.rgb, vinyl, foil);
            color *= 1.0 - vCurl * 0.28;
            color += pow(vCurl, 3.0) * 0.35;
            if (eyes > 0.5) {
              // Work in sticker pixels so the eyes stay the same size on every title.
              vec2 eye = vec2((vUv.x - 0.5) * dimensions.x * 0.5,
                (1.0 - vUv.y) * dimensions.y * 0.5 - 35.0) - gaze;
              float spacing = eyeCount > 3.5 ? 18.0 : 24.0;
              float firstEye = -0.5 * (eyeCount - 1.0) * spacing;
              float nearestEye = clamp(floor((eye.x - firstEye) / spacing + 0.5), 0.0, eyeCount - 1.0);
              eye.x -= firstEye + nearestEye * spacing;
              float expression = mod(time + foilPhase * 13.0, 13.0);
              float wink = (1.0 - smoothstep(0.0, 0.22, abs(expression - 2.4))) * motion;
              float wide = (1.0 - smoothstep(0.25, 0.8, abs(expression - 6.0))) * motion;
              float sleepy = (1.0 - smoothstep(0.35, 1.0, abs(expression - 10.0))) * motion;
              float openness = eyeOpen * (1.0 - wink * step(eyeCount - 1.5, nearestEye)) * (1.0 - sleepy * 0.55);
              vec2 halfSize = vec2(4.8 + wide * 0.8, mix(0.65, 8.0 + activity + wide, openness));
              float radius = min(2.2, halfSize.y);
              vec2 d = abs(eye) - halfSize + radius;
              float distance = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
              float aa = max(0.35, fwidth(distance));
              // Eyes belong to the same printed layer as the lettering.
              float eyeInk = 1.0 - smoothstep(0.8 - aa, 0.8 + aa, distance);
              foil *= 1.0 - eyeInk;
              color = mix(color, vec3(1.0), eyeInk);
              color = mix(color, vec3(0.025), 1.0 - smoothstep(-aa, aa, distance));
              // White centers stay inside the black eyes and close with the eyelids.
              vec2 whiteCenter = vec2(gaze.x * 0.3, -1.1 + gaze.y * 0.35);
              vec2 whiteSize = vec2(2.5 + wide * 0.3, 4.6);
              vec2 whiteEdge = abs(eye - whiteCenter) - whiteSize + 0.6;
              float whiteDistance = length(max(whiteEdge, 0.0)) + min(max(whiteEdge.x, whiteEdge.y), 0.0) - 0.6;
              float whiteAA = max(0.25, fwidth(whiteDistance));
              float whiteInk = (1.0 - smoothstep(-whiteAA, whiteAA, whiteDistance))
                * (1.0 - smoothstep(-1.5 - aa, -1.5 + aa, distance))
                * smoothstep(0.15, 0.5, openness);
              color = mix(color, vec3(1.0), whiteInk);
            }
            // Clear adhesive + gloss laminate cover BOTH the foil and the printed ink.
            // A broad softbox and its narrow edge reflect independently of the rainbow.
            float glossPosition = vUv.x * 0.64 + vUv.y * 0.76
              + dot(tilt, vec2(0.22, 0.16)) + sin(time * 0.38) * 0.24;
            float softbox = softReflection(glossPosition, 0.72, 0.19);
            float glossEdge = softReflection(glossPosition, 0.55, 0.018);
            float secondReflection = softReflection(glossPosition, 1.12, 0.07);
            float gloss = softbox * 0.24 + glossEdge * 0.32 + secondReflection * 0.12;
            color = mix(color, vec3(1.0), gloss * surface * (0.48 + foil * 0.52));
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
    if (reducedMotion.matches) {
      dragTilt.set(0, 0)
      dragTarget.set(0, 0)
    } else {
      dragTilt.lerp(dragTarget, 0.18)
      dragTarget.multiplyScalar(0.92)
    }
    let animating = dragTilt.lengthSq() + dragTarget.lengthSq() > 0.000001
    if (!animating) {
      dragTilt.set(0, 0)
      dragTarget.set(0, 0)
    }
    meshes.forEach((mesh, index) => {
      mesh.material.uniforms.time.value = reducedMotion.matches ? 0 : now / 1000
      mesh.material.uniforms.motion.value = reducedMotion.matches ? 0 : 1
      const target = index === hovered && !reducedMotion.matches ? 1 : 0
      const activity = mesh.material.uniforms.activity.value
      const next = reducedMotion.matches ? 0 : activity + (target - activity) * 0.16
      mesh.material.uniforms.activity.value = Math.abs(next - target) < 0.002 ? target : next
      if (Math.abs(next - target) >= 0.002) animating = true
      const lightPointer = mesh.material.uniforms.pointer.value as Vector2
      if (reducedMotion.matches) lightPointer.copy(restingPointer)
      else {
        const targetPointer = index === hovered ? pointer : restingPointer
        lightPointer.lerp(targetPointer, 0.14)
        if (lightPointer.distanceToSquared(targetPointer) > 0.000001) animating = true
      }
      if (eyes) {
        const sticker = stickers[index]
        const gaze = mesh.material.uniforms.gaze.value as Vector2
        const phase = (sticker.seed % 1000) / 1000
        const seconds = now / 1000
        const blink = (seconds + phase * 7) % (3.6 + phase * 2.8)
        const blinkClosure = Math.max(0, 1 - Math.abs(blink - 0.12) / 0.12)
        const doubleBlink =
          sticker.seed % 3 === 0 ? Math.max(0, 1 - Math.abs(blink - 0.42) / 0.1) : 0
        mesh.material.uniforms.eyeOpen.value = reducedMotion.matches
          ? 1
          : 1 - Math.max(blinkClosure, doubleBlink)
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
    else if (stickers.length && !reducedMotion.matches)
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
    shimmer(deltaX: number, deltaY: number) {
      if (disposed || reducedMotion.matches) return
      // Screen-space movement also lights the foil when panning reaches the board edge.
      dragTarget.x = Math.max(-1, Math.min(1, dragTarget.x + deltaX / 180))
      dragTarget.y = Math.max(-1, Math.min(1, dragTarget.y - deltaY / 180))
      requestRender()
    },
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
