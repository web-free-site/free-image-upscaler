export interface RasterImage {
  width: number
  height: number
  // ArrayBuffer-backed (not SharedArrayBuffer), so it goes straight into ImageData without a copy.
  data: Uint8ClampedArray<ArrayBuffer> // RGBA, length = width*height*4
}

export type Ep = 'webgpu' | 'wasm'
export type ModelId = 'general' | 'anime' | 'photo'

export type Scale = 2 | 4
export type UpscaleProgress =
  | { phase: 'download'; loaded: number; total: number }
  | { phase: 'init' }
  | { phase: 'tiles'; done: number; total: number }
export interface UpscaleRequest {
  type: 'upscale'
  jobId: number
  image: RasterImage
  modelId: ModelId
  scale: Scale
  forceWasm: boolean
}
export type WorkerResponse =
  | { type: 'progress'; jobId: number; progress: UpscaleProgress }
  | { type: 'ep'; jobId: number; ep: Ep }
  | { type: 'result'; jobId: number; image: RasterImage }
  | { type: 'error'; jobId: number; kind: 'download' | 'runtime'; message: string }
