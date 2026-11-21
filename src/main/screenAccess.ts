import koffi from 'koffi'

const CORE_GRAPHICS = '/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics'

/**
 * Calls CoreGraphics' `CGRequestScreenCaptureAccess`, the system call made for this purpose.
 * Electron does not expose it, and `desktopCapturer.getSources` fails without prompting on recent
 * macOS versions. The call shows the Screen Recording prompt (once) and adds the app to the
 * Screen Recording list. Returns true only if access was already granted.
 */
export function requestScreenCaptureAccess(): boolean {
  const lib = koffi.load(CORE_GRAPHICS)
  const request = lib.func('bool CGRequestScreenCaptureAccess()')
  return request() as boolean
}
