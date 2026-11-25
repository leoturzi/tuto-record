import { readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import { createWatermark, INK_COLOR } from '../src/main/watermark'
import { watermarkLayout } from '../src/main/watermarkGeometry'

const LOGO = join(__dirname, '../resources/watermark-logo.png')
const loadLogo = (): Promise<Buffer> => readFile(LOGO)
const SIZE = { width: 2880, height: 1800 }

interface Pixels {
  data: Buffer
  width: number
  channels: number
}

async function pixels(image: Buffer): Promise<Pixels> {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, channels: info.channels }
}

const red = (p: Pixels, x: number, y: number): number => p.data[(y * p.width + x) * p.channels]

/** A flat Screenshot of one gray level with the Watermark drawn on it, and where it went. */
async function draw(
  level: number,
  size = SIZE
): Promise<{ out: Pixels; left: number; top: number; width: number; height: number }> {
  const layer = (await createWatermark({ loadLogo })(size))!
  const background = { r: level, g: level, b: level, alpha: 1 }
  const png = await sharp({ create: { ...size, channels: 4, background } })
    .composite([layer])
    .png()
    .toBuffer()
  const meta = await sharp(layer.input as Buffer).metadata()
  return {
    out: await pixels(png),
    left: layer.left!,
    top: layer.top!,
    width: meta.width,
    height: meta.height
  }
}

const near = (actual: number, expected: number): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(4)
}

const layout = watermarkLayout(SIZE)
/** A point of the plate between its left edge and the logo. */
const platePoint = (left: number, top: number): [number, number] => [
  left + Math.round(layout.paddingX / 2),
  top + Math.round(layout.paddingY + layout.logoHeight / 2)
]
/** A point in the body of the camera: low and near the left of the logo. */
const cameraPoint = (left: number, top: number): [number, number] => [
  left + layout.paddingX + Math.round(layout.logoHeight * 0.15),
  top + layout.paddingY + Math.round(layout.logoHeight * 0.8)
]

describe('createWatermark', () => {
  it('sits in the bottom-right corner, inside the margins', async () => {
    const { left, top, width, height } = await draw(255)
    expect(left + width).toBe(SIZE.width - layout.margin)
    expect(top + height).toBe(SIZE.height - layout.margin)
    expect(height).toBe(layout.logoHeight + 2 * layout.paddingY)
  })

  it('changes the corner and nothing else', async () => {
    const { out, left, top, width, height } = await draw(255)
    expect(red(out, 0, 0)).toBe(255)
    expect(red(out, left - 2, top + height / 2)).toBe(255)
    expect(red(out, left + width / 2, top - 2)).toBe(255)
    expect(red(out, left + width + 2, top + height / 2)).toBe(255)
    expect(red(out, ...platePoint(left, top))).toBeLessThan(255)
  })

  it('draws a translucent black plate with rounded corners', async () => {
    const onWhite = await draw(255)
    near(red(onWhite.out, ...platePoint(onWhite.left, onWhite.top)), 140)
    expect(red(onWhite.out, onWhite.left, onWhite.top)).toBe(255)

    const onBlack = await draw(0)
    near(red(onBlack.out, ...platePoint(onBlack.left, onBlack.top)), 0)
  })

  it('draws the logo in translucent light gray on the plate', async () => {
    const onWhite = await draw(255)
    near(red(onWhite.out, ...cameraPoint(onWhite.left, onWhite.top)), 217)

    const onBlack = await draw(0)
    near(red(onBlack.out, ...cameraPoint(onBlack.left, onBlack.top)), 196)
  })

  it('draws text to the right of the logo', async () => {
    const { out, left, top, width, height } = await draw(0)
    const logo = await sharp(LOGO).metadata()
    const textLeft =
      left +
      layout.paddingX +
      Math.round((layout.logoHeight * logo.width) / logo.height) +
      layout.gap
    let lit = 0
    for (let y = top; y < top + height; y++) {
      for (let x = textLeft; x < left + width; x++) if (red(out, x, y) > 100) lit++
    }
    expect(lit).toBeGreaterThan(200)
  })

  it('grows with the Screenshot', async () => {
    const small = await draw(255, { width: 1440, height: 900 })
    const large = await draw(255, SIZE)
    expect(large.height / small.height).toBeCloseTo(2, 0)
    expect(large.width / small.width).toBeCloseTo(2, 0)
  })

  it('gives no layer and does not load the logo when it is off', async () => {
    const load = vi.fn(loadLogo)
    expect(await createWatermark({ loadLogo: load, enabled: false })(SIZE)).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })

  it('rejects when the logo cannot be loaded', async () => {
    const watermark = createWatermark({
      loadLogo: async () => {
        throw new Error('no logo')
      }
    })
    await expect(watermark(SIZE)).rejects.toThrow('no logo')
  })
})

describe('watermark-logo.png', () => {
  it('has the same colour as the text, and a transparent background', async () => {
    const logo = await pixels(await loadLogo())
    const colours = new Set<string>()
    let clear = 0
    let solid = 0
    for (let i = 0; i < logo.data.length; i += 4) {
      const [r, g, b, a] = logo.data.subarray(i, i + 4)
      if (a === 0) clear++
      if (a !== 255) continue
      solid++
      colours.add(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`)
    }
    expect([...colours]).toEqual([INK_COLOR])
    expect(clear).toBeGreaterThan(0)
    expect(solid).toBeGreaterThan(0)
  })
})
