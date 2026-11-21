import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type RecorderStatus, type TutoApi } from '../shared/ipc'

const api: TutoApi = {
  getPermissions: () => ipcRenderer.invoke(IPC.permissionsGet),
  openPermissionSettings: (kind) => ipcRenderer.invoke(IPC.permissionsOpenSettings, kind),
  relaunch: () => ipcRenderer.invoke(IPC.appRelaunch),

  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  chooseProjectsFolder: () => ipcRenderer.invoke(IPC.settingsChooseProjectsFolder),
  selectTutorial: (path) => ipcRenderer.invoke(IPC.settingsSelectTutorial, path),
  setExpanded: (keys) => ipcRenderer.invoke(IPC.settingsSetExpanded, keys),
  openProjectsFolder: () => ipcRenderer.invoke(IPC.folderOpenProjects),
  openTutorialInFinder: (path) => ipcRenderer.invoke(IPC.tutorialOpenInFinder, path),
  openSettings: () => ipcRenderer.invoke(IPC.windowOpenSettings),
  showRowActions: (point) => ipcRenderer.invoke(IPC.menuRowActions, point),
  showCreateActions: (point) => ipcRenderer.invoke(IPC.menuCreateActions, point),

  listProjects: () => ipcRenderer.invoke(IPC.projectsList),
  createProject: (name) => ipcRenderer.invoke(IPC.projectsCreate, name),
  createItem: (parent, kind, name) => ipcRenderer.invoke(IPC.itemsCreate, parent, kind, name),
  renameItem: (path, to) => ipcRenderer.invoke(IPC.itemsRename, path, to),
  trashItem: (path) => ipcRenderer.invoke(IPC.itemsTrash, path),
  moveItem: (path, destination) => ipcRenderer.invoke(IPC.itemsMove, path, destination),

  listImages: (tutorial) => ipcRenderer.invoke(IPC.imagesList, tutorial),
  trashImage: (tutorial, file) => ipcRenderer.invoke(IPC.imagesTrash, tutorial, file),

  getRecorderStatus: () => ipcRenderer.invoke(IPC.recorderGetState),
  startRecording: () => ipcRenderer.invoke(IPC.recorderStart),
  recordAgain: () => ipcRenderer.invoke(IPC.recorderRecordAgain),
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
