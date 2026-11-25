/** The logo's height, as a share of the Screenshot's shorter side. */
export const LOGO_RATIO = 0.03
/** The logo is never smaller than this, so the text stays legible on small displays. */
export const LOGO_MIN_PX = 14
/** Distance from the right and bottom edges, as a share of the shorter side. */
export const MARGIN_RATIO = 0.02

// The rest is relative to the logo's height.
export const TEXT_RATIO = 0.6
export const GAP_RATIO = 0.3
export const PADDING_X_RATIO = 0.4
export const PADDING_Y_RATIO = 0.3
/** Relative to the plate's height. */
export const RADIUS_RATIO = 0.18

/** Sizes in pixels of the Watermark on one Screenshot. */
export interface WatermarkLayout {
  logoHeight: number
  textSize: number
  /** Between the logo and the text. */
  gap: number
  /** Between the plate and the right and bottom edges of the Screenshot. */
  margin: number
  paddingX: number
  paddingY: number
  /** Corner radius of the plate. */
  radius: number
}

/**
 * The Watermark's sizes for a Screenshot of this size. They follow the shorter side, so an
 * ultrawide or portrait display does not get an oversized or tiny Watermark.
 */
export function watermarkLayout(size: { width: number; height: number }): WatermarkLayout {
  const shorter = Math.min(size.width, size.height)
  const logoHeight = Math.max(LOGO_MIN_PX, Math.round(shorter * LOGO_RATIO))
  const paddingY = Math.round(logoHeight * PADDING_Y_RATIO)
  return {
    logoHeight,
    textSize: Math.round(logoHeight * TEXT_RATIO),
    gap: Math.round(logoHeight * GAP_RATIO),
    margin: Math.round(shorter * MARGIN_RATIO),
    paddingX: Math.round(logoHeight * PADDING_X_RATIO),
    paddingY,
    radius: Math.round((logoHeight + 2 * paddingY) * RADIUS_RATIO)
  }
}
