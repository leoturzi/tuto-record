# Permission panel (`src/renderer/src/permissions`)

The permission section of the Settings window: one row per macOS permission with its state and an **Open Settings** button, and the Relaunch box.

| File                                       | Role                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [`permissionView.ts`](permissionView.ts)   | Pure. `buildPermissionView(status, screenWasMissing)` → labels, the relaunch hint, and whether both are granted. |
| [`permissionPanel.ts`](permissionPanel.ts) | DOM. `createPermissionPanel(root)` → `render(view)`; wires the Open Settings and Relaunch buttons.               |

## Behaviour

- Each row shows "✓ Granted" or why not ("Not granted", "Not asked yet", "Blocked by your administrator"), and **Open Settings** while it is missing. That button asks main to request the permission once, then opens its System Settings pane.
- **Relaunch hint:** [`../settings.ts`](../settings.ts) remembers whether Screen Recording was missing earlier in this run (`screenWasMissing`). If it then becomes granted, the panel asks for a relaunch, because macOS usually applies that permission only after a restart. While it is still missing, the hint says to relaunch after enabling it.
- "Both permissions are granted." shows once nothing is left to do.

The main window does not show this panel. It only shows a notice with **Open Settings** while a permission is missing ([recorder bar](../recorder-bar/README.md)).

## Tests

[`tests/permissionView.test.ts`](../../../../tests/permissionView.test.ts).
