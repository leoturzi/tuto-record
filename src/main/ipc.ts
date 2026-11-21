import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC } from '../shared/ipc'
import { isPermissionKind, type PermissionService } from './permissions'
import type { Recorder } from './recorder'
import type { SettingsService } from './settings'

export function registerIpc(
  permissions: PermissionService,
  settings: SettingsService,
  recorder: Recorder
): void {
  ipcMain.handle(IPC.permissionsGet, () => permissions.getStatus())

  ipcMain.handle(IPC.permissionsOpenSettings, async (_event, kind: unknown) => {
    if (!isPermissionKind(kind)) throw new Error(`Unknown permission: ${String(kind)}`)
    await permissions.openSettings(kind)
  })

  ipcMain.handle(IPC.appRelaunch, () => {
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle(IPC.settingsGet, () => settings.get())

  ipcMain.handle(IPC.settingsChooseFolder, async (event) => {
    const current = await settings.get()
    const options = {
      title: 'Choose the folder for screenshots',
      buttonLabel: 'Choose folder',
      properties: ['openDirectory', 'createDirectory'] as Array<
        'openDirectory' | 'createDirectory'
      >,
      ...(current.outputFolder ? { defaultPath: current.outputFolder } : {})
    }
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return current
    return settings.setOutputFolder(result.filePaths[0])
  })

  ipcMain.handle(IPC.folderOpen, async () => {
    const { outputFolder } = await settings.get()
    if (!outputFolder) return
    const error = await shell.openPath(outputFolder)
    if (error) throw new Error(error)
  })

  ipcMain.handle(IPC.recorderGetState, () => recorder.getStatus())
  ipcMain.handle(IPC.recorderStart, () => recorder.start())
  ipcMain.handle(IPC.recorderStop, () => recorder.stop())
}
