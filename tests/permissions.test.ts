import { describe, expect, it, vi } from 'vitest'
import {
  createPermissionService,
  isPermissionKind,
  SETTINGS_URLS,
  type PermissionDeps
} from '../src/main/permissions'

function makeDeps(overrides: Partial<PermissionDeps> = {}): PermissionDeps {
  return {
    platform: 'darwin',
    isAccessibilityTrusted: vi.fn(() => false),
    getScreenStatus: vi.fn(() => 'not-determined' as const),
    requestScreenCapture: vi.fn(async () => {}),
    openExternal: vi.fn(async () => {}),
    ...overrides
  }
}

describe('getStatus', () => {
  it('reports missing permissions on macOS', () => {
    const status = createPermissionService(makeDeps()).getStatus()
    expect(status).toEqual({
      required: true,
      accessibility: false,
      screen: 'not-determined',
      allGranted: false
    })
  })

  it('is only allGranted when both permissions are granted', () => {
    const accessibilityOnly = createPermissionService(
      makeDeps({ isAccessibilityTrusted: () => true })
    ).getStatus()
    expect(accessibilityOnly.allGranted).toBe(false)

    const screenOnly = createPermissionService(
      makeDeps({ getScreenStatus: () => 'granted' })
    ).getStatus()
    expect(screenOnly.allGranted).toBe(false)

    const both = createPermissionService(
      makeDeps({ isAccessibilityTrusted: () => true, getScreenStatus: () => 'granted' })
    ).getStatus()
    expect(both.allGranted).toBe(true)
  })

  it('never prompts while only reading the status', () => {
    const deps = makeDeps()
    createPermissionService(deps).getStatus()
    expect(deps.isAccessibilityTrusted).toHaveBeenCalledWith(false)
    expect(deps.isAccessibilityTrusted).not.toHaveBeenCalledWith(true)
    expect(deps.requestScreenCapture).not.toHaveBeenCalled()
  })

  it('reports everything granted where nothing needs granting', () => {
    const deps = makeDeps({ platform: 'win32' })
    expect(createPermissionService(deps).getStatus()).toEqual({
      required: false,
      accessibility: true,
      screen: 'granted',
      allGranted: true
    })
    expect(deps.isAccessibilityTrusted).not.toHaveBeenCalled()
  })
})

describe('requestNext', () => {
  it('asks for Accessibility first and does not touch Screen Recording yet', async () => {
    const deps = makeDeps()
    const done = await createPermissionService(deps).requestNext()
    expect(done).toBe(false)
    expect(deps.isAccessibilityTrusted).toHaveBeenCalledWith(true)
    expect(deps.requestScreenCapture).not.toHaveBeenCalled()
  })

  it('shows the Accessibility prompt only once per run', async () => {
    const deps = makeDeps()
    const service = createPermissionService(deps)
    await service.requestNext()
    await service.requestNext()
    await service.requestNext()
    const prompts = vi.mocked(deps.isAccessibilityTrusted).mock.calls.filter(([p]) => p)
    expect(prompts).toHaveLength(1)
  })

  it('asks for Screen Recording once Accessibility is granted', async () => {
    let trusted = false
    const deps = makeDeps({ isAccessibilityTrusted: vi.fn(() => trusted) })
    const service = createPermissionService(deps)
    expect(await service.requestNext()).toBe(false)
    trusted = true
    expect(await service.requestNext()).toBe(true)
    expect(deps.requestScreenCapture).toHaveBeenCalledTimes(1)
  })

  it('asks for Screen Recording only once per run', async () => {
    const deps = makeDeps({ isAccessibilityTrusted: vi.fn(() => true) })
    const service = createPermissionService(deps)
    await service.requestNext()
    await service.requestNext()
    expect(deps.requestScreenCapture).toHaveBeenCalledTimes(1)
  })

  it('has nothing to do when both permissions are granted', async () => {
    const deps = makeDeps({
      isAccessibilityTrusted: vi.fn(() => true),
      getScreenStatus: () => 'granted'
    })
    expect(await createPermissionService(deps).requestNext()).toBe(true)
    expect(deps.isAccessibilityTrusted).not.toHaveBeenCalledWith(true)
    expect(deps.requestScreenCapture).not.toHaveBeenCalled()
  })

  it('does nothing where nothing needs granting', async () => {
    const deps = makeDeps({ platform: 'linux' })
    expect(await createPermissionService(deps).requestNext()).toBe(true)
    expect(deps.isAccessibilityTrusted).not.toHaveBeenCalled()
    expect(deps.requestScreenCapture).not.toHaveBeenCalled()
  })

  it('survives a failing Screen Recording request', async () => {
    const deps = makeDeps({
      isAccessibilityTrusted: vi.fn(() => true),
      requestScreenCapture: vi.fn(async () => {
        throw new Error('boom')
      })
    })
    await expect(createPermissionService(deps).requestNext()).resolves.toBe(true)
  })
})

describe('openSettings', () => {
  it('opens the matching Privacy & Security pane', async () => {
    const deps = makeDeps()
    const service = createPermissionService(deps)
    await service.openSettings('accessibility')
    await service.openSettings('screen')
    expect(deps.openExternal).toHaveBeenNthCalledWith(1, SETTINGS_URLS.accessibility)
    expect(deps.openExternal).toHaveBeenNthCalledWith(2, SETTINGS_URLS.screen)
  })

  it('requests the permission first so the app is listed, but only once', async () => {
    const deps = makeDeps()
    const service = createPermissionService(deps)
    await service.openSettings('screen')
    await service.openSettings('screen')
    expect(deps.requestScreenCapture).toHaveBeenCalledTimes(1)
    expect(deps.openExternal).toHaveBeenCalledTimes(2)
  })

  it('does not request a permission that was already requested by requestNext', async () => {
    const deps = makeDeps()
    const service = createPermissionService(deps)
    await service.requestNext()
    await service.openSettings('accessibility')
    const prompts = vi.mocked(deps.isAccessibilityTrusted).mock.calls.filter(([p]) => p)
    expect(prompts).toHaveLength(1)
  })
})

describe('isPermissionKind', () => {
  it('accepts only known kinds', () => {
    expect(isPermissionKind('accessibility')).toBe(true)
    expect(isPermissionKind('screen')).toBe(true)
    expect(isPermissionKind('camera')).toBe(false)
    expect(isPermissionKind(undefined)).toBe(false)
  })
})
