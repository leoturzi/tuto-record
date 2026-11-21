import type { SettingsState } from '../../../shared/ipc'

export interface SettingsView {
  /** The folder's path, or a hint when none is chosen. */
  pathText: string
  pathEmpty: boolean
  /** Why the folder cannot be used, or null. */
  problem: string | null
  /** Whether "Open in Finder" makes sense (a folder is chosen and usable). */
  showOpen: boolean
  chooseLabel: string
}

export function buildSettingsView(settings: SettingsState): SettingsView {
  const folder = settings.projectsFolder
  return {
    pathText: folder ?? 'No folder chosen yet',
    pathEmpty: folder === null,
    problem: settings.projectsFolderProblem,
    showOpen: folder !== null && settings.projectsFolderProblem === null,
    chooseLabel: folder === null ? 'Choose folder…' : 'Change…'
  }
}
