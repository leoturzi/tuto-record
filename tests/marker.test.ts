import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { CIRCLE_OPACITY, drawMarker, markerSvg } from '../src/main/marker'
import type { MarkerSpec } from '../src/main/markerGeometry'

const GRAY = { r: 120, g: 120, b: 120 }

async function grayPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { ...GRAY, alpha: 1 } }
  })
    .png()
    .toBuffer()
}

/** Black on the left half, white on the right half: stands in for dark and light content. */
async function splitPng(width: number, height: number): Promise<Buffer> {
  const white = await sharp({
    create: {
      width: width / 2,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .png()
    .toBuffer()
  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
  })
    .composite([{ input: white, left: width / 2, top: 0 }])
    .png()
    .toBuffer()
}

type Rgb = [number, number, number]

async function pixel(png: Buffer, x: number, y: number): Promise<Rgb> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const i = (y * info.width + x) * info.channels
  return [data[i], data[i + 1], data[i + 2]]
}

const near = (actual: Rgb, expected: Rgb, tolerance = 4): void => {
  actual.forEach((value, i) => expect(Math.abs(value - expected[i])).toBeLessThanOrEqual(tolerance))
}

/** The colour of `GRAY` with the red circle over it. */
const TINTED_GRAY: Rgb = [
  120 * (1 - CIRCLE_OPACITY) + 255 * CIRCLE_OPACITY,
  120 * (1 - CIRCLE_OPACITY) + 59 * CIRCLE_OPACITY,
  120 * (1 - CIRCLE_OPACITY) + 48 * CIRCLE_OPACITY
]

// At scale 2 the circle is centred on the arrow: 12 px right and 18.8 px below the tip.
const spec: MarkerSpec = { width: 400, height: 300, scale: 2, cx: 200, cy: 150, radius: 48 }
const CENTRE = { x: 212, y: 169 }

describe('drawMarker', () => {
  it('keeps the image size and format', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height, meta.format]).toEqual([400, 300, 'png'])
  })

  it('tints the circle area with translucent red', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    near(await pixel(out, 200 - 4, 150 - 4), TINTED_GRAY) // inside the circle, off the cursor
  })

  it('has no outline: the tint is even right up to the edge', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    const inner = await pixel(out, 200 - 4, 150 - 4)
    near(await pixel(out, CENTRE.x + 46, CENTRE.y), inner)
    near(await pixel(out, CENTRE.x - 46, CENTRE.y), inner)
  })

  it('leaves everything outside the circle untouched', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    expect(await pixel(out, 10, 10)).toEqual([120, 120, 120])
    expect(await pixel(out, 390, 290)).toEqual([120, 120, 120])
    expect(await pixel(out, CENTRE.x + 52, CENTRE.y)).toEqual([120, 120, 120]) // just outside
  })

  it('does not cover what is underneath: dark and light content stay clearly different', async () => {
    // Circle centred on the boundary between the black and the white half.
    const out = await drawMarker(await splitPng(400, 300), { ...spec, cx: 188 })
    const dark = await pixel(out, 170, 170)
    const light = await pixel(out, 230, 170)
    expect(light[1] - dark[1]).toBeGreaterThan(120)
    // Both are tinted red, not replaced by it.
    expect(dark[0]).toBeGreaterThan(dark[1])
    expect(light[0]).toBeGreaterThan(light[1])
  })

  it('draws a black arrow cursor with its tip at the click position', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    // 2 pt right and 8 pt below the tip, at 2x: inside the arrow's body.
    expect(await pixel(out, 200 + 4, 150 + 16)).toEqual([0, 0, 0])
    // Just left of the arrow's straight edge: the white outline.
    const [r, g, b] = await pixel(out, 200 - 2, 150 + 16)
    expect(Math.min(r, g, b)).toBeGreaterThan(220)
  })

  it('sizes the cursor and circle by the scale factor', async () => {
    const one: MarkerSpec = { ...spec, scale: 1, radius: 24 }
    const out = await drawMarker(await grayPng(400, 300), one)
    expect(await pixel(out, 200 + 2, 150 + 8)).toEqual([0, 0, 0])
    // The same pixel is black at 2x; at 1x it is already outside the arrow body.
    const [r] = await pixel(out, 200 + 4, 150 + 16)
    expect(r).toBeGreaterThan(100)
    // The 1x circle is half as big: 40 px right of the centre is outside it.
    expect(await pixel(out, 206 + 40, 159)).toEqual([120, 120, 120])
  })

  it('does not fail when the circle runs off the edge of the image', async () => {
    const edge: MarkerSpec = { ...spec, cx: 395, cy: 2 }
    const out = await drawMarker(await grayPng(400, 300), edge)
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height]).toEqual([400, 300])
  })
})

describe('markerSvg', () => {
  it('is as large as the Screenshot, with the circle around the arrow and the tip at the click', () => {
    const svg = markerSvg(spec)
    expect(svg).toContain('width="400" height="300"')
    expect(svg).toContain('cx="212" cy="168.8" r="48"') // centred on the arrow
    expect(svg).toContain('translate(200 150) scale(2)') // the tip is the click
  })

  it('fills the circle with low-opacity red and draws no outline on it', () => {
    const circle = markerSvg(spec).match(/<circle[^>]*>/)?.[0] ?? ''
    expect(circle).toContain(`fill-opacity="${CIRCLE_OPACITY}"`)
    expect(circle).not.toContain('stroke')
    expect(CIRCLE_OPACITY).toBeGreaterThan(0)
    expect(CIRCLE_OPACITY).toBeLessThan(0.5)
  })
})
