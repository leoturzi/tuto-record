import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC, type ImageItem, type TutorialRef } from '../shared/ipc'
import { imageUrl } from './imageUrl'
import { showRowActions } from './menu'
import { isPermissionKind, type PermissionService } from './permissions'
import type { ProjectsService } from './projects'
import type { Recorder } from './recorder'
import { isTutorialRef, type SettingsService } from './settings'
import type { ConfirmRequest, TutorialRecording } from './tutorialRecording'

export interface IpcServices {
  permissions: PermissionService
  settings: SettingsService
  projects: ProjectsService
  recorder: Recorder
  tutorialRecording: TutorialRecording
  confirm(request: ConfirmRequest): Promise<boolean>
  openSettings(): void
}

// Everything below arrives from the renderer, so its shape is checked before it is used.
// Names are then checked again by projects.ts, which only accepts existing direct children.

function text(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error(`Expected ${what} to be text.`)
  return value
}

function tutorialRef(value: unknown): TutorialRef {
  if (!isTutorialRef(value)) throw new Error('Expected a Tutorial.')
  return { project: value.project, tutorial: value.tutorial }
}

function point(value: unknown): { x: number; y: number } {
  const { x, y } = (value ?? {}) as Record<string, unknown>
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Expected a point.')
  return { x: x as number, y: y as number }
}

const plural = (count: number, noun: string): string =>
  count === 1 ? `1 ${noun}` : `${count} ${noun}s`

export function registerIpc(services: IpcServices): void {
  const { permissions, settings, projects, recorder, tutorialRecording, confirm } = services

  ipcMain.handle(IPC.permissionsGet, () => permissions.getStatus())

  ipcMain.handle(IPC.permissionsOpenSettings, async (_event, kind: unknown) => {
    if (!isPermissionKind(kind)) throw new Error(`Unknown permission: ${String(kind)}`)
    await permissions.openSettings(kind)
  })

  ipcMain.handle(IPC.appRelaunch, () => {
    app.relaunch()
    app.exit(0)
  })

  // Settings

  ipcMain.handle(IPC.settingsGet, () => settings.get())

  ipcMain.handle(IPC.settingsChooseProjectsFolder, async (event) => {
    const current = await settings.get()
    const options = {
      title: 'Choose the folder that holds your Projects',
      buttonLabel: 'Choose folder',
      properties: ['openDirectory', 'createDirectory'] as Array<
        'openDirectory' | 'createDirectory'
      >,
      ...(current.projectsFolder ? { defaultPath: current.projectsFolder } : {})
    }
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const chosen = result.filePaths[0]
    if (result.canceled || !chosen || chosen === current.projectsFolder) return current
    return settings.setProjectsFolder(chosen)
  })

  ipcMain.handle(IPC.settingsSelectTutorial, (_event, ref: unknown) =>
    settings.selectTutorial(ref === null ? null : tutorialRef(ref))
  )

  ipcMain.handle(IPC.settingsSetExpanded, async (_event, names: unknown) => {
    if (!Array.isArray(names)) throw new Error('Expected a list of Projects.')
    await settings.setExpanded(names.map((name) => text(name, 'a Project')))
  })

  ipcMain.handle(IPC.folderOpenProjects, async () => {
    const { projectsFolder } = await settings.get()
    if (!projectsFolder) return
    const error = await shell.openPath(projectsFolder)
    if (error) throw new Error(error)
  })

  ipcMain.handle(IPC.tutorialOpenInFinder, async (_event, ref: unknown) => {
    const error = await shell.openPath(await projects.tutorialPath(tutorialRef(ref)))
    if (error) throw new Error(error)
  })

  ipcMain.handle(IPC.windowOpenSettings, () => services.openSettings())

  ipcMain.handle(IPC.menuRowActions, (event, at: unknown) => {
    const { x, y } = point(at)
    return showRowActions(event.sender, x, y)
  })

  // Projects and Tutorials

  ipcMain.handle(IPC.projectsList, async () => {
    const { projectsFolder, projectsFolderProblem } = await settings.get()
    if (!projectsFolder || projectsFolderProblem) return []
    return projects.listTree()
  })

  ipcMain.handle(IPC.projectsCreate, async (_event, name: unknown) => {
    const result = await projects.createProject(text(name, 'a name'))
    if (!result.error) {
      const { expandedProjects } = await settings.get()
      await settings.setExpanded([...expandedProjects, (name as string).trim()])
    }
    return result
  })

  ipcMain.handle(IPC.projectsRename, async (_event, project: unknown, to: unknown) => {
    const from = text(project, 'a Project')
    const result = await projects.renameProject(from, text(to, 'a name'))
    if (!result.error) await settings.followProjectRename(from, (to as string).trim())
    return result
  })

  ipcMain.handle(IPC.projectsTrash, async (_event, project: unknown) => {
    const name = text(project, 'a Project')
    const tutorials = await projects.countTutorials(name)
    const ok = await confirm({
      message: `Move the Project "${name}" and its ${plural(tutorials, 'Tutorial')} to the Trash?`,
      detail: 'You can get it back from the Trash.',
      confirmLabel: 'Move to Trash'
    })
    if (!ok) return false
    await projects.trashProject(name)
    await settings.forgetProject(name)
    return true
  })

  ipcMain.handle(IPC.tutorialsCreate, async (_event, project: unknown, name: unknown) =>
    projects.createTutorial(text(project, 'a Project'), text(name, 'a name'))
  )

  ipcMain.handle(IPC.tutorialsRename, async (_event, ref: unknown, to: unknown) => {
    const from = tutorialRef(ref)
    const result = await projects.renameTutorial(from, text(to, 'a name'))
    if (!result.error) await settings.followTutorialRename(from, (to as string).trim())
    return result
  })

  ipcMain.handle(IPC.tutorialsTrash, async (_event, ref: unknown) => {
    const tutorial = tutorialRef(ref)
    const ok = await confirm({
      message: `Move the Tutorial "${tutorial.tutorial}" and its screenshots to the Trash?`,
      detail: 'You can get it back from the Trash.',
      confirmLabel: 'Move to Trash'
    })
    if (!ok) return false
    await projects.trashTutorial(tutorial)
    await settings.forgetTutorial(tutorial)
    return true
  })

  // Images

  ipcMain.handle(IPC.imagesList, async (_event, ref: unknown): Promise<ImageItem[]> => {
    const tutorial = tutorialRef(ref)
    const images = await projects.listImages(tutorial)
    return images.map(({ file, version }) => ({
      file,
      thumbUrl: imageUrl('thumb', tutorial, file, version),
      previewUrl: imageUrl('preview', tutorial, file, version)
    }))
  })

  ipcMain.handle(IPC.imagesTrash, async (_event, ref: unknown, file: unknown) => {
    const tutorial = tutorialRef(ref)
    const name = text(file, 'a file name')
    const ok = await confirm({
      message: `Move "${name}" to the Trash?`,
      detail: 'You can get it back from the Trash.',
      confirmLabel: 'Move to Trash'
    })
    if (!ok) return false
    await projects.trashImage(tutorial, name)
    return true
  })

  // Recorder

  ipcMain.handle(IPC.recorderGetState, () => recorder.getStatus())
  ipcMain.handle(IPC.recorderStart, () => recorder.start())
  ipcMain.handle(IPC.recorderRecordAgain, async () => {
    await tutorialRecording.recordAgain()
  })
  ipcMain.handle(IPC.recorderStop, () => recorder.stop())
}
