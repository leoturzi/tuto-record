/** Channel names and payload types shared by main, preload and renderer. */
import type { ItemPath } from './paths'

export type { ItemPath } from './paths'

export const IPC = {
  permissionsGet: 'permissions:get',
  permissionsOpenSettings: 'permissions:open-settings',
  appRelaunch: 'app:relaunch',
  settingsGet: 'settings:get',
  settingsChooseProjectsFolder: 'settings:choose-projects-folder',
  settingsSelectTutorial: 'settings:select-tutorial',
  settingsSetExpanded: 'settings:set-expanded',
  folderOpenProjects: 'folder:open-projects',
  tutorialOpenInFinder: 'tutorial:open-in-finder',
  windowOpenSettings: 'window:open-settings',
  menuRowActions: 'menu:row-actions',
  menuCreateActions: 'menu:create-actions',
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  itemsCreate: 'items:create',
  itemsRename: 'items:rename',
  itemsTrash: 'items:trash',
  itemsMove: 'items:move',
  imagesList: 'images:list',
  imagesTrash: 'images:trash',
  recorderGetState: 'recorder:get-state',
  recorderStart: 'recorder:start',
  recorderRecordAgain: 'recorder:record-again',
  recorderStop: 'recorder:stop',
  recorderState: 'recorder:state'
} as const

export type PermissionKind = 'accessibility' | 'screen'

export type ScreenStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface PermissionsStatus {
  /** False on platforms with nothing to grant (everything is then reported as granted). */
  required: boolean
  accessibility: boolean
  screen: ScreenStatus
  /** True when the app can listen for Clicks and capture Screenshots. */
  allGranted: boolean
}

/** What can live inside a Project or a Group. */
export type ItemKind = 'group' | 'tutorial'

export interface TreeNode {
  kind: ItemKind
  name: string
  /** Groups only: Groups first, then Tutorials, each newest first. */
  children?: TreeNode[]
}

export interface ProjectNode {
  name: string
  /** Groups first, then Tutorials, each newest first by folder creation time. */
  children: TreeNode[]
}

/** One image file in a Tutorial folder, as the preview shows it. */
export interface ImageItem {
  file: string
  /** `tuto-image://` URLs; they change when the file changes. */
  thumbUrl: string
  previewUrl: string
}

/** Result of a create, rename or move: `error` is null when it worked, otherwise a short message. */
export interface NameResult {
  error: string | null
}

/** What the ⋯ menu on a sidebar row offers. */
export type RowAction = 'rename' | 'trash'

/** What the + menu on a Project or Group row offers. */
export type CreateAction = ItemKind

export interface SettingsState {
  /** The Projects folder the user chose, or null before one was chosen. */
  projectsFolder: string | null
  /** Why the Projects folder cannot be used right now (deleted, not writable), or null if it is fine. */
  projectsFolderProblem: string | null
  /** Path of the selected Tutorial, or null when none is selected or its folder no longer exists. */
  selectedTutorial: ItemPath | null
  /** Keys (paths joined with '/') of the Projects and Groups shown expanded in the sidebar. */
  expanded: string[]
}

export type RecorderPhase = 'idle' | 'starting' | 'recording'

export interface RecorderStatus {
  phase: RecorderPhase
  /** Clicks counted in the current Recording, or in the last one once it has stopped. */
  count: number
  /** Why the last Start or Recording failed, or null. */
  error: string | null
  /** False when another app already owns the Stop shortcut. */
  shortcutOk: boolean
}

/** The API the preload script exposes as `window.api`. */
export interface TutoApi {
  getPermissions(): Promise<PermissionsStatus>
  openPermissionSettings(kind: PermissionKind): Promise<void>
  relaunch(): Promise<void>

  getSettings(): Promise<SettingsState>
  /** Opens the folder picker. Resolves with the settings after the dialog (unchanged if cancelled). */
  chooseProjectsFolder(): Promise<SettingsState>
  selectTutorial(path: ItemPath | null): Promise<SettingsState>
  setExpanded(keys: string[]): Promise<void>
  openProjectsFolder(): Promise<void>
  openTutorialInFinder(path: ItemPath): Promise<void>
  openSettings(): Promise<void>
  /** Shows the native ⋯ menu at a point in the window. Resolves to the choice, or null. */
  showRowActions(point: { x: number; y: number }): Promise<RowAction | null>
  /** Shows the native + menu (New Tutorial / New Group). Resolves to the choice, or null. */
  showCreateActions(point: { x: number; y: number }): Promise<CreateAction | null>

  listProjects(): Promise<ProjectNode[]>
  createProject(name: string): Promise<NameResult>
  /** Creates a Tutorial or a Group inside the Project or Group at `parent`. */
  createItem(parent: ItemPath, kind: ItemKind, name: string): Promise<NameResult>
  /** Renames a Project, Group or Tutorial. */
  renameItem(path: ItemPath, to: string): Promise<NameResult>
  /** Asks first. Resolves to false if the user cancelled. */
  trashItem(path: ItemPath): Promise<boolean>
  /** Moves a Tutorial or Group into the Project or Group at `destination`. */
  moveItem(path: ItemPath, destination: ItemPath): Promise<NameResult>

  listImages(tutorial: ItemPath): Promise<ImageItem[]>
  /** Asks first. Resolves to false if the user cancelled. */
  trashImage(tutorial: ItemPath, file: string): Promise<boolean>

  getRecorderStatus(): Promise<RecorderStatus>
  startRecording(): Promise<void>
  /** Asks first, moves the Tutorial's images to the Trash, then starts. */
  recordAgain(): Promise<void>
  stopRecording(): Promise<void>
  /** Calls `listener` on every recorder change. Returns a function that unsubscribes. */
  onRecorderStatus(listener: (status: RecorderStatus) => void): () => void
}
