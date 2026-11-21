import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type RecorderStatus, type TutoApi } from '../shared/ipc'

const api: TutoApi = {
  getPermissions: () => ipcRenderer.invoke(IPC.permissionsGet),
  openPermissionSettings: (kind) => ipcRenderer.invoke(IPC.permissionsOpenSettings, kind),
  relaunch: () => ipcRenderer.invoke(IPC.appRelaunch),

  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  chooseProjectsFolder: () => ipcRenderer.invoke(IPC.settingsChooseProjectsFolder),
  selectTutorial: (ref) => ipcRenderer.invoke(IPC.settingsSelectTutorial, ref),
  setExpandedProjects: (projects) => ipcRenderer.invoke(IPC.settingsSetExpanded, projects),
  openProjectsFolder: () => ipcRenderer.invoke(IPC.folderOpenProjects),
  openTutorialInFinder: (ref) => ipcRenderer.invoke(IPC.tutorialOpenInFinder, ref),
  openSettings: () => ipcRenderer.invoke(IPC.windowOpenSettings),
  showRowActions: (point) => ipcRenderer.invoke(IPC.menuRowActions, point),

  listProjects: () => ipcRenderer.invoke(IPC.projectsList),
  createProject: (name) => ipcRenderer.invoke(IPC.projectsCreate, name),
  renameProject: (project, to) => ipcRenderer.invoke(IPC.projectsRename, project, to),
  trashProject: (project) => ipcRenderer.invoke(IPC.projectsTrash, project),
  createTutorial: (project, name) => ipcRenderer.invoke(IPC.tutorialsCreate, project, name),
  renameTutorial: (ref, to) => ipcRenderer.invoke(IPC.tutorialsRename, ref, to),
  trashTutorial: (ref) => ipcRenderer.invoke(IPC.tutorialsTrash, ref),

  listImages: (ref) => ipcRenderer.invoke(IPC.imagesList, ref),
  trashImage: (ref, file) => ipcRenderer.invoke(IPC.imagesTrash, ref, file),

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
