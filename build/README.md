# Build resources (`build`)

Everything electron-vite and electron-builder need to package the app: the app icon, the macOS entitlements and the signing hook. [`electron-builder.yml`](../electron-builder.yml) points at this folder (`buildResources: build`).

| File                                               | Role                                                                                                                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`logo-source.jpg`](logo-source.jpg)               | The original logo (2000 × 2000). Kept for reference; the icons below were made from it.                                                                                                                   |
| `icon.icns`                                        | The macOS app icon.                                                                                                                                                                                       |
| `icon.ico`                                         | The Windows app icon (16 to 256 px). Not used until there is a Windows build.                                                                                                                             |
| `icon.png`                                         | A 1024 px rounded square used for Linux and as electron-builder's fallback, and shown at the top of the project README.                                                                                   |
| [`entitlements.mac.plist`](entitlements.mac.plist) | The macOS entitlements the app is signed with, including the ones that let ad-hoc signed native modules load (`disable-library-validation`) and Electron's JIT.                                           |
| [`adhocSign.cjs`](adhocSign.cjs)                   | The `afterPack` hook that signs the packed app ad-hoc with `codesign`, without touching the keychain. It exists because `identity: '-'` would pick up any keychain certificate with a hyphen in its name. |

## About the icons

The icon files are finished assets, edited by hand when the logo changes. How they were made, if you need to redo them:

- **Centred artwork:** the camera in the original logo sits about 46 px above the middle of the image, so the artwork was moved down by that amount (on the flat green background) before resizing.
- **macOS (`icon.icns`)**: macOS does not round or pad custom icons, so it is done in the image: the artwork is clipped to a squircle (a superellipse with exponent 5) 824 px wide inside a 1024 px canvas, which is Apple's icon grid, with a soft shadow (32 % black, blurred, shifted 12 px down). The ten sizes of an `.iconset` (16 to 512 px, each with an `@2x` variant) are packed with `iconutil -c icns`.
- **Windows (`icon.ico`)**: a full-bleed rounded square with no margin (corner radius 18 % of the width), in the sizes 16, 24, 32, 48, 64, 128 and 256 px, stored as PNG data inside the `.ico`.
- **Watermark logo:** it is also made from `icon.png`, so redo it when the logo changes ([`resources`](../resources/README.md#remaking-watermark-logopng)).
- **Small sizes**: at 16 px the shutter lines of the lens blur together but the camera shape stays recognisable.
- The script that originally produced these files was removed once they were final; it is in the git history (`build/makeIcons.mjs` in the commit "Add app logo and generate icons from it").
- macOS caches icons. After installing a new build, the Dock or Finder may keep showing the old one until you relaunch the Dock (`killall Dock`) or Finder.
