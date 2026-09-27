/** Saving the result. Three paths, picked by what the browser can do (as in slop-vectorizer):
 *  - iPad / iPhone: the share sheet's Save to Files (`deliverFile`), since Safari has no picker.
 *    Encoding can outlast the tap, so an expired tap falls through to ShareReadyDialog.
 *  - Chromium desktop: the File System Access save picker (`saveImage`).
 *  - Everything else (Firefox, desktop Safari): a plain download (`saveImage`). */
import { canShareFile, shareFile, type ShareOutcome } from './share'

declare global {
  interface Window {
    showSaveFilePicker?: (opts: {
      suggestedName: string
      types: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<FileSystemFileHandle>
  }
}

// iPad can cancel a download whose object URL is revoked too soon.
const REVOKE_DELAY_MS = 60_000

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

/** Desktop save: the picker where there is one, otherwise a download. */
export async function saveImage(blob: Blob, name: string): Promise<'saved' | 'cancelled'> {
  if (window.showSaveFilePicker) {
    const ext = '.' + name.split('.').pop()
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'Image', accept: { [blob.type]: [ext] } }],
      })
      const w = await h.createWritable()
      await w.write(blob)
      await w.close()
      return 'saved'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      throw err
    }
  }
  downloadBlob(blob, name)
  return 'saved'
}

/** What happened to a file sent toward Save to Files. `ready` means the caller should raise the
 *  fresh-tap dialog. */
export type DeliverResult =
  | { kind: 'shared' }
  | { kind: 'dismissed' }
  | { kind: 'downloaded' }
  | { kind: 'ready'; error: string }

/** Injected for tests; the app passes nothing and gets the real ones. */
export type DeliverDeps = {
  canShare?: (file: File) => boolean
  share?: (file: File) => Promise<{ outcome: ShareOutcome; error?: unknown }>
  download?: (blob: Blob, name: string) => void
}

/** Send a finished file toward Save to Files; the caller has checked `saveToFilesAvailable()`.
 *  Anything but a completed or dismissed sheet falls through to the dialog, where a fresh tap
 *  opens it. Ported from slop-vectorizer/src/lib/saveFile.ts. */
export async function deliverFile(file: File, deps: DeliverDeps = {}): Promise<DeliverResult> {
  const canShare = deps.canShare ?? canShareFile
  const share = deps.share ?? shareFile
  const download = deps.download ?? downloadBlob

  if (!canShare(file)) {
    download(file, file.name)
    return { kind: 'downloaded' }
  }
  const r = await share(file)
  if (r.outcome === 'shared') return { kind: 'shared' }
  if (r.outcome === 'dismissed') return { kind: 'dismissed' }
  // An expired tap is expected and needs no message; a real failure carries the browser's own.
  return { kind: 'ready', error: r.outcome === 'failed' ? errorMessage(r.error) : '' }
}
