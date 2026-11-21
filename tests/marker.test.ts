import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { drawMarker, markerSvg } from '../src/main/marker'
import type { MarkerSpec } from '../src/main/markerGeometry'

const GRAY = { r: 120, g: 120, b: 120 }

async function grayPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { ...GRAY, alpha: 1 } }
  })
    .png()
    .toBuffer()
}

async function pixel(png: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const i = (y * info.width + x) * info.channels
  return [data[i], data[i + 1], data[i + 2]]
}

const spec: MarkerSpec = {
  width: 400,
  height: 300,
  scale: 2,
  cx: 200,
  cy: 150,
  radius: 48,
  stroke: 8
}

describe('drawMarker', () => {
  it('keeps the image size and format', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height, meta.format]).toEqual([400, 300, 'png'])
  })

  it('draws a red ring centred on the cursor arrow', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    // The arrow's middle is 6 pt right and 9.4 pt below its tip: 12 and 18.8 px at 2x.
    const [r, g, b] = await pixel(out, 212 + 48, 169) // on the ring
    expect(r).toBeGreaterThan(200)
    expect(g).toBeLessThan(90)
    expect(b).toBeLessThan(90)
  })

  it('leaves the rest of the image untouched', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    expect(await pixel(out, 200 - 4, 150 - 4)).toEqual([120, 120, 120]) // inside the ring, off the cursor
    expect(await pixel(out, 10, 10)).toEqual([120, 120, 120])
    expect(await pixel(out, 390, 290)).toEqual([120, 120, 120])
  })

  it('draws a white halo just outside the red ring', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    const [r, g, b] = await pixel(out, 212 + 48 + 6, 169) // between red edge (4) and halo edge (8)
    expect(Math.min(r, g, b)).toBeGreaterThan(200)
  })

  it('draws a black arrow cursor with its tip at the click position', async () => {
    const out = await drawMarker(await grayPng(400, 300), spec)
    // 2 pt right and 8 pt below the tip, at 2x: inside the arrow's body.
    expect(await pixel(out, 200 + 4, 150 + 16)).toEqual([0, 0, 0])
    // Just left of the arrow's straight edge: the white outline.
    const [r, g, b] = await pixel(out, 200 - 2, 150 + 16)
    expect(Math.min(r, g, b)).toBeGreaterThan(220)
  })

  it('sizes the cursor by the scale factor', async () => {
    const one: MarkerSpec = { ...spec, scale: 1, radius: 24, stroke: 4 }
    const out = await drawMarker(await grayPng(400, 300), one)
    expect(await pixel(out, 200 + 2, 150 + 8)).toEqual([0, 0, 0])
    // The same pixel is black at 2x; at 1x it is already outside the arrow body.
    const [r] = await pixel(out, 200 + 4, 150 + 16)
    expect(r).toBeGreaterThan(100)
  })

  it('does not fail when the ring runs off the edge of the image', async () => {
    const edge: MarkerSpec = { ...spec, cx: 395, cy: 2 }
    const out = await drawMarker(await grayPng(400, 300), edge)
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height]).toEqual([400, 300])
  })
})

describe('markerSvg', () => {
  it('is as large as the Screenshot, with the ring around the arrow and the tip at the click', () => {
    const svg = markerSvg(spec)
    expect(svg).toContain('width="400" height="300"')
    expect(svg).toContain('cx="212" cy="168.8" r="48"') // centred on the arrow
    expect(svg).toContain('translate(200 150) scale(2)') // the tip is the click
  })
})
