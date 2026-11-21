# Build resources (`build`)

Everything electron-builder needs to package the app, plus the app icon and the script that generates it. [`electron-builder.yml`](../electron-builder.yml) points at this folder (`buildResources: build`).

| File                                               | Role                                                                                                                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`logo-source.jpg`](logo-source.jpg)               | The master logo (2000 × 2000). Every icon is generated from it.                                                                                                                                           |
| [`makeIcons.mjs`](makeIcons.mjs)                   | Generates all the icons below and the two in [`resources`](../resources/README.md). Run it with `npm run icons` (macOS only, it uses `iconutil`).                                                         |
| `icon.icns`                                        | The macOS app icon. Generated.                                                                                                                                                                            |
| `icon.ico`                                         | The Windows app icon (16 to 256 px). Generated; not used until there is a Windows build.                                                                                                                  |
| `icon.png`                                         | A 1024 px rounded square used for Linux and as electron-builder's fallback, and shown at the top of the project README. Generated.                                                                        |
| [`entitlements.mac.plist`](entitlements.mac.plist) | The macOS entitlements the app is signed with, including the ones that let ad-hoc signed native modules load (`disable-library-validation`) and Electron's JIT.                                           |
| [`adhocSign.cjs`](adhocSign.cjs)                   | The `afterPack` hook that signs the packed app ad-hoc with `codesign`, without touching the keychain. It exists because `identity: '-'` would pick up any keychain certificate with a hyphen in its name. |

## Changing the logo

1. Replace `logo-source.jpg` with the new master (square, ideally 1024 px or more).
2. If its background colour or the artwork's centre changed, update `BACKGROUND` and `SHIFT` at the top of `makeIcons.mjs`. `SHIFT` moves the artwork so the camera sits in the middle; it was measured from the original logo.
3. Run `npm run icons` and commit the regenerated files.

## How the icons are made

- **macOS (`icon.icns`)**: macOS does not round or pad custom icons, so the script does it: the artwork is clipped to a squircle (a superellipse) 824 px wide inside a 1024 px canvas, which is Apple's icon grid, with a soft shadow. The ten sizes of an `.iconset` (16 to 1024 px, with `@2x` variants) are rendered from that master and packed with `iconutil`.
- **Windows (`icon.ico`)**: a full-bleed rounded square with no margin, in the sizes 16, 24, 32, 48, 64, 128 and 256 px, stored as PNG data inside the `.ico`.
- **Small sizes**: at 16 px the shutter lines of the lens blur together but the camera shape stays recognisable.
- macOS caches icons. After installing a new build, the Dock or Finder may keep showing the old one until you relaunch the Dock (`killall Dock`) or Finder.
