import { describe, expect, it } from 'vitest'
import { buildPermissionView } from '../src/renderer/src/permissionView'
import type { PermissionsStatus } from '../src/shared/ipc'

const base: PermissionsStatus = {
  required: true,
  accessibility: false,
  screen: 'not-determined',
  allGranted: false
}

describe('buildPermissionView', () => {
  it('shows the panel with labels while permissions are missing', () => {
    const view = buildPermissionView(base, true)
    expect(view.showPanel).toBe(true)
    expect(view.showReady).toBe(false)
    expect(view.accessibility).toEqual({ granted: false, label: 'Not granted' })
    expect(view.screen).toEqual({ granted: false, label: 'Not asked yet' })
    expect(view.relaunchHint).toMatch(/relaunch/i)
  })

  it('shows the ready message when everything was granted from the start', () => {
    const view = buildPermissionView(
      { ...base, accessibility: true, screen: 'granted', allGranted: true },
      false
    )
    expect(view.showPanel).toBe(false)
    expect(view.showReady).toBe(true)
    expect(view.relaunchHint).toBeNull()
  })

  it('asks for a relaunch when Screen Recording was granted during this run', () => {
    const view = buildPermissionView(
      { ...base, accessibility: true, screen: 'granted', allGranted: true },
      true
    )
    expect(view.showReady).toBe(false)
    expect(view.relaunchHint).toMatch(/just enabled/i)
  })

  it('shows no panel and no relaunch where nothing needs granting', () => {
    const view = buildPermissionView(
      { required: false, accessibility: true, screen: 'granted', allGranted: true },
      false
    )
    expect(view.showPanel).toBe(false)
    expect(view.relaunchHint).toBeNull()
    expect(view.showReady).toBe(true)
  })

  it('labels a restricted Screen Recording permission', () => {
    const view = buildPermissionView({ ...base, screen: 'restricted' }, true)
    expect(view.screen.label).toMatch(/administrator/i)
  })
})
