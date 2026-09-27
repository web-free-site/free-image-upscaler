import { describe, it, expect } from 'vitest'
import { MODELS, modelAvailable } from '../src/lib/models'

describe('modelAvailable', () => {
  it('offers every model on desktop', () => {
    for (const m of Object.values(MODELS)) expect(modelAvailable(m, false)).toBe(true)
  })
  it('offers only the light general model on iPhone/iPad (the RRDB models crashed an iPad tab)', () => {
    expect(modelAvailable(MODELS.general, true)).toBe(true)
    expect(modelAvailable(MODELS.anime, true)).toBe(false)
    expect(modelAvailable(MODELS.photo, true)).toBe(false)
  })
})
