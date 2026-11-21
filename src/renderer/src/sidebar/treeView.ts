import type { ProjectNode, TreeNode } from '../../../shared/ipc'
import { isWithin, parentOf, pathKey, samePath, type ItemPath } from '../../../shared/paths'

/** What is being created when a new row is shown. */
export type Creating = 'project' | 'group' | 'tutorial'

/** What is being typed in the sidebar, if anything. */
export type Editing =
  { kind: 'new'; parent: ItemPath; what: Creating } | { kind: 'rename'; path: ItemPath } | null

/** The text being typed and what is wrong with it. */
export interface Draft {
  value: string
  error: string | null
}

export interface SidebarRow {
  kind: 'project' | 'group' | 'tutorial' | 'new'
  /** Stable across polls, so the DOM can reuse the row's elements. */
  key: string
  /** The item's path; for a 'new' row, the path of the container it is created in ([] for a Project). */
  path: ItemPath
  name: string
  /** 0 for Projects, one more per level. */
  depth: number
  expanded?: boolean
  selected?: boolean
  /** Present when this row is an editable name field. */
  editing?: Draft
  /** For a 'new' row: what is being created. */
  creating?: Creating
}

export const newRowKey = (parent: ItemPath): string => `new:${pathKey(parent)}`

/**
 * Turns the tree into the sidebar's rows, top to bottom. Order comes from main (Groups first, then
 * Tutorials, each newest first). A new row goes first among its siblings, and the container it is
 * created in is shown expanded. Expanded keys that no longer exist are ignored.
 */
export function buildSidebarRows(
  tree: ProjectNode[],
  expanded: string[],
  selected: ItemPath | null,
  editing: Editing,
  draft: Draft
): SidebarRow[] {
  const rows: SidebarRow[] = []
  const open = new Set(expanded)
  const addingTo = editing?.kind === 'new' ? pathKey(editing.parent) : null

  function newRow(parent: ItemPath, depth: number): void {
    if (editing?.kind !== 'new' || pathKey(parent) !== addingTo) return
    rows.push({
      kind: 'new',
      key: newRowKey(parent),
      path: parent,
      name: '',
      depth,
      editing: draft,
      creating: editing.what
    })
  }

  function addChildren(children: TreeNode[], parent: ItemPath, depth: number): void {
    newRow(parent, depth)
    for (const node of children) {
      const path = [...parent, node.name]
      const key = pathKey(path)
      const renaming = editing?.kind === 'rename' && samePath(editing.path, path)
      if (node.kind === 'tutorial') {
        rows.push({
          kind: 'tutorial',
          key,
          path,
          name: node.name,
          depth,
          selected: samePath(selected, path),
          ...(renaming ? { editing: draft } : {})
        })
        continue
      }
      const isOpen = open.has(key) || key === addingTo
      rows.push({
        kind: 'group',
        key,
        path,
        name: node.name,
        depth,
        expanded: isOpen,
        ...(renaming ? { editing: draft } : {})
      })
      if (isOpen) addChildren(node.children ?? [], path, depth + 1)
    }
  }

  newRow([], 0)
  for (const project of tree) {
    const path = [project.name]
    const key = pathKey(path)
    const isOpen = open.has(key) || key === addingTo
    const renaming = editing?.kind === 'rename' && samePath(editing.path, path)
    rows.push({
      kind: 'project',
      key,
      path,
      name: project.name,
      depth: 0,
      expanded: isOpen,
      ...(renaming ? { editing: draft } : {})
    })
    if (isOpen) addChildren(project.children, path, 1)
  }
  return rows
}

/** The children of the Project or Group at `path`, or [] when it does not exist. */
function childrenAt(tree: ProjectNode[], path: ItemPath): TreeNode[] {
  let children: TreeNode[] | undefined = tree.find((p) => p.name === path[0])?.children
  for (const name of path.slice(1)) {
    children = children?.find((n) => n.name === name && n.kind === 'group')?.children
  }
  return children ?? []
}

/** The names an edited name must not collide with, and the item's own name when renaming. */
export function editingSiblings(
  tree: ProjectNode[],
  editing: Exclude<Editing, null>
): { siblings: string[]; current?: string } {
  const namesIn = (parent: ItemPath): string[] =>
    parent.length === 0 ? tree.map((p) => p.name) : childrenAt(tree, parent).map((n) => n.name)
  if (editing.kind === 'new') return { siblings: namesIn(editing.parent) }
  return {
    siblings: namesIn(parentOf(editing.path)),
    current: editing.path[editing.path.length - 1]
  }
}

/**
 * Whether `source` (a Tutorial or Group row) may be dropped onto `target` (a Project or Group row).
 * Not: Projects or new rows as the source; Tutorials or new rows as the target; a Group into itself
 * or anything inside it; the item's current parent (nothing would change). A name already used at
 * the destination is left to main, which has the full list.
 */
export function canDrop(source: SidebarRow, target: SidebarRow): boolean {
  if (source.kind !== 'tutorial' && source.kind !== 'group') return false
  if (target.kind !== 'project' && target.kind !== 'group') return false
  if (source.editing || target.editing) return false
  if (isWithin(target.path, source.path)) return false
  return !samePath(parentOf(source.path), target.path)
}

/** What the sidebar shows when it has no rows. */
export function sidebarEmptyMessage(hasProjectsFolder: boolean, rowCount: number): string | null {
  if (!hasProjectsFolder) return 'Choose a Projects folder in Settings.'
  if (rowCount === 0) return 'No projects yet. Create one with +.'
  return null
}
