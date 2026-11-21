// Entry point of the Settings window (settings.html): the Projects folder and the permissions.
import { buildPermissionView } from './permissions/permissionView'
import { createPermissionPanel } from './permissions/permissionPanel'
import { createSettingsPage } from './settings-window/settingsPage'
import { $ } from './ui/dom'

const POLL_MS = 1500

const folderSection = createSettingsPage($('#folder-section'))
const permissionPanel = createPermissionPanel($('#permissions'))

/** True once Screen Recording was seen missing in this run; it then needs a relaunch to apply. */
let screenWasMissing = false

async function refresh(): Promise<void> {
  const [permissions, settings] = await Promise.all([
    window.api.getPermissions(),
    window.api.getSettings()
  ])
  if (permissions.required && permissions.screen !== 'granted') screenWasMissing = true
  folderSection.render(settings)
  permissionPanel.render(buildPermissionView(permissions, screenWasMissing))
}

void refresh()
setInterval(() => void refresh(), POLL_MS)
