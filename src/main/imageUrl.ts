import type { TutorialRef } from '../shared/ipc'

/** `thumb` for the strip, `preview` for the large view. */
export type ImageSize = 'thumb' | 'preview'

export const IMAGE_SCHEME = 'tuto-image'

/** Width in pixels of each size; images are never enlarged. */
export const IMAGE_WIDTHS: Record<ImageSize, number> = { thumb: 320, preview: 1600 }

const SIZES = Object.keys(IMAGE_WIDTHS) as ImageSize[]

export interface ParsedImageUrl {
  size: ImageSize
  ref: TutorialRef
  file: string
}

/**
 * `tuto-image://thumb/<project>/<tutorial>/<file>?v=<version>`, each segment URI-encoded.
 * `version` (the file's modified time) makes a changed file a new URL, so no cache shows it stale.
 */
export function imageUrl(size: ImageSize, ref: TutorialRef, file: string, version: number): string {
  const path = [ref.project, ref.tutorial, file].map(encodeURIComponent).join('/')
  return `${IMAGE_SCHEME}://${size}/${path}?v=${version}`
}

function decodeSegment(segment: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    return null
  }
  if (decoded === '' || decoded === '.' || decoded === '..') return null
  if (decoded.includes('/') || decoded.includes('\0')) return null
  return decoded
}

/** The parts of an image URL, or null for anything that is not exactly one. */
export function parseImageUrl(url: string): ParsedImageUrl | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${IMAGE_SCHEME}:`) return null
  const size = SIZES.find((s) => s === parsed.hostname)
  if (!size) return null
  const segments = parsed.pathname.split('/').slice(1)
  if (segments.length !== 3) return null
  const [project, tutorial, file] = segments.map(decodeSegment)
  if (project === null || tutorial === null || file === null) return null
  return { size, ref: { project, tutorial }, file }
}
