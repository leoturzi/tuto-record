import { describe, expect, it } from 'vitest'
import { findDisplayAt, markerSpec } from '../src/main/markerGeometry'
import type { DisplayGeometry } from '../src/main/naming'

const display = (
  id: number,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number
): DisplayGeometry => ({
  id,
  bounds: { x, y, width: w, height: h },
  scaleFactor: scale
})

const main = display(1, 0, 0, 1440, 900, 2)
const right = display(2, 1440, 0, 1920, 1080, 1)
const left = display(3, -1920, -180, 1920, 1080, 1)
const above = display(4, 0, -1080, 1920, 1080, 1)

describe('findDisplayAt', () => {
  const all = [main, right, left, above]

  it('finds the display containing the point', () => {
    expect(findDisplayAt(all, 100, 100)?.id).toBe(1)
    expect(findDisplayAt(all, 1500, 100)?.id).toBe(2)
    expect(findDisplayAt(all, -100, 100)?.id).toBe(3)
    expect(findDisplayAt(all, 100, -50)?.id).toBe(4)
  })

  it('treats the far edges as outside (x = 1440 is the next display)', () => {
    expect(findDisplayAt(all, 1439, 100)?.id).toBe(1)
    expect(findDisplayAt(all, 1440, 100)?.id).toBe(2)
  })

  it('gives a point outside every display to the nearest one', () => {
    expect(findDisplayAt(all, 3500, 100)?.id).toBe(2)
    expect(findDisplayAt(all, 100, 2000)?.id).toBe(1)
  })

  it('returns undefined without displays', () => {
    expect(findDisplayAt([], 0, 0)).toBeUndefined()
  })
})

describe('markerSpec', () => {
  it('scales the position and size by the scale factor on a Retina display', () => {
    expect(markerSpec(main, 100, 50)).toEqual({
      width: 2880,
      height: 1800,
      scale: 2,
      cx: 200,
      cy: 100,
      radius: 48
    })
  })

  it('uses a position relative to the display’s own origin', () => {
    const spec = markerSpec(right, 1540, 300)
    expect([spec.cx, spec.cy]).toEqual([100, 300])
  })

  it('handles displays left of and above the primary display (negative origins)', () => {
    const l = markerSpec(left, -1820, 20)
    expect([l.cx, l.cy]).toEqual([100, 200])
    const a = markerSpec(above, 50, -1000)
    expect([a.cx, a.cy]).toEqual([50, 80])
  })

  it('rounds a fractional scale factor to whole pixels', () => {
    const d = display(5, 0, 0, 1512, 982, 1.5)
    const spec = markerSpec(d, 101, 51)
    expect([spec.cx, spec.cy]).toEqual([152, 77])
    expect(spec.radius).toBe(36)
  })

  it('may place the centre outside the image for a click at the very edge', () => {
    const spec = markerSpec(main, 1440, 900)
    expect([spec.cx, spec.cy]).toEqual([2880, 1800])
  })
})
