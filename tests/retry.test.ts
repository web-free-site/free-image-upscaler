import { describe, it, expect } from 'vitest'
import { withCpuRetry } from '../src/worker/retry'

const fail = (msg: string) => {
  throw new Error(msg)
}

describe('withCpuRetry', () => {
  it('returns the first result without retrying', async () => {
    const calls: boolean[] = []
    const r = await withCpuRetry(async (cpu) => (calls.push(cpu), 'ok'), {
      forceWasm: false,
      isGpu: () => true,
      retryable: () => true,
      reset: async () => {},
    })
    expect(r).toBe('ok')
    expect(calls).toEqual([false])
  })
  it('resets and reruns on the CPU after a GPU runtime failure', async () => {
    const calls: boolean[] = []
    let resets = 0
    const r = await withCpuRetry(
      async (cpu) => {
        calls.push(cpu)
        return cpu ? 'cpu' : fail('device lost')
      },
      {
        forceWasm: false,
        isGpu: () => true,
        retryable: () => true,
        reset: async () => void resets++,
      },
    )
    expect(r).toBe('cpu')
    expect(calls).toEqual([false, true])
    expect(resets).toBe(1)
  })
  it('resets but does not retry a non-retryable (download) error', async () => {
    let resets = 0
    await expect(
      withCpuRetry(async () => fail('HTTP 404'), {
        forceWasm: false,
        isGpu: () => true,
        retryable: () => false,
        reset: async () => void resets++,
      }),
    ).rejects.toThrow('HTTP 404')
    expect(resets).toBe(1)
  })
  it('does not retry when the failure was already on the CPU', async () => {
    const calls: boolean[] = []
    await expect(
      withCpuRetry(async (cpu) => (calls.push(cpu), fail('oom')), {
        forceWasm: false,
        isGpu: () => false,
        retryable: () => true,
        reset: async () => {},
      }),
    ).rejects.toThrow('oom')
    expect(calls).toEqual([false])
  })
  it('surfaces the CPU error if the retry also fails', async () => {
    await expect(
      withCpuRetry(async (cpu) => fail(cpu ? 'cpu broke' : 'gpu broke'), {
        forceWasm: false,
        isGpu: () => true,
        retryable: () => true,
        reset: async () => {},
      }),
    ).rejects.toThrow('cpu broke')
  })
})
