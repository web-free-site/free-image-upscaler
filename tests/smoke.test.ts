import { describe, it, expect } from 'vitest'
import type { RasterImage } from '../src/types'

describe('smoke', () => {
  it('runs vitest with TS', () => {
    const img: RasterImage = { width: 1, height: 1, data: new Uint8ClampedArray(4) }
    expect(img.data.length).toBe(4)
  })
})
