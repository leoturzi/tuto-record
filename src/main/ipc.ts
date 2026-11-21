import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC, type ImageItem, type ItemKind } from '../shared/ipc'
import { isItemPath, type ItemPath } from '../shared/paths'
import { imageUrl } from './imageUrl'
import { showCreateActions, showRowActions } from './menu'
import { isPermissionKind, type PermissionService } from './permissions'
import type { ProjectsService } from './projects'
import type { Recorder } from './recorder'
import type { SettingsService } from './settings'
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
// Paths are then checked again by projects.ts, one existing folder name at a time.

function text(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error(`Expected ${what} to be text.`)
  return value
}

function itemPath(value: unknown): ItemPath {
  if (!isItemPath(value)) throw new Error('Expected a path.')
  return [...value]
}

function itemKind(value: unknown): ItemKind {
  if (value !== 'tutorial' && value !== 'group') throw new Error('Expected a Tutorial or a Group.')
  return value
}

function point(value: unknown): { x: number; y: number } {
  const { x, y } = (value ?? {}) as Record<string, unknown>
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Expected a point.')
  return { x: x as number, y: y as number }
}

const plural = (count: number, noun: string): string =>
  count === 1 ? `1 ${noun}` : `${count} ${noun}s`

const last = (path: ItemPath): string => path[path.length - 1]

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

  ipcMain.handle(IPC.settingsSelectTutorial, (_event, path: unknown) =>
    settings.selectTutorial(path === null ? null : itemPath(path))
  )

  ipcMain.handle(IPC.settingsSetExpanded, async (_event, keys: unknown) => {
    if (!Array.isArray(keys)) throw new Error('Expected a list of keys.')
    await settings.setExpanded(keys.map((key) => text(key, 'a key')))
  })

  ipcMain.handle(IPC.folderOpenProjects, async () => {
    const { projectsFolder } = await settings.get()
    if (!projectsFolder) return
    const error = await shell.openPath(projectsFolder)
    if (error) throw new Error(error)
  })

  ipcMain.handle(IPC.tutorialOpenInFinder, async (_event, path: unknown) => {
    const error = await shell.openPath(await projects.tutorialPath(itemPath(path)))
    if (error) throw new Error(error)
  })

  ipcMain.handle(IPC.windowOpenSettings, () => services.openSettings())

  ipcMain.handle(IPC.menuRowActions, (event, at: unknown) => {
    const { x, y } = point(at)
    return showRowActions(event.sender, x, y)
  })

  ipcMain.handle(IPC.menuCreateActions, (event, at: unknown) => {
    const { x, y } = point(at)
    return showCreateActions(event.sender, x, y)
  })

  // Projects, Groups and Tutorials

  ipcMain.handle(IPC.projectsList, async () => {
    const { projectsFolder, projectsFolderProblem } = await settings.get()
    if (!projectsFolder || projectsFolderProblem) return []
    return projects.listTree()
  })

  ipcMain.handle(IPC.projectsCreate, async (_event, name: unknown) => {
    const result = await projects.createProject(text(name, 'a name'))
    if (!result.error) {
      const { expanded } = await settings.get()
      await settings.setExpanded([...expanded, (name as string).trim()])
    }
    return result
  })

  ipcMain.handle(IPC.itemsCreate, (_event, parent: unknown, kind: unknown, name: unknown) =>
    projects.createItem(itemPath(parent), itemKind(kind), text(name, 'a name'))
  )

  ipcMain.handle(IPC.itemsRename, async (_event, path: unknown, to: unknown) => {
    const from = itemPath(path)
    const result = await projects.rename(from, text(to, 'a name'))
    if (!result.error)
      await settings.followMove(from, [...from.slice(0, -1), (to as string).trim()])
    return result
  })

  ipcMain.handle(IPC.itemsTrash, async (_event, path: unknown) => {
    const item = itemPath(path)
    const tutorials = await projects.countTutorials(item)
    const isTutorial = item.length > 1 && tutorials === 0 && (await isTutorialPath(item))
    const what = item.length === 1 ? 'Project' : isTutorial ? 'Tutorial' : 'Group'
    const ok = await confirm({
      message: isTutorial
        ? `Move the Tutorial "${last(item)}" and its screenshots to the Trash?`
        : `Move the ${what} "${last(item)}" and its ${plural(tutorials, 'Tutorial')} to the Trash?`,
      detail: 'You can get it back from the Trash.',
      confirmLabel: 'Move to Trash'
    })
    if (!ok) return false
    await projects.trash(item)
    await settings.forget(item)
    return true
  })

  async function isTutorialPath(path: ItemPath): Promise<boolean> {
    try {
      await projects.tutorialPath(path)
      return true
    } catch {
      return false
    }
  }

  ipcMain.handle(IPC.itemsMove, async (_event, path: unknown, destination: unknown) => {
    const from = itemPath(path)
    const to = itemPath(destination)
    const result = await projects.move(from, to)
    if (!result.error) await settings.followMove(from, [...to, last(from)])
    return result
  })

  // Images

  ipcMain.handle(IPC.imagesList, async (_event, path: unknown): Promise<ImageItem[]> => {
    const tutorial = itemPath(path)
    const images = await projects.listImages(tutorial)
    return images.map(({ file, version }) => ({
      file,
      thumbUrl: imageUrl('thumb', tutorial, file, version),
      previewUrl: imageUrl('preview', tutorial, file, version)
    }))
  })

  ipcMain.handle(IPC.imagesTrash, async (_event, path: unknown, file: unknown) => {
    const tutorial = itemPath(path)
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
