import { describe, expect, it } from 'vitest'
import { buildRecorderView } from '../src/renderer/src/recorder-bar/recorderView'
import type { RecorderStatus } from '../src/shared/ipc'

const idle: RecorderStatus = { phase: 'idle', count: 0, error: null, shortcutOk: true }

describe('buildRecorderView', () => {
  it('offers Start in the middle of an empty Tutorial, enabled only when ready', () => {
    expect(buildRecorderView(idle, true, 'empty').primary).toEqual({
      action: 'start',
      label: 'Start recording',
      enabled: true,
      placement: 'empty-state'
    })
    expect(buildRecorderView(idle, false, 'empty').primary?.enabled).toBe(false)
  })

  it('offers Record again in the header once the Tutorial has images', () => {
    expect(buildRecorderView(idle, true, 'has-images').primary).toEqual({
      action: 'record-again',
      label: 'Record again',
      enabled: true,
      placement: 'header'
    })
  })

  it('offers nothing without a selected Tutorial', () => {
    expect(buildRecorderView(idle, false, 'none').primary).toBeNull()
  })

  it('disables the button while starting, where it was', () => {
    const empty = buildRecorderView({ ...idle, phase: 'starting' }, true, 'empty').primary
    expect(empty).toMatchObject({ enabled: false, placement: 'empty-state' })
    expect(empty?.label).toMatch(/starting/i)
    const full = buildRecorderView({ ...idle, phase: 'starting' }, true, 'has-images').primary
    expect(full).toMatchObject({ action: 'record-again', enabled: false, placement: 'header' })
  })

  it('offers Stop while recording and shows the count', () => {
    const view = buildRecorderView({ ...idle, phase: 'recording', count: 3 }, true, 'empty')
    expect(view.primary).toMatchObject({ action: 'stop', label: 'Stop recording', enabled: true })
    expect(view.summary).toMatch(/3 captures/)
  })

  it('uses the singular for one click', () => {
    const view = buildRecorderView({ ...idle, phase: 'recording', count: 1 }, true, 'empty')
    expect(view.summary).toMatch(/1 capture /)
  })

  it('summarises the last Recording once stopped', () => {
    expect(buildRecorderView({ ...idle, count: 5 }, true, 'has-images').summary).toBe(
      'Last recording: 5 captures.'
    )
    expect(buildRecorderView(idle, true, 'empty').summary).toBeNull()
  })

  it('shows an error instead of a summary', () => {
    const view = buildRecorderView({ ...idle, count: 2, error: 'Disk full' }, true, 'has-images')
    expect(view.error).toBe('Disk full')
    expect(view.summary).toBeNull()
  })

  it('warns when the shortcut is taken, pointing at the Dock icon', () => {
    const warning = buildRecorderView({ ...idle, shortcutOk: false }, true, 'empty').shortcutWarning
    expect(warning).toMatch(/already used/)
    expect(warning).toMatch(/Dock icon/)
    expect(buildRecorderView(idle, true, 'empty').shortcutWarning).toBeNull()
  })
})
