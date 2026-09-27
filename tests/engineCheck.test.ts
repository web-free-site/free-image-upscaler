import { describe, it, expect } from 'vitest'
import { classifyInitError } from '../src/worker/engineCheck'
import { ModelDownloadError } from '../src/lib/modelCache'

const original = new Error('failed to fetch dynamically imported module')

describe('classifyInitError', () => {
  it('turns a session-creation failure into a download error when the CDN is unreachable', async () => {
    const err = await classifyInitError(original, async () => false)
    expect(err).toBeInstanceOf(ModelDownloadError)
  })
  it('treats a probe that throws (offline) as unreachable', async () => {
    const err = await classifyInitError(original, async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(err).toBeInstanceOf(ModelDownloadError)
  })
  it('keeps the original error when the CDN is reachable (a real engine/model problem)', async () => {
    expect(await classifyInitError(original, async () => true)).toBe(original)
  })
})
