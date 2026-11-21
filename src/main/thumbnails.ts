import { IMAGE_WIDTHS, type ImageSize } from './imageUrl'

export interface ThumbnailDeps {
  /** Reads the image at `path` and returns it resized to `width` pixels wide (never enlarged). */
  render(path: string, width: number): Promise<Buffer>
}

export interface ThumbnailOptions {
  /** How many rendered images to keep. The least recently used one is dropped first. */
  maxEntries?: number
  /** How many images may be rendered at the same time. */
  concurrency?: number
}

export type Thumbnailer = (path: string, version: number, size: ImageSize) => Promise<Buffer>

/**
 * Returns resized copies of images, cached in memory. A new `version` of a file is a new cache
 * entry, so an edited file is rendered again. Renders are limited to a few at a time, because a
 * Tutorial can hold dozens of Retina Screenshots and the strip asks for all of them at once.
 */
export function createThumbnailer(
  deps: ThumbnailDeps,
  options: ThumbnailOptions = {}
): Thumbnailer {
  const maxEntries = options.maxEntries ?? 300
  const concurrency = options.concurrency ?? 4
  // A Map keeps insertion order; re-inserting on every hit makes the first key the least recent.
  const cache = new Map<string, Promise<Buffer>>()
  const waiting: Array<() => void> = []
  let running = 0

  async function limited<T>(task: () => Promise<T>): Promise<T> {
    if (running >= concurrency) await new Promise<void>((resolve) => waiting.push(resolve))
    running++
    try {
      return await task()
    } finally {
      running--
      waiting.shift()?.()
    }
  }

  return (path, version, size) => {
    const key = `${size}|${version}|${path}`
    const hit = cache.get(key)
    if (hit) {
      cache.delete(key)
      cache.set(key, hit)
      return hit
    }
    const render = limited(() => deps.render(path, IMAGE_WIDTHS[size]))
    cache.set(key, render)
    // A failed render is not cached, so the next request tries again.
    render.catch(() => {
      if (cache.get(key) === render) cache.delete(key)
    })
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value!)
    return render
  }
}
