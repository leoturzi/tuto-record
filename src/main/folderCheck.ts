import { access, constants, stat } from 'fs/promises'

/**
 * Returns a short message saying why the folder cannot be used,
 * or null when it exists and is writable.
 */
export async function checkFolder(folder: string): Promise<string | null> {
  try {
    const info = await stat(folder)
    if (!info.isDirectory()) return 'The chosen path is not a folder.'
  } catch {
    return 'The folder no longer exists.'
  }
  try {
    await access(folder, constants.W_OK)
  } catch {
    return 'tuto-record cannot write to this folder.'
  }
  return null
}
