# Recorder bar (`src/renderer/src/recorder-bar`)

The recording controls and the messages under the pane.

| File                                 | Role                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`recorderView.ts`](recorderView.ts) | Pure. `buildRecorderView(status, ready, tutorial)` → the one recording button (action, label, enabled, placement), summary, error, shortcut warning. |
| [`status.ts`](status.ts)             | Pure. `buildStatus(permissionsGranted, settings, tutorial, imageCount)` → the status line, `ready`, and whether the fix is in Settings.              |
| [`recorderBar.ts`](recorderBar.ts)   | DOM. `createRecorderBar({ act, openInFinder })` → `render(view, hasTutorial)`.                                                                       |

## Behaviour

A Tutorial holds the Screenshots of one Recording, so the button depends on what the selected Tutorial holds (`TutorialState`):

| Tutorial    | Button                                 | Where                        |
| ----------- | -------------------------------------- | ---------------------------- |
| none        | none                                   |                              |
| empty       | **Start recording**                    | the middle of the empty pane |
| has images  | **Record again** (main confirms first) | the header                   |
| (recording) | **Stop recording**                     | the header                   |

While starting, the button shows "Starting…" and is disabled. **Open in Finder** is in the header whenever a Tutorial is selected.

The status line repeats main's readiness checks in the same order (permissions, Projects folder, its problem, a selected Tutorial), then "Ready to record." or "N screenshots. Record again replaces them." When the fix is in the Settings window (`needsSettings`), the pane shows a notice with an **Open Settings** button instead of the preview. These checks are a convenience; main re-checks before it starts.

The recorder's own messages show under the status line: "Recording… N captures so far.", "Last recording: N captures.", the error that stopped the last Recording, and a warning when another app owns ⌃⌥⌘R (stop with the Dock icon instead; the shortcut never starts a Recording).

## Tests

[`tests/recorderView.test.ts`](../../../../tests/recorderView.test.ts), [`tests/status.test.ts`](../../../../tests/status.test.ts).
