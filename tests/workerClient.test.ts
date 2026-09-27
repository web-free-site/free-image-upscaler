import { describe, it, expect } from 'vitest'
import { UpscalerClient, UpscaleError } from '../src/lib/workerClient'
import type { RasterImage, UpscaleRequest, WorkerResponse } from '../src/types'

class FakeWorker {
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null
  posted: UpscaleRequest[] = []
  terminated = false
  postMessage(msg: UpscaleRequest): void {
    this.posted.push(msg)
  }
  terminate(): void {
    this.terminated = true
  }
  emit(m: WorkerResponse) {
    this.onmessage?.({ data: m } as MessageEvent<WorkerResponse>)
  }
}
const instances: FakeWorker[] = []
;(globalThis as unknown as { Worker: unknown }).Worker = class extends FakeWorker {
  constructor() {
    super()
    instances.push(this)
  }
}

const img = (): RasterImage => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) })
const noop = () => {}

describe('UpscalerClient', () => {
  it('resolves with the result and forwards progress and ep', async () => {
    instances.length = 0
    const c = new UpscalerClient()
    const progress: unknown[] = []
    const eps: string[] = []
    const p = c.upscale(
      img(),
      'general',
      4,
      false,
      (x) => progress.push(x),
      (e) => eps.push(e),
    )
    const w = instances[0]
    const jobId = w.posted[0].jobId
    w.emit({ type: 'ep', jobId, ep: 'webgpu' })
    w.emit({ type: 'progress', jobId, progress: { phase: 'tiles', done: 1, total: 2 } })
    w.emit({ type: 'result', jobId, image: img() })
    await expect(p).resolves.toMatchObject({ width: 1 })
    expect(eps).toEqual(['webgpu'])
    expect(progress).toEqual([{ phase: 'tiles', done: 1, total: 2 }])
  })
  it('does not transfer (detach) the caller image', () => {
    instances.length = 0
    const c = new UpscalerClient()
    const src = img()
    void c.upscale(src, 'general', 4, false, noop, noop).catch(noop)
    expect(instances[0].posted[0].image.data).not.toBe(src.data)
  })
  it('rejects with a typed error', async () => {
    instances.length = 0
    const c = new UpscalerClient()
    const p = c.upscale(img(), 'general', 4, false, noop, noop)
    const w = instances[0]
    w.emit({ type: 'error', jobId: w.posted[0].jobId, kind: 'download', message: 'HTTP 404' })
    const err = await p.catch((e) => e)
    expect(err).toBeInstanceOf(UpscaleError)
    expect(err.kind).toBe('download')
  })
  it('cancel terminates, rejects "cancelled", and ignores the old worker afterwards', async () => {
    instances.length = 0
    const c = new UpscalerClient()
    const progress: unknown[] = []
    const p1 = c.upscale(img(), 'general', 4, false, (x) => progress.push(x), noop)
    const old = instances[0]
    const oldJob = old.posted[0].jobId
    c.cancel()
    await expect(p1).rejects.toThrow('cancelled')
    expect(old.terminated).toBe(true)
    const p2 = c.upscale(img(), 'general', 4, false, (x) => progress.push(x), noop)
    const fresh = instances[1]
    old.emit({ type: 'progress', jobId: oldJob, progress: { phase: 'init' } })
    old.emit({ type: 'result', jobId: oldJob, image: img() })
    fresh.emit({ type: 'result', jobId: fresh.posted[0].jobId, image: img() })
    await expect(p2).resolves.toBeDefined()
    expect(progress).toEqual([])
  })
  it('a new call supersedes an unsettled one and stops its worker', async () => {
    instances.length = 0
    const c = new UpscalerClient()
    const p1 = c.upscale(img(), 'general', 4, false, noop, noop)
    const p2 = c.upscale(img(), 'anime', 4, false, noop, noop)
    await expect(p1).rejects.toThrow('cancelled')
    const [old, fresh] = instances
    expect(old.terminated).toBe(true) // otherwise two jobs share one ORT session
    old.emit({ type: 'result', jobId: old.posted[0].jobId, image: img() }) // stale
    fresh.emit({ type: 'result', jobId: fresh.posted[0].jobId, image: img() })
    await expect(p2).resolves.toBeDefined()
  })
})
