# Shared code (`src/shared`)

Code that the main process, the preload script and the renderer all import. Because three differently sandboxed environments import it, it must stay free of runtime dependencies: no `electron`, no Node modules, no DOM, no imports outside this folder. Types, constants and small pure functions only.

| File                     | What it holds                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| [`ipc.ts`](ipc.ts)       | The IPC contract: channel names, payload types and the `TutoApi` interface that describes `window.api`. |
| [`names.ts`](names.ts)   | `validateName` and `checkNameCharacters`: the rules for Project and Tutorial names.                     |
| [`images.ts`](images.ts) | `IMAGE_EXTENSIONS` and `isImageFile`: which files in a Tutorial folder count as images.                 |

Where the two ends of the contract live:

- Main side (handlers, and the one push): [`src/main/ipc.ts`](../main/README.md) and `src/main/index.ts`.
- Preload side (`window.api`): [`src/preload`](../preload/README.md).
- Renderer side (callers): [`src/renderer`](../renderer/README.md).

## Channels

`IPC` maps a code name to a channel string. All channels but one are request/response (`ipcRenderer.invoke` → `ipcMain.handle`); `recorder:state` is pushed from main. Anything that moves files to the Trash asks for confirmation in main first and resolves to `false` when the user cancels.

| `IPC` key                      | Channel                           | Request                    | Response            | Notes                                                                                                       |
| ------------------------------ | --------------------------------- | -------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `permissionsGet`               | `permissions:get`                 | none                       | `PermissionsStatus` | Read-only; never prompts.                                                                                   |
| `permissionsOpenSettings`      | `permissions:open-settings`       | `PermissionKind`           | none                | Requests that permission once, then opens its System Settings pane. Main rejects an unknown kind.           |
| `appRelaunch`                  | `app:relaunch`                    | none                       | none                | Relaunches and exits the app.                                                                               |
| `settingsGet`                  | `settings:get`                    | none                       | `SettingsState`     | Re-checks the Projects folder and the selected Tutorial on every call.                                      |
| `settingsChooseProjectsFolder` | `settings:choose-projects-folder` | none                       | `SettingsState`     | Native folder dialog. A new folder clears the selection; cancelling returns the settings unchanged.         |
| `settingsSelectTutorial`       | `settings:select-tutorial`        | `TutorialRef \| null`      | `SettingsState`     |                                                                                                             |
| `settingsSetExpanded`          | `settings:set-expanded`           | `string[]`                 | none                | The Projects shown expanded in the sidebar.                                                                 |
| `folderOpenProjects`           | `folder:open-projects`            | none                       | none                | Opens the Projects folder in Finder; rejects if it cannot.                                                  |
| `tutorialOpenInFinder`         | `tutorial:open-in-finder`         | `TutorialRef`              | none                | Opens the Tutorial's folder in Finder.                                                                      |
| `windowOpenSettings`           | `window:open-settings`            | none                       | none                | Opens the Settings window, or brings it forward.                                                            |
| `menuRowActions`               | `menu:row-actions`                | `{ x, y }`                 | `RowAction \| null` | The native ⋯ menu at that point of the sender's window.                                                     |
| `projectsList`                 | `projects:list`                   | none                       | `ProjectNode[]`     | Newest first at both levels; `[]` without a usable Projects folder.                                         |
| `projectsCreate`               | `projects:create`                 | name                       | `NameResult`        | The new Project is added to the expanded list.                                                              |
| `projectsRename`               | `projects:rename`                 | Project, new name          | `NameResult`        | The selection and the expanded list follow.                                                                 |
| `projectsTrash`                | `projects:trash`                  | Project                    | `boolean`           | Confirms, then the whole folder goes to the Trash.                                                          |
| `tutorialsCreate`              | `tutorials:create`                | Project, name              | `NameResult`        |                                                                                                             |
| `tutorialsRename`              | `tutorials:rename`                | `TutorialRef`, new name    | `NameResult`        | The selection follows.                                                                                      |
| `tutorialsTrash`               | `tutorials:trash`                 | `TutorialRef`              | `boolean`           | Confirms, then the folder goes to the Trash.                                                                |
| `imagesList`                   | `images:list`                     | `TutorialRef`              | `ImageItem[]`       | Sorted by file name.                                                                                        |
| `imagesTrash`                  | `images:trash`                    | `TutorialRef`, file name   | `boolean`           | Confirms, then the file goes to the Trash.                                                                  |
| `recorderGetState`             | `recorder:get-state`              | none                       | `RecorderStatus`    | The current status, for the first render.                                                                   |
| `recorderStart`                | `recorder:start`                  | none                       | none                | Main re-checks readiness (including "the Tutorial is empty"); a refusal shows up in `RecorderStatus.error`. |
| `recorderRecordAgain`          | `recorder:record-again`           | none                       | none                | Confirms, moves the Tutorial's images to the Trash, then starts. Rejects if trashing fails.                 |
| `recorderStop`                 | `recorder:stop`                   | none                       | none                | No effect when idle.                                                                                        |
| `recorderState`                | `recorder:state`                  | (push, main → main window) | `RecorderStatus`    | Sent on every recorder change.                                                                              |

## Types

- **`PermissionKind`**: `'accessibility' | 'screen'`.
- **`ScreenStatus`**: `'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'`. macOS reports `denied` both before and after the user declines.
- **`PermissionsStatus`**: `{ required, accessibility, screen, allGranted }`. `required` is false off macOS, where everything is reported as granted.
- **`TutorialRef`**: `{ project, tutorial }`, the two folder names.
- **`ProjectNode`**: `{ name, tutorials: TutorialNode[] }`; **`TutorialNode`**: `{ name }`.
- **`ImageItem`**: `{ file, thumbUrl, previewUrl }`. The URLs are `tuto-image://` URLs (see [Preview images](../main/README.md#preview-images)) and change when the file changes.
- **`NameResult`**: `{ error }`, null when a create or rename worked, otherwise a short message for the inline error.
- **`RowAction`**: `'rename' | 'trash'`.
- **`SettingsState`**: `{ projectsFolder, projectsFolderProblem, selectedTutorial, expandedProjects }`. The problem is a short message, or null when the folder is usable; `selectedTutorial` is null when nothing is selected or its folder no longer exists.
- **`RecorderPhase`**: `'idle' | 'starting' | 'recording'`.
- **`RecorderStatus`**: `{ phase, count, error, shortcutOk }`. `count` is the number of Captures, kept after stopping. `error` is why the last Start or Recording failed. `shortcutOk` is false when another app owns the shortcut.
- **`TutoApi`**: what `window.api` offers the renderer. Each method corresponds to one channel above (`onRecorderStatus` subscribes to the push and returns an unsubscribe function).

## Names (`names.ts`)

`validateName(name, siblings, current?)` returns null or a short message. On the trimmed name, in this order: not empty; no `/` or `:`; does not start with `.`; at most 255 UTF-8 bytes; not equal to a sibling **ignoring case** (APFS is case-insensitive by default), except `current`, the item's own name when renaming, so "git" → "Git" is allowed. `checkNameCharacters(name)` is the same without the sibling check.

The renderer uses it for instant feedback while typing; main uses it again before touching the disk, because main never trusts the renderer.

## Images (`images.ts`)

`isImageFile(name)` is true for a visible file (not starting with `.`) whose extension is png, jpg, jpeg, gif or webp, in any case. Everything else in a Tutorial folder is ignored by the preview and left alone by Record again.

## Changing the contract

Changing `ipc.ts` touches four places, and none of them can be skipped:

1. Add or change the channel and the types here.
2. Handle it in [`src/main/ipc.ts`](../main/ipc.ts). Check the shape of anything the renderer sends; main must not trust it.
3. Expose it in [`src/preload/index.ts`](../preload/index.ts) so it matches `TutoApi`.
4. Use it from the renderer through `window.api`.

Then update the table and types above, and the README of any side whose behaviour changed.
