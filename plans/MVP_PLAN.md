# tuto-record — MVP Plan (v0.1)

A desktop app that saves a Screenshot of every display each time the user Clicks, into an Output folder the user picks, so the Clicks can later be turned into a step-by-step tutorial.

- **Framework:** Electron
- **Language:** TypeScript
- **Platform (v0.1):** macOS only (dev machine: macOS 14.5, Node 20). Windows comes later (see §11).
- **Vocabulary:** terms in **bold capitals** (Recording, Click, Capture, Screenshot, Marker, Output folder) are defined in [GLOSSARY.md](../GLOSSARY.md).
- **Decisions:** [docs/adr/](../docs/adr/)

---

## 1. Decisions (from the design grill)

| # | Topic | Decision |
|---|---|---|
| D1 | Platform | macOS only for v0.1 |
| D2 | Permissions | Prompt for Accessibility and Screen Recording at launch; **Start** is disabled until both are granted |
| D3 | Click | **Left button only**, fires on press (mouse down). Middle/right buttons and scrolling are ignored |
| D4 | Rapid clicks | Clicks less than **300 ms** apart collapse into one Capture (a double-click gives one Capture) |
| D5 | What is captured | **All displays**: one Screenshot per display for each Click, at native resolution |
| D6 | Timing | Screenshots are taken **just after** the Click (~100–300 ms later). See [ADR 0001](../docs/adr/0001-capture-just-after-click.md) |
| D7 | Marker | A translucent red circle (about 30 % opaque, no outline, so what is underneath stays readable) with an arrow cursor on top (tip at the Click position, circle centred on the arrow so it looks centred), drawn only on the clicked display's Screenshot. The screen capture does not include the real pointer, so the cursor is always an arrow, whatever the real pointer looked like |
| D8 | Format | PNG |
| D9 | Files | Saved directly in the Output folder (no subfolders), named `YYYY-MM-DD_HH-mm-ss-SSS_d<N>.png`, using the Click time |
| D10 | Output folder | Must be picked before Start works; remembered across launches |
| D11 | App shell | A normal window with a Dock icon (no menu-bar/tray app) |
| D12 | Window during Recording | Hidden, so it never appears in Screenshots |
| D13 | Start/Stop | Global shortcut **Ctrl+Option+Cmd+R** toggles Recording; the Start/Stop button in the window also works |
| D14 | Dock icon click | Stops Recording, shows the window, and **deletes the Capture made by that Dock click** |
| D15 | Indicator | The Dock icon shows a badge with the Capture count while Recording; it clears on Stop |
| D16 | Errors | If saving fails during Recording: stop Recording, show a macOS notification, bring the window back with the error |

### Out of scope for v0.1
- Windows / Linux
- Menu-bar (tray) app
- Capturing the exact moment of the Click (live-stream frame buffer, see ADR 0001)
- Window-only or region capture, annotations other than the Marker
- Exporting to a document or slideshow
- Configurable shortcut, Marker style, format or debounce time
- Auto-update, notarization, App Store distribution

---

## 2. User flows

### First launch
1. The app opens its window and checks permissions.
2. Accessibility missing → the system prompt appears and the app is added to **Privacy & Security → Accessibility**.
3. Screen Recording missing → the system prompt appears and the app is added to **Privacy & Security → Screen Recording**.
4. The window shows each permission's status with an **Open Settings** button, polls every ~1.5 s, and offers **Relaunch** when Screen Recording needs a restart to take effect.
5. The user picks an Output folder.
6. Once both permissions are granted and a folder is set, **Start** becomes enabled.

### Recording
1. The user presses **Start** or **Ctrl+Option+Cmd+R**.
2. The window hides. After ~300 ms (so the hide animation is not captured) the app starts listening for Clicks.
3. Each Click produces one Capture: one PNG per display, with a Marker on the clicked display's Screenshot. The Dock badge shows the count.
4. The user stops with **Ctrl+Option+Cmd+R** or a **Dock icon click**. The window comes back, showing how many Captures were saved and an **Open folder** button.

### Error during Recording
Recording stops, a macOS notification says what went wrong, and the window comes back with the error (for example "Output folder no longer exists", "Disk full", "Screen Recording permission was removed").

---

## 3. macOS permissions

| Need | Permission | Check | Trigger the prompt and get listed |
|---|---|---|---|
| Hear Clicks in every app | **Accessibility** | `systemPreferences.isTrustedAccessibilityClient(false)` | `systemPreferences.isTrustedAccessibilityClient(true)` shows the system dialog and adds the app to the list (switched off until the user enables it) |
| Read screen pixels | **Screen Recording** | `systemPreferences.getMediaAccessStatus('screen')` (reports `denied` both before and after the user declines) | Call CoreGraphics `CGRequestScreenCaptureAccess()` through `koffi`. On macOS 14 with Electron 44, `desktopCapturer.getSources` fails with "Failed to get sources" and never prompts or lists the app. There is no `askForMediaAccess('screen')` |

Settings deep links (via `shell.openExternal`):
- `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`
- `x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`

### Gotchas
- **One prompt at a time.** macOS drops a permission prompt that arrives while another is showing, so the app requests Accessibility first and Screen Recording only after Accessibility is granted (`requestNext()` on a 1.5 s timer).
- **In dev the lists show "Electron"** (or the terminal/IDE that launched it), not "tuto-record". The real name only appears in a packaged `.app` with its own bundle ID (`com.tuto-record.app`). Milestone M6 checks this.
- macOS ties permissions to the app's **code signature**. An ad-hoc signature changes with every build (the entry in System Settings then looks enabled but no longer matches), so after a rebuild reset and re-grant permissions. To reset stuck permissions:
  ```bash
  tccutil reset Accessibility com.tuto-record.app
  ```
  ```bash
  tccutil reset ScreenCapture com.tuto-record.app
  ```
- macOS 15+ shows recurring "allow screen recording" reminders. This is expected; mentioned in the project README.

---

## 4. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Scaffold / build | **electron-vite** (`vanilla-ts` template) | TypeScript for main, preload and renderer; keeps native modules external |
| Packaging | **electron-builder** | Handles native `.node` modules (`asarUnpack`), ad-hoc signing, `.app`/`.dmg` |
| Screen Recording prompt | **`koffi`** (FFI) | Calls `CGRequestScreenCaptureAccess`, which Electron does not expose |
| Click listener | **`uiohook-napi`** | Global mouse hook; prebuilt N-API binaries. Electron has no global mouse API |
| Screen capture | Electron **`desktopCapturer`** | Built in; one `NativeImage` per display |
| Marker drawing | **`sharp`** | Composites an SVG circle onto the PNG quickly; prebuilt binaries for macOS |
| Start/Stop shortcut | Electron **`globalShortcut`** | No extra permission needed |
| Dock badge, notifications | `app.dock.setBadge`, Electron `Notification` | Built in |
| Settings | Small JSON file in `app.getPath('userData')` | No dependency (electron-store is ESM-only) |
| Tests | **Vitest** | Unit tests for the pure logic |
| Lint/format | ESLint + Prettier | Standard |

Scaffold:
```bash
npm create @quick-start/electron@latest tuto-record -- --template vanilla-ts
```

---

## 5. Architecture

```
┌──────────────────── Main process ────────────────────┐      ┌──── Renderer (UI) ────┐
│ permissions.ts   check / prompt / poll / deep links   │      │ permission status     │
│ settings.ts      load/save Output folder              │◄IPC─►│ folder picker         │
│ clickListener.ts uiohook left mousedown → Click       │      │ Start/Stop, count     │
│ capture.ts       desktopCapturer → Screenshots        │      │ error message         │
│ marker.ts        sharp: draw circle on one PNG        │      │ Open folder           │
│ recorder.ts      state machine, debounce, Dock rule,  │      └───────────────────────┘
│                  badge, errors, file writes           │             ▲ contextBridge
│ shortcut.ts      Ctrl+Option+Cmd+R toggle             │       preload.ts (typed API)
│ index.ts         lifecycle, window, 'activate' (Dock) │
└───────────────────────────────────────────────────────┘
```

### Recorder state machine
```
idle ──Start (button/shortcut)──► starting (hide window, wait 300 ms) ──► recording
recording ──shortcut──────────────► idle (show window)
recording ──Dock click ('activate')► idle (drop the Dock-click Capture, show window)
recording ──save error────────────► idle (notification, show window with error)
```
Start is only allowed when both permissions are granted and an Output folder is set. Otherwise the shortcut just shows the window.

### Click → Capture pipeline
1. `uiohook` emits `mousedown`; keep only `button === 1` (left). Record the Click time and global position.
2. **Debounce (D4):** ignore the Click if less than 300 ms passed since the previous Click.
3. `desktopCapturer.getSources({ types: ['screen'], thumbnailSize })` with `thumbnailSize` set to the largest display's pixel size. Match each source to a display via `display_id === String(display.id)`.
4. **Display numbering:** `d1` = primary display, then the rest ordered left to right by `bounds.x`.
5. For each display, `thumbnail.toPNG()`; if a smaller display's thumbnail came back upscaled, resize it to `size × scaleFactor`.
6. **Marker (D7):** on the display containing the Click (`screen.getDisplayNearestPoint`), compute `((x − bounds.x) × scaleFactor, (y − bounds.y) × scaleFactor)` and composite a translucent red circle (24 pt radius, scaled by `scaleFactor`) and an arrow cursor with `sharp`.
7. Write every Screenshot as `<Click time>_d<N>.png` into the Output folder. Write the Capture's files in parallel; if any write fails, go to the error transition.
8. Increase the count, update the Dock badge, send `recorder:capture-saved` to the UI.

### Dock-click rule (D14)
macOS raises `app.on('activate')` when the Dock icon is clicked. While recording, on `activate`:
- if the latest counted Click was less than 1 s ago, delete that Capture's files (waiting for it first if it is still being written) and decrease the count;
- then stop Recording and show the window.

The plan first also required the Click to lie outside the display's `workArea`. That was dropped: with an auto-hidden Dock the Dock area is inside `workArea`, so the check would miss exactly those clicks.

### Security defaults
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. All privileged work happens in main behind a small typed IPC surface.

---

## 6. Project structure

```
tuto-record/
├─ GLOSSARY.md
├─ plans/MVP_PLAN.md
├─ docs/adr/
├─ package.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ tsconfig.json / tsconfig.node.json / tsconfig.web.json
├─ build/entitlements.mac.plist
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ permissions.ts
│  │  ├─ settings.ts
│  │  ├─ clickListener.ts
│  │  ├─ capture.ts
│  │  ├─ marker.ts
│  │  ├─ recorder.ts
│  │  ├─ shortcut.ts
│  │  ├─ naming.ts          # pure: filenames, display numbering
│  │  └─ ipc.ts
│  ├─ preload/index.ts
│  ├─ renderer/
│  │  ├─ index.html
│  │  └─ src/{main.ts, styles.css}
│  └─ shared/ipc.ts         # channel names + payload types
└─ tests/*.test.ts
```

### IPC contract (`src/shared/ipc.ts`)
| Channel | Direction | Payload |
|---|---|---|
| `permissions:get` | invoke | → `{ accessibility: boolean; screen: 'granted' \| 'denied' \| 'not-determined' \| 'restricted' \| 'unknown' }` |
| `permissions:open-settings` | renderer → main | `'accessibility' \| 'screen'` |
| `app:relaunch` | renderer → main | — |
| `settings:get` | invoke | → `{ outputFolder: string \| null }` |
| `settings:choose-folder` | invoke | → `string \| null` (`dialog.showOpenDialog` with `openDirectory`, `createDirectory`) |
| `recorder:start` / `recorder:stop` | invoke | → `RecorderState` |
| `recorder:state` | main → renderer | `{ state: 'idle' \| 'starting' \| 'recording'; captureCount: number; error?: string }` |
| `recorder:capture-saved` | main → renderer | `{ files: string[]; captureCount: number }` |
| `folder:open` | renderer → main | — (`shell.openPath(outputFolder)`) |

---

## 7. Milestones

Each one ends with something you can run and check.

### M0 — Scaffold (½ day)
- electron-vite `vanilla-ts`, ESLint, Prettier, Vitest. `appId: com.tuto-record.app`, `productName: tuto-record`.
- **Spike:** package an empty `.app` with `uiohook-napi` and `sharp` installed, and confirm both native modules load.
- ✅ `npm run dev` opens a window; `typecheck` and `test` pass; the spike `.app` started without native-module errors (the spike code was removed in M6: the app itself now loads both modules at startup).
- **Done (2026-11-21).** Notes: the Node on this Mac is x64 (Rosetta), so `npm install` fetched x64 binaries. The arm64 app needs the arm64 binaries too: `npm install --no-save --os=darwin --cpu=arm64 sharp` and `npm_config_arch=arm64 npx install-electron` (for dev). `npm run build:unpack` then builds `dist/mac-arm64/tuto-record.app`.

### M1 — Permissions (1 day)
- `permissions.ts` + status panel with polling, Open Settings, Relaunch. Prompts fire on `app.whenReady()` when missing.
- ✅ After `tccutil reset`, launching shows both prompts and the app (as "Electron" in dev) appears in both lists. Start stays disabled until both are granted.
- **Done and verified by hand (2026-11-21).** Logic is in `src/main/permissions.ts` (unit-tested, Electron injected), wired in `permissionsElectron.ts` and `ipc.ts`; the panel is `src/renderer`. The window now runs with `sandbox: true` and the preload exposes only `window.api`. The Start button is not part of M1 (it arrives with M3). Install `koffi`'s arm64 binary the same way as sharp: `npm install --no-save --os=darwin --cpu=arm64 koffi`. Debug logging: launch with `open -n --env TUTO_DEBUG=1 --stdout <file> dist/mac-arm64/tuto-record.app` (launching the binary directly attributes permissions to the shell, not the app).

### M2 — Settings and Output folder (½ day)
- Load/save `settings.json` with a safe fallback for a missing or corrupt file; folder picker; check the folder exists and is writable on Start.
- ✅ The chosen folder survives a restart; Start is disabled with no folder.
- **Code done (2026-11-21), manual check pending.** `settings.ts` (JSON in `userData`, atomic write, defaults on a missing or corrupt file), `outputFolder.ts` (exists and writable), IPC `settings:get`, `settings:choose-folder`, `folder:open`. The window shows the folder, **Choose folder…**, **Open folder**, any problem, and a status line ("Ready to record."). The Start button itself arrives in M3, which will use the same readiness rule (`buildStatus`). The folder is re-checked every 1.5 s, so a deleted folder shows up while the window is open.

### M3 — Recording controls (1 day)
- `clickListener.ts` (left button only, start the hook only after Accessibility is granted, stop it on `before-quit`).
- `recorder.ts` state machine, 300 ms debounce, hide window on Start with the 300 ms delay, `shortcut.ts`, Dock badge, Dock-click `activate` handling.
- ✅ Left Clicks in other apps are logged with coordinates (right clicks are not); a double-click logs once; the shortcut toggles Recording; the badge counts; a Dock click stops and shows the window.
- **Code done (2026-11-21), manual check pending.** `click.ts` + `clickListener.ts` (uiohook, left button = 1 only), `recorder.ts` (state machine: `idle` → `starting` → `recording`; 300 ms start delay; 300 ms debounce measured from the last counted Click), `shortcut.ts` (Ctrl+Option+Cmd+R), Dock badge, Dock-click stop. Start re-checks readiness in main (both permissions, folder usable). Clicks are only counted in M3; the Capture (M4) hooks in through `onClick`. Run with `TUTO_DEBUG=1` to log each counted Click as `CLICK x,y`.

### M4 — Capture and save (1 day)
- `capture.ts`: all displays, display numbering, size correction, parallel writes, error transition, Dock-click Capture removal.
- `naming.ts` unit-tested.
- ✅ Each Click saves one full-resolution PNG per display with the right names; tested with one and two displays (Retina + non-Retina if available); deleting the Output folder mid-Recording triggers the error flow.
- **Code done (2026-11-21), manual check pending.** `naming.ts` (stamp, display numbering), `capture.ts` (pure core, Electron injected), `captureElectron.ts` (`desktopCapturer`, `NativeImage`); a failed Capture removes its own partial files, stops Recording and shows a macOS notification. `count` now counts Captures.

### M5 — Marker (1 day)
- `marker.ts` with `sharp`; position maths unit-tested for display offsets and scale factors.
- Check whether `desktopCapturer` includes the mouse pointer. Either way, the Marker is drawn.
- ✅ The Marker sits exactly on the clicked spot on Retina, non-Retina and secondary displays (including displays left of or above the primary).
- **Code done (2026-11-21), manual check pending.** `markerGeometry.ts` (display lookup, position and size in pixels), `marker.ts` (sharp: a translucent red circle, 24 pt radius scaled by the display's scale factor, 30 % opaque with no outline, then the cursor with a white outline on top). Position maths and real rendered pixels are unit-tested, including displays with negative origins. The real pointer is not in the screen capture, so an arrow cursor is drawn too (always an arrow, never an I-beam or hand).

### M6 — Package and verify real permissions (½–1 day)
- electron-builder `dir` + `dmg`, `hardenedRuntime: true`, ad-hoc signing (or a stable self-signed certificate), `asarUnpack: ["**/*.node", "**/node_modules/sharp/**", "**/node_modules/@img/**"]`.
- Install to `/Applications`, reset TCC for the bundle ID, launch.
- ✅ Prompts name **tuto-record**, and **tuto-record** appears in both lists. The whole Recording flow works from the packaged app.
- **Done and verified by hand (2026-11-21).** `npm run build:mac` builds `dist/mac-arm64/tuto-record.app` and `tuto-record-0.1.0.dmg` (arm64 only; other-platform `sharp`, `koffi` and `uiohook-napi` binaries are excluded, which saves about 20 MB). `hdiutil verify` and `codesign -v` pass; the app was installed from the dmg into `/Applications` and launches from there without errors. The spike code was removed. Not notarized: a copy sent to someone else needs right-click → Open.

**Rough total: 5½–6 working days.**

---

## 8. Testing

**Unit (Vitest):** filename generation from Click time; display numbering; debounce; Marker position for offset/scaled displays; settings load/save/fallback; recorder state transitions; Dock-click rule (time and `workArea` checks).

**Manual checklist (macOS):**
- [ ] Fresh permissions: both prompts appear on first launch
- [ ] App listed in Accessibility and Screen Recording (as tuto-record in the packaged build)
- [ ] Start disabled until both permissions are granted and a folder is chosen
- [ ] Granting a permission while running updates the status; Relaunch works
- [ ] Window hides on Start and never appears in a Screenshot
- [ ] Ctrl+Option+Cmd+R starts and stops Recording
- [ ] Left Click in another app → one PNG per display, Marker on the clicked one
- [ ] Right click, middle click and scroll → nothing saved
- [ ] Double-click → one Capture
- [ ] Dock badge counts Captures and clears on Stop
- [ ] Dock icon click → Recording stops, window shows, no Screenshot of the Dock click remains
- [ ] Output folder deleted mid-Recording → Recording stops, notification, error in window
- [ ] Screen Recording permission removed mid-Recording → same error flow
- [ ] Quit while Recording → hook stopped, shortcut unregistered, no leftover process

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Dev builds get permissions as "Electron" or the terminal | Expected; verify the real name only in M6 packaged builds |
| Permissions lost after a rebuild (signature change) | Ad-hoc signatures change on every build: reset and re-grant after each rebuild (`tccutil` commands documented). A stable self-signed certificate avoids this but needs a one-time keychain "Always Allow"; revisit in M6 |
| `uiohook-napi` / `sharp` binaries missing from the packaged app | M0 packaging spike; `asarUnpack` |
| Screen Recording needs a restart | Relaunch button |
| Screenshots show the screen just after the Click | Accepted for v0.1 ([ADR 0001](../docs/adr/0001-capture-just-after-click.md)) |
| Mixed displays: thumbnails upscaled or Marker off by a scale factor | Resize to native size; unit-test Marker maths; test on 2 displays |
| Capturing all displays at Retina size is slow or large (several MB per Click) | Parallel writes; measure in M4; JPEG or "clicked display only" remain options for later |
| Shortcut already used by another app | `globalShortcut.register` returns false → show a warning in the window; Start/Stop button still works |
| Dock-click rule removes the wrong Capture | Requires both "less than 1 s ago" and "outside workArea"; covered by unit tests |

---

## 10. Next steps
1. M0: scaffold plus the native-module packaging spike.
2. M1 → M6 in order.

## 11. Later: Windows
- No permission screen on Windows: there is nothing to grant, so the app goes straight to the main window.
- `uiohook-napi`, `desktopCapturer`, `sharp` and `globalShortcut` all work on Windows; the Dock badge becomes a taskbar overlay, and the Dock-click rule needs a taskbar equivalent.
- Needs a Windows machine or VM for testing.
