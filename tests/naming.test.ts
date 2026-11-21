import { describe, expect, it } from 'vitest'
import {
  formatStamp,
  numberDisplays,
  pixelSize,
  screenshotFilename,
  type DisplayGeometry
} from '../src/main/naming'

const display = (id: number, x: number, y = 0, w = 1440, h = 900, scale = 2): DisplayGeometry => ({
  id,
  bounds: { x, y, width: w, height: h },
  scaleFactor: scale
})

describe('formatStamp', () => {
  it('formats local time with milliseconds', () => {
    const time = new Date(2026, 10, 21, 9, 5, 7, 42).getTime()
    expect(formatStamp(time)).toBe('2026-11-21_09-05-07-042')
  })

  it('sorts alphabetically in time order', () => {
    const a = formatStamp(new Date(2026, 0, 2, 3, 4, 5, 6).getTime())
    const b = formatStamp(new Date(2026, 0, 2, 3, 4, 5, 70).getTime())
    const c = formatStamp(new Date(2026, 11, 31, 23, 59, 59, 999).getTime())
    expect([c, b, a].sort()).toEqual([a, b, c])
  })
})

describe('screenshotFilename', () => {
  it('adds the display number and the png extension', () => {
    const time = new Date(2026, 10, 21, 9, 15, 42, 123).getTime()
    expect(screenshotFilename(time, 2)).toBe('2026-11-21_09-15-42-123_d2.png')
  })
})

describe('numberDisplays', () => {
  it('gives a single display the number 1', () => {
    expect(numberDisplays([display(7, 0)], 7)).toEqual(new Map([[7, 1]]))
  })

  it('numbers the primary display 1 even when it is not leftmost', () => {
    const left = display(1, -1920)
    const primary = display(2, 0)
    const right = display(3, 1440)
    const numbers = numberDisplays([left, right, primary], 2)
    expect(numbers.get(2)).toBe(1)
    expect(numbers.get(1)).toBe(2)
    expect(numbers.get(3)).toBe(3)
  })

  it('orders the others left to right, then top to bottom', () => {
    const primary = display(1, 0)
    const rightTop = display(2, 1440, 0)
    const rightBottom = display(3, 1440, 900)
    const farRight = display(4, 2880)
    const numbers = numberDisplays([farRight, rightBottom, rightTop, primary], 1)
    expect([1, 2, 3, 4].map((id) => numbers.get(id))).toEqual([1, 2, 3, 4])
  })
})

describe('pixelSize', () => {
  it('multiplies points by the scale factor', () => {
    expect(pixelSize(display(1, 0, 0, 1440, 900, 2))).toEqual({ width: 2880, height: 1800 })
    expect(pixelSize(display(1, 0, 0, 1920, 1080, 1))).toEqual({ width: 1920, height: 1080 })
  })

  it('rounds fractional results', () => {
    expect(pixelSize(display(1, 0, 0, 1512, 982, 1.5))).toEqual({ width: 2268, height: 1473 })
  })
})
