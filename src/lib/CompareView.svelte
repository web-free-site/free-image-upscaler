<!-- src/lib/CompareView.svelte -->
<script lang="ts">
  import type { RasterImage } from '../types'
  import type { Viewport } from './viewport.svelte'
  import { pinchStep, type Point } from './viewportMath'

  let {
    original,
    result,
    viewport,
    width,
    height,
  }: {
    original: RasterImage
    result: RasterImage | null // null: not upscaled yet, right half shows a placeholder
    viewport: Viewport
    width: number // view space = output pixels
    height: number
  } = $props()

  let divider = $state(50) // percent
  let container: HTMLDivElement
  let origCanvas = $state<HTMLCanvasElement | null>(null)
  let resultCanvas = $state<HTMLCanvasElement | null>(null)
  const pointers = new Map<number, Point>()
  let draggingDivider = false

  function paint(canvas: HTMLCanvasElement | null, img: RasterImage) {
    if (!canvas) return
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')!.putImageData(new ImageData(img.data, img.width, img.height), 0, 0)
  }
  $effect(() => paint(origCanvas, original))
  $effect(() => {
    if (result) paint(resultCanvas, result)
  })

  function wheel(e: WheelEvent) {
    e.preventDefault()
    const r = container.getBoundingClientRect()
    viewport.wheelAt(e.clientX - r.left, e.clientY - r.top, e.deltaY)
  }
  function down(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent) {
    if (draggingDivider) {
      const r = container.getBoundingClientRect()
      divider = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100))
      return
    }
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    if (pointers.size === 1) {
      viewport.panBy(cur.x - prev.x, cur.y - prev.y)
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1]
      const s = pinchStep(prev, other, cur, other)
      const r = container.getBoundingClientRect()
      viewport.zoomAt(s.cx - r.left, s.cy - r.top, s.factor)
      viewport.panBy(s.dx, s.dy)
    }
    pointers.set(e.pointerId, cur)
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId)
    draggingDivider = false
  }
</script>

<div
  class="compare"
  bind:this={container}
  onwheel={wheel}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  role="img"
  aria-label="Compare original and upscaled"
>
  <!-- clip-path lives on an UNtransformed wrapper so it stays in screen space
       (aligned with the divider line); the transform is on the inner layer. -->
  <div class="clip" style:clip-path={`inset(0 ${100 - divider}% 0 0)`}>
    <div
      class="layer"
      style:transform={`translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`}
      style:--zoom={viewport.zoom}
    >
      <canvas
        bind:this={origCanvas}
        style:width={`${width}px`}
        style:height={`${height}px`}
        style:image-rendering="pixelated"
      ></canvas>
    </div>
  </div>
  <div class="clip" style:clip-path={`inset(0 0 0 ${divider}%)`}>
    <div
      class="layer"
      style:transform={`translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`}
      style:--zoom={viewport.zoom}
    >
      {#if result}
        <canvas bind:this={resultCanvas} style:width={`${width}px`} style:height={`${height}px`}
        ></canvas>
      {:else}
        <div class="placeholder" style:width={`${width}px`} style:height={`${height}px`}>
          <span>Not upscaled yet</span>
        </div>
      {/if}
    </div>
  </div>
  <span class="tag left">Original</span>
  <span class="tag right">Upscaled</span>
  <div
    class="divider"
    style:left={`${divider}%`}
    onpointerdown={(e) => {
      e.stopPropagation()
      draggingDivider = true
      ;(e.target as Element).setPointerCapture(e.pointerId)
    }}
    onpointermove={move}
    onpointerup={up}
    onkeydown={(e) => {
      if (e.key === 'ArrowLeft') divider = Math.max(2, divider - 2)
      else if (e.key === 'ArrowRight') divider = Math.min(98, divider + 2)
      else return
      e.preventDefault()
    }}
    role="slider"
    aria-label="Comparison divider"
    aria-orientation="vertical"
    aria-valuenow={Math.round(divider)}
    aria-valuemin={2}
    aria-valuemax={98}
    tabindex="0"
  ></div>
</div>

<style>
  .compare {
    position: relative;
    overflow: hidden;
    height: 100%;
    background: var(--color-ground);
    touch-action: none;
    cursor: grab;
  }
  .clip {
    position: absolute;
    inset: 0;
  }
  .layer {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
  }
  /* Checker on the artwork itself; 16 screen px at any zoom. */
  .layer canvas {
    display: block;
    --check: calc(16px / var(--zoom, 1));
    background: repeating-conic-gradient(var(--color-check-b) 0% 25%, var(--color-check-a) 0% 50%) 0
      0 / var(--check) var(--check);
  }
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    border: calc(2px / var(--zoom, 1)) dashed var(--color-line);
    box-sizing: border-box;
  }
  .placeholder span {
    color: var(--color-muted);
    font-size: calc(12px / var(--zoom, 1));
  }
  .tag {
    position: absolute;
    top: 8px;
    font-size: 11px;
    color: var(--color-muted);
    background: var(--color-panel);
    border: 1px solid var(--color-line);
    border-radius: 999px;
    padding: 2px 8px;
    pointer-events: none;
  }
  .tag.left {
    left: 8px;
  }
  .tag.right {
    right: 8px;
  }
  .divider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 8px;
    margin-left: -4px;
    cursor: col-resize;
    background: transparent;
  }
  .divider::after {
    content: '';
    position: absolute;
    inset: 0 3px;
    background: var(--color-accent);
  }
</style>
