import { describe, expect, it } from 'vitest'
import { deliverFile, type DeliverDeps } from '../src/lib/saveFile'
import type { ShareOutcome } from '../src/lib/share'

// Ported from slop-vectorizer/tests/saveFile.test.ts.
const file = new File([new Uint8Array([1, 2, 3])], 'photo@4x.png', { type: 'image/png' })

function deps(over: Partial<DeliverDeps> = {}) {
  const downloaded: { blob: Blob; name: string }[] = []
  const d: DeliverDeps = {
    canShare: () => true,
    share: async () => ({ outcome: 'shared' as ShareOutcome }),
    download: (blob, name) => void downloaded.push({ blob, name }),
    ...over,
  }
  return { d, downloaded }
}

describe('deliverFile', () => {
  it('downloads, without sharing, when the browser refuses the file type', async () => {
    let shared = false
    const { d, downloaded } = deps({
      canShare: () => false,
      share: async () => {
        shared = true
        return { outcome: 'shared' }
      },
    })
    expect(await deliverFile(file, d)).toEqual({ kind: 'downloaded' })
    expect(shared).toBe(false)
    expect(downloaded).toEqual([{ blob: file, name: 'photo@4x.png' }])
  })
  it('reports a completed sheet as shared', async () => {
    expect(await deliverFile(file, deps().d)).toEqual({ kind: 'shared' })
  })
  it('reports a closed sheet as dismissed, not a failure', async () => {
    const { d } = deps({ share: async () => ({ outcome: 'dismissed' }) })
    expect(await deliverFile(file, d)).toEqual({ kind: 'dismissed' })
  })
  it('falls back to the dialog with no error text when the tap expired', async () => {
    const { d } = deps({ share: async () => ({ outcome: 'needs-tap' }) })
    expect(await deliverFile(file, d)).toEqual({ kind: 'ready', error: '' })
  })
  it("falls back to the dialog carrying the browser's message when sharing failed", async () => {
    const { d } = deps({ share: async () => ({ outcome: 'failed', error: new Error('no sheet') }) })
    expect(await deliverFile(file, d)).toEqual({ kind: 'ready', error: 'no sheet' })
  })
})
