# Settings window (`src/renderer/src/settings-window`)

The Projects folder section of the Settings window (`settings.html`). The permission panel below it is its own module, [`permissions`](../permissions/README.md); [`../settings.ts`](../settings.ts) polls main every 1.5 s and renders both.

| File                                 | Role                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [`settingsView.ts`](settingsView.ts) | Pure. `buildSettingsView(settings)` → path text, problem, whether Open in Finder shows, the button label.        |
| [`settingsPage.ts`](settingsPage.ts) | DOM. `createSettingsPage(root)` → `render(settings)`; wires **Choose folder… / Change…** and **Open in Finder**. |

## Behaviour

- The path of the Projects folder, or "No folder chosen yet". The button reads **Choose folder…** until one is chosen, then **Change…**.
- A problem (deleted, not writable) shows under the path, and **Open in Finder** hides.
- Choosing a different folder clears the selected Tutorial and the expanded Projects in main, since they named folders in the old one. The main window picks the change up on its next poll.
- The window opens by itself at launch while a permission is missing or no usable Projects folder is set, from the menu with **⌘,**, or from the sidebar's Settings button.

## Tests

[`tests/settingsView.test.ts`](../../../../tests/settingsView.test.ts).
