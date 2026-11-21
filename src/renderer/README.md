# Renderer (`src/renderer`)

The window's user interface: plain TypeScript and HTML, no framework. It shows state and sends commands. It has no Node or Electron access and talks to the main process only through `window.api` ([contract](../shared/README.md), [bridge](../preload/README.md)).

## Layout

| Path                                             | Role                                                                                                                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`index.html`](index.html)                       | The page: permission panel, Output folder section, Recording section, status line. Sets a strict Content-Security-Policy (`script-src 'self'`, no inline scripts or styles). |
| [`assets/styles.css`](assets/styles.css)         | All styling. Colours are CSS variables, with a dark variant under `prefers-color-scheme`.                                                                                    |
| [`src/renderer.ts`](src/renderer.ts)             | The only file that touches the DOM and `window.api`: fetches state, renders it, wires the buttons.                                                                           |
| [`src/permissionView.ts`](src/permissionView.ts) | Pure: `PermissionsStatus` → what the permission panel shows (labels, relaunch hint, whether the panel or the ready message is shown).                                        |
| [`src/status.ts`](src/status.ts)                 | Pure: permissions and settings → the status line, and `ready` (true when recording could start).                                                                             |
| [`src/recorderView.ts`](src/recorderView.ts)     | Pure: `RecorderStatus` and `ready` → the Start/Stop button, summary, error and shortcut warning.                                                                             |

## How it works

- **Polling:** every 1.5 s `renderer.ts` fetches permissions and settings together and re-renders. That is how a permission granted in System Settings, or an Output folder deleted in Finder, shows up while the window is open.
- **Push:** the recorder status arrives through `window.api.onRecorderStatus`, plus one `getRecorderStatus()` at start-up for the first render.
- **Readiness:** the Start button is enabled only when `buildStatus(...).ready` is true (both permissions granted and the Output folder usable). This is a convenience: [main re-checks](../main/README.md#recorderts--the-state-machine) before it starts.
- **Relaunch hint:** the renderer remembers whether Screen Recording was missing earlier in this run (`screenWasMissing`). If it becomes granted, it asks for a relaunch, because macOS usually applies that permission only after a restart.
- **Screens:** the permission panel is hidden when everything is granted, and when the window comes back after a Recording it shows "Last recording: N captures".

## Rules

- **Logic goes in the pure view builders** (`permissionView.ts`, `status.ts`, `recorderView.ts`), which take data and return data and are unit-tested. Keep `renderer.ts` to DOM updates and event wiring.
- **Write text with `textContent`**, never `innerHTML`. Everything shown comes from main or from constants, but the habit keeps the CSP meaningful.
- **No inline scripts or styles** (the CSP forbids them); add styles to `styles.css`.
- A new field the UI needs goes through the shared contract first (see [Changing the contract](../shared/README.md#changing-the-contract)).

## Tests

| Module              | Test file                                                            |
| ------------------- | -------------------------------------------------------------------- |
| `permissionView.ts` | [`tests/permissionView.test.ts`](../../tests/permissionView.test.ts) |
| `status.ts`         | [`tests/status.test.ts`](../../tests/status.test.ts)                 |
| `recorderView.ts`   | [`tests/recorderView.test.ts`](../../tests/recorderView.test.ts)     |

`renderer.ts` and `index.html` are not unit-tested; they are covered by the manual checklist in [plans/MVP_PLAN.md](../../plans/MVP_PLAN.md).
