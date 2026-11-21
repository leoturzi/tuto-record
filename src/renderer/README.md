# Renderer (`src/renderer`)

The user interface of both windows: plain TypeScript and HTML, no framework. It shows state and sends commands. It has no Node or Electron access and talks to the main process only through `window.api` ([contract](../shared/README.md), [bridge](../preload/README.md)). Main re-checks everything it is asked to do.

## Pages

| Path                             | Window                                                                             | Entry script                         |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| [`index.html`](index.html)       | Main window: the sidebar with the Projects tree, and the selected Tutorial's pane. | [`src/main.ts`](src/main.ts)         |
| [`settings.html`](settings.html) | Settings window: the Projects folder and the permission panel.                     | [`src/settings.ts`](src/settings.ts) |

Both are electron-vite inputs (`electron.vite.config.ts`). Each sets a strict Content-Security-Policy: `script-src 'self'`, `style-src 'self'`, no inline scripts or styles. The main window also allows `tuto-image:` in `img-src`, the scheme main serves the preview images on.

The entry scripts hold the state, poll main every 1.5 s, and wire the modules together. They contain no logic worth testing; that lives in the modules' view builders.

## Modules

Each folder is one part of the UI, with a pure, unit-tested view builder (data in, data out) and a thin DOM file. Its README has the details.

| Folder                                                   | Part of the UI                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`src/sidebar`](src/sidebar/README.md)                   | The Projects tree: expand and select, **+** to create, ⋯ to rename or trash, inline name fields, the Settings button. |
| [`src/tutorial-preview`](src/tutorial-preview/README.md) | The heading, the large image and the horizontal thumbnail strip, ←/→, removing a Screenshot.                          |
| [`src/recorder-bar`](src/recorder-bar/README.md)         | Start recording / Record again / Stop, Open in Finder, the status line and the recorder's messages.                   |
| [`src/settings-window`](src/settings-window/README.md)   | The Projects folder section of the Settings window.                                                                   |
| [`src/permissions`](src/permissions/README.md)           | The permission panel of the Settings window.                                                                          |
| [`src/ui`](src/ui/README.md)                             | Small DOM helpers shared by the others.                                                                               |

How they connect in the main window (`src/main.ts`): the sidebar selects a Tutorial (stored in main's settings); the preview and the recorder bar show that Tutorial; whether it is empty decides between Start and Record again. A finished Recording (`recorder:state` back to `idle`) reloads the images at once and selects the first.

## Styles

All styling is in [`assets/`](assets), linked from the HTML: `base.css` (colour tokens with a dark variant under `prefers-color-scheme`, buttons, messages) plus one file per area (`layout.css`, `sidebar.css`, `preview.css`, `recorder-bar.css`, `settings.css`, `permissions.css`). Icons are CSS masks over inline SVG data, so they take the text colour.

## Rules

- **Logic goes in the pure view builders**, which take data and return data and are unit-tested. Keep the DOM files and the entry scripts to DOM updates and event wiring.
- **Write text with `textContent`**, never `innerHTML`. Everything shown comes from main or from constants, but the habit keeps the CSP meaningful.
- **No inline scripts or styles** (the CSP forbids them).
- **Never import CSS from TypeScript.** In dev, Vite injects imported CSS as `<style>` tags, which `style-src 'self'` blocks. Link the file from the HTML instead.
- **Don't rebuild what the user is using.** The poll re-renders every 1.5 s; the DOM files reuse elements (the sidebar by row key, the strip only when the files change), so a name being typed, the caret and the strip's scroll position survive.
- Keyboard shortcuts in the page (←/→, Delete) are ignored while a text field has focus.
- A new field the UI needs goes through the shared contract first (see [Changing the contract](../shared/README.md#changing-the-contract)).

## Tests

Each module README lists its tests. The DOM files, the entry scripts and the HTML are not unit-tested; they are covered by the manual checklist in [plans/V0.2.0_PLAN.md](../../plans/V0.2.0_PLAN.md#5-testing).
