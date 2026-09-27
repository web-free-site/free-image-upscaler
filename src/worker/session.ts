import * as ort from 'onnxruntime-web/webgpu'
import type { Ep } from '../types'

// The WebGPU .wasm (~28 MB) is over Cloudflare's 25 MiB per-asset limit, so all ORT binaries
// come from jsDelivr, pinned to the exact version bundled here.
const CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}`
ort.env.wasm.wasmPaths = `${CDN}/dist/`
// Threads need SharedArrayBuffer, i.e. a cross-origin-isolated page (public/_headers).
ort.env.wasm.numThreads = self.crossOriginIsolated
  ? Math.min(8, navigator.hardwareConcurrency || 4)
  : 1

/** Whether the CDN serving ORT's binaries answers (used to classify session-creation failures). */
export async function engineReachable(): Promise<boolean> {
  const res = await fetch(`${CDN}/package.json`, { method: 'HEAD' })
  return res.ok
}

export async function createSession(
  model: Uint8Array,
  forceWasm: boolean,
): Promise<{ session: ort.InferenceSession; ep: Ep }> {
  if (!forceWasm && 'gpu' in navigator) {
    try {
      const session = await ort.InferenceSession.create(model, { executionProviders: ['webgpu'] })
      return { session, ep: 'webgpu' }
    } catch (err) {
      console.warn('[upscaler] WebGPU session failed, falling back to WASM', err)
    }
  }
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] })
  return { session, ep: 'wasm' }
}

export async function runTile(
  session: ort.InferenceSession,
  input: Float32Array,
  w: number,
  h: number,
): Promise<Float32Array> {
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, h, w]) }
  const out = (await session.run(feeds))[session.outputNames[0]]
  const data = out.data as Float32Array
  for (let i = 0; i < data.length; i++) data[i] = Math.min(1, Math.max(0, data[i]))
  out.dispose()
  return data
}
