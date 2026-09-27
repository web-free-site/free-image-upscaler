import { describe, it, expect } from 'vitest'
import { upscaleImage, type UpscaleDeps } from '../src/worker/upscaleCore'
import type { RasterImage } from '../src/types'

function noise(w: number, h: number, alpha = 255): RasterImage {
  const data = new Uint8ClampedArray(w * h * 4)
  let s = 12345
  for (let i = 0; i < data.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    data[i] = i % 4 === 3 ? alpha : s % 256
  }
  return { width: w, height: h, data }
}

/** Nearest-neighbour RGBA upscale by k — the reference a seamless tiler must reproduce exactly. */
function nearest(img: RasterImage, k: number): RasterImage {
  const w = img.width * k
  const h = img.height * k
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / k) * img.width + Math.floor(x / k)) * 4
      data.set(img.data.subarray(s, s + 4), (y * w + x) * 4)
    }
  return { width: w, height: h, data }
}

// Fake model: planar RGB nearest ×4. Fake resize: nearest downsample by integer factor.
const deps: UpscaleDeps = {
  async run(input, w, h) {
    const n = w * h
    const W = w * 4
    const out = new Float32Array(3 * n * 16)
    for (let c = 0; c < 3; c++)
      for (let y = 0; y < h * 4; y++)
        for (let x = 0; x < W; x++)
          out[c * n * 16 + y * W + x] = input[c * n + Math.floor(y / 4) * w + Math.floor(x / 4)]
    return out
  },
  async resize(img, tw, th) {
    const k = img.width / tw
    const data = new Uint8ClampedArray(tw * th * 4)
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const s = (y * k * img.width + x * k) * 4
        data.set(img.data.subarray(s, s + 4), (y * tw + x) * 4)
      }
    return { width: tw, height: th, data }
  },
}

describe('upscaleImage', () => {
  for (const [w, h, tile] of [
    [37, 23, 8],
    [3, 5, 256],
    [1, 1, 256],
    [16, 16, 16],
  ]) {
    it(`×4 tiled equals whole-image nearest ×4 (${w}x${h}, tile ${tile})`, async () => {
      const img = noise(w, h)
      const out = await upscaleImage(img, { tile, pad: 4, modelScale: 4, outScale: 4 }, deps)
      expect(out.width).toBe(w * 4)
      expect(out.data).toEqual(nearest(img, 4).data)
    })
  }
  it('×2 via per-tile downscale equals nearest ×2', async () => {
    const img = noise(29, 17)
    const out = await upscaleImage(img, { tile: 8, pad: 4, modelScale: 4, outScale: 2 }, deps)
    expect(out.data).toEqual(nearest(img, 2).data)
  })
  it('reports progress once per tile', async () => {
    const calls: [number, number][] = []
    await upscaleImage(
      noise(20, 10),
      { tile: 8, pad: 2, modelScale: 4, outScale: 4, onTile: (d, t) => calls.push([d, t]) },
      deps,
    )
    expect(calls).toEqual([
      [1, 6],
      [2, 6],
      [3, 6],
      [4, 6],
      [5, 6],
      [6, 6],
    ])
  })
  it('carries a transparent alpha channel through (models are RGB-only)', async () => {
    const out = await upscaleImage(
      noise(6, 4, 100),
      { tile: 4, pad: 2, modelScale: 4, outScale: 4 },
      deps,
    )
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(100)
  })
  it('leaves opaque images opaque', async () => {
    const out = await upscaleImage(
      noise(6, 4),
      { tile: 4, pad: 2, modelScale: 4, outScale: 4 },
      deps,
    )
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(255)
  })
})

describe('upscaleImage transparent input', () => {
  it('feeds the model visible colour, not black, under fully transparent pixels', async () => {
    // 2x1: opaque white | fully transparent (premultiplied canvases give 0,0,0,0 here)
    const img: RasterImage = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]),
    }
    let minSeen = 1
    const spy: UpscaleDeps = {
      ...deps,
      async run(input, w, h) {
        minSeen = Math.min(minSeen, ...input)
        return deps.run(input, w, h)
      },
    }
    await upscaleImage(img, { tile: 256, pad: 2, modelScale: 4, outScale: 4 }, spy)
    expect(minSeen).toBe(1)
  })
})
