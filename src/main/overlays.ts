import sharp from 'sharp'
import { markerLayer } from './marker'
import type { MarkerSpec } from './markerGeometry'
import type { createWatermark } from './watermark'

/**
 * Builds the function that draws everything that goes on a Screenshot in one pass: the Watermark,
 * then the Marker (clicked display only) on top of it, so the Click is never hidden. With nothing
 * to draw, the PNG is returned as it is, without being encoded again.
 */
export function createOverlays(deps: {
  watermark: ReturnType<typeof createWatermark>
}): (
  png: Buffer,
  size: { width: number; height: number },
  marker: MarkerSpec | null
) => Promise<Buffer> {
  return async (png, size, marker) => {
    const watermark = await deps.watermark(size)
    const layers = [...(watermark ? [watermark] : []), ...(marker ? [markerLayer(marker)] : [])]
    if (layers.length === 0) return png
    return sharp(png).composite(layers).png().toBuffer()
  }
}
