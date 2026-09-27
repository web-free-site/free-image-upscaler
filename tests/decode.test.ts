import { describe, it, expect } from 'vitest'
import { resampleSteps } from '../src/lib/decode'

describe('resampleSteps', () => {
  it('is one step for ≤2× reductions', () => {
    expect(resampleSteps(100, 100, 60, 60)).toEqual([{ w: 60, h: 60 }])
  })
  it('halves until within 2×, ending exactly on target', () => {
    expect(resampleSteps(1000, 800, 100, 80)).toEqual([
      { w: 500, h: 400 },
      { w: 250, h: 200 },
      { w: 125, h: 100 },
      { w: 100, h: 80 },
    ])
  })
})
