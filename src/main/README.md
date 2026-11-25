# Main process (`src/main`)

Everything privileged lives here: permissions, the global click hook, screen capture, the Projects folder on disk, the image protocol, windows, menus and the Dock. The renderer ([`src/renderer`](../renderer/README.md)) only shows state and sends commands; it reaches this code through the typed [IPC contract](../shared/README.md) and the [preload script](../preload/README.md). Terms such as **Projects folder**, **Project**, **Group**, **Tutorial**, **Recording**, **Click**, **Capture**, **Screenshot**, **Marker** and **Watermark** are defined in [GLOSSARY.md](../../GLOSSARY.md); this document uses them in that sense.

## How it fits together

```
                ┌──────────────────────────── index.ts ────────────────────────────┐
                │ creates the services below and wires them; windows.ts owns the   │
                │ main and Settings windows, menu.ts the menus                     │
                └──────────────────────────────────────────────────────────────────┘
 permissions.ts ─────┐                                            ┌── clickListener.ts (uiohook)
 (+ permissionsElectron, screenAccess)                            │   emits Clicks (click.ts)
 settings.ts ────────┤          ┌──────────────────┐   ┌─────────┐│
 (+ folderCheck.ts)  ├─ ipc.ts ─┤ tutorialRecording├───┤ recorder├┤
 projects.ts ────────┤          │ (readiness,      │   │ state   │└── capture function ── capture.ts
 (folders, images,   │          │  Record again)   │   │ machine │    (+ captureElectron, naming,
  Trash)             │          └──────────────────┘   └────┬────┘     overlays, watermark, marker)
 confirmElectron.ts ─┘                                      │
 imageProtocol.ts ── tuto-image:// (imageUrl, thumbnails)    shortcut.ts ── stop ──┘
```

**The convention that keeps this testable:** logic lives in a plain module that takes its dependencies as an argument (`createRecorder(deps)`, `createCapturer(deps)`, `createProjectsService(deps)`, `createTutorialRecording(deps)`, `createThumbnailer(deps)`, `createPermissionService(deps)`). Modules that only touch the file system (`settings.ts`, `projects.ts`) use `fs/promises` directly and are tested against real temporary folders. A thin glue file (`*Electron.ts`, `windows.ts`, `menu.ts`, `imageProtocol.ts`, `index.ts`) supplies the real Electron or OS functions. Unit tests (`tests/`) use fakes and never import `electron`. Files that touch Electron directly are checked by hand.

## Life of a click

1. [`clickListener.ts`](clickListener.ts) gets a global `mousedown` from `uiohook-napi`; [`click.ts`](click.ts) keeps it only if it is the left button (`button === 1`) and turns it into a `ClickEvent` `{x, y, time}`.
2. [`recorder.ts`](recorder.ts) drops it if it is within 300 ms of the last counted Click, otherwise counts it, updates the Dock badge and calls the capture function.
3. [`capture.ts`](capture.ts) asks for the selected Tutorial's folder, grabs every display with one `desktopCapturer` call, resizes each image to the display's real pixel size, draws the Watermark on every image and the Marker on the clicked display's image, and writes one PNG per display.
4. The recorder pushes the new state to the main window (`recorder:state`). If the capture throws, the recorder stops with the error and `index.ts` shows a notification.

## Modules

### `index.ts` — wiring and lifecycle

Creates the services and wires them, registers IPC, the menu and the shortcut, and handles app events:

- **Top level:** `registerImageScheme()`, which Electron only accepts before the app is ready.
- **At launch:** shows the main window, and opens the Settings window too when a permission is missing or no usable Projects folder is set.
- **`activate`** (Dock icon click): when idle, shows the main window; when recording, calls `recorder.handleDockActivate()`.
- **`before-quit`**: stops the onboarding timer and releases the click hook. **`will-quit`**: unregisters the shortcut.
- Starts the permission onboarding timer (see `permissions.ts`).
- Sends a macOS notification when a Recording ends with an error.
- In dev mode sets the Dock icon to `resources/icon-mac.png` (packaged builds take it from the app bundle; see the [build resources](../../build/README.md)).

### `windows.ts` — the two windows

`createWindows()` returns `showMain()`, `openSettings()`, `hideAll()` and `sendToMain(channel, payload)`.

- **Main window** (`index.html`): 1000 × 680, at least 760 × 520. **Settings window** (`settings.html`): 520 × 640, not resizable. There is never more than one of each; asking again brings the existing one forward.
- Both run with `contextIsolation`, no Node integration and `sandbox: true`, deny `window.open`, and load `${ELECTRON_RENDERER_URL}/<page>.html` in dev or `out/renderer/<page>.html` otherwise.
- **Titles:** `Tuto-Record` and `Settings`, with ` (Development)` added in dev mode (`npm run dev`) so a dev window is not mistaken for the installed app. In dev the page is blocked from overwriting the title.
- **Icons:** on Windows and Linux the windows get `resources/icon.png`; macOS takes the icon from the app bundle.
- `hideAll()` is what the recorder calls on Start, so the Settings window never ends up in a Screenshot either.

### `menu.ts` — menus

- `installMenu(openSettings)`: the application menu with **Settings… ⌘,**. **It keeps the standard Edit menu on purpose:** on macOS, ⌘C, ⌘V, ⌘A and ⌘Z in text fields (the sidebar's name fields) only work through the Edit menu's roles.
- `showRowActions(sender, x, y)`: the native ⋯ menu of a sidebar row (Rename, Move to Trash), and `showCreateActions(sender, x, y)`: the native + menu of a Project or Group row (New Tutorial, New Group). Both resolve to the choice, or `null` when the menu closes without one.

### `ipc.ts` — the renderer's door

`registerIpc(services)` registers every `ipcMain.handle` and checks the shape of everything coming from the renderer (strings are strings, paths are non-empty lists of names, kinds are `tutorial` or `group`, points are numbers). It forwards to the services, adds the confirmations for anything that moves files to the Trash, and keeps the settings in step after a rename, a move or a trash (`followMove`, `forget`). Paths and names are checked a second time by `projects.ts`. The channels and payloads are listed in the [shared contract](../shared/README.md); the one push (`recorder:state`) is sent from `index.ts`.

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
- Screen Recording usually takes effect only after a relaunch; the Settings window offers one.
- Permissions are tied to the code signature. Ad-hoc signatures change on every build, so after a rebuild reset them (`tccutil reset …`, see [Troubleshooting](../README.md#troubleshooting)).

### Settings

| File                               | Role                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`settings.ts`](settings.ts)       | `createSettingsService(filePath)`: reads and writes `settings.json` in `userData`. Writes go to a temporary file first, then `rename`. |
| [`folderCheck.ts`](folderCheck.ts) | `checkFolder(path)`: `null` if the folder exists and is writable, otherwise a short message.                                           |

The file holds `{ "projectsFolder": string | null, "selectedTutorial": string[] | null, "expanded": string[] }`. `selectedTutorial` is the Tutorial's **path** (folder names from the Project down, see [`paths.ts`](../shared/README.md#paths-pathsts)); `expanded` holds the keys (paths joined with `/`) of the expanded Projects and Groups.

- **Each field is checked on its own** (`parseSettings`): a malformed field falls back to its default without touching the others. A missing or corrupt file means defaults. A v0.1 file (`{ "outputFolder": … }`) also means defaults: the old folder is deliberately not carried over. **A v0.2 file is read into the current shape**: `selectedTutorial: { project, tutorial }` becomes `[project, tutorial]` and `expandedProjects` becomes `expanded` (Project names are already valid keys).
- **`get()` re-checks on every call**: the Projects folder (`projectsFolderProblem`), and whether the selected Tutorial's folder still exists (`selectedTutorial` reads as `null` when it does not). So a folder deleted in Finder is noticed by the UI poll, by the readiness check and by every Capture. `get()` never writes.
- **`setProjectsFolder`** clears the selection and the expanded list, because they named folders in the old one.
- **`followMove(from, to)`** (after a rename or a move in the app) and **`forget(path)`** (after trashing) keep the selection and every expanded key inside that path in step. Changes made in Finder are not followed; the selection then simply reads as `null`.

### `projects.ts` — Projects, Groups, Tutorials and images on disk

`createProjectsService({ getRoot, trash })`. The folders are the record of what exists ([ADR 0002](../../docs/adr/0002-folders-are-the-only-record.md)): every visible subfolder of the Projects folder is a Project, and inside a Project every visible subfolder is a **Group** or a **Tutorial**, nested to any depth. A folder's name is its name. Everything is addressed by its **path**, the folder names from the Project down (`['Python', 'Setup', 'Install']`).

**Group or Tutorial** ([ADR 0003](../../docs/adr/0003-groups-are-marked-with-a-hidden-file.md)), decided by `classify(folder)` in this order:

1. it holds the hidden file `.tuto-group` (`GROUP_TAG`) → Group;
2. it holds an image file → Tutorial, and its subfolders are ignored (as in v0.2, so screenshots never disappear);
3. it holds a visible, non-link subfolder → Group (so nested folders made in Finder work);
4. otherwise (empty, or only other files) → Tutorial.

Groups created in the app get the tag, so an empty new Group is not mistaken for an empty Tutorial. v0.2 data needs no migration.

| Function                                                | What it does                                                                                                                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listTree()`                                            | Every Project and what it holds, recursively. At each level **Groups first, then Tutorials**, each **newest first** by folder creation time (then by name).                                                                         |
| `createProject(name)`, `createItem(parent, kind, name)` | `mkdir` with the trimmed name inside the Projects folder, or inside a Project or Group; a Group also gets its tag (if writing the tag fails, the folder is removed again). Returns `{ error }` for an invalid or already used name. |
| `rename(path, to)`                                      | Any Project, Group or Tutorial; a case-only change ("git" → "Git") is allowed.                                                                                                                                                      |
| `countTutorials(path)`, `trash(path)`                   | Tutorials at any depth inside a Project or Group (for the confirmation message); the folder to the Trash.                                                                                                                           |
| `move(path, destination)`                               | Moves a Tutorial or Group into a Project or Group (see below).                                                                                                                                                                      |
| `tutorialPath(path)`                                    | The Tutorial's folder, or throws when the path is not an existing Tutorial.                                                                                                                                                         |
| `listImages(path)`                                      | Image files directly in the Tutorial folder, sorted by name (numbers in names compared as numbers), each with a `version` (its modified time).                                                                                      |
| `imagePath(path, file)`, `trashImage`, `trashAllImages` | One listed image's path; one image or all of them to the Trash (all: one at a time, stopping at the first failure).                                                                                                                 |

**`move`** refuses, in order: a Project ("Projects can't be moved."); a path or destination that does not exist; a destination that is a Tutorial; a destination inside the item itself ("A Group can't go inside itself."). Moving onto the current parent does nothing. A name already used at the destination (ignoring case) is refused with "That name is already used in "…"."; otherwise the folder is renamed into place. `EXDEV` becomes "Can't move between disks."

Rules:

- **Nothing outside the Projects folder can be reached.** A path is resolved one name at a time: each must be an existing, visible direct child found by `readdir` (never trusted by joining paths), so `..`, `a/b` and empty names are refused. **Symbolic links are ignored**: a linked folder is not a Project, Group or Tutorial, and a linked image is not listed, so a link can never lead outside the Projects folder.
- New names are checked with [`validateName`](../shared/README.md) (also used by the renderer for instant feedback). Names are compared **ignoring case**, because APFS is case-insensitive by default, and against files as well as folders, since `mkdir` fails on either.
- Hidden entries (names starting with `.`) are skipped everywhere; that is also why the tag file never shows up.
- What counts as an image is [`isImageFile`](../shared/README.md): png, jpg, jpeg, gif, webp, in any case.
- Recursion stops at 64 levels, as a guard; links are never followed, so there are no cycles.
- `trash` is `shell.trashItem`, passed in from `index.ts`. Nothing is ever deleted permanently.

### `tutorialRecording.ts` — the rules for recording a Tutorial

`createTutorialRecording(deps)` returns:

- **`checkReady()`**, used as the recorder's readiness check. In order: "Grant both permissions first." · "Choose a Projects folder first." · the folder's problem · "Select a Tutorial first." · "This Tutorial already has screenshots. Use Record again to replace them." A Tutorial holds the Screenshots of one Recording, so Start only works on an empty one. The renderer shows the same checks in the same order (`recorder-bar/status.ts`); main does not trust it.
- **`recordAgain()`**: asks "Move N images to the Trash and record again?", then moves every image of the selected Tutorial to the Trash, **then** starts. Cancelled → nothing happens. If trashing fails, the Recording does not start and the error goes back to the renderer. With nothing to record into, it calls Start anyway, so the recorder reports the reason the usual way.

`startRecorder` is passed as a closure (`() => recorder.start()`), because the recorder is created after this module and takes `checkReady` from it.

### `recorder.ts` — the state machine

```
idle ──start()──► starting ──(300 ms)──► recording
  ▲                  │                       │
  └── stop(error?) ──┴───────────────────────┘
```

- **`start()`** sets `starting`, awaits `checkReady()` (re-checked here, never trusted from the renderer), hides every window, then after `START_DELAY_MS` (300 ms, so the hide animation is never captured) starts the click hook.
- **Debounce:** Clicks less than `DEBOUNCE_MS` (300 ms) after the last _counted_ Click are ignored, so a double-click is one Capture.
- **`stop(error?)`** clears the timer, stops the hook, clears the badge, shows the main window and records the error. It does nothing when idle.
- **`handleShortcut()`** (⌃⌥⌘R): stops when starting or recording; when idle it only brings the main window back. **The shortcut never starts a Recording**; starting is always the Start or Record again button.
- **Capture failure** calls `stop("Capture failed: …")`.
- **Dock click (`handleDockActivate`)**: the Dock click was itself a Click and produced a Capture. If the latest counted Click is less than `DOCK_CLICK_WINDOW_MS` (1 s) old, its files are deleted (after waiting for them if still being written) and it is not counted; then the Recording stops. A position check against the display's `workArea` was rejected because an auto-hidden Dock lies inside it.
- `count` is the number of Captures (counted Clicks), kept after stopping so the window can show "Last recording: N captures".

### Click source

| File                                   | Role                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| [`click.ts`](click.ts)                 | `ClickEvent`, `ClickSource` interface and `toClick()`, the left-button filter.    |
| [`clickListener.ts`](clickListener.ts) | The real `ClickSource` on `uIOhook`. Only start it once Accessibility is granted. |

### Capture

| File                                           | Role                                                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`capture.ts`](capture.ts)                     | `createCapturer(deps)` returns `(click) => Promise<string[]>` (the saved paths).                                                                                                |
| [`captureElectron.ts`](captureElectron.ts)     | Real `desktopCapturer`, `screen`, `NativeImage` (adapted to `ImageLike`) and file writes. Also exports `removeFile`.                                                            |
| [`naming.ts`](naming.ts)                       | File names, display numbering, pixel sizes.                                                                                                                                     |
| [`markerGeometry.ts`](markerGeometry.ts)       | Which display was clicked and where the Marker goes.                                                                                                                            |
| [`marker.ts`](marker.ts)                       | The Marker as a `sharp` layer (`markerLayer`).                                                                                                                                  |
| [`watermarkGeometry.ts`](watermarkGeometry.ts) | Pure. The Watermark's sizes for a Screenshot of a given size.                                                                                                                   |
| [`watermark.ts`](watermark.ts)                 | The Watermark as a `sharp` layer. `createWatermark({ loadLogo, enabled? })` returns `(size) => Promise<layer \| null>`; also holds its colours, opacities, text and off switch. |
| [`overlays.ts`](overlays.ts)                   | `createOverlays({ watermark })` returns `(png, size, marker) => Promise<Buffer>`: draws both layers in one pass.                                                                |

How a Capture is made:

- **The folder is the selected Tutorial's**, looked up for every Capture (`getFolder`). If the Tutorial is renamed or deleted in Finder mid-Recording, the next Capture fails and the Recording stops with the error. Missing folders are **not** created: re-creating a Tutorial the user deleted would be wrong.
- **One `getSources` call for all displays.** Its thumbnail size is the largest display's pixel size (points × scale factor). Smaller displays come back scaled to fit that box, so each image is resized to its own real pixel size when it differs.
- **Matching:** a source belongs to a display when `source.display_id === String(display.id)`.
- **File names:** `YYYY-MM-DD_HH-mm-ss-SSS_d<N>.png`, local time of the Click. `d1` is the primary display; the others follow left to right, then top to bottom. Sorted by name they come out in Click order, which is the order the preview shows.
- **All or nothing:** if any display fails (empty image, missing source, write error, Watermark or Marker error), the files already written for that Capture are removed and the error is thrown.
- **Marker:** only the clicked display's image gets one, a translucent red circle plus an arrow cursor with a white outline. The cursor's tip is the Click position; the circle (24 pt radius multiplied by the scale factor, filled at `CIRCLE_OPACITY` = 0.3, no outline) is centred on the arrow so the cursor looks centred in it. The low opacity keeps text and controls under the circle readable. The real pointer is not in the screen capture, so the cursor is always an arrow. Coordinates: Click positions are global points; a display's `bounds` are in points and may be negative (displays left of or above the primary).
- **Watermark:** every Screenshot gets one, in the bottom-right corner: the camera logo ([`resources/watermark-logo.png`](../../resources/README.md)) and "Tuto-Record" in `#e6e6e6` at 85 % opacity, on a rounded plate of black at 45 %. It is part of the saved PNG, and no clean copy is kept.
  - **Size:** everything follows the Screenshot's shorter side: the logo is 3 % of it (at least 14 px) and the margin 2 %; the text, spacing and corners follow the logo's height ([`watermarkGeometry.ts`](watermarkGeometry.ts)).
  - **Off switch:** set `WATERMARK_ENABLED` to `false` in [`watermark.ts`](watermark.ts) and rebuild. There is deliberately no setting.
  - **Text:** it is drawn by `sharp` with the system `sans-serif` font. SVG cannot measure text, so it is rendered alone, trimmed and then placed.
  - **Logo file:** it is read with `fs`, not given to `sharp` as a path, because only Node can read inside `app.asar`.
- **One drawing pass** ([`overlays.ts`](overlays.ts)): the Watermark first, then the Marker, so the Click is never hidden. With nothing to draw, the PNG is saved as captured, without being encoded again.
- Displays are numbered and sized in `naming.ts`; `markerGeometry.ts` and `watermarkGeometry.ts` have no `sharp` import, so they stay pure.

### Preview images

The window shows a Tutorial's images through a custom scheme, `tuto-image://`, instead of `file://`, so the renderer never gets file paths or file access.

| File                                   | Role                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`imageUrl.ts`](imageUrl.ts)           | Pure. `imageUrl(size, tutorial, file, version)` → `tuto-image://<size>/<project>/<group>/…/<tutorial>/<file>?v=<version>`, each segment URI-encoded; `parseImageUrl` reverses it (at least a Project, a Tutorial and a file) and rejects anything else. |
| [`thumbnails.ts`](thumbnails.ts)       | Pure. `createThumbnailer({ render })`: resized copies, cached in memory.                                                                                                                                                                                |
| [`imageProtocol.ts`](imageProtocol.ts) | Glue. `registerImageScheme()` (before ready) and `handleImages(projects)` (inside ready): URL → `parseImageUrl` → `projects.imagePath` → thumbnail.                                                                                                     |

- **Sizes:** `thumb` is 320 px wide (the strip), `preview` 1600 px wide (the large view); never enlarged. Rendered with `sharp` as WebP (quality 90). A Retina Screenshot is several MB, so the window never loads the original.
- **Cache:** by path, version and size, at most 300 entries (least recently used dropped first), at most 4 renders at a time, and a request for an image that is already rendering shares that render. A failed render is not cached.
- **Versions:** the URL carries the file's modified time, so an image edited in Finder gets a new URL and is never shown stale.
- **Safety:** a URL that does not parse, or a file that `projects.imagePath` does not accept, gets a 404 that never mentions a path. The scheme is registered as `standard` and `secure`; the main window's CSP allows it in `img-src`.

### `confirmElectron.ts`

`confirm({ message, detail, confirmLabel })`: a native warning dialog on the focused window with `[confirmLabel, 'Cancel']`. **Cancel is the default button**, so Return never moves anything to the Trash by accident.

### `shortcut.ts`

Registers `Control+Alt+Command+R` with `globalShortcut` (`registerStopShortcut`). It returns `false` when another app already owns the key; the recorder then reports `shortcutOk: false` and the UI says to stop with the Dock icon instead.

## Tests

| Module                          | Test file                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `permissions.ts`                | [`tests/permissions.test.ts`](../../tests/permissions.test.ts)                                           |
| `settings.ts`, `folderCheck.ts` | [`tests/settings.test.ts`](../../tests/settings.test.ts) (real temporary folders)                        |
| `projects.ts`                   | [`tests/projects.test.ts`](../../tests/projects.test.ts) (real temporary folders)                        |
| `tutorialRecording.ts`          | [`tests/tutorialRecording.test.ts`](../../tests/tutorialRecording.test.ts)                               |
| `recorder.ts`                   | [`tests/recorder.test.ts`](../../tests/recorder.test.ts) (fake timers)                                   |
| `click.ts`                      | [`tests/click.test.ts`](../../tests/click.test.ts)                                                       |
| `capture.ts`                    | [`tests/capture.test.ts`](../../tests/capture.test.ts)                                                   |
| `naming.ts`                     | [`tests/naming.test.ts`](../../tests/naming.test.ts)                                                     |
| `markerGeometry.ts`             | [`tests/markerGeometry.test.ts`](../../tests/markerGeometry.test.ts)                                     |
| `marker.ts`                     | [`tests/marker.test.ts`](../../tests/marker.test.ts) (checks real rendered pixels)                       |
| `watermarkGeometry.ts`          | [`tests/watermarkGeometry.test.ts`](../../tests/watermarkGeometry.test.ts)                               |
| `watermark.ts`                  | [`tests/watermark.test.ts`](../../tests/watermark.test.ts) (real rendered pixels and the real logo file) |
| `overlays.ts`                   | [`tests/overlays.test.ts`](../../tests/overlays.test.ts)                                                 |
| `imageUrl.ts`                   | [`tests/imageUrl.test.ts`](../../tests/imageUrl.test.ts)                                                 |
| `thumbnails.ts`                 | [`tests/thumbnails.test.ts`](../../tests/thumbnails.test.ts)                                             |

Not unit-tested, because they call Electron or the OS directly: `index.ts`, `ipc.ts`, `windows.ts`, `menu.ts`, `confirmElectron.ts`, `imageProtocol.ts`, `permissionsElectron.ts`, `screenAccess.ts`, `clickListener.ts`, `captureElectron.ts`, `shortcut.ts`. They are covered by the manual checklist in [plans/V0.2.0_PLAN.md](../../plans/V0.2.0_PLAN.md#5-testing).

## Debugging

Launch through `open` so macOS attributes permissions to the app and not to your shell:

```bash
open -n --env TUTO_DEBUG=1 --stdout /tmp/tuto.log --stderr /tmp/tuto.log dist/mac-arm64/tuto-record.app
```

With `TUTO_DEBUG=1` the app logs the permission state at launch, the result of the Screen Recording request and one `CAPTURE x,y <files>` line per Capture. Add `--env ELECTRON_ENABLE_LOGGING=1` to also get the windows' console output.

## Adding something

- **New command from the UI:** follow [Changing the contract](../shared/README.md#changing-the-contract); the handler goes in `ipc.ts`.
- **New behaviour that needs Electron:** write it as a module with injected dependencies, put the Electron glue in a thin file, and test the module with fakes.
- **Windows:** `permissions.ts` already reports everything granted off macOS; the Dock badge (`app.dock?`) and the Dock-click rule need a taskbar equivalent.
