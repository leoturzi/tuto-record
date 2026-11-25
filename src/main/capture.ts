import { join } from 'path'
import type { ClickEvent } from './click'
import { findDisplayAt, markerSpec, type MarkerSpec } from './markerGeometry'
import { numberDisplays, pixelSize, screenshotFilename, type DisplayGeometry } from './naming'

/** The few image operations we need; Electron's NativeImage is adapted to this. */
export interface ImageLike {
  width: number
  height: number
  isEmpty(): boolean
  toPNG(): Buffer
  resize(width: number, height: number): ImageLike
}

export interface CapturedSource {
  /** Electron's `display_id`: the display's id as a string. */
  displayId: string
  image: ImageLike
}

export interface CaptureDeps {
  getDisplays(): DisplayGeometry[]
  getPrimaryDisplayId(): number
  /** Captures every display, each scaled to fit inside `maxSize`. */
  grab(maxSize: { width: number; height: number }): Promise<CapturedSource[]>
  /** Resolves to the folder for this Capture (the selected Tutorial's), or throws a readable message. */
  getFolder(): Promise<string>
  /**
   * Draws the Watermark and, when `marker` is given, the Marker on a Screenshot of `size` pixels,
   * and returns the PNG to save.
   */
  drawOverlays(
    png: Buffer,
    size: { width: number; height: number },
    marker: MarkerSpec | null
  ): Promise<Buffer>
  writeFile(path: string, data: Buffer): Promise<void>
  removeFile(path: string): Promise<void>
}

/**
 * Builds the function that turns one Click into a Capture: one PNG per display, saved in the
 * selected Tutorial's folder, each with the Watermark, and with a Marker on the display that was
 * clicked. Resolves to the saved
 * file paths. If any display fails, the files already written for this Capture are removed and the
 * error is thrown.
 */
export function createCapturer(deps: CaptureDeps): (click: ClickEvent) => Promise<string[]> {
  return async (click) => {
    const folder = await deps.getFolder()
    const displays = deps.getDisplays()
    const numbers = numberDisplays(displays, deps.getPrimaryDisplayId())
    const clicked = findDisplayAt(displays, click.x, click.y)

    const sizes = displays.map(pixelSize)
    const maxSize = {
      width: Math.max(...sizes.map((s) => s.width)),
      height: Math.max(...sizes.map((s) => s.height))
    }
    const sources = await deps.grab(maxSize)

    const written: string[] = []
    const results = await Promise.allSettled(
      displays.map(async (display) => {
        const number = numbers.get(display.id)!
        const source = sources.find((s) => s.displayId === String(display.id))
        if (!source || source.image.isEmpty()) {
          throw new Error(
            `Could not capture display ${number}. Is Screen Recording still allowed for tuto-record?`
          )
        }
        const target = pixelSize(display)
        const image =
          source.image.width === target.width && source.image.height === target.height
            ? source.image
            : source.image.resize(target.width, target.height)
        const path = join(folder, screenshotFilename(click.time, number))
        const marker = display.id === clicked?.id ? markerSpec(display, click.x, click.y) : null
        await deps.writeFile(path, await deps.drawOverlays(image.toPNG(), target, marker))
        written.push(path)
        return path
      })
    )

    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failure) {
      await Promise.allSettled(written.map((path) => deps.removeFile(path)))
      throw failure.reason instanceof Error ? failure.reason : new Error(String(failure.reason))
    }
    return results.map((r) => (r as PromiseFulfilledResult<string>).value).sort()
  }
}
