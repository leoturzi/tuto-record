import { $, setText } from '../ui/dom'
import type { RecorderAction, RecorderView } from './recorderView'

export interface RecorderBarHandlers {
  act(action: RecorderAction['action']): void
  openInFinder(): void
}

export interface RecorderBar {
  /** `hasTutorial` shows Open in Finder. */
  render(view: RecorderView, hasTutorial: boolean): void
}

/**
 * The recording controls: Record again / Stop in the header, Start recording in the empty
 * Tutorial's middle, Open in Finder, and the recorder's summary, error and shortcut warning.
 */
export function createRecorderBar(handlers: RecorderBarHandlers): RecorderBar {
  const headerButton = $<HTMLButtonElement>('#header-action')
  const startButton = $<HTMLButtonElement>('#start')
  const openButton = $<HTMLButtonElement>('#open-tutorial')
  const summary = $('#recorder-summary')
  const error = $('#recorder-error')
  const warning = $('#shortcut-warning')
  let action: RecorderAction['action'] | null = null

  for (const button of [headerButton, startButton]) {
    button.addEventListener('click', () => {
      if (action) handlers.act(action)
    })
  }
  openButton.addEventListener('click', () => handlers.openInFinder())

  function place(button: HTMLButtonElement, primary: RecorderAction | null, where: string): void {
    const here = primary !== null && primary.placement === where
    button.hidden = !here
    if (!here) return
    button.textContent = primary.label
    button.disabled = !primary.enabled
    button.classList.toggle('danger', primary.action === 'stop')
  }

  return {
    render(view, hasTutorial) {
      action = view.primary?.action ?? null
      place(headerButton, view.primary, 'header')
      place(startButton, view.primary, 'empty-state')
      openButton.hidden = !hasTutorial
      setText(summary, view.summary)
      setText(error, view.error)
      setText(warning, view.shortcutWarning)
    }
  }
}
