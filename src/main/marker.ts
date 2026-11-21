import sharp from 'sharp'
import type { MarkerSpec } from './markerGeometry'

const RED = '#ff3b30'
const WHITE = '#ffffff'
const BLACK = '#000000'

/** A standard arrow pointer, in points, with its tip at (0, 0). */
const CURSOR_PATH = 'M0,0 L0,16.5 L4,12.8 L6.6,18.8 L9.2,17.7 L6.7,11.8 L12,11.8 Z'
const CURSOR_OUTLINE_PT = 2.5
/** The middle of the arrow's bounding box, relative to its tip, in points. */
const CURSOR_CENTER_PT = { x: 6, y: 9.4 }

/**
 * The ring and an arrow cursor as an SVG the size of the whole Screenshot. The ring has a white
 * halo and the cursor a white outline so both stay visible on any background. The cursor's tip is
 * the Click position, and the ring is centred on the arrow (not on the tip) so the cursor looks
 * centred in it. The screen capture does not include the real pointer, so it is drawn here.
 */
export function markerSvg(spec: MarkerSpec): string {
  const { width, height, radius, stroke, scale } = spec
  const { cx: tipX, cy: tipY } = spec
  const cx = tipX + CURSOR_CENTER_PT.x * scale
  const cy = tipY + CURSOR_CENTER_PT.y * scale
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${WHITE}" stroke-width="${stroke * 2}" stroke-opacity="0.9"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${RED}" stroke-width="${stroke}"/>` +
    `<g transform="translate(${tipX} ${tipY}) scale(${scale})">` +
    `<path d="${CURSOR_PATH}" fill="${WHITE}" stroke="${WHITE}" stroke-width="${CURSOR_OUTLINE_PT}" stroke-linejoin="round"/>` +
    `<path d="${CURSOR_PATH}" fill="${BLACK}"/>` +
    `</g>` +
    `</svg>`
  )
}

/** Draws the Marker (ring and cursor) on a PNG and returns the new PNG. */
export async function drawMarker(png: Buffer, spec: MarkerSpec): Promise<Buffer> {
  return sharp(png)
    .composite([{ input: Buffer.from(markerSvg(spec)), top: 0, left: 0 }])
    .png()
    .toBuffer()
}
