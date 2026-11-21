import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type RecorderStatus, type TutoApi } from '../shared/ipc'

const api: TutoApi = {
  getPermissions: () => ipcRenderer.invoke(IPC.permissionsGet),
  openPermissionSettings: (kind) => ipcRenderer.invoke(IPC.permissionsOpenSettings, kind),
  relaunch: () => ipcRenderer.invoke(IPC.appRelaunch),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  chooseOutputFolder: () => ipcRenderer.invoke(IPC.settingsChooseFolder),
  openOutputFolder: () => ipcRenderer.invoke(IPC.folderOpen),
  getRecorderStatus: () => ipcRenderer.invoke(IPC.recorderGetState),
  startRecording: () => ipcRenderer.invoke(IPC.recorderStart),
  stopRecording: () => ipcRenderer.invoke(IPC.recorderStop),
  onRecorderStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: RecorderStatus): void =>
      listener(status)
    ipcRenderer.on(IPC.recorderState, handler)
    return () => {
      ipcRenderer.removeListener(IPC.recorderState, handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
