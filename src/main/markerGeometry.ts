import { pixelSize, type DisplayGeometry } from './naming'

/** Marker size in points; it is multiplied by the display's scale factor to get pixels. */
export const MARKER_RADIUS_PT = 24

/** Where and how big to draw a Marker, in pixels of one display's Screenshot. */
export interface MarkerSpec {
  /** Screenshot size in pixels. */
  width: number
  height: number
  /** Pixels per point on this display; sizes the cursor. */
  scale: number
  /** The tip of the cursor, which is the Click position. It may lie outside the image at the very edge. */
  cx: number
  cy: number
  /** Radius of the circle, in pixels. */
  radius: number
}

/**
 * The display a point (in global points) is on. A point just outside every display (it can
 * happen at the very edge) belongs to the nearest one.
 */
export function findDisplayAt(
  displays: DisplayGeometry[],
  x: number,
  y: number
): DisplayGeometry | undefined {
  let best: DisplayGeometry | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const display of displays) {
    const { bounds } = display
    const dx = Math.max(bounds.x - x, 0, x - (bounds.x + bounds.width - 1))
    const dy = Math.max(bounds.y - y, 0, y - (bounds.y + bounds.height - 1))
    const distance = Math.hypot(dx, dy)
    if (distance < bestDistance) {
      best = display
      bestDistance = distance
    }
  }
  return best
}

/** The Marker for a Click at (`x`, `y`) in global points, drawn on `display`'s Screenshot. */
export function markerSpec(display: DisplayGeometry, x: number, y: number): MarkerSpec {
  const { width, height } = pixelSize(display)
  const scale = display.scaleFactor
  return {
    width,
    height,
    scale,
    cx: Math.round((x - display.bounds.x) * scale),
    cy: Math.round((y - display.bounds.y) * scale),
    radius: MARKER_RADIUS_PT * scale
  }
}
