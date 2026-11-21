import type { ItemPath, SettingsState } from '../shared/ipc'

export interface ConfirmRequest {
  message: string
  detail: string
  /** Label of the button that goes ahead; the other one is Cancel. */
  confirmLabel: string
}

export interface TutorialRecordingDeps {
  permissionsGranted(): boolean
  getSettings(): Promise<SettingsState>
  countImages(tutorial: ItemPath): Promise<number>
  trashAllImages(tutorial: ItemPath): Promise<void>
  confirm(request: ConfirmRequest): Promise<boolean>
  /** `recorder.start`, passed as a closure because the recorder is created after this. */
  startRecorder(): Promise<void>
}

export interface TutorialRecording {
  /** The recorder's readiness check: null when a Recording may start, or why it may not. */
  checkReady(): Promise<string | null>
  /**
   * Record again: asks first, moves every image of the selected Tutorial to the Trash, then
   * starts. Resolves to false when there is nothing selected or the user cancelled.
   */
  recordAgain(): Promise<boolean>
}

const images = (count: number): string => (count === 1 ? '1 image' : `${count} images`)

/** The rules for recording into the selected Tutorial (one Recording per Tutorial). */
export function createTutorialRecording(deps: TutorialRecordingDeps): TutorialRecording {
  /** Everything except "the Tutorial must be empty". */
  async function selection(): Promise<{ path: ItemPath } | { problem: string }> {
    if (!deps.permissionsGranted()) return { problem: 'Grant both permissions first.' }
    const settings = await deps.getSettings()
    if (!settings.projectsFolder) return { problem: 'Choose a Projects folder first.' }
    if (settings.projectsFolderProblem) return { problem: settings.projectsFolderProblem }
    if (!settings.selectedTutorial) return { problem: 'Select a Tutorial first.' }
    return { path: settings.selectedTutorial }
  }

  return {
    async checkReady() {
      const selected = await selection()
      if ('problem' in selected) return selected.problem
      if ((await deps.countImages(selected.path)) > 0) {
        return 'This Tutorial already has screenshots. Use Record again to replace them.'
      }
      return null
    },

    async recordAgain() {
      const selected = await selection()
      if ('problem' in selected) {
        // Let the recorder report the problem the usual way.
        await deps.startRecorder()
        return false
      }
      const count = await deps.countImages(selected.path)
      if (count > 0) {
        const ok = await deps.confirm({
          message: `Move ${images(count)} to the Trash and record again?`,
          detail: `Everything in "${selected.path[selected.path.length - 1]}" will be replaced by the new Recording. You can get the images back from the Trash.`,
          confirmLabel: 'Record again'
        })
        if (!ok) return false
        await deps.trashAllImages(selected.path)
      }
      await deps.startRecorder()
      return true
    }
  }
}
