// electron-builder hook: ad-hoc signs the packed macOS app. It runs before the dmg is built.
// electron-builder's own `identity: '-'` also matches real certificates whose name contains a
// hyphen, and would then ask for keychain access. This never touches the keychain.
const { execFileSync } = require('child_process')
const { join } = require('path')

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync(
    'codesign',
    [
      '--force',
      '--deep',
      '--sign',
      '-',
      '--options',
      'runtime',
      '--entitlements',
      join(context.packager.projectDir, 'build', 'entitlements.mac.plist'),
      app
    ],
    { stdio: 'inherit' }
  )
}
