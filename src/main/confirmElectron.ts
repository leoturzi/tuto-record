import { BrowserWindow, dialog } from 'electron'
import type { ConfirmRequest } from './tutorialRecording'

/**
 * Asks a yes/no question with a native dialog, attached to the focused window. Cancel is the
 * default button, so pressing Return never moves anything to the Trash by accident.
 */
export async function confirm({ message, detail, confirmLabel }: ConfirmRequest): Promise<boolean> {
  const options = {
    type: 'warning' as const,
    message,
    detail,
    buttons: [confirmLabel, 'Cancel'],
    defaultId: 1,
    cancelId: 1
  }
  const window = BrowserWindow.getFocusedWindow()
  const { response } = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options)
  return response === 0
}
