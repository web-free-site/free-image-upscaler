import { describe, it, expect } from 'vitest'
import {
  toPlanarRgb,
  fromPlanarRgb,
  hasAlpha,
  alphaOf,
  resizeChannelBilinear,
  setAlpha,
  bleedTransparent,
} from '../src/worker/pixels'

describe('planar RGB', () => {
  it('round-trips RGB exactly and sets alpha to 255', () => {
    const img = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([10, 20, 30, 7, 250, 0, 128, 99]),
    }
    const f = toPlanarRgb(img)
    expect(f.length).toBe(6)
    expect(f[0]).toBeCloseTo(10 / 255) // R plane first
    expect(f[2]).toBeCloseTo(20 / 255) // then G plane
    const back = fromPlanarRgb(f, 2, 1)
    expect([...back.data]).toEqual([10, 20, 30, 255, 250, 0, 128, 255])
  })
})

describe('alpha helpers', () => {
  it('detects any non-opaque pixel', () => {
    expect(hasAlpha({ width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) })).toBe(
      false,
    )
    expect(hasAlpha({ width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 254]) })).toBe(
      true,
    )
  })
  it('extracts and writes back the alpha channel', () => {
    const img = { width: 2, height: 1, data: new Uint8ClampedArray([1, 2, 3, 40, 5, 6, 7, 80]) }
    expect([...alphaOf(img)]).toEqual([40, 80])
    setAlpha(img, new Uint8ClampedArray([9, 8]))
    expect([...img.data]).toEqual([1, 2, 3, 9, 5, 6, 7, 8])
  })
})

describe('resizeChannelBilinear', () => {
  it('keeps a constant channel constant', () => {
    const out = resizeChannelBilinear(new Uint8ClampedArray(6).fill(128), 3, 2, 12, 8)
    expect(out.length).toBe(96)
    expect(out.every((v) => v === 128)).toBe(true)
  })
  it('interpolates between neighbours and keeps edges', () => {
    const out = resizeChannelBilinear(new Uint8ClampedArray([0, 255]), 2, 1, 8, 1)
    expect(out[0]).toBe(0)
    expect(out[7]).toBe(255)
    for (let i = 1; i < 8; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1])
  })
})

describe('bleedTransparent', () => {
  it('fills fully transparent pixels with the nearest visible colour, alpha untouched', () => {
    // row: red(opaque) | transparent black | transparent black | blue(alpha 128)
    const img = {
      width: 4,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 128]),
    }
    const out = bleedTransparent(img)
    expect([...out.data]).toEqual([255, 0, 0, 255, 255, 0, 0, 0, 0, 0, 255, 0, 0, 0, 255, 128])
    expect([...img.data.subarray(4, 8)]).toEqual([0, 0, 0, 0]) // input not mutated
  })
  it('leaves a fully transparent image as is', () => {
    const img = { width: 2, height: 1, data: new Uint8ClampedArray(8) }
    expect([...bleedTransparent(img).data]).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })
})
