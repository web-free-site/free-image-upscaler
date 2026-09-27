import pica from 'pica'
import type { Ep, InferenceSession } from './sessionTypes'
import type { RasterImage, UpscaleRequest, WorkerResponse } from '../types'
import { MODELS } from '../lib/models'
import { loadModel, openModelCache, ModelDownloadError } from '../lib/modelCache'
import { createSession, engineReachable, runTile } from './session'
import { classifyInitError } from './engineCheck'
import { upscaleImage } from './upscaleCore'
import { withCpuRetry } from './retry'

const resizer = pica({ features: ['js', 'wasm'] }) // no nested workers inside our worker
let current: { key: string; session: InferenceSession; ep: Ep } | null = null

const post = (m: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(m, transfer)

async function lanczos(img: RasterImage, tw: number, th: number): Promise<RasterImage> {
  const out = await resizer.resizeBuffer({
    src: img.data,
    width: img.width,
    height: img.height,
    toWidth: tw,
    toHeight: th,
    filter: 'lanczos3',
  })
  return {
    width: tw,
    height: th,
    data: new Uint8ClampedArray(out.buffer as ArrayBuffer, out.byteOffset, out.byteLength),
  }
}

async function resetSession(): Promise<void> {
  const s = current?.session
  current = null
  await s?.release().catch(() => {})
}

self.onmessage = async (e: MessageEvent<UpscaleRequest>) => {
  const { jobId, image, modelId, scale } = e.data

  async function run(forceWasm: boolean): Promise<RasterImage> {
    const key = `${modelId}:${forceWasm}`
    if (current?.key !== key) {
      await resetSession()
      const model = MODELS[modelId]
      const bytes = await loadModel(
        model.url,
        (loaded, total) =>
          post({
            type: 'progress',
            jobId,
            progress: { phase: 'download', loaded, total: total || model.bytes },
          }),
        await openModelCache(),
        fetch,
        model.bytes,
      )
      post({ type: 'progress', jobId, progress: { phase: 'init' } })
      try {
        current = { key, ...(await createSession(bytes, forceWasm)) }
      } catch (err) {
        throw await classifyInitError(err, engineReachable)
      }
    }
    const { session, ep } = current
    post({ type: 'ep', jobId, ep })
    return upscaleImage(
      image,
      {
        tile: ep === 'webgpu' ? 512 : 256,
        pad: 16,
        modelScale: 4,
        outScale: scale,
        onTile: (done, total) =>
          post({ type: 'progress', jobId, progress: { phase: 'tiles', done, total } }),
      },
      { run: (input, w, h) => runTile(session, input, w, h), resize: lanczos },
    )
  }

  try {
    const out = await withCpuRetry(run, {
      forceWasm: e.data.forceWasm,
      isGpu: () => current?.ep === 'webgpu',
      retryable: (err) => !(err instanceof ModelDownloadError),
      reset: resetSession,
    })
    post({ type: 'result', jobId, image: out }, [out.data.buffer])
  } catch (err) {
    post({
      type: 'error',
      jobId,
      kind: err instanceof ModelDownloadError ? 'download' : 'runtime',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
