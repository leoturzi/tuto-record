export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** What we need to know about a display. `bounds` are in points, as Electron reports them. */
export interface DisplayGeometry {
  id: number
  bounds: Rect
  scaleFactor: number
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0')

/** Local time as `YYYY-MM-DD_HH-mm-ss-SSS`. */
export function formatStamp(time: number): string {
  const d = new Date(time)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`
  )
}

/** `2026-11-21_09-15-42-123_d1.png`: Click time plus the display number. */
export function screenshotFilename(time: number, displayNumber: number): string {
  return `${formatStamp(time)}_d${displayNumber}.png`
}

/**
 * Numbers displays from 1: the primary display is d1, the rest follow from left to right
 * (and top to bottom for displays at the same x). Returns a map from display id to number.
 */
export function numberDisplays(
  displays: DisplayGeometry[],
  primaryId: number
): Map<number, number> {
  const ordered = [...displays].sort((a, b) => {
    if (a.id === primaryId) return b.id === primaryId ? 0 : -1
    if (b.id === primaryId) return 1
    return a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y || a.id - b.id
  })
  return new Map(ordered.map((display, index) => [display.id, index + 1]))
}

/** The display's size in real pixels (points times scale factor). */
export function pixelSize(display: DisplayGeometry): { width: number; height: number } {
  return {
    width: Math.round(display.bounds.width * display.scaleFactor),
    height: Math.round(display.bounds.height * display.scaleFactor)
  }
}
