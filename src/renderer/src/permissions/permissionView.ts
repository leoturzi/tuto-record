import type { PermissionsStatus, ScreenStatus } from '../../../shared/ipc'

export interface PermissionView {
  showPanel: boolean
  accessibility: { granted: boolean; label: string }
  screen: { granted: boolean; label: string }
  showReady: boolean
  /** Message above the Relaunch button, or null when no relaunch is needed. */
  relaunchHint: string | null
}

const SCREEN_LABELS: Record<ScreenStatus, string> = {
  granted: 'Granted',
  denied: 'Not granted',
  'not-determined': 'Not asked yet',
  restricted: 'Blocked by your administrator',
  unknown: 'Unknown'
}

/**
 * Turns a status into what the panel shows.
 * `screenWasMissing` is true when Screen Recording was not granted earlier in this run: macOS
 * usually only applies a newly granted Screen Recording permission after a relaunch.
 */
export function buildPermissionView(
  status: PermissionsStatus,
  screenWasMissing: boolean
): PermissionView {
  const screenGranted = status.screen === 'granted'
  let relaunchHint: string | null = null
  if (status.required) {
    if (screenGranted && screenWasMissing) {
      relaunchHint = 'Screen Recording was just enabled. Relaunch so it takes effect.'
    } else if (!screenGranted) {
      relaunchHint = 'After enabling Screen Recording in System Settings, relaunch the app.'
    }
  }
  return {
    showPanel: status.required && !status.allGranted,
    accessibility: {
      granted: status.accessibility,
      label: status.accessibility ? 'Granted' : 'Not granted'
    },
    screen: { granted: screenGranted, label: SCREEN_LABELS[status.screen] },
    showReady: status.allGranted && !(screenWasMissing && screenGranted),
    relaunchHint
  }
}
