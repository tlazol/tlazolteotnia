import type { GlassShade } from './island-lamp-glass'
import { decorModel, type LightEmitter } from './island-models'
import { decorVoxelStep, type VoxelSurface, voxelSurface } from './island-voxels'
import type { DecorKind } from './island-world'

export type VoxelRequest = { kind: DecorKind; look: number }
export type VoxelResult = VoxelRequest & {
  surface: VoxelSurface
  emitters: LightEmitter[]
  shades?: GlassShade[]
  sway: number
  bob: number
}
self.onmessage = ({ data }: MessageEvent<VoxelRequest>) => {
  const model = decorModel(data.kind, data.look)
  const surface = voxelSurface(model, decorVoxelStep(data.kind))
  const result: VoxelResult = {
    ...data,
    surface,
    emitters: model.parts.flatMap((part) => part.emitter ?? []),
    shades: model.shades,
    sway: model.sway,
    bob: model.bob
  }
  self.postMessage(result, { transfer: Object.values(surface).map((array) => array.buffer) })
}
