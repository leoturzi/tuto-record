# Shared contract (`src/shared`)

Code that the main process, the preload script and the renderer all import. At the moment that is one file, [`ipc.ts`](ipc.ts): the channel names, the payload types and the `TutoApi` interface that describes `window.api`. Because three differently sandboxed environments import it, it must stay free of runtime dependencies: no `electron`, no Node modules, no DOM. Types and constants only.

Where the two ends live:

- Main side (handlers, and the one push): [`src/main/ipc.ts`](../main/README.md) and `src/main/index.ts`.
- Preload side (`window.api`): [`src/preload`](../preload/README.md).
- Renderer side (callers): [`src/renderer`](../renderer/README.md).

## Channels

`IPC` maps a code name to a channel string. Most channels are request/response (`ipcRenderer.invoke` → `ipcMain.handle`); one is pushed from main.

| `IPC` key                 | Channel                     | Kind                  | Request          | Response            | Notes                                                                                      |
| ------------------------- | --------------------------- | --------------------- | ---------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| `permissionsGet`          | `permissions:get`           | invoke                | none             | `PermissionsStatus` | Read-only; never prompts.                                                                  |
| `permissionsOpenSettings` | `permissions:open-settings` | invoke                | `PermissionKind` | none                | Requests that permission once, then opens its Settings pane. Main rejects an unknown kind. |
| `appRelaunch`             | `app:relaunch`              | invoke                | none             | none                | Relaunches and exits the app.                                                              |
| `settingsGet`             | `settings:get`              | invoke                | none             | `SettingsState`     | Re-checks the Output folder on every call.                                                 |
| `settingsChooseFolder`    | `settings:choose-folder`    | invoke                | none             | `SettingsState`     | Opens the native folder dialog; returns the current settings unchanged if cancelled.       |
| `folderOpen`              | `folder:open`               | invoke                | none             | none                | Opens the Output folder in Finder; rejects if it cannot.                                   |
| `recorderGetState`        | `recorder:get-state`        | invoke                | none             | `RecorderStatus`    | The current status, for the first render.                                                  |
| `recorderStart`           | `recorder:start`            | invoke                | none             | none                | Main re-checks readiness; a refusal shows up in `RecorderStatus.error`.                    |
| `recorderStop`            | `recorder:stop`             | invoke                | none             | none                | No effect when idle.                                                                       |
| `recorderState`           | `recorder:state`            | push, main → renderer | none             | `RecorderStatus`    | Sent on every recorder change.                                                             |

## Types

- **`PermissionKind`**: `'accessibility' | 'screen'`.
- **`ScreenStatus`**: `'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'`. macOS reports `denied` both before and after the user declines.
- **`PermissionsStatus`**: `{ required, accessibility, screen, allGranted }`. `required` is false off macOS, where everything is reported as granted.
- **`SettingsState`**: `{ outputFolder: string | null, outputFolderProblem: string | null }`. The problem is a short message, or null when the folder is usable.
- **`RecorderPhase`**: `'idle' | 'starting' | 'recording'`.
- **`RecorderStatus`**: `{ phase, count, error, shortcutOk }`. `count` is the number of Captures, kept after stopping. `error` is why the last Start or Recording failed. `shortcutOk` is false when another app owns the shortcut.
- **`TutoApi`**: what `window.api` offers the renderer. Each method corresponds to one channel above (`onRecorderStatus` subscribes to the push and returns an unsubscribe function).

## Changing the contract

Changing this file touches four places, and none of them can be skipped:

1. Add or change the channel and the types here.
2. Handle it in [`src/main/ipc.ts`](../main/ipc.ts). Validate anything the renderer sends; main must not trust it.
3. Expose it in [`src/preload/index.ts`](../preload/index.ts) so it matches `TutoApi`.
4. Use it from the renderer through `window.api`.

Then update the table and types above, and the README of any side whose behaviour changed.
