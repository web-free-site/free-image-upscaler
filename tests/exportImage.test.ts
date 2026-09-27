import { describe, it, expect } from 'vitest'
import { exportName } from '../src/lib/exportImage'

describe('exportName', () => {
  it('replaces the extension and adds the scale', () => {
    expect(exportName('photo.final.jpg', 4, 'image/png')).toBe('photo.final@4x.png')
    expect(exportName('a.png', 2, 'image/jpeg')).toBe('a@2x.jpg')
    expect(exportName('a.png', 2, 'image/webp')).toBe('a@2x.webp')
  })
  it('names a pasted (nameless) image', () => {
    expect(exportName(undefined, 4, 'image/png')).toBe('upscaled@4x.png')
    expect(exportName('', 4, 'image/png')).toBe('upscaled@4x.png')
  })
  it('uses the ACTUAL blob type, so a Safari WebP→PNG fallback gets .png', () => {
    const actual = 'image/png' // what convertToBlob returned for a webp request
    expect(exportName('a.png', 4, actual)).toBe('a@4x.png')
  })
})
