/** File extensions the preview shows (and Record again removes), lower case, without the dot. */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const

/** True for a visible file name with one of the image extensions (any case). */
export function isImageFile(name: string): boolean {
  if (name.startsWith('.')) return false
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return false
  const extension = name.slice(dot + 1).toLowerCase()
  return (IMAGE_EXTENSIONS as readonly string[]).includes(extension)
}
