import type {
  Ep,
  ModelId,
  RasterImage,
  Scale,
  UpscaleProgress,
  UpscaleRequest,
  WorkerResponse,
} from '../types'

export class UpscaleError extends Error {
  kind: 'download' | 'runtime'
  constructor(kind: 'download' | 'runtime', message: string) {
    super(message)
    this.kind = kind
  }
}

export class UpscalerClient {
  private worker: Worker
  private jobId = 0
  private pending: { reject: (e: Error) => void } | null = null

  constructor() {
    this.worker = this.spawn()
  }

  private spawn(): Worker {
    return new Worker(new URL('../worker/upscale.worker.ts', import.meta.url), { type: 'module' })
  }

  upscale(
    image: RasterImage,
    modelId: ModelId,
    scale: Scale,
    forceWasm: boolean,
    onProgress: (p: UpscaleProgress) => void,
    onEp: (ep: Ep) => void,
  ): Promise<RasterImage> {
    if (this.pending) this.cancel() // a new call supersedes (and stops) any unsettled job
    const jobId = ++this.jobId
    const worker = this.worker
    return new Promise<RasterImage>((resolve, reject) => {
      this.pending = { reject }
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const m = e.data
        // Stale job, or a worker cancel() already replaced.
        if (m.jobId !== this.jobId || worker !== this.worker) return
        if (m.type === 'progress') onProgress(m.progress)
        else if (m.type === 'ep') onEp(m.ep)
        else if (m.type === 'result') {
          this.pending = null
          resolve(m.image)
        } else {
          this.pending = null
          reject(new UpscaleError(m.kind, m.message))
        }
      }
      worker.onerror = (e) => {
        if (worker !== this.worker) return
        this.pending = null
        reject(new UpscaleError('runtime', e.message))
      }
      // Copy, then transfer the copy: the caller keeps displaying the original.
      const copy = { ...image, data: image.data.slice() }
      const req: UpscaleRequest = { type: 'upscale', jobId, image: copy, modelId, scale, forceWasm }
      worker.postMessage(req, [copy.data.buffer])
    })
  }

  cancel(): void {
    this.worker.terminate()
    this.pending?.reject(new Error('cancelled'))
    this.pending = null
    this.jobId++
    this.worker = this.spawn()
  }
}
