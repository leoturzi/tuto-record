# Main process (`src/main`)

Everything privileged lives here: permissions, the global click hook, screen capture, files and the Dock. The renderer ([`src/renderer`](../renderer/README.md)) only shows state and sends commands; it reaches this code through the typed [IPC contract](../shared/README.md) and the [preload script](../preload/README.md). Terms such as **Recording**, **Click**, **Capture**, **Screenshot**, **Marker** and **Output folder** are defined in [GLOSSARY.md](../../GLOSSARY.md); this document uses them in that sense.

## How it fits together

```
                       ┌──────────────────────── index.ts ────────────────────────┐
                       │ creates the services below, wires them, owns the window  │
                       └──────────────────────────────────────────────────────────┘
   permissions.ts ──────────┐                                  ┌── clickListener.ts (uiohook)
   (+ permissionsElectron,  │          ┌─────────────┐         │   emits Clicks (click.ts)
      screenAccess)         ├─ ipc.ts ─┤ recorder.ts ├─────────┤
   settings.ts ─────────────┘          │ state       │         └── capture function ── capture.ts
   (+ outputFolder.ts)                 │ machine     │             (+ captureElectron, naming,
                                       └──────┬──────┘              markerGeometry, marker)
   shortcut.ts ── toggle ─────────────────────┘
```

**The convention that keeps this testable:** logic lives in a plain module that takes its dependencies as an argument (`createRecorder(deps)`, `createCapturer(deps)`, `createPermissionService(deps)`). A second, thin `*Electron.ts` / `index.ts` file supplies the real Electron or OS functions. Unit tests (`tests/`) use fakes and never import `electron`. Files that touch Electron directly are checked by hand.

## Life of a click

1. [`clickListener.ts`](clickListener.ts) gets a global `mousedown` from `uiohook-napi`; [`click.ts`](click.ts) keeps it only if it is the left button (`button === 1`) and turns it into a `ClickEvent` `{x, y, time}`.
2. [`recorder.ts`](recorder.ts) drops it if it is within 300 ms of the last counted Click, otherwise counts it, updates the Dock badge and calls the capture function.
3. [`capture.ts`](capture.ts) asks the Output folder service for the folder, grabs every display with one `desktopCapturer` call, resizes each image to the display's real pixel size, draws the Marker on the clicked display's image and writes one PNG per display.
4. The recorder pushes the new state to the window (`recorder:state`). If the capture throws, the recorder stops with the error and `index.ts` shows a notification.

## Modules

### `index.ts` — wiring and lifecycle

Creates the services, registers IPC and the shortcut, owns the single `BrowserWindow` (`createWindow`, `showMainWindow`, `sendToWindow`) and handles app events:

- **`activate`** (Dock icon click): when idle, shows the window; when recording, calls `recorder.handleDockActivate()`.
- **`before-quit`**: stops the onboarding timer and releases the click hook. **`will-quit`**: unregisters the shortcut.
- Starts the permission onboarding timer (see `permissions.ts`).
- Sends a macOS notification when a Recording ends with an error.
- The window runs with `contextIsolation`, no Node integration and `sandbox: true`.
- **Window title:** `Tuto-Record`, or `Tuto-Record (Development)` in dev mode (`npm run dev`) so a dev window is not mistaken for the installed app. In dev, `index.ts` blocks the page from overwriting the title.
- **Icons:** on Windows and Linux the window gets `resources/icon.png`; macOS takes the icon from the app bundle, except in dev mode, where `index.ts` sets the Dock icon to `resources/icon-mac.png`. Both come from the [build resources](../../build/README.md).

### `ipc.ts` — the renderer's door

`registerIpc(permissions, settings, recorder)` registers every `ipcMain.handle` and validates anything coming from the renderer (for example the permission kind). It forwards to the services; it holds no logic of its own. The channels and payloads are listed in the [shared contract](../shared/README.md); the push (`recorder:state`) is sent from `index.ts`.

### Permissions

| File                                               | Role                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`permissions.ts`](permissions.ts)                 | Pure service: `getStatus()`, `requestNext()`, `openSettings(kind)`. Dependencies are injected. |
| [`permissionsElectron.ts`](permissionsElectron.ts) | Supplies the real `systemPreferences`, `shell` and screen-access calls.                        |
| [`screenAccess.ts`](screenAccess.ts)               | Calls CoreGraphics `CGRequestScreenCaptureAccess()` through `koffi`.                           |

Two permissions are needed on macOS: **Accessibility** (to hear Clicks) and **Screen Recording** (to read pixels). On other platforms everything is reported as granted.

Things that are easy to get wrong:

- **One prompt at a time.** macOS silently drops a permission prompt that arrives while another is showing. `requestNext()` asks for Accessibility first and for Screen Recording only after Accessibility is granted, each at most once per run. `index.ts` calls it every 1.5 s until it returns `true`. `openSettings(kind)` also requests that permission first, so the app is listed before the Settings pane opens.
- **`desktopCapturer.getSources` does not prompt.** On macOS 14 with Electron 44 it fails with "Failed to get sources" when Screen Recording is missing, and never adds the app to the list. That is why `CGRequestScreenCaptureAccess` is called directly.
- **`getMediaAccessStatus('screen')`** reports `denied` both before and after the user declines, so "not asked yet" cannot be told apart.
- Screen Recording usually takes effect only after a relaunch; the UI offers one.
- Permissions are tied to the code signature. Ad-hoc signatures change on every build, so after a rebuild reset them (`tccutil reset …`, see [Troubleshooting](../README.md#troubleshooting)).

### Settings and Output folder

| File                                 | Role                                                                                                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`settings.ts`](settings.ts)         | `createSettingsService(filePath)`: reads and writes `settings.json` in `userData` (`{ "outputFolder": string \| null }`). A missing, corrupt or wrongly shaped file means defaults. Writes go to a temporary file first, then `rename`. |
| [`outputFolder.ts`](outputFolder.ts) | `checkOutputFolder(path)`: `null` if the folder exists and is writable, otherwise a short message.                                                                                                                                      |

`settings.get()` returns `{ outputFolder, outputFolderProblem }`, re-checking the folder every time, so a deleted folder is noticed by the UI poll, by `checkReady` and by every Capture.

### `recorder.ts` — the state machine

```
idle ──start()──► starting ──(300 ms)──► recording
  ▲                  │                       │
  └── stop(error?) ──┴───────────────────────┘
```

- **`start()`** sets `starting`, awaits `checkReady()` (permissions and folder, re-checked here and not trusted from the renderer), hides the window, then after `START_DELAY_MS` (300 ms, so the hide animation is never captured) starts the click hook.
- **Debounce:** Clicks less than `DEBOUNCE_MS` (300 ms) after the last _counted_ Click are ignored, so a double-click is one Capture.
- **`stop(error?)`** clears the timer, stops the hook, clears the badge, shows the window and records the error. It does nothing when idle.
- **Capture failure** calls `stop("Capture failed: …")`.
- **Dock click (`handleDockActivate`)**: the Dock click was itself a Click and produced a Capture. If the latest counted Click is less than `DOCK_CLICK_WINDOW_MS` (1 s) old, its files are deleted (after waiting for them if still being written) and it is not counted; then the Recording stops. A position check against the display's `workArea` was rejected because an auto-hidden Dock lies inside it.
- `count` is the number of Captures (counted Clicks), kept after stopping so the window can show "Last recording: N captures".

### Click source

| File                                   | Role                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| [`click.ts`](click.ts)                 | `ClickEvent`, `ClickSource` interface and `toClick()`, the left-button filter.    |
| [`clickListener.ts`](clickListener.ts) | The real `ClickSource` on `uIOhook`. Only start it once Accessibility is granted. |

### Capture

| File                                       | Role                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [`capture.ts`](capture.ts)                 | `createCapturer(deps)` returns `(click) => Promise<string[]>` (the saved paths).                                     |
| [`captureElectron.ts`](captureElectron.ts) | Real `desktopCapturer`, `screen`, `NativeImage` (adapted to `ImageLike`) and file writes. Also exports `removeFile`. |
| [`naming.ts`](naming.ts)                   | File names, display numbering, pixel sizes.                                                                          |
| [`markerGeometry.ts`](markerGeometry.ts)   | Which display was clicked and where the Marker goes.                                                                 |
| [`marker.ts`](marker.ts)                   | Draws the Marker with `sharp`.                                                                                       |

How a Capture is made:

- **One `getSources` call for all displays.** Its thumbnail size is the largest display's pixel size (points × scale factor). Smaller displays come back scaled to fit that box, so each image is resized to its own real pixel size when it differs.
- **Matching:** a source belongs to a display when `source.display_id === String(display.id)`.
- **File names:** `YYYY-MM-DD_HH-mm-ss-SSS_d<N>.png`, local time of the Click. `d1` is the primary display; the others follow left to right, then top to bottom.
- **All or nothing:** if any display fails (empty image, missing source, write error, Marker error), the files already written for that Capture are removed and the error is thrown.
- **Marker:** only the clicked display's image gets one, a translucent red circle plus an arrow cursor with a white outline. The cursor's tip is the Click position; the circle (24 pt radius multiplied by the scale factor, filled at `CIRCLE_OPACITY` = 0.3, no outline) is centred on the arrow so the cursor looks centred in it. The low opacity keeps text and controls under the circle readable. The real pointer is not in the screen capture, so the cursor is always an arrow. Coordinates: Click positions are global points; a display's `bounds` are in points and may be negative (displays left of or above the primary).
- Displays are numbered and sized in `naming.ts`; `markerGeometry.ts` has no `sharp` import so it stays unit-testable.

### `shortcut.ts`

Registers `Control+Alt+Command+R` with `globalShortcut`. `registerToggleShortcut` returns `false` when another app already owns it; the recorder then reports `shortcutOk: false` and the UI says to use the button.

## Tests

| Module                           | Test file                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `permissions.ts`                 | [`tests/permissions.test.ts`](../../tests/permissions.test.ts)                     |
| `settings.ts`, `outputFolder.ts` | [`tests/settings.test.ts`](../../tests/settings.test.ts) (real temporary folders)  |
| `recorder.ts`                    | [`tests/recorder.test.ts`](../../tests/recorder.test.ts) (fake timers)             |
| `click.ts`                       | [`tests/click.test.ts`](../../tests/click.test.ts)                                 |
| `capture.ts`                     | [`tests/capture.test.ts`](../../tests/capture.test.ts)                             |
| `naming.ts`                      | [`tests/naming.test.ts`](../../tests/naming.test.ts)                               |
| `markerGeometry.ts`              | [`tests/markerGeometry.test.ts`](../../tests/markerGeometry.test.ts)               |
| `marker.ts`                      | [`tests/marker.test.ts`](../../tests/marker.test.ts) (checks real rendered pixels) |

Not unit-tested, because they call Electron or the OS directly: `index.ts`, `ipc.ts`, `permissionsElectron.ts`, `screenAccess.ts`, `clickListener.ts`, `captureElectron.ts`, `shortcut.ts`. They are covered by the manual checklist in [plans/MVP_PLAN.md](../../plans/MVP_PLAN.md).

## Debugging

Launch through `open` so macOS attributes permissions to the app and not to your shell:

```bash
open -n --env TUTO_DEBUG=1 --stdout /tmp/tuto.log --stderr /tmp/tuto.log dist/mac-arm64/tuto-record.app
```

With `TUTO_DEBUG=1` the app logs the result of the Screen Recording request and one `CAPTURE x,y <files>` line per Capture.

## Adding something

- **New command from the UI:** follow [Changing the contract](../shared/README.md#changing-the-contract); the handler goes in `ipc.ts`.
- **New behaviour that needs Electron:** write it as a module with injected dependencies, put the Electron glue in a thin file, and test the module with fakes.
- **Windows:** `permissions.ts` already reports everything granted off macOS; the Dock badge (`app.dock?`) and the Dock-click rule need a taskbar equivalent.
