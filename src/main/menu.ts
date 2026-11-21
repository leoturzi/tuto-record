import { BrowserWindow, Menu, type WebContents } from 'electron'
import type { CreateAction, RowAction } from '../shared/ipc'

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

/** One choice in a popup menu; `null` draws a separator. */
type Choice<T> = { label: string; value: T } | null

/**
 * Pops up a native menu at a point in the sender's window. Resolves to the chosen value, or null
 * when the menu closes without a choice.
 */
function popup<T>(
  sender: WebContents,
  x: number,
  y: number,
  choices: Choice<T>[]
): Promise<T | null> {
  return new Promise((resolve) => {
    let choice: T | null = null
    const menu = Menu.buildFromTemplate(
      choices.map((c) =>
        c === null
          ? { type: 'separator' as const }
          : { label: c.label, click: () => (choice = c.value) }
      )
    )
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

/** The ⋯ menu of a sidebar row: Rename, Move to Trash. */
export function showRowActions(
  sender: WebContents,
  x: number,
  y: number
): Promise<RowAction | null> {
  return popup<RowAction>(sender, x, y, [
    { label: 'Rename', value: 'rename' },
    null,
    { label: 'Move to Trash', value: 'trash' }
  ])
}

/** The + menu of a Project or Group row: New Tutorial, New Group. */
export function showCreateActions(
  sender: WebContents,
  x: number,
  y: number
): Promise<CreateAction | null> {
  return popup<CreateAction>(sender, x, y, [
    { label: 'New Tutorial', value: 'tutorial' },
    { label: 'New Group', value: 'group' }
  ])
}
