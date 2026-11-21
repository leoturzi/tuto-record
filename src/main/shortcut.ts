import { globalShortcut } from 'electron'

/** Control+Option+Command+R on macOS. Unlikely to clash with another app. */
export const SHORTCUT_ACCELERATOR = 'Control+Alt+Command+R'

/**
 * Registers the Stop shortcut (when idle it only brings the window back; it never starts a
 * Recording). Returns false when another app already owns it.
 */
export function registerStopShortcut(onPress: () => void): boolean {
  return globalShortcut.register(SHORTCUT_ACCELERATOR, onPress)
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
