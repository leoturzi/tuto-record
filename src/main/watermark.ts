import sharp, { type OverlayOptions, type Sharp } from 'sharp'
import { watermarkLayout, type WatermarkLayout } from './watermarkGeometry'

/** Change to `false` to stop drawing the Watermark. There is no setting for it. */
export const WATERMARK_ENABLED = true

export const WATERMARK_TEXT = 'Tuto-Record'
export const PLATE_COLOR = '#000000'
export const PLATE_OPACITY = 0.45
/** The colour of the text. `resources/watermark-logo.png` has the same colour. */
export const INK_COLOR = '#e6e6e6'
/** Opacity of the logo and text on the plate. */
export const INK_OPACITY = 0.85

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

interface Raster {
  data: Buffer
  width: number
  height: number
}

async function toRaster(image: Sharp): Promise<Raster> {
  const { data, info } = await image.png().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/** SVG cannot measure text, so it is drawn on a canvas with room to spare and then trimmed. */
async function renderText(size: number): Promise<Raster> {
  const width = size * WATERMARK_TEXT.length * 2
  const height = size * 3
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<text x="${size}" y="${size * 2}" font-family="sans-serif" font-weight="600" ` +
    `font-size="${size}" fill="${INK_COLOR}">${WATERMARK_TEXT}</text>` +
    `</svg>`
  const canvas = await sharp(Buffer.from(svg)).png().toBuffer()
  return toRaster(sharp(canvas).trim())
}

/** The plate with the logo and text on it, as one image. */
async function renderWatermark(logo: Buffer, layout: WatermarkLayout): Promise<Raster> {
  const { logoHeight, gap, paddingX, paddingY, radius } = layout
  const mark = await toRaster(sharp(logo).resize({ height: logoHeight }))
  const text = await renderText(layout.textSize)

  const inkWidth = mark.width + gap + text.width
  const ink = await sharp({
    create: { width: inkWidth, height: logoHeight, channels: 4, background: TRANSPARENT }
  })
    .composite([
      { input: mark.data, left: 0, top: 0 },
      {
        input: text.data,
        left: mark.width + gap,
        top: Math.round((logoHeight - text.height) / 2)
      }
    ])
    .png()
    .toBuffer()
  // Fade the logo and text together: scale only their alpha channel.
  const faded = await sharp(ink).linear([1, 1, 1, INK_OPACITY], [0, 0, 0, 0]).png().toBuffer()

  const width = inkWidth + 2 * paddingX
  const height = logoHeight + 2 * paddingY
  const plate =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" rx="${radius}" ` +
    `fill="${PLATE_COLOR}" fill-opacity="${PLATE_OPACITY}"/>` +
    `</svg>`
  return toRaster(
    sharp(Buffer.from(plate)).composite([{ input: faded, left: paddingX, top: paddingY }])
  )
}

/**
 * Builds the function that gives the layer drawing the Watermark in the bottom-right corner of a
 * Screenshot of a given size, or null when the Watermark is off. The logo is passed in because the
 * real file path is only known to the Electron build.
 */
export function createWatermark(deps: {
  loadLogo(): Promise<Buffer>
  /** Defaults to `WATERMARK_ENABLED`. */
  enabled?: boolean
}): (size: { width: number; height: number }) => Promise<OverlayOptions | null> {
  const enabled = deps.enabled ?? WATERMARK_ENABLED
  return async (size) => {
    if (!enabled) return null
    const layout = watermarkLayout(size)
    const image = await renderWatermark(await deps.loadLogo(), layout)
    return {
      input: image.data,
      left: size.width - layout.margin - image.width,
      top: size.height - layout.margin - image.height
    }
  }
}
