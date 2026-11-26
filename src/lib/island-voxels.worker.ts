import { decorModel, type LightEmitter } from './island-models'
import { type VoxelSurface, voxelSurface } from './island-voxels'
import type { DecorKind } from './island-world'

export type VoxelRequest = { kind: DecorKind; look: number }
export type VoxelResult = VoxelRequest & {
  surface: VoxelSurface
  emitters: LightEmitter[]
  sway: number
  bob: number
}
self.onmessage = ({ data }: MessageEvent<VoxelRequest>) => {
  const model = decorModel(data.kind, data.look)
  const surface = voxelSurface(model)
  const result: VoxelResult = {
    ...data,
    surface,
    emitters: model.parts.flatMap((part) => part.emitter ?? []),
    sway: model.sway,
    bob: model.bob
  }
  self.postMessage(result, { transfer: Object.values(surface).map((array) => array.buffer) })
}
