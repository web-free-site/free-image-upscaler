import { describe, it, expect } from 'vitest'
import { fitInput, MAX_PIXELS_DESKTOP, MAX_PIXELS_APPLE_TOUCH } from '../src/lib/limits'

describe('fitInput', () => {
  it('accepts an input whose output fits', () => {
    expect(fitInput(2048, 1024, 4, MAX_PIXELS_DESKTOP)).toEqual({ ok: true, w: 2048, h: 1024 })
  })
  it('shrinks to the 8192 side cap, keeping aspect', () => {
    expect(fitInput(4000, 1000, 4, MAX_PIXELS_DESKTOP)).toEqual({ ok: false, w: 2048, h: 512 })
  })
  it('×2 allows twice the input side', () => {
    expect(fitInput(4096, 100, 2, MAX_PIXELS_DESKTOP).ok).toBe(true)
  })
  it('applies the iPhone/iPad canvas area cap', () => {
    const r = fitInput(2000, 2000, 4, MAX_PIXELS_APPLE_TOUCH)
    expect(r.ok).toBe(false)
    expect(r.w * 4 * r.h * 4).toBeLessThanOrEqual(MAX_PIXELS_APPLE_TOUCH)
    expect(r.w).toBe(r.h)
  })
  it('never returns a zero dimension', () => {
    const r = fitInput(100000, 3, 4, MAX_PIXELS_DESKTOP)
    expect(r.h).toBeGreaterThanOrEqual(1)
  })
})
