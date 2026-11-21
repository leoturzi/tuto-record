/** Channel names and payload types shared by main, preload and renderer. */

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
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsRename: 'projects:rename',
  projectsTrash: 'projects:trash',
  tutorialsCreate: 'tutorials:create',
  tutorialsRename: 'tutorials:rename',
  tutorialsTrash: 'tutorials:trash',
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

/** Points at one Tutorial by its Project's and its own folder names. */
export interface TutorialRef {
  project: string
  tutorial: string
}

export interface TutorialNode {
  name: string
}

export interface ProjectNode {
  name: string
  /** Newest first, by folder creation time. */
  tutorials: TutorialNode[]
}

/** One image file in a Tutorial folder, as the preview shows it. */
export interface ImageItem {
  file: string
  /** `tuto-image://` URLs; they change when the file changes. */
  thumbUrl: string
  previewUrl: string
}

/** Result of a create or rename: `error` is null when it worked, otherwise a short message. */
export interface NameResult {
  error: string | null
}

/** What the ⋯ menu on a sidebar row offers. */
export type RowAction = 'rename' | 'trash'

export interface SettingsState {
  /** The Projects folder the user chose, or null before one was chosen. */
  projectsFolder: string | null
  /** Why the Projects folder cannot be used right now (deleted, not writable), or null if it is fine. */
  projectsFolderProblem: string | null
  /** The selected Tutorial, or null when none is selected or its folder no longer exists. */
  selectedTutorial: TutorialRef | null
  /** Names of the Projects shown expanded in the sidebar. */
  expandedProjects: string[]
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
  selectTutorial(ref: TutorialRef | null): Promise<SettingsState>
  setExpandedProjects(projects: string[]): Promise<void>
  openProjectsFolder(): Promise<void>
  openTutorialInFinder(ref: TutorialRef): Promise<void>
  openSettings(): Promise<void>
  /** Shows the native ⋯ menu at a point in the window. Resolves to the choice, or null. */
  showRowActions(point: { x: number; y: number }): Promise<RowAction | null>

  listProjects(): Promise<ProjectNode[]>
  createProject(name: string): Promise<NameResult>
  renameProject(project: string, to: string): Promise<NameResult>
  /** Asks first. Resolves to false if the user cancelled. */
  trashProject(project: string): Promise<boolean>
  createTutorial(project: string, name: string): Promise<NameResult>
  renameTutorial(ref: TutorialRef, to: string): Promise<NameResult>
  /** Asks first. Resolves to false if the user cancelled. */
  trashTutorial(ref: TutorialRef): Promise<boolean>

  listImages(ref: TutorialRef): Promise<ImageItem[]>
  /** Asks first. Resolves to false if the user cancelled. */
  trashImage(ref: TutorialRef, file: string): Promise<boolean>

  getRecorderStatus(): Promise<RecorderStatus>
  startRecording(): Promise<void>
  /** Asks first, moves the Tutorial's images to the Trash, then starts. */
  recordAgain(): Promise<void>
  stopRecording(): Promise<void>
  /** Calls `listener` on every recorder change. Returns a function that unsubscribes. */
  onRecorderStatus(listener: (status: RecorderStatus) => void): () => void
}
