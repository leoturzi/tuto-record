# Sidebar (`src/renderer/src/sidebar`)

The left column of the main window: the Projects tree, the **+** buttons, the ⋯ menus, the inline name fields and the Settings button.

| File                         | Role                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`treeView.ts`](treeView.ts) | Pure. `buildSidebarRows(tree, expanded, selected, editing, draft)` → rows; `editingSiblings`; `sidebarEmptyMessage`.        |
| [`sidebar.ts`](sidebar.ts)   | DOM. `createSidebar(root, handlers)` → `render(rows, emptyMessage, canCreate)`. Calls back into `main.ts` for every action. |

## Behaviour

- **Order** comes from main: Projects and Tutorials newest first. Clicking a Project expands or collapses it; clicking a Tutorial selects it. Expansion and selection are stored in main's settings.
- **Creating:** **+** next to PROJECTS adds a Project; **+** on a Project row (shown on hover) adds a Tutorial in it and expands the Project. A new row with an empty name field appears first in its list.
- **⋯** (shown on hover and on the selected row) opens main's native menu: **Rename** turns the row into a name field; **Move to Trash** asks in main, then the folder goes to the Trash.
- **Name fields:** every keystroke is checked with `validateName` against the visible siblings, and the message shows under the field (an empty field only complains on Enter). Enter commits, Esc cancels, leaving the field commits a valid changed name and cancels otherwise, like Finder. Main checks the name again and may still answer with an error, shown the same way. A new Tutorial is selected once created.
- **Empty states:** "Choose a Projects folder in Settings." without a usable folder (the **+** is disabled), "No projects yet. Create one with +." with an empty one.

## Rules

- `Editing` says which row is a field (`new-project`, `new-tutorial`, `rename-project`, `rename-tutorial`); `Draft` is its text and error. Both live in `main.ts`; the row builder only places them.
- **Rows are reused by key** (`project/<name>`, `tutorial/<project>/<name>`, `new-project`, `new-tutorial/<project>`). A row is rebuilt only when it switches between name and field, and is moved only when it is out of place, so the 1.5 s poll never steals the focus or the typed text.
- The ⋯ menu's position is the button's bottom-left corner in window coordinates.

## Tests

[`tests/treeView.test.ts`](../../../../tests/treeView.test.ts): order, expansion, selection, each editing kind, stale expanded names, siblings, empty messages.
