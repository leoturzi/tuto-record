import type { RecorderStatus } from '../../../shared/ipc'

/** What the selected Tutorial holds, as far as recording is concerned. */
export type TutorialState = 'none' | 'empty' | 'has-images'

export interface RecorderAction {
  action: 'start' | 'record-again' | 'stop'
  label: string
  enabled: boolean
  /** Start sits in the empty Tutorial's middle; Record again and Stop sit in the header. */
  placement: 'empty-state' | 'header'
}

export interface RecorderView {
  /** The one recording button, or null when there is nothing to record into. */
  primary: RecorderAction | null
  summary: string | null
  error: string | null
  shortcutWarning: string | null
}

export const SHORTCUT_LABEL = '⌃⌥⌘R'

function captures(count: number): string {
  return count === 1 ? '1 capture' : `${count} captures`
}

/**
 * `ready` is true when permissions are granted, the Projects folder is usable and a Tutorial is
 * selected. Start is offered only for an empty Tutorial, Record again only for one with images.
 */
export function buildRecorderView(
  status: RecorderStatus,
  ready: boolean,
  tutorial: TutorialState
): RecorderView {
  const shortcutWarning = status.shortcutOk
    ? null
    : `The shortcut ${SHORTCUT_LABEL} is already used by another app. Stop a Recording by clicking the Dock icon.`

  const kind = tutorial === 'has-images' ? 'record-again' : 'start'
  const placement = kind === 'start' ? 'empty-state' : 'header'
  const label = kind === 'start' ? 'Start recording' : 'Record again'

  switch (status.phase) {
    case 'starting':
      return {
        primary: { action: kind, label: 'Starting…', enabled: false, placement },
        summary: null,
        error: null,
        shortcutWarning
      }
    case 'recording':
      return {
        primary: { action: 'stop', label: 'Stop recording', enabled: true, placement: 'header' },
        summary: `Recording… ${captures(status.count)} so far.`,
        error: null,
        shortcutWarning
      }
    case 'idle':
      return {
        primary: tutorial === 'none' ? null : { action: kind, label, enabled: ready, placement },
        summary:
          status.count > 0 && status.error === null
            ? `Last recording: ${captures(status.count)}.`
            : null,
        error: status.error,
        shortcutWarning
      }
  }
}
