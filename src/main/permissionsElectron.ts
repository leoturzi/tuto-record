import { desktopCapturer, screen, shell, systemPreferences } from 'electron'
import { createPermissionService, type PermissionService } from './permissions'
import { requestScreenCaptureAccess } from './screenAccess'

const debug = (msg: string): void => {
  if (process.env['TUTO_DEBUG'] === '1') console.log(msg)
}

async function probeWithDesktopCapturer(): Promise<void> {
  // Ask for a real-size thumbnail: a token-size one may never read the screen's pixels.
  const { size, scaleFactor } = screen.getPrimaryDisplay()
  await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(size.width * scaleFactor),
      height: Math.round(size.height * scaleFactor)
    }
  })
}

export function createElectronPermissionService(): PermissionService {
  return createPermissionService({
    platform: process.platform,
    isAccessibilityTrusted: (prompt) =>
      process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(prompt) : true,
    getScreenStatus: () =>
      process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted',
    requestScreenCapture: async () => {
      try {
        debug(`PROBE CGRequestScreenCaptureAccess -> ${requestScreenCaptureAccess()}`)
      } catch (err) {
        debug(`PROBE CGRequestScreenCaptureAccess failed: ${String(err)}`)
        // Last resort: on older macOS versions this call shows the prompt itself.
        await probeWithDesktopCapturer()
      }
    },
    openExternal: (url) => shell.openExternal(url)
  })
}
