import type { ImageItem } from '../../../shared/ipc'
import { $, el } from '../ui/dom'
import { sameImages, type PreviewView } from './previewView'

export interface PreviewHandlers {
  select(file: string): void
  /** The ✕ on a thumbnail was pressed. */
  trash(file: string): void
}

export interface Preview {
  render(images: ImageItem[], view: PreviewView): void
}

/**
 * The large image and the horizontally scrolling strip of thumbnails. The large image does
 * nothing when clicked. The strip is rebuilt only when the files change, which keeps its scroll
 * position and avoids flicker on every poll.
 */
export function createPreview(root: HTMLElement, handlers: PreviewHandlers): Preview {
  const large = $<HTMLImageElement>('#large-image', root)
  const strip = $('#strip', root)
  let shown: ImageItem[] | null = null
  let selectedFile: string | null = null

  function buildStrip(images: ImageItem[]): void {
    strip.replaceChildren(
      ...images.map((image) => {
        const thumb = el('div', 'thumb')
        thumb.dataset.file = image.file
        thumb.setAttribute('role', 'option')
        thumb.title = image.file
        thumb.addEventListener('click', () => handlers.select(image.file))

        const img = el('img')
        img.src = image.thumbUrl
        img.alt = image.file
        img.loading = 'lazy'
        img.draggable = false

        const remove = el('button', 'remove', '✕')
        remove.type = 'button'
        remove.title = 'Move to Trash'
        remove.setAttribute('aria-label', `Move ${image.file} to the Trash`)
        remove.addEventListener('click', (event) => {
          event.stopPropagation()
          handlers.trash(image.file)
        })

        thumb.append(img, remove)
        return thumb
      })
    )
  }

  return {
    render(images, view) {
      const rebuilt = !sameImages(shown, images)
      if (rebuilt) buildStrip(images)
      shown = images

      const file = view.large?.file ?? null
      const thumbs = Array.from(strip.children) as HTMLElement[]
      thumbs.forEach((thumb, index) => {
        const isSelected = index === view.selectedIndex
        thumb.classList.toggle('selected', isSelected)
        thumb.setAttribute('aria-selected', String(isSelected))
      })
      if (file !== selectedFile || rebuilt) {
        thumbs[view.selectedIndex]?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
      }
      selectedFile = file

      const url = view.large?.previewUrl ?? ''
      if (large.dataset.url !== url) {
        large.dataset.url = url
        large.src = url
        large.alt = file ?? ''
      }
    }
  }
}
