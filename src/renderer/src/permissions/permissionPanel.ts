import type { PermissionKind } from '../../../shared/ipc'
import { $, setText } from '../ui/dom'
import type { PermissionView } from './permissionView'

export interface PermissionPanel {
  render(view: PermissionView): void
}

/**
 * The permission panel in the Settings window: one row per permission with its state and an
 * Open Settings button, and the Relaunch box. Expects the markup in `settings.html`.
 */
export function createPermissionPanel(root: HTMLElement): PermissionPanel {
  const relaunchBox = $('#relaunch-box', root)
  const relaunchHint = $('#relaunch-hint', root)
  const allGranted = $('#permissions-ready', root)

  for (const kind of ['accessibility', 'screen'] as const) {
    $(`.perm[data-kind="${kind}"] [data-role="open"]`, root).addEventListener('click', () => {
      void window.api.openPermissionSettings(kind)
    })
  }
  $('#relaunch', root).addEventListener('click', () => {
    void window.api.relaunch()
  })

  function renderPerm(kind: PermissionKind, state: { granted: boolean; label: string }): void {
    const row = $(`.perm[data-kind="${kind}"]`, root)
    const badge = $('[data-role="badge"]', row)
    badge.textContent = state.granted ? `✓ ${state.label}` : state.label
    badge.className = `badge ${state.granted ? 'ok' : 'missing'}`
    $('[data-role="open"]', row).hidden = state.granted
  }

  return {
    render(view) {
      renderPerm('accessibility', view.accessibility)
      renderPerm('screen', view.screen)
      relaunchBox.hidden = view.relaunchHint === null
      relaunchHint.textContent = view.relaunchHint ?? ''
      setText(allGranted, view.showReady ? 'Both permissions are granted.' : null)
    }
  }
}
