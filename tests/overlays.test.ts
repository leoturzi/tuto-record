import { readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import type { MarkerSpec } from '../src/main/markerGeometry'
import { createOverlays } from '../src/main/overlays'
import { createWatermark } from '../src/main/watermark'

const SIZE = { width: 800, height: 600 }
const loadLogo = (): Promise<Buffer> => readFile(join(__dirname, '../resources/watermark-logo.png'))

const draw = createOverlays({ watermark: createWatermark({ loadLogo }) })
const drawWithoutWatermark = createOverlays({
  watermark: createWatermark({ loadLogo, enabled: false })
})

const white = (): Promise<Buffer> =>
  sharp({ create: { ...SIZE, channels: 4, background: '#ffffff' } })
    .png()
    .toBuffer()

async function pixel(png: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const i = (y * info.width + x) * info.channels
  return [data[i], data[i + 1], data[i + 2]]
}

/** A Marker whose cursor lies on the Watermark's plate: at this size it spans y 560–588. */
const marker: MarkerSpec = { ...SIZE, scale: 1, radius: 24, cx: 750, cy: 568 }
const IN_ARROW: [number, number] = [marker.cx + 2, marker.cy + 8]

describe('createOverlays', () => {
  it('keeps the image size and format', async () => {
    const meta = await sharp(await draw(await white(), SIZE, marker)).metadata()
    expect([meta.width, meta.height, meta.format]).toEqual([800, 600, 'png'])
  })

  it('returns the same PNG when there is nothing to draw', async () => {
    const png = await white()
    expect(await drawWithoutWatermark(png, SIZE, null)).toBe(png)
  })

  it('draws the Marker alone when the Watermark is off', async () => {
    const out = await drawWithoutWatermark(await white(), SIZE, marker)
    expect(await pixel(out, ...IN_ARROW)).toEqual([0, 0, 0])
    // On the plate's place, away from the circle.
    expect(await pixel(out, 700, 574)).toEqual([255, 255, 255])
  })

  it('draws the Marker on top of the Watermark', async () => {
    const plain = await draw(await white(), SIZE, null)
    expect((await pixel(plain, 700, 574))[0]).toBeLessThan(255)
    // The Watermark really is under the point tested below.
    expect((await pixel(plain, ...IN_ARROW))[0]).toBeLessThan(255)

    const out = await draw(await white(), SIZE, marker)
    expect(await pixel(out, ...IN_ARROW)).toEqual([0, 0, 0])
  })
})
