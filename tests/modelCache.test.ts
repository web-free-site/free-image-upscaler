import { describe, it, expect } from 'vitest'
import { loadModel, ModelDownloadError, type CacheLike } from '../src/lib/modelCache'

function memCache(): CacheLike & { store: Map<string, Uint8Array<ArrayBuffer>> } {
  const store = new Map<string, Uint8Array<ArrayBuffer>>()
  return {
    store,
    async match(url) {
      const b = store.get(url)
      return b ? new Response(b) : undefined
    },
    async put(url, res) {
      store.set(url, new Uint8Array(await res.arrayBuffer()))
    },
  }
}

const bytes = new Uint8Array([1, 2, 3, 4, 5, 6])
const okFetch = (async () =>
  new Response(bytes, { headers: { 'content-length': '6' } })) as unknown as typeof fetch

describe('loadModel', () => {
  it('downloads with progress and caches', async () => {
    const cache = memCache()
    const seen: [number, number][] = []
    const got = await loadModel('/m.onnx', (l, t) => seen.push([l, t]), cache, okFetch)
    expect([...got]).toEqual([...bytes])
    expect(seen.at(-1)).toEqual([6, 6])
    expect([...cache.store.get('/m.onnx')!]).toEqual([...bytes])
  })
  it('serves from cache without fetching', async () => {
    const cache = memCache()
    cache.store.set('/m.onnx', bytes)
    const failFetch = (async () => {
      throw new Error('should not fetch')
    }) as unknown as typeof fetch
    expect([...(await loadModel('/m.onnx', () => {}, cache, failFetch))]).toEqual([...bytes])
  })
  it('throws ModelDownloadError on HTTP errors', async () => {
    const f = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch
    await expect(loadModel('/m.onnx', () => {}, memCache(), f)).rejects.toBeInstanceOf(
      ModelDownloadError,
    )
  })
  it('does not cache a download interrupted mid-stream', async () => {
    const cache = memCache()
    const f = (async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array([1, 2]))
            c.error(new Error('network lost'))
          },
        }),
      )) as unknown as typeof fetch
    await expect(loadModel('/m.onnx', () => {}, cache, f)).rejects.toBeInstanceOf(
      ModelDownloadError,
    )
    expect(cache.store.size).toBe(0)
  })
  it('works without a cache (storage unavailable)', async () => {
    expect([...(await loadModel('/m.onnx', () => {}, null, okFetch))]).toEqual([...bytes])
  })
})

describe('loadModel size check', () => {
  it('rejects and does not cache a body of the wrong size (captive portal, proxy page)', async () => {
    const cache = memCache()
    const html = (async () =>
      new Response('<html>login</html>', {
        headers: { 'content-type': 'text/html' },
      })) as unknown as typeof fetch
    await expect(loadModel('/m.onnx', () => {}, cache, html, 6)).rejects.toBeInstanceOf(
      ModelDownloadError,
    )
    expect(cache.store.size).toBe(0)
  })
  it('accepts a body of the expected size', async () => {
    const cache = memCache()
    expect([...(await loadModel('/m.onnx', () => {}, cache, okFetch, 6))]).toEqual([...bytes])
    expect(cache.store.size).toBe(1)
  })
})
