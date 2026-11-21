import type { ProjectNode, TutorialRef } from '../../../shared/ipc'

/** What is being typed in the sidebar, if anything. */
export type Editing =
  | { kind: 'new-project' }
  | { kind: 'new-tutorial'; project: string }
  | { kind: 'rename-project'; project: string }
  | { kind: 'rename-tutorial'; ref: TutorialRef }
  | null

/** The text being typed and what is wrong with it. */
export interface Draft {
  value: string
  error: string | null
}

export interface SidebarRow {
  kind: 'project' | 'tutorial' | 'new-project' | 'new-tutorial'
  /** Stable across polls, so the DOM can reuse the row's elements. */
  key: string
  name: string
  depth: 0 | 1
  /** The Project the row belongs to (its own name for a Project row). */
  project: string
  expanded?: boolean
  selected?: boolean
  /** Present when this row is an editable name field. */
  editing?: Draft
}

/** Keys of the editable rows. A rename keeps the key of the row it renames. */
export const NEW_PROJECT_KEY = 'new-project'
export const newTutorialKey = (project: string): string => `new-tutorial/${project}`
export const projectKey = (project: string): string => `project/${project}`
export const tutorialKey = (ref: TutorialRef): string => `tutorial/${ref.project}/${ref.tutorial}`

const isSelected = (selected: TutorialRef | null, project: string, tutorial: string): boolean =>
  selected !== null && selected.project === project && selected.tutorial === tutorial

/**
 * Turns the tree into the sidebar's rows, top to bottom. Order comes from main (newest first).
 * A new Project row goes first; a new Tutorial row goes first inside its Project, which is
 * shown expanded for it. Expanded names that no longer exist are ignored.
 */
export function buildSidebarRows(
  tree: ProjectNode[],
  expanded: string[],
  selected: TutorialRef | null,
  editing: Editing,
  draft: Draft
): SidebarRow[] {
  const rows: SidebarRow[] = []
  if (editing?.kind === 'new-project') {
    rows.push({
      kind: 'new-project',
      key: NEW_PROJECT_KEY,
      name: '',
      depth: 0,
      project: '',
      editing: draft
    })
  }
  for (const project of tree) {
    const renaming = editing?.kind === 'rename-project' && editing.project === project.name
    const addingHere = editing?.kind === 'new-tutorial' && editing.project === project.name
    const isExpanded = addingHere || expanded.includes(project.name)
    rows.push({
      kind: 'project',
      key: projectKey(project.name),
      name: project.name,
      depth: 0,
      project: project.name,
      expanded: isExpanded,
      ...(renaming ? { editing: draft } : {})
    })
    if (!isExpanded) continue
    if (addingHere) {
      rows.push({
        kind: 'new-tutorial',
        key: newTutorialKey(project.name),
        name: '',
        depth: 1,
        project: project.name,
        editing: draft
      })
    }
    for (const tutorial of project.tutorials) {
      const ref = { project: project.name, tutorial: tutorial.name }
      const renamingThis =
        editing?.kind === 'rename-tutorial' &&
        editing.ref.project === project.name &&
        editing.ref.tutorial === tutorial.name
      rows.push({
        kind: 'tutorial',
        key: tutorialKey(ref),
        name: tutorial.name,
        depth: 1,
        project: project.name,
        selected: isSelected(selected, project.name, tutorial.name),
        ...(renamingThis ? { editing: draft } : {})
      })
    }
  }
  return rows
}

/** The names an edited name must not collide with, and the item's own name when renaming. */
export function editingSiblings(
  tree: ProjectNode[],
  editing: Exclude<Editing, null>
): { siblings: string[]; current?: string } {
  const projects = tree.map((p) => p.name)
  const tutorialsOf = (name: string): string[] =>
    tree.find((p) => p.name === name)?.tutorials.map((t) => t.name) ?? []
  switch (editing.kind) {
    case 'new-project':
      return { siblings: projects }
    case 'rename-project':
      return { siblings: projects, current: editing.project }
    case 'new-tutorial':
      return { siblings: tutorialsOf(editing.project) }
    case 'rename-tutorial':
      return { siblings: tutorialsOf(editing.ref.project), current: editing.ref.tutorial }
  }
}

/** What the sidebar shows when it has no rows. */
export function sidebarEmptyMessage(hasProjectsFolder: boolean, rowCount: number): string | null {
  if (!hasProjectsFolder) return 'Choose a Projects folder in Settings.'
  if (rowCount === 0) return 'No projects yet. Create one with +.'
  return null
}
