# tuto-record

A macOS desktop app (Electron + TypeScript) that saves a screenshot of every display each time you click, so the clicks can later be turned into a step-by-step tutorial.

See [MVP_PLAN.md](MVP_PLAN.md) for the plan, [GLOSSARY.md](GLOSSARY.md) for the vocabulary and [docs/adr](docs/adr) for decisions.

## Status

| Milestone | State |
|---|---|
| M0 Scaffold | Done |
| M1 Permissions (Accessibility, Screen Recording) | Done |
| M2 Output folder and settings | Done |
| M3 Recording controls | Done |
| M4 Capture and save | Done |
| M5 Marker | Done |
| M6 Package and verify | Done |

Right now the app checks and requests the two macOS permissions it needs, lets you choose the folder for screenshots, and and records: every left click saves one PNG per display into the folder (Start button or **⌃⌥⌘R**; stop with **⌃⌥⌘R** or a Dock icon click). The screenshot of the display you clicked gets a red ring and a cursor arrow at the click position.

## Run the app

Run the packaged app. It appears as **tuto-record** in System Settings → Privacy & Security:

```bash
open dist/mac-arm64/tuto-record.app
```

After changing code, rebuild it first:

```bash
npm run build:unpack
```

Dev mode is quicker for editing, but macOS lists it as **Electron**, not tuto-record:

```bash
npm run dev
```

## Install

`npm run build:mac` builds the app and a disk image, both Apple Silicon only:

```bash
npm run build:mac
```

Open `dist/tuto-record-0.1.0.dmg` and drag **tuto-record** into **Applications**. The app is ad-hoc signed, not notarized, so macOS may block the first launch of a copy that was downloaded or sent to you. Right-click the app and choose **Open**, or allow it under System Settings → Privacy & Security.

### App size

The `.app` is about 290 MB and the `.dmg` about 116 MB. Most of it is Electron itself (the Chromium framework alone is about 250 MB), which any Electron app carries. The build keeps only the English language files and excludes the binaries for other platforms and for Intel Macs.

## First launch

1. The app asks for **Accessibility**. Turn tuto-record on in System Settings.
2. Within a couple of seconds it asks for **Screen Recording**. Turn it on too.
3. Press **Relaunch app** in the window, because macOS usually applies Screen Recording only after a restart.

The window then shows "All permissions granted". macOS 15 and later shows a recurring reminder about screen recording; that is expected.

## Setup

```bash
npm install
```

On an Apple Silicon Mac whose Node runs as x64 (Rosetta, check with `node -p process.arch`), `npm install` fetches x64 binaries. Add the arm64 ones once:

```bash
npm install --no-save --os=darwin --cpu=arm64 sharp koffi
```

```bash
npm_config_arch=arm64 npx install-electron
```

Using an arm64 Node avoids both steps.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start in development mode |
| `npm run build:unpack` | Build `dist/mac-arm64/tuto-record.app` |
| `npm run build:mac` | Build the `.app` and a `.dmg` |
| `npm run typecheck` | Type-check main, preload and renderer |
| `npm run lint` | ESLint and Prettier |
| `npm test` | Unit tests (Vitest) |

## Troubleshooting

**tuto-record is missing from a permission list, or a prompt never appears.** Reset the app's permissions and launch it again:

```bash
tccutil reset Accessibility com.tuto-record.app
```

```bash
tccutil reset ScreenCapture com.tuto-record.app
```

**Permissions look enabled in System Settings but the app says they are missing.** macOS ties permissions to the app's code signature. Builds are ad-hoc signed (by `build/adhocSign.cjs`), and an ad-hoc signature changes on every build, so the old entry no longer matches. After each rebuild, reset both permissions with the `tccutil` commands above, then launch and grant them again.

To avoid that, you can sign with a stable self-signed code-signing certificate instead: create one in your login keychain, set `identity: <its name>` in `electron-builder.yml` and remove the `afterPack` line, and click **Always Allow** when `codesign` asks to use its private key (clicking **Allow** makes it ask again for every file).

**Debug logging.** Launch through `open` so macOS attributes permissions to the app, not your shell:

```bash
open -n --env TUTO_DEBUG=1 --stdout /tmp/tuto.log --stderr /tmp/tuto.log dist/mac-arm64/tuto-record.app
```

## Editor setup

[VS Code](https://code.visualstudio.com/) with the [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions.
