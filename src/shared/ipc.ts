/** Channel names and payload types shared by main, preload and renderer. */

export const IPC = {
  permissionsGet: 'permissions:get',
  permissionsOpenSettings: 'permissions:open-settings',
  appRelaunch: 'app:relaunch',
  settingsGet: 'settings:get',
  settingsChooseFolder: 'settings:choose-folder',
  folderOpen: 'folder:open',
  recorderGetState: 'recorder:get-state',
  recorderStart: 'recorder:start',
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

export interface SettingsState {
  /** The Output folder the user chose, or null before one was chosen. */
  outputFolder: string | null
  /** Why the Output folder cannot be used right now (deleted, not writable), or null if it is fine. */
  outputFolderProblem: string | null
}

export type RecorderPhase = 'idle' | 'starting' | 'recording'

export interface RecorderStatus {
  phase: RecorderPhase
  /** Clicks counted in the current Recording, or in the last one once it has stopped. */
  count: number
  /** Why the last Start or Recording failed, or null. */
  error: string | null
  /** False when another app already owns the Start/Stop shortcut. */
  shortcutOk: boolean
}

/** The API the preload script exposes as `window.api`. */
export interface TutoApi {
  getPermissions(): Promise<PermissionsStatus>
  openPermissionSettings(kind: PermissionKind): Promise<void>
  relaunch(): Promise<void>
  getSettings(): Promise<SettingsState>
  /** Opens the folder picker. Resolves with the settings after the dialog (unchanged if cancelled). */
  chooseOutputFolder(): Promise<SettingsState>
  openOutputFolder(): Promise<void>
  getRecorderStatus(): Promise<RecorderStatus>
  startRecording(): Promise<void>
  stopRecording(): Promise<void>
  /** Calls `listener` on every recorder change. Returns a function that unsubscribes. */
  onRecorderStatus(listener: (status: RecorderStatus) => void): () => void
}
