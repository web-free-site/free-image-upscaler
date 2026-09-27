import type { RasterImage } from '../types'

/** RGBA bytes → planar float RGB in [0,1] ([R…, G…, B…]), the models' NCHW input. */
export function toPlanarRgb(img: RasterImage): Float32Array {
  const n = img.width * img.height
  const f = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) {
    f[i] = img.data[i * 4] / 255
    f[n + i] = img.data[i * 4 + 1] / 255
    f[2 * n + i] = img.data[i * 4 + 2] / 255
  }
  return f
}

/** Planar float RGB in [0,1] → opaque RGBA bytes. */
export function fromPlanarRgb(f: Float32Array, w: number, h: number): RasterImage {
  const n = w * h
  const data = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    data[i * 4] = Math.round(f[i] * 255)
    data[i * 4 + 1] = Math.round(f[n + i] * 255)
    data[i * 4 + 2] = Math.round(f[2 * n + i] * 255)
    data[i * 4 + 3] = 255
  }
  return { width: w, height: h, data }
}

export function hasAlpha(img: RasterImage): boolean {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return true
  return false
}

export function alphaOf(img: RasterImage): Uint8ClampedArray {
  const a = new Uint8ClampedArray(img.width * img.height)
  for (let i = 0; i < a.length; i++) a[i] = img.data[i * 4 + 3]
  return a
}

export function setAlpha(img: RasterImage, alpha: Uint8ClampedArray): void {
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i]
}

/** Single-channel bilinear resize with pixel-centre alignment (edges clamp). */
export function resizeChannelBilinear(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  tw: number,
  th: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tw * th)
  for (let y = 0; y < th; y++) {
    const sy = Math.min(h - 1, Math.max(0, ((y + 0.5) * h) / th - 0.5))
    const y0 = Math.floor(sy)
    const y1 = Math.min(h - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(w - 1, Math.max(0, ((x + 0.5) * w) / tw - 0.5))
      const x0 = Math.floor(sx)
      const x1 = Math.min(w - 1, x0 + 1)
      const fx = sx - x0
      const top = src[y0 * w + x0] * (1 - fx) + src[y0 * w + x1] * fx
      const bot = src[y1 * w + x0] * (1 - fx) + src[y1 * w + x1] * fx
      out[y * tw + x] = Math.round(top * (1 - fy) + bot * fy)
    }
  }
  return out
}

/** Copy of `img` whose fully transparent pixels take the colour of the nearest visible pixel
 *  (4-neighbour BFS). Canvases store premultiplied colour, so transparent pixels arrive as black;
 *  the RGB-only model would smear that black into anti-aliased edges as a dark fringe. */
export function bleedTransparent(img: RasterImage): RasterImage {
  const { width: w, height: h } = img
  const data = img.data.slice()
  const done = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let tail = 0
  for (let i = 0; i < w * h; i++)
    if (data[i * 4 + 3] > 0) {
      done[i] = 1
      queue[tail++] = i
    }
  for (let head = 0; head < tail; head++) {
    const i = queue[head]
    const x = i % w
    const y = (i - x) / w
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ]) {
      if (j < 0 || done[j]) continue
      done[j] = 1
      data[j * 4] = data[i * 4]
      data[j * 4 + 1] = data[i * 4 + 1]
      data[j * 4 + 2] = data[i * 4 + 2]
      queue[tail++] = j
    }
  }
  return { width: w, height: h, data }
}
