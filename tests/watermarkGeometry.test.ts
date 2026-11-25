import { describe, expect, it } from 'vitest'
import { LOGO_MIN_PX, watermarkLayout } from '../src/main/watermarkGeometry'

describe('watermarkLayout', () => {
  it('sizes everything from the shorter side of a landscape Screenshot', () => {
    expect(watermarkLayout({ width: 2880, height: 1800 })).toEqual({
      logoHeight: 54,
      textSize: 32,
      gap: 16,
      margin: 36,
      paddingX: 22,
      paddingY: 16,
      radius: 15
    })
  })

  it('uses the shorter side on ultrawide and portrait displays', () => {
    const ultrawide = watermarkLayout({ width: 5120, height: 1440 })
    const portrait = watermarkLayout({ width: 1440, height: 2560 })
    expect(ultrawide).toEqual(watermarkLayout({ width: 1440, height: 1440 }))
    expect(portrait).toEqual(ultrawide)
  })

  it('never makes the logo smaller than the minimum', () => {
    expect(watermarkLayout({ width: 400, height: 300 }).logoHeight).toBe(LOGO_MIN_PX)
  })
})
