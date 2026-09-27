import type { RasterImage } from '../types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Core rectangles (no padding) covering the image row by row; edge tiles are smaller. */
export function planTiles(width: number, height: number, tile: number): Rect[] {
  const rects: Rect[] = []
  for (let y = 0; y < height; y += tile)
    for (let x = 0; x < width; x += tile)
      rects.push({ x, y, w: Math.min(tile, width - x), h: Math.min(tile, height - y) })
  return rects
}

/** Mirror index i into [0, n) without repeating the edge pixel (…2 1 |0 1 2 3| 2 1…).
 *  Periodic, so any offset works, including pads larger than the image. */
export function reflect(i: number, n: number): number {
  if (n === 1) return 0
  const period = 2 * (n - 1)
  const m = ((i % period) + period) % period
  return m < n ? m : period - m
}

/** The core rect grown by `pad` on every side, reflect-padded at image edges. */
export function extractTile(img: RasterImage, r: Rect, pad: number): RasterImage {
  const w = r.w + 2 * pad
  const h = r.h + 2 * pad
  const data = new Uint8ClampedArray(w * h * 4)
  for (let ty = 0; ty < h; ty++) {
    const sy = reflect(r.y - pad + ty, img.height)
    for (let tx = 0; tx < w; tx++) {
      const s = (sy * img.width + reflect(r.x - pad + tx, img.width)) * 4
      const d = (ty * w + tx) * 4
      data[d] = img.data[s]
      data[d + 1] = img.data[s + 1]
      data[d + 2] = img.data[s + 2]
      data[d + 3] = img.data[s + 3]
    }
  }
  return { width: w, height: h, data }
}

/** Write an upscaled padded tile's core into `out`: drop pad*scale px per side, place at r*scale. */
export function pasteTile(
  out: RasterImage,
  tile: RasterImage,
  r: Rect,
  pad: number,
  scale: number,
): void {
  const p = pad * scale
  const cw = r.w * scale
  const ch = r.h * scale
  for (let y = 0; y < ch; y++) {
    const s = ((y + p) * tile.width + p) * 4
    const d = ((r.y * scale + y) * out.width + r.x * scale) * 4
    out.data.set(tile.data.subarray(s, s + cw * 4), d)
  }
}
