import { BrowserWindow, Menu, type WebContents } from 'electron'
import type { RowAction } from '../shared/ipc'

/**
 * The application menu, with **Settings… ⌘,**. It keeps the standard Edit menu: on macOS, ⌘C,
 * ⌘V, ⌘A and ⌘Z in text fields only work through the Edit menu's roles.
 */
export function installMenu(openSettings: () => void): void {
  const menu = Menu.buildFromTemplate([
    {
      role: 'appMenu',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CommandOrControl+,', click: openSettings },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'windowMenu' }
  ])
  Menu.setApplicationMenu(menu)
}

/**
 * Shows the native ⋯ menu of a sidebar row at a point in the sender's window.
 * Resolves to the chosen action, or null when the menu closes without a choice.
 */
export function showRowActions(
  sender: WebContents,
  x: number,
  y: number
): Promise<RowAction | null> {
  return new Promise((resolve) => {
    let choice: RowAction | null = null
    const menu = Menu.buildFromTemplate([
      { label: 'Rename', click: () => (choice = 'rename') },
      { type: 'separator' },
      { label: 'Move to Trash', click: () => (choice = 'trash') }
    ])
    const window = BrowserWindow.fromWebContents(sender) ?? undefined
    menu.popup({
      window,
      x: Math.round(x),
      y: Math.round(y),
      // The item's click runs before the menu reports that it closed.
      callback: () => resolve(choice)
    })
  })
}
