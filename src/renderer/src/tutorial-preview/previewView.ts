import type { ImageItem } from '../../../shared/ipc'
import type { ItemPath } from '../../../shared/paths'

const SEPARATOR = ' › '

/**
 * The heading for a Tutorial's path, from the longest to the shortest: the full path
 * (`Python › Setup › macOS › Install`), then with the Groups in the middle collapsed to `…`, one
 * more each time, starting next to the Project (`Python › … › macOS › Install`,
 * `Python › … › Install`). The Project and the Tutorial are always shown.
 */
export function headingVariants(path: ItemPath): string[] {
  if (path.length <= 2) return [path.join(SEPARATOR)]
  const project = path[0]
  const groups = path.slice(1, -1)
  const tutorial = path[path.length - 1]
  const variants = [path.join(SEPARATOR)]
  for (let hidden = 1; hidden <= groups.length; hidden++) {
    variants.push([project, '…', ...groups.slice(hidden), tutorial].join(SEPARATOR))
  }
  return variants
}

export interface PreviewView {
  /** none: no Tutorial (or its images could not be read); empty: no images yet. */
  state: 'none' | 'empty' | 'images'
  /** Index of the selected image, or -1. */
  selectedIndex: number
  /** The image shown large. */
  large: ImageItem | null
}

/** `images` is null when no Tutorial is selected. A `selectedFile` not in the list selects the first image. */
export function buildPreview(images: ImageItem[] | null, selectedFile: string | null): PreviewView {
  if (images === null) return { state: 'none', selectedIndex: -1, large: null }
  if (images.length === 0) return { state: 'empty', selectedIndex: -1, large: null }
  const found = images.findIndex((image) => image.file === selectedFile)
  const selectedIndex = found === -1 ? 0 : found
  return { state: 'images', selectedIndex, large: images[selectedIndex] }
}

/** The file selected after ← or →. Stops at both ends; never wraps. */
export function moveSelection(
  images: ImageItem[],
  selectedFile: string | null,
  direction: 'left' | 'right'
): string | null {
  if (images.length === 0) return null
  const { selectedIndex } = buildPreview(images, selectedFile)
  const next = Math.min(
    images.length - 1,
    Math.max(0, selectedIndex + (direction === 'left' ? -1 : 1))
  )
  return images[next].file
}

/** The file to select once `removedFile` is gone: the next one, or the previous one at the end. */
export function selectionAfterRemoval(images: ImageItem[], removedFile: string): string | null {
  const index = images.findIndex((image) => image.file === removedFile)
  if (index === -1) return images[0]?.file ?? null
  return images[index + 1]?.file ?? images[index - 1]?.file ?? null
}

/** True when both lists show the same files at the same versions, so the strip can stay as it is. */
export function sameImages(a: ImageItem[] | null, b: ImageItem[] | null): boolean {
  if (a === null || b === null) return a === b
  return a.length === b.length && a.every((image, i) => image.thumbUrl === b[i].thumbUrl)
}
