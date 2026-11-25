# Source and development guide (`src`)

How to build, install, run and troubleshoot tuto-record, and where the code lives. For what the app does and how to use it, see the [project README](../README.md).

## Where things are

| Folder                           | What it is                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`main`](main/README.md)         | The main process: permissions, click hook, capture, Projects, Groups and Tutorials on disk, preview images, windows, recorder state machine |
| [`renderer`](renderer/README.md) | The user interface of the main window and the Settings window, one folder per part of the UI                                                |
| [`preload`](preload/README.md)   | The bridge that exposes `window.api` to the renderer                                                                                        |
| [`shared`](shared/README.md)     | The IPC contract (channels and types), paths, and the name and image rules, used by all three                                               |

The app icons and signing resources are in [`../build`](../build/README.md) and [`../resources`](../resources/README.md). Unit tests are in `tests/` at the project root; each folder's README says which test covers which module. Each README documents its own folder only; the rule is in [CLAUDE.md](../CLAUDE.md).

## Setup

```bash
npm install
```

On an Apple Silicon Mac whose Node runs as x64 (Rosetta; check with `node -p process.arch`), `npm install` fetches x64 binaries. Add the arm64 ones once:

```bash
npm install --no-save --os=darwin --cpu=arm64 sharp koffi
```

```bash
npm_config_arch=arm64 npx install-electron
```

Using an arm64 Node avoids both steps.

## Scripts

| Command                | What it does                           |
| ---------------------- | -------------------------------------- |
| `npm run dev`          | Start in development mode              |
| `npm run build:unpack` | Build `dist/mac-arm64/tuto-record.app` |
| `npm run build:mac`    | Build the `.app` and a `.dmg`          |
| `npm run typecheck`    | Type-check main, preload and renderer  |
| `npm run lint`         | ESLint and Prettier                    |
| `npm test`             | Unit tests (Vitest)                    |

## Run

Run the packaged app. It appears as **tuto-record** in System Settings → Privacy & Security:

```bash
open dist/mac-arm64/tuto-record.app
```

After changing code, rebuild it first:

```bash
npm run build:unpack
```

Dev mode is quicker for editing, but it is not the real app: it runs the stock **Electron** app (bundle ID `com.github.Electron`), never tuto-record's permissions, and macOS attributes its permissions to whatever launched it. If your terminal or IDE already has Accessibility and Screen Recording, the dev app inherits them, shows no prompts and may not appear in the lists at all. Its window is titled **Tuto-Record (Development)** so you can tell it apart from the installed app. Test permissions with the packaged app.

```bash
npm run dev
```

## Build and install

`npm run build:mac` builds the app and a disk image, both Apple Silicon only:

```bash
npm run build:mac
```

Open `dist/tuto-record-0.3.1.dmg` and drag **tuto-record** into **Applications**. The app is ad-hoc signed (by `build/adhocSign.cjs`), not notarized, so macOS blocks the first launch of a copy that was downloaded or sent to you. On macOS 15 (Sequoia) and later, open it once and then press **Open Anyway** under System Settings → Privacy & Security (right-click → **Open** no longer works there); on macOS 14 and earlier, right-click the app and choose **Open**. A copy you built yourself is not quarantined and opens normally.

**What goes into the app.** `files` in [`electron-builder.yml`](../electron-builder.yml) is an allow-list: `out/**`, `resources/**` and `package.json`, plus the production `node_modules` that electron-builder adds itself. Anything else in the project folder stays out, including local folders such as test recordings with screenshots. If the app needs a new file at runtime, add it to the list; do not replace the list with exclusions. Check the result before publishing:

```bash
npx asar list dist/mac-arm64/tuto-record.app/Contents/Resources/app.asar | grep -v '^/node_modules'
```

Only `out`, `resources` and `package.json` should appear.

The `.app` is about 290 MB and the `.dmg` about 116 MB. Most of it is Electron itself (the Chromium framework alone is about 250 MB), which any Electron app carries. The build keeps only the English language files and excludes the binaries for other platforms and for Intel Macs.

### Publish a release

Releases are how people get the app: a GitHub Release with the `.dmg` attached, tagged `v<version>` on `main`. After the version bump is merged:

```bash
git switch main && git pull && npm run build:mac
```

```bash
gh release create v0.3.1 dist/tuto-record-0.3.1.dmg --target main --title "tuto-record 0.3.1" --notes-file notes.md
```

The notes say what changed, repeat the install steps from the [project README](../README.md#install) (including **Open Anyway** on macOS 15), and give the dmg's SHA-256 (`shasum -a 256 dist/*.dmg`).

## Troubleshooting

**tuto-record is missing from a permission list, or a prompt never appears.** Reset the app's permissions and launch it again:

```bash
tccutil reset Accessibility com.tuto-record.app
```

```bash
tccutil reset ScreenCapture com.tuto-record.app
```

**Permissions look enabled in System Settings but the app says they are missing.** macOS ties permissions to the app's code signature. An ad-hoc signature changes on every build, so the old entry no longer matches. After each rebuild, reset both permissions with the commands above, then launch the app and grant them again.

To avoid that, you can sign with a stable self-signed code-signing certificate instead: create one in your login keychain, set `identity: <its name>` in `electron-builder.yml` and remove the `afterPack` line, and click **Always Allow** when `codesign` asks to use its private key (clicking **Allow** makes it ask again for every file).

**Debug logging.** Launch through `open` so macOS attributes permissions to the app, not your shell:

```bash
open -n --env TUTO_DEBUG=1 --stdout /tmp/tuto.log --stderr /tmp/tuto.log dist/mac-arm64/tuto-record.app
```

## Editor setup

[VS Code](https://code.visualstudio.com/) with the [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions.
