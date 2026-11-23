<!-- src/App.svelte -->
<script lang="ts">
  import type { Ep, ModelId, RasterImage, Scale, UpscaleProgress } from './types'
  import Dropzone from './lib/Dropzone.svelte'
  import ControlsPanel from './lib/ControlsPanel.svelte'
  import CompareView from './lib/CompareView.svelte'
  import ImagePane from './lib/ImagePane.svelte'
  import { Viewport } from './lib/viewport.svelte'
  import { fileToRasterImage, resizeImage } from './lib/decode'
  import { fitInput, MAX_PIXELS_APPLE_TOUCH, MAX_PIXELS_DESKTOP } from './lib/limits'
  import { isAppleTouch, saveToFilesAvailable } from './lib/share'
  import { UpscalerClient, UpscaleError } from './lib/workerClient'
  import { DEFAULT_MODEL } from './lib/models'
  import { encodeImage, exportName, type ExportFormat } from './lib/exportImage'
  import { deliverFile, saveImage } from './lib/saveFile'
  import ShareReadyDialog from './lib/ShareReadyDialog.svelte'
  import AdSlot from './lib/ads/AdSlot.svelte'

  let { fullscreen = $bindable(false) } = $props()

  const client = new UpscalerClient()
  const viewport = new Viewport()
  // ?cpu forces the WebAssembly path (manual QA of the fallback).
  const forceWasm = new URLSearchParams(location.search).has('cpu')
  // iPhone/iPad: Safari's 16.7 MP canvas limit, and only the light model (see modelAvailable).
  const appleTouch = isAppleTouch(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
  const maxPixels = appleTouch ? MAX_PIXELS_APPLE_TOUCH : MAX_PIXELS_DESKTOP

  let original = $state<RasterImage | null>(null) // what gets upscaled (maybe downscaled to fit)
  let source: RasterImage | null = null // the image as loaded, full resolution
  let downscaledFor: Scale | null = null // the scale `original` was shrunk to fit
  let result = $state<RasterImage | null>(null)
  let sourceName = $state<string | undefined>(undefined)
  let modelId = $state<ModelId>(DEFAULT_MODEL)
  let scale = $state<Scale>(4)
  let mode = $state<'split' | 'side'>('side')
  let format = $state<ExportFormat>('image/png')
  let quality = $state(0.92)
  let ep = $state<Ep | null>(null)
  let running = $state(false)
  let stage = $state<string | null>(null)
  let error = $state<{ text: string; retry: boolean } | null>(null)
  let dropError = $state<string | null>(null)
  let saveNotice = $state<string | null>(null)
  let tooBig = $state<{ w: number; h: number } | null>(null)
  // iPhone/iPad save through the share sheet (Save to Files); this holds a file whose tap expired
  // while it was being encoded, until the dialog's button provides a fresh one.
  const saveToFiles = saveToFilesAvailable()
  let shareReady = $state<{ file: File; error: string } | null>(null)
  let dropping = $state(false)
  let viewsW = $state(0)
  let viewsH = $state(0)
  let imageInput: HTMLInputElement

  // View space = output pixels, known before the run so the panes don't jump when it lands.
  const viewW = $derived(original ? original.width * scale : 0)
  const viewH = $derived(original ? original.height * scale : 0)
  const twoColumn = $derived(mode === 'side')

  function fit() {
    const cw = twoColumn ? (viewsW - 2) / 2 : viewsW
    if (viewW && cw > 0) viewport.fitTo(cw, viewsH, viewW, viewH)
  }
  // Refit when the image, scale or layout changes, unless the user has zoomed/panned.
  $effect(() => {
    void [viewW, viewH, viewsW, viewsH, twoColumn]
    if (!viewport.touched) fit()
  })

  $effect(() => {
    fullscreen = !!original
  })

  async function handleFile(file: File) {
    try {
      const img = await fileToRasterImage(file)
      if (running) cancel()
      original = source = img
      downscaledFor = null
      result = null
      sourceName = file.name
      tooBig = null // a size-cap dialog belongs to the image it was raised for
      error = dropError = saveNotice = null
      viewport.touched = false
    } catch {
      dropError = "That file isn't an image this browser can open."
      if (original) error = { text: dropError, retry: false }
    }
  }

  function settingsChanged() {
    result = null
    saveNotice = null
    // A downscale only fits the scale it was made for: go back to full resolution, and let the
    // size check on the next Upscale decide again.
    if (source && downscaledFor !== null && scale !== downscaledFor) {
      original = source
      downscaledFor = null
    }
  }

  function upscale() {
    if (!original) return
    const f = fitInput(original.width, original.height, scale, maxPixels)
    if (!f.ok) {
      tooBig = { w: f.w, h: f.h }
      return
    }
    void run(original)
  }

  function acceptDownscale() {
    if (!original || !tooBig) return
    original = resizeImage(original, tooBig.w, tooBig.h)
    downscaledFor = scale
    tooBig = null
    void run(original)
  }

  function describe(p: UpscaleProgress): string {
    if (p.phase === 'download')
      return p.total
        ? `Downloading model… ${Math.round((p.loaded / p.total) * 100)}%`
        : `Downloading model… ${(p.loaded / 1e6).toFixed(1)} MB`
    if (p.phase === 'init') return 'Starting model…'
    return `Upscaling… tile ${p.done}/${p.total}`
  }

  async function run(img: RasterImage) {
    running = true
    error = null
    saveNotice = null
    stage = 'Starting…'
    try {
      result = await client.upscale(
        img,
        modelId,
        scale,
        forceWasm,
        (p) => (stage = describe(p)),
        (e) => (ep = e),
      )
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled') return
      if (err instanceof UpscaleError && err.kind === 'download')
        error = { text: "Couldn't download the model files. Check your connection.", retry: true }
      else
        error = {
          text: `Upscaling failed (${err instanceof Error ? err.message : String(err)}). Try a smaller image or the General model.`,
          retry: false,
        }
    } finally {
      running = false
      stage = null
    }
  }

  function cancel() {
    client.cancel()
    running = false
    stage = null
  }

  async function save() {
    if (!result) return
    saveNotice = null
    try {
      const blob = await encodeImage(result, format, quality)
      const name = exportName(sourceName, scale, blob.type)
      const fallback =
        blob.type === format
          ? null
          : `This browser can't encode ${format.split('/')[1].toUpperCase()}; saved as ${blob.type.split('/')[1].toUpperCase()}.`
      if (saveToFiles) {
        const file = new File([blob], name, { type: blob.type })
        const r = await deliverFile(file)
        if (r.kind === 'shared') saveNotice = fallback ?? `Sent ${name} to the share sheet.`
        else if (r.kind === 'downloaded') saveNotice = fallback ?? `Downloaded ${name}.`
        else if (r.kind === 'ready') shareReady = { file, error: r.error }
        return
      }
      if ((await saveImage(blob, name)) === 'saved') saveNotice = fallback ?? 'Saved.'
    } catch (err) {
      error = {
        text: `Save failed: ${err instanceof Error ? err.message : String(err)}`,
        retry: false,
      }
    }
  }

  // Drop and paste work over the editor too (the Dropzone owns them on the start screen).
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
  function editorDragOver(e: DragEvent) {
    if (!original || !hasFiles(e)) return
    e.preventDefault()
    dropping = true
  }
  function editorDrop(e: DragEvent) {
    if (!original || !hasFiles(e)) return
    e.preventDefault()
    dropping = false
    const f = e.dataTransfer?.files?.[0]
    if (f) void handleFile(f)
  }
  function editorPaste(e: ClipboardEvent) {
    if (!original) return
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
    const f = item?.getAsFile()
    if (f) void handleFile(f)
  }
</script>

<svelte:window
  ondragover={editorDragOver}
  ondragleave={(e) => {
    if (!e.relatedTarget) dropping = false
  }}
  ondrop={editorDrop}
  onpaste={editorPaste}
/>
<input
  type="file"
  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,image/*"
  hidden
  bind:this={imageInput}
  onchange={() => {
    const f = imageInput.files?.[0]
    if (f) void handleFile(f)
    imageInput.value = ''
  }}
/>

{#if !original}
  <main class="empty">
    <div class="intro">
      <h1>Free Image Upscaler</h1>
      <p>
        Upscale photos and anime ×2 or ×4 with Real-ESRGAN, running on your GPU in the browser.
        Nothing is uploaded.
      </p>
      <Dropzone onfile={handleFile} error={dropError} />
      <AdSlot adSlot="nativeBelowResult" className="ad-native-home" label="Sponsored" />
    </div>
  </main>
{:else}
  <div class="app-grid" class:fullscreen>
    <div class="views" class:side={twoColumn} bind:clientWidth={viewsW} bind:clientHeight={viewsH}>
      {#if mode === 'split'}
        <CompareView {original} {result} {viewport} width={viewW} height={viewH} />
      {:else}
        <ImagePane
          image={original}
          label="Original"
          {viewport}
          width={viewW}
          height={viewH}
          pixelated
        />
        <ImagePane image={result} label="Upscaled" {viewport} width={viewW} height={viewH} />
      {/if}
      {#if stage}<span class="stage-pill">{stage}</span>{/if}
    </div>
    <aside class="panel">
      <ControlsPanel
        bind:modelId
        bind:scale
        bind:mode
        bind:format
        bind:quality
        {ep}
        {appleTouch}
        {running}
        hasResult={!!result}
        inputSize={original}
        {saveNotice}
        onupscale={upscale}
        oncancel={cancel}
        onsave={save}
        onfit={() => {
          viewport.touched = false
          fit()
        }}
        onnew={() => imageInput.click()}
        onsettings={settingsChanged}
      />
      <AdSlot adSlot="nativeBelowResult" className="ad-native-panel" label="Sponsored" />
    </aside>
  </div>
  {#if dropping}<div class="drop-overlay"><span>Drop to open</span></div>{/if}
  {#if error}
    <div class="toast" role="alert">
      {error.text}
      {#if error.retry}<button class="retry" onclick={upscale}>Retry</button>{/if}
      <button onclick={() => (error = null)} aria-label="Dismiss">×</button>
    </div>
  {/if}
  {#if tooBig}
    <div class="scrim">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="too-big-title">
        <h2 id="too-big-title">Image too large for ×{scale}</h2>
        <p>
          {original.width}×{original.height} would produce
          {original.width * scale}×{original.height * scale}. Downscale the input to
          {tooBig.w}×{tooBig.h} first?
        </p>
        <div class="actions">
          <button onclick={() => (tooBig = null)}>Cancel</button>
          <button class="btn-primary" onclick={acceptDownscale}>Downscale and upscale</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

{#if shareReady}
  <ShareReadyDialog
    file={shareReady.file}
    error={shareReady.error}
    onclose={(status) => {
      shareReady = null
      if (status) saveNotice = status
    }}
  />
{/if}

<style>
  .app-grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    grid-template-rows: minmax(0, 1fr);
    height: min(100vh, 100%);
    min-height: 480px;
  }
  .app-grid.fullscreen {
    position: fixed;
    inset: 0;
    z-index: 30;
    height: 100vh;
    min-height: 0;
  }
  .views {
    display: grid;
    min-width: 0;
    position: relative;
    background: var(--color-ground);
  }
  .views.side {
    grid-template-columns: 1fr 1fr;
    gap: 2px;
  }
  .stage-pill {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-panel);
    border: 1px solid var(--color-line);
    color: var(--color-muted);
    font-size: 12px;
    padding: 4px 12px;
    border-radius: 999px;
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
  .panel {
    overflow-y: auto;
    border-left: 1px solid var(--color-line);
    background: var(--color-panel);
  }
  .empty {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .intro {
    max-width: 440px;
    text-align: center;
  }
  .intro h1 {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 0.5rem;
  }
  .intro p {
    font-size: 14px;
    color: var(--color-muted);
    line-height: 1.55;
    margin: 0 0 1.5rem;
  }
  .drop-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 20%, transparent);
    pointer-events: none;
  }
  .drop-overlay span {
    background: var(--color-panel);
    border: 1px solid var(--color-line);
    color: var(--color-text);
    font-size: 14px;
    padding: 8px 16px;
    border-radius: 999px;
  }
  .toast {
    position: fixed;
    bottom: 1rem;
    right: 316px;
    max-width: 360px;
    background: var(--color-panel);
    border: 1px solid var(--color-danger);
    color: var(--color-text);
    font-size: 12px;
    padding: 8px 12px;
    border-radius: 6px;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.4);
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .toast button[aria-label='Dismiss'] {
    height: auto;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-muted);
    font-size: 16px;
  }
  .scrim {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 0.5);
  }
  .dialog {
    max-width: 380px;
    background: var(--color-panel);
    border: 1px solid var(--color-line);
    border-radius: 8px;
    padding: 16px;
    font-size: 12px;
  }
  .dialog h2 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .dialog p {
    margin: 0 0 16px;
    color: var(--color-muted);
    line-height: 1.5;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
</style>
