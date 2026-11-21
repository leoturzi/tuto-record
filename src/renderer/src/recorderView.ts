import type { RecorderStatus } from '../../shared/ipc'

export interface RecorderView {
  buttonLabel: string
  buttonEnabled: boolean
  /** What the button does when pressed. */
  action: 'start' | 'stop'
  summary: string | null
  error: string | null
  shortcutWarning: string | null
}

export const SHORTCUT_LABEL = '⌃⌥⌘R'

function captures(count: number): string {
  return count === 1 ? '1 capture' : `${count} captures`
}

/** `ready` is true when permissions are granted and the Output folder is usable. */
export function buildRecorderView(status: RecorderStatus, ready: boolean): RecorderView {
  const shortcutWarning = status.shortcutOk
    ? null
    : `The shortcut ${SHORTCUT_LABEL} is already used by another app. Use the button instead.`

  switch (status.phase) {
    case 'starting':
      return {
        buttonLabel: 'Starting…',
        buttonEnabled: false,
        action: 'start',
        summary: null,
        error: null,
        shortcutWarning
      }
    case 'recording':
      return {
        buttonLabel: 'Stop recording',
        buttonEnabled: true,
        action: 'stop',
        summary: `Recording… ${captures(status.count)} so far.`,
        error: null,
        shortcutWarning
      }
    case 'idle':
      return {
        buttonLabel: 'Start recording',
        buttonEnabled: ready,
        action: 'start',
        summary:
          status.count > 0 && status.error === null
            ? `Last recording: ${captures(status.count)}.`
            : null,
        error: status.error,
        shortcutWarning
      }
  }
}
