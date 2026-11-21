import type { SettingsState } from '../../../shared/ipc'
import type { TutorialState } from './recorderView'

export interface StatusView {
  /** The status line under the preview. */
  text: string
  /** True when a Recording could start (Start or Record again). */
  ready: boolean
  /** True when the fix is in the Settings window, so the pane shows a notice with a button there. */
  needsSettings: boolean
}

const screenshots = (count: number): string =>
  count === 1 ? '1 screenshot' : `${count} screenshots`

/** The same checks, in the same order, as main's readiness check (`tutorialRecording.ts`). */
export function buildStatus(
  permissionsGranted: boolean,
  settings: SettingsState,
  tutorial: TutorialState,
  imageCount: number
): StatusView {
  if (!permissionsGranted) {
    return {
      text: 'tuto-record needs permissions. Grant them in Settings.',
      ready: false,
      needsSettings: true
    }
  }
  if (!settings.projectsFolder) {
    return {
      text: 'Choose a Projects folder in Settings to start.',
      ready: false,
      needsSettings: true
    }
  }
  if (settings.projectsFolderProblem) {
    return {
      text: `${settings.projectsFolderProblem} Choose another Projects folder in Settings.`,
      ready: false,
      needsSettings: true
    }
  }
  if (tutorial === 'none') {
    return { text: 'Select a Tutorial, or create one with +.', ready: false, needsSettings: false }
  }
  if (tutorial === 'has-images') {
    return {
      text: `${screenshots(imageCount)}. Record again replaces them.`,
      ready: true,
      needsSettings: false
    }
  }
  return { text: 'Ready to record.', ready: true, needsSettings: false }
}
