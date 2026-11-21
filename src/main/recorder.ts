import type { RecorderPhase, RecorderStatus } from '../shared/ipc'
import type { ClickEvent, ClickSource } from './click'

/** Wait after Start so the window's hide animation is not captured. */
export const START_DELAY_MS = 300
/** Clicks closer together than this (since the last counted Click) are one Click. */
export const DEBOUNCE_MS = 300
/** A Dock icon click this soon after a Click is taken to be that Click. */
export const DOCK_CLICK_WINDOW_MS = 1000

export interface RecorderDeps {
  /** Resolves to null when recording may start, or to a message saying why not. */
  checkReady(): Promise<string | null>
  clicks: ClickSource
  /** Hides every app window, so none of them appears in a Screenshot. */
  hideWindow(): void
  /** Brings the main window back. */
  showWindow(): void
  /** Sets the Dock badge text; an empty string clears it. */
  setBadge(text: string): void
  /** Saves the Capture for a counted Click; resolves to the saved file paths. */
  capture(click: ClickEvent): Promise<string[]>
  deleteFiles(paths: string[]): Promise<void>
  /** The current time in milliseconds, comparable to a Click's `time`. */
  now(): number
  onChange(status: RecorderStatus): void
}

export interface Recorder {
  getStatus(): RecorderStatus
  start(): Promise<void>
  /** Stops Recording and brings the window back. Does nothing when idle. */
  stop(error?: string): void
  /** The Stop shortcut: stops a Recording; when idle it only brings the window back. */
  handleShortcut(): void
  /**
   * The user clicked the Dock icon: stop if recording. The Dock click itself was counted as a
   * Click, so if it was the latest one its Capture is deleted first.
   */
  handleDockActivate(): Promise<void>
  setShortcutOk(ok: boolean): void
  /** Releases the click hook on quit, without touching the window. */
  dispose(): void
}

export function createRecorder(deps: RecorderDeps): Recorder {
  let status: RecorderStatus = { phase: 'idle', count: 0, error: null, shortcutOk: true }
  let startTimer: ReturnType<typeof setTimeout> | null = null
  let lastCounted = Number.NEGATIVE_INFINITY
  /** The latest counted Click and its (possibly still running) Capture. */
  let last: { click: ClickEvent; files: Promise<string[]> } | null = null

  function update(patch: Partial<RecorderStatus>): void {
    status = { ...status, ...patch }
    deps.onChange(status)
  }

  /** Reads the phase afresh; needed because it can change while awaiting. */
  const phase = (): RecorderPhase => status.phase

  function clearStartTimer(): void {
    if (startTimer) clearTimeout(startTimer)
    startTimer = null
  }

  function handleClick(click: ClickEvent): void {
    if (status.phase !== 'recording') return
    if (click.time - lastCounted < DEBOUNCE_MS) return
    lastCounted = click.time
    update({ count: status.count + 1 })
    deps.setBadge(String(status.count))

    const files = deps.capture(click)
    last = { click, files }
    files.catch((err: unknown) => {
      stop(`Capture failed: ${err instanceof Error ? err.message : String(err)}`)
    })
  }

  function begin(): void {
    startTimer = null
    try {
      deps.clicks.start(handleClick)
    } catch (err) {
      deps.clicks.stop()
      deps.setBadge('')
      update({
        phase: 'idle',
        error: `Could not listen for clicks: ${err instanceof Error ? err.message : String(err)}`
      })
      deps.showWindow()
      return
    }
    lastCounted = Number.NEGATIVE_INFINITY
    last = null
    deps.setBadge('0')
    update({ phase: 'recording' })
  }

  function stop(error?: string): void {
    if (status.phase === 'idle') return
    clearStartTimer()
    deps.clicks.stop()
    deps.setBadge('')
    update({ phase: 'idle', error: error ?? null })
    deps.showWindow()
  }

  async function start(): Promise<void> {
    if (status.phase !== 'idle') return
    update({ phase: 'starting', count: 0, error: null })
    const problem = await deps.checkReady()
    if (phase() !== 'starting') return // stopped while checking
    if (problem) {
      update({ phase: 'idle', error: problem })
      deps.showWindow()
      return
    }
    deps.hideWindow()
    startTimer = setTimeout(begin, START_DELAY_MS)
  }

  return {
    getStatus: () => status,

    start,

    stop,

    handleShortcut() {
      if (status.phase === 'idle') deps.showWindow()
      else stop()
    },

    async handleDockActivate() {
      if (status.phase === 'idle') return
      const latest = last
      if (latest && deps.now() - latest.click.time < DOCK_CLICK_WINDOW_MS) {
        last = null
        update({ count: Math.max(0, status.count - 1) })
        try {
          await deps.deleteFiles(await latest.files)
        } catch {
          // The Capture failed or its files are already gone; there is nothing left to delete.
        }
      }
      stop()
    },

    setShortcutOk(ok) {
      update({ shortcutOk: ok })
    },

    dispose() {
      clearStartTimer()
      deps.clicks.stop()
      deps.setBadge('')
    }
  }
}
