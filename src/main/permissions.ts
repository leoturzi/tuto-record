import type { PermissionKind, PermissionsStatus, ScreenStatus } from '../shared/ipc'

export const SETTINGS_URLS: Record<PermissionKind, string> = {
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
}

/** Everything that touches Electron or the OS, injected so the logic can be unit-tested. */
export interface PermissionDeps {
  platform: NodeJS.Platform
  /** `prompt: true` shows the system dialog and adds the app to the Accessibility list. */
  isAccessibilityTrusted(prompt: boolean): boolean
  getScreenStatus(): ScreenStatus
  /** Shows the Screen Recording prompt (once) and adds the app to the Screen Recording list. */
  requestScreenCapture(): Promise<void>
  openExternal(url: string): Promise<void>
}

export interface PermissionService {
  getStatus(): PermissionsStatus
  /**
   * Requests the next missing permission, at most one new system prompt per call and each
   * permission at most once per run. Accessibility goes first; Screen Recording only once
   * Accessibility is granted, because macOS drops a prompt that arrives while another is showing.
   * Call it repeatedly (for example on a timer) until it returns true.
   * Returns true when nothing is left to request.
   */
  requestNext(): Promise<boolean>
  /** Requests the permission if that has not happened yet, then opens its Settings pane. */
  openSettings(kind: PermissionKind): Promise<void>
}

export function isPermissionKind(value: unknown): value is PermissionKind {
  return value === 'accessibility' || value === 'screen'
}

export function createPermissionService(deps: PermissionDeps): PermissionService {
  const required = deps.platform === 'darwin'
  const requested: Record<PermissionKind, boolean> = { accessibility: false, screen: false }

  async function requestOnce(kind: PermissionKind): Promise<void> {
    if (requested[kind]) return
    requested[kind] = true
    if (kind === 'accessibility') {
      deps.isAccessibilityTrusted(true)
    } else {
      try {
        await deps.requestScreenCapture()
      } catch {
        // Only here to trigger the prompt; a failure is not actionable.
      }
    }
  }

  return {
    getStatus() {
      if (!required) {
        return { required, accessibility: true, screen: 'granted', allGranted: true }
      }
      const accessibility = deps.isAccessibilityTrusted(false)
      const screen = deps.getScreenStatus()
      return { required, accessibility, screen, allGranted: accessibility && screen === 'granted' }
    },

    async requestNext() {
      if (!required) return true
      if (!deps.isAccessibilityTrusted(false)) {
        await requestOnce('accessibility')
        return false
      }
      if (deps.getScreenStatus() !== 'granted') {
        await requestOnce('screen')
        return requested.screen
      }
      return true
    },

    async openSettings(kind) {
      if (!required) return
      await requestOnce(kind)
      await deps.openExternal(SETTINGS_URLS[kind])
    }
  }
}
