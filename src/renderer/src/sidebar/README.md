# Sidebar (`src/renderer/src/sidebar`)

The left column of the main window: the tree of Projects, Groups and Tutorials, the **+** buttons and menus, the ⋯ menus, the inline name fields, drag and drop, and the Settings button.

| File                         | Role                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [`treeView.ts`](treeView.ts) | Pure. `buildSidebarRows(tree, expanded, selected, editing, draft)` → rows; `editingSiblings`; `canDrop(source, target)`; `sidebarEmptyMessage`. |
| [`sidebar.ts`](sidebar.ts)   | DOM. `createSidebar(root, handlers)` → `render(rows, emptyMessage, canCreate, canDrag)`. Calls back into `main.ts` for every action.            |

## Behaviour

- **The tree** comes from main: Projects newest first; inside each Project or Group, Groups first, then Tutorials, each newest first. Nesting has no limit; each level is indented 8 px (`--indent` in `sidebar.css`), just enough to show the nesting. Tutorials have no ▸ arrow and keep no space for one, so they sit close to their parent; a Tutorial next to a Group at the same level starts a little further left than the Group. Clicking a Project or Group expands or collapses it; clicking a Tutorial selects it. The expanded Projects and Groups and the selection are stored in main's settings.
- **Creating:** **+** next to PROJECTS adds a Project. **+** on a Project or Group row (shown on hover) opens main's native menu, **New Tutorial** or **New Group**, then shows a name field first in that container and expands it for good. A new Tutorial is selected once created; a new Group is expanded.
- **⋯** (shown on hover and on the selected row) opens main's native menu: **Rename** turns the row into a name field; **Move to Trash** asks in main (counting the Tutorials inside), then the folder goes to the Trash.
- **Name fields:** every keystroke is checked with `validateName` against the names at the same level, and the message shows under the field (an empty field only complains on Enter). Enter commits, Esc cancels, leaving the field commits a valid changed name and cancels otherwise, like Finder. Main checks the name again and may still answer with an error, shown the same way.
- **Drag and drop:** a Tutorial or Group can be dragged onto any Project or Group row, in any Project. The row that would accept it is outlined; the dragged row is dimmed. Resting on a collapsed Project or Group for 0.6 s opens it. On drop, main moves the folder; the selection and expanded Groups follow; a refusal (for example a name already used there) shows in the status line.
- **Empty states:** "Choose a Projects folder in Settings." without a usable folder (the **+** is disabled), "No projects yet. Create one with +." with an empty one.

## Rules

- **Rows are keyed by path** (`pathKey`, e.g. `Python/Setup/Install`; a new row is `new:<parent key>`). A row is rebuilt only when it switches between name and field, and is moved only when it is out of place, so the 1.5 s poll never steals the focus or the typed text. A row whose kind changes (a Tutorial becoming a Group in Finder) keeps its element; its icon and class are updated.
- `Editing` is `{ kind: 'new', parent, what }` or `{ kind: 'rename', path }`; `Draft` is the text and its error. Both live in `main.ts`; the row builder only places them.
- **Drop rules** (`canDrop`): only Tutorials and Groups are dragged, never Projects or rows being edited; only Project and Group rows accept a drop; a Group cannot go into itself or anything inside it; dropping onto the current parent is not offered. A name clash is left to main, which knows every name at the destination even when it is collapsed.
- **Only the sidebar's own drags are accepted**: `dragstart` sets a private type (`application/x-tuto-item`), and `dragover` accepts only that, so files dragged in from Finder or other apps are ignored. Dragging is off while a name is being edited or a Recording runs.
- **Indentation** is set with `element.style.setProperty('--depth', …)` and used by `sidebar.css`. The CSP (`style-src 'self'`) blocks `style` attributes in markup but allows the CSSOM.
- The menus' position is the button's bottom-left corner in window coordinates.

## Tests

[`tests/treeView.test.ts`](../../../../tests/treeView.test.ts): rows at depth, expansion per level, selection, stale keys, new and rename rows, siblings, every drop rule, empty messages. Drag and drop itself is DOM work and is checked by hand.
