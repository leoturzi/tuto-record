import type { SettingsState } from '../../shared/ipc'

export interface StatusView {
  /** Message under the sections, or null when permissions still need attention. */
  text: string | null
  /** True when recording could start (permissions granted and Output folder usable). */
  ready: boolean
}

/** `permissionsReady` is the permission view's `showReady`. */
export function buildStatus(permissionsReady: boolean, settings: SettingsState): StatusView {
  if (!permissionsReady) return { text: null, ready: false }
  if (!settings.outputFolder) {
    return { text: 'Choose an output folder to start recording.', ready: false }
  }
  if (settings.outputFolderProblem) {
    return { text: 'Fix the output folder to start recording.', ready: false }
  }
  return { text: 'Ready to record.', ready: true }
}
