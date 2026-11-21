import { describe, expect, it } from 'vitest'
import { buildRecorderView } from '../src/renderer/src/recorderView'
import type { RecorderStatus } from '../src/shared/ipc'

const idle: RecorderStatus = { phase: 'idle', count: 0, error: null, shortcutOk: true }

describe('buildRecorderView', () => {
  it('enables Start only when ready', () => {
    expect(buildRecorderView(idle, true)).toMatchObject({
      buttonLabel: 'Start recording',
      buttonEnabled: true,
      action: 'start'
    })
    expect(buildRecorderView(idle, false).buttonEnabled).toBe(false)
  })

  it('disables the button while starting', () => {
    const view = buildRecorderView({ ...idle, phase: 'starting' }, true)
    expect(view.buttonEnabled).toBe(false)
    expect(view.buttonLabel).toMatch(/starting/i)
  })

  it('offers Stop while recording and shows the count', () => {
    const view = buildRecorderView({ ...idle, phase: 'recording', count: 3 }, true)
    expect(view).toMatchObject({ buttonLabel: 'Stop recording', action: 'stop' })
    expect(view.summary).toMatch(/3 captures/)
  })

  it('uses the singular for one click', () => {
    const view = buildRecorderView({ ...idle, phase: 'recording', count: 1 }, true)
    expect(view.summary).toMatch(/1 capture /)
  })

  it('summarises the last Recording once stopped', () => {
    expect(buildRecorderView({ ...idle, count: 5 }, true).summary).toBe(
      'Last recording: 5 captures.'
    )
    expect(buildRecorderView(idle, true).summary).toBeNull()
  })

  it('shows an error instead of a summary', () => {
    const view = buildRecorderView({ ...idle, count: 2, error: 'Disk full' }, true)
    expect(view.error).toBe('Disk full')
    expect(view.summary).toBeNull()
  })

  it('warns when the shortcut is taken', () => {
    expect(buildRecorderView({ ...idle, shortcutOk: false }, true).shortcutWarning).toMatch(
      /already used/
    )
    expect(buildRecorderView(idle, true).shortcutWarning).toBeNull()
  })
})
