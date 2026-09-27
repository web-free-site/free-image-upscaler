import { ModelDownloadError } from '../lib/modelCache'

/** ORT fetches its .wasm from jsDelivr during session creation, and a failed fetch surfaces as an
 *  opaque runtime error. If the CDN can't be reached, report it as a download error instead, so the
 *  UI offers Retry rather than "try a smaller image". */
export async function classifyInitError(
  err: unknown,
  reachable: () => Promise<boolean>,
): Promise<unknown> {
  let ok = false
  try {
    ok = await reachable()
  } catch {
    // offline
  }
  return ok ? err : new ModelDownloadError("couldn't reach the engine download (cdn.jsdelivr.net)")
}
