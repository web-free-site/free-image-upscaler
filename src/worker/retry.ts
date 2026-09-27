export interface RetryOptions {
  forceWasm: boolean // the user asked for CPU (?cpu): nothing to fall back to
  isGpu: () => boolean // was the failed attempt on WebGPU? (read before reset)
  retryable: (err: unknown) => boolean // false for download errors: the CPU needs the same bytes
  reset: () => Promise<void> // drop the failed session so the next job doesn't reuse it
}

/** Run once; after any failure drop the session, and if it failed on the GPU (device lost,
 *  buffer too large for this adapter), rerun once on WebAssembly. */
export async function withCpuRetry<T>(
  run: (forceWasm: boolean) => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  try {
    return await run(opts.forceWasm)
  } catch (err) {
    const gpu = opts.isGpu()
    await opts.reset()
    if (opts.forceWasm || !gpu || !opts.retryable(err)) throw err
    console.warn('[upscaler] WebGPU run failed, retrying on WASM', err)
    try {
      return await run(true)
    } catch (err2) {
      await opts.reset()
      throw err2
    }
  }
}
