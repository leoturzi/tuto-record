# Preload script (`src/preload`)

The only bridge between the sandboxed renderer and the main process. It exposes one object, `window.api`, typed as `TutoApi` from [`src/shared/ipc.ts`](../shared/README.md), and nothing else: the renderer gets no `ipcRenderer`, no Node and no Electron objects.

| File                       | Role                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`index.ts`](index.ts)     | Builds the `api` object and publishes it with `contextBridge.exposeInMainWorld('api', api)`.           |
| [`index.d.ts`](index.d.ts) | Adds `api: TutoApi` to the global `Window` type, so the renderer is type-checked against the contract. |

## How it works

- Each method is a one-line call to `ipcRenderer.invoke(IPC.<channel>, …)`. The channels, payloads and responses are in the [shared contract](../shared/README.md).
- **`onRecorderStatus(listener)`** subscribes to the `recorder:state` push. It wraps the listener so Electron's event object never reaches the renderer, and it returns a function that removes the subscription.
- Both windows are created with `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true` (set in [`src/main/windows.ts`](../main/README.md#windowsts--the-two-windows)).

## Rules

- **Keep it thin.** No logic, no state, no validation: those belong in main. The preload only forwards calls.
- **Sandbox limits.** A sandboxed preload can only `require` `electron` and the files bundled into it (the relative import of `../shared/ipc` is bundled). Importing a package such as `@electron-toolkit/preload` fails at runtime, which is why this project does not use it.
- **Expose only what the contract lists.** Adding something here without adding it to `TutoApi` fails the type check; adding it to `TutoApi` means following the steps in [Changing the contract](../shared/README.md#changing-the-contract).
