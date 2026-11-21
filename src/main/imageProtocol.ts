import { protocol } from 'electron'
import sharp from 'sharp'
import { IMAGE_SCHEME, parseImageUrl } from './imageUrl'
import type { ProjectsService } from './projects'
import { createThumbnailer } from './thumbnails'

/**
 * Declares the `tuto-image` scheme. Electron only accepts this before the app is ready, so
 * `index.ts` calls it at the top level.
 */
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true } }
  ])
}

const notFound = (): Response => new Response('Not found', { status: 404 })

/**
 * Serves `tuto-image://` URLs: resized copies of the images in a Tutorial folder. The URL is
 * parsed and checked by `imageUrl.ts`, and the file must be one that `projects.imagePath`
 * accepts, so no other file can be read through it. Call inside `app.whenReady()`.
 */
export function handleImages(projects: ProjectsService): void {
  const thumbnail = createThumbnailer({
    render: (path, width) =>
      sharp(path).resize({ width, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer()
  })

  protocol.handle(IMAGE_SCHEME, async (request) => {
    const parsed = parseImageUrl(request.url)
    if (!parsed) return notFound()
    try {
      const path = await projects.imagePath(parsed.ref, parsed.file)
      const version = Number(new URL(request.url).searchParams.get('v')) || 0
      const body = await thumbnail(path, version, parsed.size)
      return new Response(new Uint8Array(body), {
        headers: { 'content-type': 'image/webp', 'cache-control': 'max-age=31536000, immutable' }
      })
    } catch {
      return notFound()
    }
  })
}
