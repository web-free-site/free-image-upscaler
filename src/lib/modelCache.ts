export class ModelDownloadError extends Error {}

export interface CacheLike {
  match(url: string): Promise<Response | undefined>
  put(url: string, res: Response): Promise<void>
}

// Bump the suffix if a model file changes at the same URL.
const CACHE_NAME = 'slop-upscaler-models-v1'

export async function openModelCache(): Promise<CacheLike | null> {
  try {
    return await caches.open(CACHE_NAME)
  } catch {
    return null // private mode / storage blocked: download every time
  }
}

/** Model bytes from the cache, or downloaded with progress and then cached. Only a complete
 *  download of the expected size is cached — a partial file, or a 200 that is really a captive
 *  portal or proxy page, would make every later session creation fail. */
export async function loadModel(
  url: string,
  onProgress: (loaded: number, total: number) => void,
  cache: CacheLike | null,
  fetchFn: typeof fetch = fetch,
  expectedBytes?: number,
): Promise<Uint8Array> {
  const hit = await cache?.match(url)
  if (hit) return new Uint8Array(await hit.arrayBuffer())

  const chunks: Uint8Array[] = []
  let loaded = 0
  try {
    const res = await fetchFn(url)
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    const total = Number(res.headers.get('content-length')) || 0
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      onProgress(loaded, total)
    }
  } catch (err) {
    throw new ModelDownloadError(err instanceof Error ? err.message : String(err))
  }
  if (expectedBytes !== undefined && loaded !== expectedBytes)
    throw new ModelDownloadError(`got ${loaded} bytes, expected ${expectedBytes}`)
  const bytes = new Uint8Array(loaded)
  let o = 0
  for (const c of chunks) {
    bytes.set(c, o)
    o += c.length
  }
  try {
    await cache?.put(url, new Response(bytes))
  } catch {
    // quota exceeded: still usable this session
  }
  return bytes
}
