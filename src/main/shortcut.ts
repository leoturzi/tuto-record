import { globalShortcut } from 'electron'

/** Control+Option+Command+R on macOS. Unlikely to clash with another app. */
export const TOGGLE_ACCELERATOR = 'Control+Alt+Command+R'

/** Registers the Start/Stop shortcut. Returns false when another app already owns it. */
export function registerToggleShortcut(onPress: () => void): boolean {
  return globalShortcut.register(TOGGLE_ACCELERATOR, onPress)
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
