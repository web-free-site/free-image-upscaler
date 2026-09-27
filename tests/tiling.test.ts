import { describe, it, expect } from 'vitest'
import { planTiles, reflect, extractTile, pasteTile } from '../src/worker/tiling'
import type { RasterImage } from '../src/types'

function gradient(w: number, h: number): RasterImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = i % 256
    data[i * 4 + 1] = (i * 7) % 256
    data[i * 4 + 2] = (i * 13) % 256
    data[i * 4 + 3] = 255
  }
  return { width: w, height: h, data }
}

describe('planTiles', () => {
  it('covers every pixel exactly once', () => {
    for (const [w, h, t] of [
      [1, 1, 256],
      [300, 200, 128],
      [256, 512, 256],
      [5, 3, 2],
    ]) {
      const hits = new Uint8Array(w * h)
      for (const r of planTiles(w, h, t))
        for (let y = r.y; y < r.y + r.h; y++)
          for (let x = r.x; x < r.x + r.w; x++) hits[y * w + x]++
      expect(hits.every((c) => c === 1)).toBe(true)
    }
  })
  it('uses one tile for an image smaller than the tile', () => {
    expect(planTiles(10, 7, 256)).toEqual([{ x: 0, y: 0, w: 10, h: 7 }])
  })
})

describe('reflect', () => {
  it('mirrors without repeating the edge pixel', () => {
    expect([-2, -1, 0, 1, 2, 3, 4, 5].map((i) => reflect(i, 4))).toEqual([2, 1, 0, 1, 2, 3, 2, 1])
  })
  it('handles n=1 and offsets far larger than n', () => {
    expect(reflect(-16, 1)).toBe(0)
    expect(reflect(17, 1)).toBe(0)
    const v = reflect(-16, 3)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(3)
  })
})

describe('extractTile', () => {
  it('pads a 1x1 image by replicating its only pixel', () => {
    const img = gradient(1, 1)
    const t = extractTile(img, { x: 0, y: 0, w: 1, h: 1 }, 16)
    expect(t.width).toBe(33)
    expect(t.height).toBe(33)
    for (let i = 0; i < 33 * 33; i++)
      expect([...t.data.subarray(i * 4, i * 4 + 4)]).toEqual([...img.data])
  })
  it('keeps interior pixels in place', () => {
    const img = gradient(20, 20)
    const t = extractTile(img, { x: 4, y: 4, w: 8, h: 8 }, 2)
    // tile(2,2) is image(4,4)
    expect([...t.data.subarray((2 * t.width + 2) * 4, (2 * t.width + 2) * 4 + 4)]).toEqual([
      ...img.data.subarray((4 * 20 + 4) * 4, (4 * 20 + 4) * 4 + 4),
    ])
  })
})

describe('pasteTile', () => {
  it('crops pad*scale and writes the core at r*scale', () => {
    const out: RasterImage = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) }
    // padded tile at scale 2: core 2x2 → 4x4, pad 1 → 2px border each side → 8x8
    const tile: RasterImage = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) }
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) tile.data[(y * 8 + x) * 4] = 200
    pasteTile(out, tile, { x: 2, y: 0, w: 2, h: 2 }, 1, 2)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) expect(out.data[(y * 8 + x) * 4]).toBe(x >= 4 && y < 4 ? 200 : 0)
  })
})
