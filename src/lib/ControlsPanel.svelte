<!-- src/lib/ControlsPanel.svelte -->
<script lang="ts">
  import { Columns2, SquareSplitHorizontal, Maximize, ImagePlus } from '@lucide/svelte'
  import type { Ep, ModelId, Scale } from '../types'
  import { MODELS, MODEL_ORDER, modelAvailable } from './models'
  import type { ExportFormat } from './exportImage'
  import { sliderFill } from './sliderFill'

  let {
    modelId = $bindable(),
    scale = $bindable(),
    mode = $bindable(),
    format = $bindable(),
    quality = $bindable(),
    ep,
    appleTouch,
    running,
    hasResult,
    inputSize,
    saveNotice,
    onupscale,
    oncancel,
    onsave,
    onfit,
    onnew,
    onsettings,
  }: {
    modelId: ModelId
    scale: Scale
    mode: 'split' | 'side'
    format: ExportFormat
    quality: number
    ep: Ep | null
    appleTouch: boolean // iPhone/iPad: the heavy models are unavailable
    running: boolean
    hasResult: boolean
    inputSize: { width: number; height: number }
    saveNotice: string | null
    onupscale: () => void
    oncancel: () => void
    onsave: () => void
    onfit: () => void
    onnew: () => void
    onsettings: () => void // model or scale changed: the old result no longer matches
  } = $props()

  const SCALES: Scale[] = [2, 4]
  const mb = (b: number) => `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB`
</script>

<div class="cp">
  <header class="top">
    <strong>slop-image-upscaler</strong>
    <button class="icon-btn" onclick={onnew} title="Open another image"
      ><ImagePlus size={16} /></button
    >
  </header>

  <section>
    <h2 class="section-head">View</h2>
    <div class="body">
      <div class="icon-row">
        <button
          class="icon-btn"
          class:ui-on={mode === 'side'}
          aria-pressed={mode === 'side'}
          onclick={() => (mode = 'side')}
          title="Side by side"><Columns2 size={16} /></button
        >
        <button
          class="icon-btn"
          class:ui-on={mode === 'split'}
          aria-pressed={mode === 'split'}
          onclick={() => (mode = 'split')}
          title="Split"><SquareSplitHorizontal size={16} /></button
        >
        <button class="icon-btn" onclick={onfit} title="Fit"><Maximize size={16} /></button>
      </div>
    </div>
  </section>

  <section>
    <h2 class="section-head">Upscale</h2>
    <div class="body">
      <label class="select-row">
        <span class="name">Model</span>
        <select bind:value={modelId} onchange={onsettings} disabled={running}>
          {#each MODEL_ORDER as id (id)}
            <option value={id} disabled={!modelAvailable(MODELS[id], appleTouch)}
              >{MODELS[id].label} · {modelAvailable(MODELS[id], appleTouch)
                ? mb(MODELS[id].bytes)
                : 'desktop only'}</option
            >
          {/each}
        </select>
      </label>
      {#if appleTouch}
        <p class="hint">
          Anime and Photo models need more memory than iPhone/iPad Safari allows; use them on a
          desktop browser.
        </p>
      {/if}
      {#if MODELS[modelId].slowOnCpu && ep === 'wasm'}
        <p class="notice">Slow on CPU — this can take minutes per image.</p>
      {/if}
      <div class="select-row">
        <span class="name">Scale</span>
        <div class="icon-row">
          {#each SCALES as s (s)}
            <button
              class:ui-on={scale === s}
              aria-pressed={scale === s}
              disabled={running}
              onclick={() => {
                scale = s
                onsettings()
              }}>×{s}</button
            >
          {/each}
        </div>
      </div>
      <p class="hint">
        {inputSize.width}×{inputSize.height} → {inputSize.width * scale}×{inputSize.height * scale}
      </p>
      <div class="save-buttons">
        {#if running}
          <button class="grow" onclick={oncancel}>Cancel</button>
        {:else}
          <button class="btn-primary grow" onclick={onupscale}>Upscale</button>
        {/if}
      </div>
      {#if ep}
        <p class="hint">Running on {ep === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WebAssembly)'}</p>
      {/if}
    </div>
  </section>

  <section class="save">
    <label class="select-row">
      <span class="name">Format</span>
      <select bind:value={format}>
        <option value="image/png">PNG</option>
        <option value="image/jpeg">JPEG</option>
        <option value="image/webp">WebP</option>
      </select>
    </label>
    {#if format !== 'image/png'}
      <label class="slider-row">
        <span class="name">Quality</span>
        <input
          type="range"
          min="0.5"
          max="1"
          step="0.01"
          bind:value={quality}
          style={sliderFill(quality, 0.5, 1)}
        />
        <span class="value">{Math.round(quality * 100)}</span>
      </label>
    {/if}
    <div class="save-buttons">
      <button class="grow" disabled={!hasResult || running} onclick={onsave}>Save image</button>
    </div>
    {#if saveNotice}<p class="hint">{saveNotice}</p>{/if}
  </section>

  <footer>Real-ESRGAN models (BSD-3). Runs entirely in your browser — nothing is uploaded.</footer>
</div>

<style>
  .cp {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    font-size: 12px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 44px;
    padding: 0 12px;
    flex-shrink: 0;
  }
  .top strong {
    font-size: 14px;
    font-weight: 600;
  }
  .section-head {
    margin: 0;
    height: 32px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    background: var(--color-raised);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-muted);
    justify-content: space-between;
  }
  .body {
    padding: 8px 12px 12px;
  }
  .name {
    color: var(--color-muted);
    white-space: nowrap;
  }
  .select-row,
  .slider-row {
    display: grid;
    align-items: center;
    gap: 8px;
    min-height: var(--ctl-h);
    margin: 2px 0;
  }
  .select-row {
    grid-template-columns: 1fr auto;
  }
  .select-row select {
    max-width: 190px;
  }
  .slider-row {
    grid-template-columns: 76px minmax(0, 1fr) 32px;
  }
  .value {
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .icon-row {
    display: flex;
    gap: 4px;
  }
  .icon-btn {
    width: var(--ctl-h);
    padding: 0;
  }
  .save {
    padding: 12px;
    border-top: 1px solid var(--color-line);
  }
  .save-buttons {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }
  .grow {
    flex: 1;
  }
  .hint {
    margin: 6px 0 0;
    color: var(--color-muted);
    font-size: 11px;
    overflow-wrap: anywhere;
  }
  .notice {
    margin: 0 0 4px;
    color: var(--color-warn);
  }
  footer {
    margin-top: auto;
    padding: 8px 12px;
    color: var(--color-muted);
    font-size: 11px;
  }
</style>
