import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClickEvent, ClickSource } from '../src/main/click'
import {
  createRecorder,
  DEBOUNCE_MS,
  type Recorder,
  START_DELAY_MS,
  type RecorderDeps
} from '../src/main/recorder'

function setup(overrides: Partial<RecorderDeps> = {}): {
  recorder: Recorder
  deps: RecorderDeps
  clicks: ClickSource
  click: (time: number) => void
  startAndWait: () => Promise<void>
} {
  let emit: ((click: ClickEvent) => void) | null = null
  const clicks: ClickSource = {
    start: vi.fn((onClick) => {
      emit = onClick
    }),
    stop: vi.fn(() => {
      emit = null
    })
  }
  const deps: RecorderDeps = {
    checkReady: vi.fn(async () => null),
    clicks,
    hideWindow: vi.fn(),
    showWindow: vi.fn(),
    setBadge: vi.fn(),
    capture: vi.fn(async (c: ClickEvent) => [`/out/${c.time}_d1.png`]),
    deleteFiles: vi.fn(async () => {}),
    now: vi.fn(() => 0),
    onChange: vi.fn(),
    ...overrides
  }
  const recorder = createRecorder(deps)
  const click = (time: number): void => emit?.({ x: 1, y: 2, time })
  const startAndWait = async (): Promise<void> => {
    await recorder.start()
    vi.advanceTimersByTime(START_DELAY_MS)
  }
  return { recorder, deps, clicks, click, startAndWait }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('start', () => {
  it('hides the window, waits, then starts listening', async () => {
    const { recorder, deps, clicks } = setup()
    await recorder.start()
    expect(recorder.getStatus().phase).toBe('starting')
    expect(deps.hideWindow).toHaveBeenCalledTimes(1)
    expect(clicks.start).not.toHaveBeenCalled()

    vi.advanceTimersByTime(START_DELAY_MS)
    expect(clicks.start).toHaveBeenCalledTimes(1)
    expect(recorder.getStatus().phase).toBe('recording')
    expect(deps.setBadge).toHaveBeenLastCalledWith('0')
  })

  it('does not start when not ready, and shows the reason', async () => {
    const { recorder, deps, clicks } = setup({
      checkReady: vi.fn(async () => 'Choose an output folder first.')
    })
    await recorder.start()
    expect(recorder.getStatus()).toMatchObject({
      phase: 'idle',
      error: 'Choose an output folder first.'
    })
    expect(deps.hideWindow).not.toHaveBeenCalled()
    expect(deps.showWindow).toHaveBeenCalledTimes(1)
    expect(clicks.start).not.toHaveBeenCalled()
  })

  it('ignores a second start while already running', async () => {
    const { recorder, deps, startAndWait } = setup()
    await startAndWait()
    await recorder.start()
    expect(deps.checkReady).toHaveBeenCalledTimes(1)
  })

  it('goes back to idle with an error if the click hook cannot start', async () => {
    const { recorder, deps, clicks, startAndWait } = setup()
    vi.mocked(clicks.start).mockImplementation(() => {
      throw new Error('no access')
    })
    await startAndWait()
    expect(recorder.getStatus().phase).toBe('idle')
    expect(recorder.getStatus().error).toMatch(/no access/)
    expect(deps.showWindow).toHaveBeenCalled()
    expect(deps.setBadge).toHaveBeenLastCalledWith('')
  })

  it('can be stopped before the delay ends, and never starts listening', async () => {
    const { recorder, clicks } = setup()
    await recorder.start()
    recorder.stop()
    vi.advanceTimersByTime(START_DELAY_MS * 2)
    expect(clicks.start).not.toHaveBeenCalled()
    expect(recorder.getStatus().phase).toBe('idle')
  })

  it('can be stopped while the readiness check is still running', async () => {
    let resolve: (value: string | null) => void = () => {}
    const { recorder, deps } = setup({
      checkReady: vi.fn(() => new Promise<string | null>((r) => (resolve = r)))
    })
    const starting = recorder.start()
    recorder.stop()
    resolve(null)
    await starting
    expect(recorder.getStatus().phase).toBe('idle')
    expect(deps.hideWindow).not.toHaveBeenCalled()
  })
})

describe('counting clicks', () => {
  it('counts each Click and updates the badge', async () => {
    const { recorder, deps, click, startAndWait } = setup()
    await startAndWait()
    click(1000)
    click(2000)
    expect(recorder.getStatus().count).toBe(2)
    expect(deps.setBadge).toHaveBeenLastCalledWith('2')
    expect(deps.capture).toHaveBeenCalledTimes(2)
  })

  it('collapses Clicks less than the debounce time apart', async () => {
    const { recorder, deps, click, startAndWait } = setup()
    await startAndWait()
    click(1000)
    click(1000 + DEBOUNCE_MS - 1)
    expect(recorder.getStatus().count).toBe(1)
    click(1000 + DEBOUNCE_MS)
    expect(recorder.getStatus().count).toBe(2)
    expect(deps.capture).toHaveBeenCalledTimes(2)
  })

  it('measures the debounce from the last counted Click, not from ignored ones', async () => {
    const { recorder, click, startAndWait } = setup()
    await startAndWait()
    click(0)
    click(200) // ignored
    click(400) // 400 after the counted Click: counted
    expect(recorder.getStatus().count).toBe(2)
  })

  it('counts nothing after stopping', async () => {
    const { recorder, click, startAndWait } = setup()
    await startAndWait()
    click(1000)
    recorder.stop()
    click(5000)
    expect(recorder.getStatus().count).toBe(1)
  })

  it('starts each Recording from zero', async () => {
    const { recorder, click, startAndWait } = setup()
    await startAndWait()
    click(1000)
    recorder.stop()
    await startAndWait()
    expect(recorder.getStatus().count).toBe(0)
    click(2000)
    expect(recorder.getStatus().count).toBe(1)
  })
})

describe('stop', () => {
  it('stops listening, clears the badge, shows the window and keeps the count', async () => {
    const { recorder, deps, clicks, click, startAndWait } = setup()
    await startAndWait()
    click(1000)
    recorder.stop()
    expect(clicks.stop).toHaveBeenCalled()
    expect(deps.setBadge).toHaveBeenLastCalledWith('')
    expect(deps.showWindow).toHaveBeenCalledTimes(1)
    expect(recorder.getStatus()).toMatchObject({ phase: 'idle', count: 1, error: null })
  })

  it('records an error message when stopped because of a failure', async () => {
    const { recorder, startAndWait } = setup()
    await startAndWait()
    recorder.stop('Disk full')
    expect(recorder.getStatus().error).toBe('Disk full')
  })

  it('does nothing when already idle', () => {
    const { recorder, deps } = setup()
    recorder.stop()
    expect(deps.showWindow).not.toHaveBeenCalled()
    expect(deps.onChange).not.toHaveBeenCalled()
  })
})

describe('toggle and Dock click', () => {
  it('toggle starts when idle and stops when running', async () => {
    const { recorder } = setup()
    await recorder.toggle()
    vi.advanceTimersByTime(START_DELAY_MS)
    expect(recorder.getStatus().phase).toBe('recording')
    await recorder.toggle()
    expect(recorder.getStatus().phase).toBe('idle')
  })

  it('a Dock click stops a Recording and shows the window', async () => {
    const { recorder, deps, startAndWait } = setup()
    await startAndWait()
    await recorder.handleDockActivate()
    expect(recorder.getStatus().phase).toBe('idle')
    expect(deps.showWindow).toHaveBeenCalledTimes(1)
  })

  it('a Dock click while idle does nothing', async () => {
    const { recorder, deps } = setup()
    await recorder.handleDockActivate()
    expect(deps.showWindow).not.toHaveBeenCalled()
  })
})

describe('captures', () => {
  it('captures every counted Click', async () => {
    const { deps, click, startAndWait } = setup()
    await startAndWait()
    click(1000)
    expect(deps.capture).toHaveBeenCalledWith({ x: 1, y: 2, time: 1000 })
  })

  it('stops with an error when a Capture fails', async () => {
    const { recorder, deps, click, startAndWait } = setup({
      capture: vi.fn(async () => {
        throw new Error('The folder no longer exists.')
      })
    })
    await startAndWait()
    click(1000)
    await vi.advanceTimersByTimeAsync(0)
    expect(recorder.getStatus()).toMatchObject({
      phase: 'idle',
      error: 'Capture failed: The folder no longer exists.'
    })
    expect(deps.showWindow).toHaveBeenCalled()
  })
})

describe('Dock click after a Click', () => {
  it('deletes the latest Capture and does not count it', async () => {
    const now = vi.fn(() => 1500)
    const { recorder, deps, click, startAndWait } = setup({ now })
    await startAndWait()
    click(1000)
    click(2000)
    now.mockReturnValue(2100)
    await recorder.handleDockActivate()

    expect(deps.deleteFiles).toHaveBeenCalledTimes(1)
    expect(deps.deleteFiles).toHaveBeenCalledWith(['/out/2000_d1.png'])
    expect(recorder.getStatus()).toMatchObject({ phase: 'idle', count: 1 })
    expect(deps.showWindow).toHaveBeenCalledTimes(1)
  })

  it('waits for a Capture that is still running before deleting it', async () => {
    let finish: (paths: string[]) => void = () => {}
    const now = vi.fn(() => 1100)
    const { recorder, deps, click, startAndWait } = setup({
      now,
      capture: vi.fn(() => new Promise<string[]>((resolve) => (finish = resolve)))
    })
    await startAndWait()
    click(1000)
    const dock = recorder.handleDockActivate()
    await vi.advanceTimersByTimeAsync(0)
    expect(deps.deleteFiles).not.toHaveBeenCalled()
    expect(recorder.getStatus().phase).toBe('recording')

    finish(['/out/a.png', '/out/b.png'])
    await dock
    expect(deps.deleteFiles).toHaveBeenCalledWith(['/out/a.png', '/out/b.png'])
    expect(recorder.getStatus().phase).toBe('idle')
  })

  it('keeps the Capture when the last Click was long before the Dock click', async () => {
    const now = vi.fn(() => 5000)
    const { recorder, deps, click, startAndWait } = setup({ now })
    await startAndWait()
    click(1000)
    await recorder.handleDockActivate()
    expect(deps.deleteFiles).not.toHaveBeenCalled()
    expect(recorder.getStatus().count).toBe(1)
  })

  it('still stops when deleting fails', async () => {
    const now = vi.fn(() => 1100)
    const { recorder, click, startAndWait } = setup({
      now,
      deleteFiles: vi.fn(async () => {
        throw new Error('gone')
      })
    })
    await startAndWait()
    click(1000)
    await recorder.handleDockActivate()
    expect(recorder.getStatus().phase).toBe('idle')
  })

  it('has nothing to delete when no Click was counted', async () => {
    const { recorder, deps, startAndWait } = setup()
    await startAndWait()
    await recorder.handleDockActivate()
    expect(deps.deleteFiles).not.toHaveBeenCalled()
    expect(recorder.getStatus().phase).toBe('idle')
  })
})

describe('other', () => {
  it('remembers whether the shortcut could be registered', () => {
    const { recorder } = setup()
    recorder.setShortcutOk(false)
    expect(recorder.getStatus().shortcutOk).toBe(false)
  })

  it('dispose releases the hook without touching the window', async () => {
    const { recorder, deps, clicks, startAndWait } = setup()
    await startAndWait()
    recorder.dispose()
    expect(clicks.stop).toHaveBeenCalled()
    expect(deps.showWindow).not.toHaveBeenCalled()
  })
})
