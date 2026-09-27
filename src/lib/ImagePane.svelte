<!-- src/lib/ImagePane.svelte -->
<script lang="ts">
  import type { RasterImage } from '../types'
  import type { Viewport } from './viewport.svelte'
  import { pinchStep, type Point } from './viewportMath'

  let {
    image,
    label,
    viewport,
    width,
    height,
    pixelated = false,
  }: {
    image: RasterImage | null
    label: string
    viewport: Viewport
    width: number // view space = output pixels
    height: number
    pixelated?: boolean
  } = $props()

  let el: HTMLDivElement
  let canvas = $state<HTMLCanvasElement | null>(null)
  const pointers = new Map<number, Point>()

  $effect(() => {
    if (!canvas || !image) return
    canvas.width = image.width
    canvas.height = image.height
    canvas
      .getContext('2d')!
      .putImageData(new ImageData(image.data, image.width, image.height), 0, 0)
  })

  function wheel(e: WheelEvent) {
    e.preventDefault()
    const r = el.getBoundingClientRect()
    viewport.wheelAt(e.clientX - r.left, e.clientY - r.top, e.deltaY)
  }
  function down(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent) {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    if (pointers.size === 1) {
      viewport.panBy(cur.x - prev.x, cur.y - prev.y)
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1]
      const s = pinchStep(prev, other, cur, other)
      const r = el.getBoundingClientRect()
      viewport.zoomAt(s.cx - r.left, s.cy - r.top, s.factor)
      viewport.panBy(s.dx, s.dy)
    }
    pointers.set(e.pointerId, cur)
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId)
  }
</script>

<div
  class="pane"
  bind:this={el}
  onwheel={wheel}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  role="img"
  aria-label={label}
>
  <div
    class="layer"
    style:transform={`translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`}
    style:--zoom={viewport.zoom}
  >
    {#if image}
      <canvas
        bind:this={canvas}
        style:width={`${width}px`}
        style:height={`${height}px`}
        style:image-rendering={pixelated ? 'pixelated' : null}
      ></canvas>
    {:else}
      <div class="placeholder" style:width={`${width}px`} style:height={`${height}px`}>
        <span>Not upscaled yet</span>
      </div>
    {/if}
  </div>
  <span class="pane-label">{label}</span>
</div>

<style>
  .pane {
    position: relative;
    overflow: hidden;
    background: var(--color-ground);
    touch-action: none;
    cursor: grab;
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
  .pane-label {
    position: absolute;
    top: 8px;
    left: 10px;
    font-size: 11px;
    color: var(--color-muted);
    background: color-mix(in srgb, var(--color-panel) 85%, transparent);
    padding: 2px 8px;
    border-radius: 4px;
    pointer-events: none;
  }
</style>
